/**
 * Smart TSP Contact Follow-up Service
 *
 * Non-spammy, one-time notifications with escalation:
 *
 * 1. NEW REQUESTS (24 hours):
 *    - TSP contact assigned but toolkit not sent within 24 business hours
 *    - Send ONE reminder with deep link to event
 *    - Track to prevent duplicate sends
 *
 * 2. IN-PROCESS EVENTS (7 days):
 *    - No activity (contact logs, notes, or status change) within 7 days
 *    - Send ONE reminder
 *    - Track to prevent duplicate sends
 *
 * 3. ESCALATION:
 *    - If still no activity 3 days after first reminder, escalate to admin
 *    - CC both TSP contact and admin/coordinator
 *
 * Business Days: Excludes weekends, no reminders sent on Sat/Sun
 */

import { db } from '../db';
import { eventRequests, users, tspContactFollowups } from '@shared/schema';
import { and, eq, sql, gte, lte, isNull, or, inArray } from 'drizzle-orm';
import { logger } from '../utils/production-safe-logger';
import { getUserMetadata, getUserPhoneNumber } from '@shared/types';
import { sendTSPFollowupReminderSMS } from '../sms-service';
import { EmailNotificationService } from './email-notification-service';
import { getMissingIntakeInfo, getPrimaryContextualAction } from '@shared/event-validation-utils';
import { isNotificationSuppressed } from '../utils/notification-suppression';

const serviceLogger = {
  info: (msg: string, ...args: any[]) => logger.info(`[SmartFollowup] ${msg}`, ...args),
  warn: (msg: string, ...args: any[]) => logger.warn(`[SmartFollowup] ${msg}`, ...args),
  error: (msg: string, ...args: any[]) => logger.error(`[SmartFollowup] ${msg}`, ...args),
};

const APP_URL = process.env.PUBLIC_APP_URL ||
  (process.env.REPLIT_DOMAIN ? `https://${process.env.REPLIT_DOMAIN}` : 'https://sandwich-project-platform-final-katielong2316.replit.app');

/**
 * Check if today is a weekend (Saturday = 6, Sunday = 0)
 */
function isWeekend(date: Date = new Date()): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

/**
 * Calculate business days elapsed between two dates (excludes Sat/Sun)
 */
function getBusinessDaysElapsed(startDate: Date, endDate: Date = new Date()): number {
  let count = 0;
  const current = new Date(startDate);
  current.setHours(0, 0, 0, 0);

  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);

  while (current < end) {
    current.setDate(current.getDate() + 1);
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      count++;
    }
  }

  return count;
}

/**
 * Get calendar days elapsed (for 7-day rule)
 */
function getCalendarDaysElapsed(startDate: Date, endDate: Date = new Date()): number {
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);
  return Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

interface FollowupResult {
  notificationsSent: number;
  escalationsSent: number;
  eventsProcessed: number;
  errors: number;
  timestamp: Date;
  details: Array<{
    eventId: number;
    organization: string;
    reminderType: string;
    channel: string;
    success: boolean;
    isEscalation?: boolean;
  }>;
}

interface EventToNotify {
  event: any;
  user: any;
  reminderType: 'new_request_24h' | 'in_process_7d';
  isEscalation: boolean;
}

interface UserEventGroup {
  user: any;
  events: Array<{
    event: any;
    reminderType: 'new_request_24h' | 'in_process_7d';
    isEscalation: boolean;
  }>;
}

/**
 * Check if a notification was already sent for this event/contact/type combination
 */
async function wasNotificationSent(
  eventRequestId: number,
  tspContactUserId: string,
  reminderType: string
): Promise<boolean> {
  const existing = await db
    .select({ id: tspContactFollowups.id })
    .from(tspContactFollowups)
    .where(
      and(
        eq(tspContactFollowups.eventRequestId, eventRequestId),
        eq(tspContactFollowups.tspContactUserId, tspContactUserId),
        eq(tspContactFollowups.reminderType, reminderType)
      )
    )
    .limit(1);

  return existing.length > 0;
}

