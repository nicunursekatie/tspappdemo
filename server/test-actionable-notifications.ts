/**
 * Test script to create sample actionable notifications
 * Run with: npx tsx server/test-actionable-notifications.ts
 */

import { db } from './db';
import { notifications, users, eventRequests } from '../shared/schema';
import { eq } from 'drizzle-orm';

async function createTestNotifications() {
  console.log('Creating test actionable notifications...\n');

  // Get first user
  const allUsers = await db.select().from(users).limit(5);

  if (allUsers.length === 0) {
    console.error('No users found in database. Please create a user first.');
    process.exit(1);
  }

  const testUser = allUsers[0];
  console.log(`Creating notifications for user: ${testUser.email} (ID: ${testUser.id})\n`);

  // Get a sample event request
  const events = await db
    .select()
    .from(eventRequests)
    .where(eq(eventRequests.status, 'new'))
    .limit(1);

  const sampleEvent = events[0];

  // 1. Event Request Approval Notification
  if (sampleEvent) {
    const eventNotification = await db
      .insert(notifications)
      .values({
        userId: testUser.id,
        type: 'alert',
        priority: 'high',
        title: 'New Event Request Needs Approval',
        message: `${sampleEvent.organizationName || 'An organization'} has requested an event for ${sampleEvent.preferredDate1}. Please review and approve or decline.`,
        category: 'events',
        relatedType: 'event_request',
        relatedId: sampleEvent.id,
        actionText: 'Approve',
        actionUrl: `/event-requests/${sampleEvent.id}`,
        isRead: false,
        isArchived: false,
      })
      .returning();

    console.log('✅ Created event approval notification:', {
      id: eventNotification[0].id,
      title: eventNotification[0].title,
      actionText: eventNotification[0].actionText,
      relatedType: eventNotification[0].relatedType,
      relatedId: eventNotification[0].relatedId,
    });
  }

  // 2. Task Assignment Notification
  const taskNotification = await db
    .insert(notifications)
    .values({
      userId: testUser.id,
      type: 'system_update',
      priority: 'medium',
      title: 'New Task Assigned to You',
      message: 'You have been assigned a new task: "Review volunteer applications". Click to mark as complete or view details.',
      category: 'tasks',
      relatedType: 'task',
      relatedId: 1, // Mock task ID
      actionText: 'Mark Complete',
      actionUrl: '/tasks/1',
      isRead: false,
      isArchived: false,
    })
    .returning();

  console.log('✅ Created task assignment notification:', {
    id: taskNotification[0].id,
    title: taskNotification[0].title,
    actionText: taskNotification[0].actionText,
  });

  // 3. Project Status Notification
  const projectNotification = await db
    .insert(notifications)
    .values({
      userId: testUser.id,
      type: 'reminder',
      priority: 'medium',
      title: 'Project Ready to Start',
      message: 'The "Community Outreach Q4" project has been assigned to you and is ready to begin. Click to start working on it.',
      category: 'tasks',
      relatedType: 'project',
      relatedId: 1, // Mock project ID
      actionText: 'Start Project',
      actionUrl: '/projects/1',
      isRead: false,
      isArchived: false,
    })
    .returning();

  console.log('✅ Created project notification:', {
    id: projectNotification[0].id,
    title: projectNotification[0].title,
    actionText: projectNotification[0].actionText,
  });

  // 4. Event with Decline Option
  const declineNotification = await db
    .insert(notifications)
    .values({
      userId: testUser.id,
      type: 'alert',
      priority: 'high',
      title: 'Event Request Follow-up Required',
      message: 'An event request from Springfield Elementary requires your attention. The organization has not responded to follow-ups.',
      category: 'events',
      relatedType: 'event_request',
      relatedId: sampleEvent?.id || 999,
      actionText: 'Decline',
      actionUrl: sampleEvent ? `/event-requests/${sampleEvent.id}` : '/event-requests',
      isRead: false,
      isArchived: false,
    })
    .returning();

  console.log('✅ Created decline notification:', {
    id: declineNotification[0].id,
    title: declineNotification[0].title,
    actionText: declineNotification[0].actionText,
  });

  // 5. TSP Contact Assignment
  if (sampleEvent) {
    const assignNotification = await db
      .insert(notifications)
      .values({
        userId: testUser.id,
        type: 'system_update',
        priority: 'medium',
        title: 'Assign TSP Contact Needed',
        message: `Event "${sampleEvent.organizationName}" needs a TSP contact assigned. Please assign yourself or another team member.`,
        category: 'events',
        relatedType: 'event_request',
        relatedId: sampleEvent.id,
        actionText: 'Assign TSP Contact',
        actionUrl: `/event-requests/${sampleEvent.id}`,
        isRead: false,
        isArchived: false,
      })
      .returning();

    console.log('✅ Created TSP assignment notification:', {
      id: assignNotification[0].id,
      title: assignNotification[0].title,
      actionText: assignNotification[0].actionText,
    });
  }

  console.log('\n✨ Test notifications created successfully!');
  console.log('\nTo test:');
  console.log('1. Log in as the test user');
  console.log('2. Click the bell icon to open notifications');
  console.log('3. Click the action buttons to test functionality');
  console.log('\nAction types that should work:');
  console.log('  - Approve → Updates event status to "scheduled"');
  console.log('  - Decline → Updates event status to "declined"');
  console.log('  - Mark Complete → Updates task status to "completed"');
  console.log('  - Start Project → Updates project status to "in_progress"');
  console.log('  - Assign TSP Contact → Opens form to assign contact');
}

createTestNotifications()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