/**
 * Get the most recent notification for an event/contact
 */
async function getLastNotification(
  eventRequestId: number,
  tspContactUserId: string
) {
  const [lastNotification] = await db
    .select()
    .from(tspContactFollowups)
    .where(
      and(
        eq(tspContactFollowups.eventRequestId, eventRequestId),
        eq(tspContactFollowups.tspContactUserId, tspContactUserId),
        inArray(tspContactFollowups.reminderType, ['new_request_24h', 'in_process_7d'])
      )
    )
    .orderBy(sql`${tspContactFollowups.sentAt} DESC`)
    .limit(1);

  return lastNotification;
}

/**
 * Record that a notification was sent
 */
async function recordNotification(
  eventRequestId: number,
  tspContactUserId: string,
  reminderType: string,
  deliveryChannel: string,
  organization: string,
  eventDate: Date | null,
  messagePreview: string
): Promise<void> {
  try {
    await db.insert(tspContactFollowups).values({
      eventRequestId,
      tspContactUserId,
      reminderType,
      deliveryChannel,
      eventOrganization: organization,
      eventDate,
      messagePreview: messagePreview.substring(0, 500),
    });
  } catch (error: any) {
    if (error?.code === '23505') {
      serviceLogger.warn(`Duplicate notification record for event ${eventRequestId}, type ${reminderType}`);
    } else {
      throw error;
    }
  }
}

/**
 * Get user details for TSP contact
 */
async function getTspContactUser(userId: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return user;
}

/**
 * Get admin/coordinator user for escalations
 * TODO: Add a proper admin assignment field to events
 * For now, just get any super_admin user
 */
async function getAdminUser() {
  const [admin] = await db
    .select()
    .from(users)
    .where(eq(users.role, 'super_admin'))
    .limit(1);

  return admin;
}

/**
 * Determine the preferred notification channel for a user
 */
function getPreferredChannel(user: any): 'sms' | 'email' {
  const metadata = getUserMetadata(user);
  const smsConsent = metadata.smsConsent;

  if (smsConsent?.status === 'confirmed' && smsConsent.enabled && smsConsent.phoneNumber) {
    return 'sms';
  }

  return 'email';
}

/**
 * Check if event has had any activity (notes, contact logs, status changes)
 */
function hasRecentActivity(event: any, sinceDate: Date): boolean {
  // Check if status changed to scheduled
  if (event.status === 'scheduled') {
    return true;
  }

  // Check if last contact attempt was recent (most reliable field)
  if (event.lastContactAttempt && new Date(event.lastContactAttempt) > sinceDate) {
    serviceLogger.info(`Event ${event.id} has recent lastContactAttempt: ${event.lastContactAttempt}`);
    return true;
  }

  // Check if contact attempts were logged - handle both parsed object and JSON string
  let contactLog = event.contactAttemptsLog;
  if (typeof contactLog === 'string') {
    try {
      contactLog = JSON.parse(contactLog);
    } catch {
      contactLog = null;
    }
  }

  if (contactLog && Array.isArray(contactLog) && contactLog.length > 0) {
    const recentAttempts = contactLog.filter((attempt: any) => {
      if (!attempt.timestamp) return false;
      const attemptDate = new Date(attempt.timestamp);
      return attemptDate > sinceDate;
    });
    if (recentAttempts.length > 0) {
      serviceLogger.info(`Event ${event.id} has ${recentAttempts.length} recent contact attempts in log`);
      return true;
    }
  }

  // Check if scheduling notes were added/updated recently
  // BUT only if there's meaningful content change (not just automated timestamp updates)
  // Skip this check as it's too broad and catches automated updates
  // if (event.updatedAt && new Date(event.updatedAt) > sinceDate) {
  //   return true;
  // }

  return false;
}

/**
 * Get new requests where TSP contact assigned but toolkit not sent (24 business hours)
 */
async function getNewRequestsNeedingReminder() {
  const now = new Date();
  const events = await db
    .select()
    .from(eventRequests)
    .where(
      and(
        eq(eventRequests.status, 'new'),
        isNull(eventRequests.deletedAt),
        or(
          sql`${eventRequests.tspContact} IS NOT NULL`,
          sql`${eventRequests.tspContactAssigned} IS NOT NULL`
        ),
        or(
          eq(eventRequests.toolkitSent, false),
          isNull(eventRequests.toolkitSent)
        ),
        sql`${eventRequests.tspContactAssignedDate} IS NOT NULL`
      )
    );

  return events.filter(event => {
    if (!event.tspContactAssignedDate) return false;
    const businessDays = getBusinessDaysElapsed(event.tspContactAssignedDate);
    return businessDays >= 1; // 24 hours = 1 business day
  });
}

/**
 * Get in-process events with no activity in 7 days
 */
async function getInProcessEventsNeedingReminder() {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const events = await db
    .select()
    .from(eventRequests)
    .where(
      and(
        eq(eventRequests.status, 'in_process'),
        isNull(eventRequests.deletedAt),
        or(
          sql`${eventRequests.tspContact} IS NOT NULL`,
          sql`${eventRequests.tspContactAssigned} IS NOT NULL`
        )
      )
    );

  return events.filter(event => {
    // Check if event has been in this status for at least 7 days
    const statusDate = event.tspContactAssignedDate || event.createdAt;
    if (!statusDate) return false;

    const daysElapsed = getCalendarDaysElapsed(statusDate);
    if (daysElapsed < 7) return false;

    // Check if there's been any activity in the last 7 days
    const hasActivity = hasRecentActivity(event, sevenDaysAgo);

    if (!hasActivity) {
      serviceLogger.info(`Event ${event.id} (${event.organizationName}) flagged as needing reminder: lastContactAttempt=${event.lastContactAttempt}, contactAttemptsLog entries=${Array.isArray(event.contactAttemptsLog) ? event.contactAttemptsLog.length : 'not array'}`);
    }

    return !hasActivity;
  });
}

/**
 * Get events that need escalation (reminder sent 3+ days ago, still no activity)
 */
async function getEventsNeedingEscalation() {
  const now = new Date();
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

  const events = await db
    .select()
    .from(eventRequests)
    .where(
      and(
        or(
          eq(eventRequests.status, 'new'),
          eq(eventRequests.status, 'in_process')
        ),
        isNull(eventRequests.deletedAt),
        or(
          sql`${eventRequests.tspContact} IS NOT NULL`,
          sql`${eventRequests.tspContactAssigned} IS NOT NULL`
        )
      )
    );

  const needsEscalation = [];

  for (const event of events) {
    const tspContactId = event.tspContactAssigned || event.tspContact;
    if (!tspContactId) continue;

    // Check if there was a notification sent at least 3 days ago
    const lastNotification = await getLastNotification(event.id, tspContactId);
    if (!lastNotification) continue;

    const notificationDate = new Date(lastNotification.sentAt);
    if (notificationDate > threeDaysAgo) continue; // Not old enough yet

    // Check if escalation already sent
    const escalationSent = await wasNotificationSent(event.id, tspContactId, 'escalation');
    if (escalationSent) continue;

    // Check if there's been activity since the notification
    if (hasRecentActivity(event, notificationDate)) continue;

    needsEscalation.push(event);
  }

  return needsEscalation;
}

/**
 * Send notification to TSP contact
 */
async function sendNotification(
  event: any,
  user: any,
  reminderType: 'new_request_24h' | 'in_process_7d',
  isEscalation: boolean = false,
  adminUser?: any
): Promise<{ success: boolean; channel: string; message: string }> {
  const channel = getPreferredChannel(user);
  const userName = user.displayName || user.firstName || 'there';
  const organization = event.organizationName || 'an organization';
  const eventDate = event.scheduledEventDate || event.desiredEventDate;

  // Get contextual action for more specific messaging
  const missingInfo = getMissingIntakeInfo(event);
  const action = getPrimaryContextualAction(event);

  const eventLink = `${APP_URL}/events?id=${event.id}`;
  const contactOrganizerLink = `${APP_URL}/events/${event.id}/contact`;

  let message: string;

  if (reminderType === 'new_request_24h') {
    message = isEscalation
      ? `ESCALATION: Hi ${userName}, the new ${organization} event still needs attention. It's been 3 days with no toolkit sent. ${action ? action.label + ' is still needed.' : 'Missing info: ' + missingInfo.join(', ')}. View event: ${eventLink}`
      : `Hi ${userName}! Quick reminder: The ${organization} event was assigned to you yesterday but the toolkit hasn't been sent yet. ${action ? action.label + ' needed first.' : ''} View event: ${eventLink}`;
  } else {
    message = isEscalation
      ? `ESCALATION: Hi ${userName}, the ${organization} event (in-process) hasn't had any contact notes or activity in 10 days. ${action ? action.label + ' is needed.' : 'Needs follow-up.'} View event: ${eventLink}`
      : `Hi ${userName}! The ${organization} event hasn't had any contact notes or activity in 7 days. ${action ? action.label + ' is needed.' : 'Time for a follow-up?'} View event: ${eventLink}`;
  }

  // If escalation, also notify admin
  if (isEscalation && adminUser) {
    const adminMessage = `ESCALATION: Event ${event.id} (${organization}) assigned to ${userName} needs attention. No activity for several days. ${action ? action.label + ' needed.' : 'Review: ' + eventLink}`;
    const adminChannel = getPreferredChannel(adminUser);

    if (adminChannel === 'sms') {
      const adminPhone = getUserPhoneNumber(adminUser);
      if (adminPhone) {
        await sendTSPFollowupReminderSMS(adminPhone, adminMessage);
      }
    } else {
      await EmailNotificationService.sendEscalationEmail(
        adminUser.preferredEmail || adminUser.email,
        adminUser.displayName || adminUser.firstName || 'Admin',
        organization,
        userName,
        event.id,
        eventLink
      );
    }
  }

  if (channel === 'sms') {
    const phoneNumber = getUserPhoneNumber(user);
    if (!phoneNumber) {
      return { success: false, channel: 'sms', message: 'No phone number available' };
    }

    const result = await sendTSPFollowupReminderSMS(phoneNumber, message);
    return { success: result.success, channel: 'sms', message: result.success ? 'SMS sent' : result.message };
  } else {
    const email = user.preferredEmail || user.email;
    if (!email) {
      return { success: false, channel: 'email', message: 'No email available' };
    }

    const result = await EmailNotificationService.sendTSPFollowupReminderEmail(
      email,
      userName,
      organization,
      reminderType,
      eventDate,
      event.id
    );

    return { success: result, channel: 'email', message: result ? 'Email sent' : 'Failed to send email' };
  }
}

/**
 * Send batched SMS notification for multiple events to a single user
 * Instead of spamming with 10+ individual texts, send ONE summary message
 */
async function sendBatchedSMSNotification(
  user: any,
  events: Array<{
    event: any;
    reminderType: 'new_request_24h' | 'in_process_7d';
    isEscalation: boolean;
  }>
): Promise<{ success: boolean; message: string }> {
  const phoneNumber = getUserPhoneNumber(user);
  if (!phoneNumber) {
    return { success: false, message: 'No phone number available' };
  }

  const userName = user.displayName || user.firstName || 'there';
  
  // Group events by type
  const newRequests = events.filter(e => e.reminderType === 'new_request_24h' && !e.isEscalation);
  const inProcessEvents = events.filter(e => e.reminderType === 'in_process_7d' && !e.isEscalation);
  const escalations = events.filter(e => e.isEscalation);

  let message = `Hi ${userName}! `;
  const eventListUrl = `${APP_URL}/events?filter=my-events`;

  // Build message based on what types of events we have
  if (escalations.length > 0) {
    const escalationOrgs = escalations.slice(0, 3).map(e => e.event.organizationName || 'an event').join(', ');
    message += `ESCALATION: ${escalations.length} event${escalations.length > 1 ? 's need' : ' needs'} urgent attention (${escalationOrgs}${escalations.length > 3 ? '...' : ''}). `;
  }

  if (newRequests.length > 0) {
    if (newRequests.length === 1) {
      message += `The ${newRequests[0].event.organizationName} event was assigned yesterday but toolkit hasn't been sent. `;
    } else {
      const orgNames = newRequests.slice(0, 3).map(e => e.event.organizationName || 'event').join(', ');
      message += `${newRequests.length} new event${newRequests.length > 1 ? 's' : ''} assigned need toolkits (${orgNames}${newRequests.length > 3 ? '...' : ''}). `;
    }
  }

  if (inProcessEvents.length > 0) {
    if (inProcessEvents.length === 1) {
      message += `The ${inProcessEvents[0].event.organizationName} event hasn't had activity in 7+ days. `;
    } else {
      const orgNames = inProcessEvents.slice(0, 3).map(e => e.event.organizationName || 'event').join(', ');
      message += `${inProcessEvents.length} in-process event${inProcessEvents.length > 1 ? 's' : ''} need follow-up (${orgNames}${inProcessEvents.length > 3 ? '...' : ''}). `;
    }
  }

  message += `View your events: ${eventListUrl}`;

  // Truncate if too long for SMS (160 chars is standard, but most support up to 1600)
  if (message.length > 1500) {
    message = message.substring(0, 1450) + `... View events: ${eventListUrl}`;
  }

  const result = await sendTSPFollowupReminderSMS(phoneNumber, message);
  return { success: result.success, message: result.success ? 'Batched SMS sent' : result.message };
}

/**
 * Main function to process smart TSP follow-ups
 * 
 * SMS BATCHING: Instead of sending individual SMS per event (which can result in 10+ texts/day),
 * we now collect all events per user and send ONE batched summary SMS per user.
 * Email users still receive individual emails since those are less intrusive.
 */
export async function processSmartTspFollowups(): Promise<FollowupResult> {
  const result: FollowupResult = {
    notificationsSent: 0,
    escalationsSent: 0,
    eventsProcessed: 0,
    errors: 0,
    timestamp: new Date(),
    details: [],
  };

  try {
    serviceLogger.info('Starting smart TSP follow-up check...');

    // Skip all reminders on weekends
    if (isWeekend()) {
      serviceLogger.info('Weekend detected - skipping all follow-up reminders');
      return result;
    }

    // Collect all events that need notifications, grouped by user
    const userEventGroups: Map<string, UserEventGroup> = new Map();
    const emailNotifications: EventToNotify[] = [];

    // 1. Check new requests (24 hours without toolkit)
    const newRequestEvents = await getNewRequestsNeedingReminder();
    serviceLogger.info(`Found ${newRequestEvents.length} new requests needing reminder (24h without toolkit)`);

    // Log each event being considered for debugging
    if (newRequestEvents.length > 0) {
      serviceLogger.info(`📋 New request events being processed: ${newRequestEvents.map(e => `${e.id}:${e.organizationName}`).join(', ')}`);
    }

    for (const event of newRequestEvents) {
      result.eventsProcessed++;
      const tspContactId = event.tspContactAssigned || event.tspContact;
      if (!tspContactId) continue;

      // Skip users with suppressed event notifications (only get assignments + comments)
      if (isNotificationSuppressed(tspContactId)) continue;

      try {
        const alreadySent = await wasNotificationSent(event.id, tspContactId, 'new_request_24h');
        if (alreadySent) {
          serviceLogger.info(`Skipping event ${event.id} - new_request reminder already sent`);
          continue;
        }

        const user = await getTspContactUser(tspContactId);
        if (!user) {
          serviceLogger.warn(`TSP contact user ${tspContactId} not found for event ${event.id}`);
          continue;
        }

        const channel = getPreferredChannel(user);
        
        if (channel === 'sms') {
          // Collect for batched SMS
          if (!userEventGroups.has(user.id)) {
            userEventGroups.set(user.id, { user, events: [] });
          }
          userEventGroups.get(user.id)!.events.push({
            event,
            reminderType: 'new_request_24h',
            isEscalation: false,
          });
        } else {
          // Email users - send individual emails (less intrusive)
          emailNotifications.push({
            event,
            user,
            reminderType: 'new_request_24h',
            isEscalation: false,
          });
        }
      } catch (error) {
        result.errors++;
        serviceLogger.error(`Error collecting new request ${event.id}:`, error);
      }
    }

    // 2. Check in-process events (7 days without activity)
    const inProcessEvents = await getInProcessEventsNeedingReminder();
    serviceLogger.info(`Found ${inProcessEvents.length} in-process events needing reminder (7d without activity)`);

    // Log each in-process event being considered for debugging
    if (inProcessEvents.length > 0) {
      serviceLogger.info(`📋 In-process events being processed: ${inProcessEvents.map(e => `${e.id}:${e.organizationName}:status=${e.status}`).join(', ')}`);
    }

    for (const event of inProcessEvents) {
      result.eventsProcessed++;
      const tspContactId = event.tspContactAssigned || event.tspContact;
      if (!tspContactId) continue;

      // Skip users with suppressed event notifications (only get assignments + comments)
      if (isNotificationSuppressed(tspContactId)) continue;

      try {
        const alreadySent = await wasNotificationSent(event.id, tspContactId, 'in_process_7d');
        if (alreadySent) {
          serviceLogger.info(`Skipping event ${event.id} - in_process reminder already sent`);
          continue;
        }

        const user = await getTspContactUser(tspContactId);
        if (!user) {
          serviceLogger.warn(`TSP contact user ${tspContactId} not found for event ${event.id}`);
          continue;
        }

        const channel = getPreferredChannel(user);
        
        if (channel === 'sms') {
          // Collect for batched SMS
          if (!userEventGroups.has(user.id)) {
            userEventGroups.set(user.id, { user, events: [] });
          }
          userEventGroups.get(user.id)!.events.push({
            event,
            reminderType: 'in_process_7d',
            isEscalation: false,
          });
        } else {
          // Email users - send individual emails
          emailNotifications.push({
            event,
            user,
            reminderType: 'in_process_7d',
            isEscalation: false,
          });
        }
      } catch (error) {
        result.errors++;
        serviceLogger.error(`Error collecting in-process event ${event.id}:`, error);
      }
    }

    // 3. Check for escalations (3 days after first reminder, still no activity)
    const escalationEvents = await getEventsNeedingEscalation();
    serviceLogger.info(`Found ${escalationEvents.length} events needing escalation`);

    const admin = await getAdminUser();
    if (!admin) {
      serviceLogger.warn('No admin user found for escalations');
    }

    for (const event of escalationEvents) {
      result.eventsProcessed++;
      const tspContactId = event.tspContactAssigned || event.tspContact;
      if (!tspContactId) continue;

      // Skip users with suppressed event notifications (only get assignments + comments)
      if (isNotificationSuppressed(tspContactId)) continue;

      try {
        const user = await getTspContactUser(tspContactId);
        if (!user) {
          serviceLogger.warn(`TSP contact user ${tspContactId} not found for event ${event.id}`);
          continue;
        }

        const reminderType = event.status === 'new' ? 'new_request_24h' : 'in_process_7d';
        const channel = getPreferredChannel(user);
        
        if (channel === 'sms') {
          // Collect for batched SMS
          if (!userEventGroups.has(user.id)) {
            userEventGroups.set(user.id, { user, events: [] });
          }
          userEventGroups.get(user.id)!.events.push({
            event,
            reminderType,
            isEscalation: true,
          });
        } else {
          // Email users - send individual emails
          emailNotifications.push({
            event,
            user,
            reminderType,
            isEscalation: true,
          });
        }
      } catch (error) {
        result.errors++;
        serviceLogger.error(`Error collecting escalation for event ${event.id}:`, error);
      }
    }

    // === SEND BATCHED SMS NOTIFICATIONS ===
    // Instead of 10+ individual texts, send ONE summary SMS per user
    serviceLogger.info(`Sending batched SMS to ${userEventGroups.size} users with ${Array.from(userEventGroups.values()).reduce((sum, g) => sum + g.events.length, 0)} total events`);

    for (const [userId, group] of userEventGroups) {
      try {
        const smsResult = await sendBatchedSMSNotification(group.user, group.events);
        
        if (smsResult.success) {
          // Record each event individually in tracking table (prevents re-sending)
          for (const eventItem of group.events) {
            const tspContactId = eventItem.event.tspContactAssigned || eventItem.event.tspContact;
            const recordType = eventItem.isEscalation ? 'escalation' : eventItem.reminderType;
            const messagePreview = eventItem.isEscalation 
              ? 'Escalation (batched SMS)' 
              : `${eventItem.reminderType} reminder (batched SMS)`;
            
            await recordNotification(
              eventItem.event.id,
              tspContactId,
              recordType,
              'sms',
              eventItem.event.organizationName || 'Unknown',
              eventItem.event.scheduledEventDate || eventItem.event.desiredEventDate,
              messagePreview
            );

            result.details.push({
              eventId: eventItem.event.id,
              organization: eventItem.event.organizationName || 'Unknown',
              reminderType: eventItem.isEscalation ? 'escalation' : eventItem.reminderType,
              channel: 'sms',
              success: true,
              isEscalation: eventItem.isEscalation,
            });

            if (eventItem.isEscalation) {
              result.escalationsSent++;
            }
          }
          
          // Count as ONE notification sent (batched)
          result.notificationsSent++;
          serviceLogger.info(`Sent batched SMS to ${group.user.firstName || group.user.email} covering ${group.events.length} events`);
        } else {
          serviceLogger.error(`Failed to send batched SMS to ${group.user.firstName || group.user.email}: ${smsResult.message}`);
          result.errors++;
        }
      } catch (error) {
        result.errors++;
        serviceLogger.error(`Error sending batched SMS to user ${userId}:`, error);
      }
    }

    // === SEND INDIVIDUAL EMAIL NOTIFICATIONS ===
    // Emails are less intrusive so we can send individual ones
    serviceLogger.info(`Sending ${emailNotifications.length} individual email notifications`);

    for (const notification of emailNotifications) {
      try {
        const notificationResult = await sendNotification(
          notification.event,
          notification.user,
          notification.reminderType,
          notification.isEscalation,
          notification.isEscalation ? admin : undefined
        );

        const tspContactId = notification.event.tspContactAssigned || notification.event.tspContact;
        const recordType = notification.isEscalation ? 'escalation' : notification.reminderType;
        const messagePreview = notification.isEscalation 
          ? 'Escalation - no response to reminder' 
          : `${notification.reminderType === 'new_request_24h' ? '24h' : '7d'} reminder - ${notification.reminderType === 'new_request_24h' ? 'toolkit not sent' : 'no activity'}`;

        if (notificationResult.success) {
          await recordNotification(
            notification.event.id,
            tspContactId,
            recordType,
            notificationResult.channel,
            notification.event.organizationName || 'Unknown',
            notification.event.scheduledEventDate || notification.event.desiredEventDate,
            messagePreview
          );
          result.notificationsSent++;

          if (notification.isEscalation) {
            result.escalationsSent++;
          }
        }

        result.details.push({
          eventId: notification.event.id,
          organization: notification.event.organizationName || 'Unknown',
          reminderType: notification.isEscalation ? 'escalation' : notification.reminderType,
          channel: notificationResult.channel,
          success: notificationResult.success,
          isEscalation: notification.isEscalation,
        });
      } catch (error) {
        result.errors++;
        serviceLogger.error(`Error sending email for event ${notification.event.id}:`, error);
      }
    }

    serviceLogger.info(`Smart follow-up check complete: ${result.notificationsSent} notifications sent (${result.escalationsSent} escalations, SMS batched for ${userEventGroups.size} users), ${result.errors} errors`);

  } catch (error) {
    serviceLogger.error('Fatal error in smart TSP follow-up processing:', error);
    result.errors++;
  }

  return result;
}
