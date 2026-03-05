import { Router } from 'express';
import { StreamChat } from 'stream-chat';
import crypto from 'crypto';
import { logger } from '../utils/production-safe-logger';
import { storage } from '../storage-wrapper';
import { NotificationService } from '../notification-service';
import { getUserMetadata } from '@shared/types';
import { requirePermission } from '../middleware/auth';
import { PERMISSIONS } from '@shared/auth-utils';
import { db } from '../db';
import { notifications } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { getSocketInstance } from '../socket-chat';

export const streamRoutes = Router();

// Initialize Stream Chat server client (server-side only)
let streamServerClient: StreamChat | null = null;

const initializeStreamServer = () => {
  try {
    const apiKey = process.env.STREAM_API_KEY;
    const apiSecret = process.env.STREAM_API_SECRET;

    if (!apiKey || !apiSecret) {
      logger.log('Stream Chat credentials not found in environment variables');
      return null;
    }

    streamServerClient = StreamChat.getInstance(apiKey, apiSecret);
    return streamServerClient;
  } catch (error) {
    logger.error('Failed to initialize Stream Chat server:', error);
    return null;
  }
};

// Get Stream Chat credentials and generate user token
streamRoutes.post('/credentials', async (req, res) => {
  try {
    logger.log('=== STREAM CREDENTIALS ENDPOINT ===');
    logger.log('User from req.user:', req.user);
    logger.log('User from session:', req.session?.user);
    logger.log('Session exists:', !!req.session);
    logger.log('Session ID:', req.sessionID);

    const user = req.user || req.session?.user;
    if (!user) {
      logger.log('❌ No user found in request or session');
      return res.status(401).json({ error: 'Authentication required' });
    }

    logger.log('✅ User authenticated:', user.email);

    const apiKey = process.env.STREAM_API_KEY;
    const apiSecret = process.env.STREAM_API_SECRET;

    if (!apiKey || !apiSecret) {
      return res.status(500).json({
        error: 'Stream Chat not configured',
        message:
          'Please add STREAM_API_KEY and STREAM_API_SECRET to environment variables',
      });
    }

    // Initialize server client if not already done
    if (!streamServerClient) {
      streamServerClient = initializeStreamServer();
      if (!streamServerClient) {
        return res
          .status(500)
          .json({ error: 'Failed to initialize Stream Chat' });
      }
    }

    // Create Stream user ID based on app user ID
    const streamUserId = `user_${user.id}`;

    try {
      // Map user roles to valid Stream Chat roles
      const userRole = user.role;
      let streamRole = 'user'; // default
      
      // Map app roles to Stream Chat roles
      if (userRole === 'admin' || userRole === 'admin_coordinator' || userRole === 'super_admin') {
        streamRole = 'admin';
      } else if (userRole === 'volunteer' || userRole === 'viewer') {
        streamRole = 'user';
      }

      logger.log(`🔧 Stream Chat role mapping: ${userRole} -> ${streamRole} for user ${user.email}`);

      // Create or update user in Stream
      await streamServerClient.upsertUser({
        id: streamUserId,
        name: user.firstName && user.lastName
          ? `${user.firstName} ${user.lastName}`
          : user.fullName || user.email || 'User',
        email: user.email,
        role: streamRole,
      });

      // Also create test users for multi-user conversations
      const testUsers = [
        { id: 'test-user-2', name: 'Test User', email: 'test@example.com' },
        { id: 'admin-user', name: 'Admin User', email: 'admin@example.com' },
        { id: 'demo-user-1', name: 'Demo User 1', email: 'demo1@example.com' },
        { id: 'demo-user-2', name: 'Demo User 2', email: 'demo2@example.com' },
      ];

      for (const testUser of testUsers) {
        await streamServerClient
          .upsertUser({
            id: testUser.id,
            name: testUser.name,
            email: testUser.email,
            role: 'user',
          })
          .catch(() => {
            // Ignore if user already exists
          });
      }

      // Generate user token
      const userToken = streamServerClient.createToken(streamUserId);

      // Initialize team chat rooms based on user permissions
      const teamRooms = [
        { id: 'general', name: 'General Chat', permission: 'CHAT_GENERAL' },
        { id: 'core-team', name: 'Core Team', permission: 'CHAT_CORE_TEAM' },
        { id: 'grants-committee', name: 'Grants Committee', permission: 'CHAT_GRANTS_COMMITTEE' },
        { id: 'events-committee', name: 'Events Committee', permission: 'CHAT_EVENTS_COMMITTEE' },
        { id: 'board-chat', name: 'Board Chat', permission: 'CHAT_BOARD' },
        { id: 'web-committee', name: 'Web Committee', permission: 'CHAT_WEB_COMMITTEE' },
        { id: 'volunteer-management', name: 'Volunteer Management', permission: 'CHAT_VOLUNTEER_MANAGEMENT' },
        { id: 'host', name: 'Host Chat', permission: 'CHAT_HOST' },
        { id: 'driver', name: 'Driver Chat', permission: 'CHAT_DRIVER' },
        { id: 'recipient', name: 'Recipient Chat', permission: 'CHAT_RECIPIENT' },
      ];

      // Create team channels that the user has permission for AND add user as member
      const userPermissions = user.permissions || [];
      logger.log(`🔍 Processing channels for ${user.email}, permissions:`, userPermissions);

      for (const room of teamRooms) {
        if (userPermissions.includes(room.permission)) {
          logger.log(`✓ User has permission ${room.permission}, setting up channel ${room.id}`);
          try {
            // Get or create the channel
            const channel = streamServerClient.channel('team', room.id, {
              name: room.name,
              created_by_id: streamUserId,
            });

            // Use create() which creates if not exists, or returns existing
            await channel.create();

            // Add user as member (this works for both new and existing channels)
            try {
              await channel.addMembers([streamUserId]);
              logger.log(`✅ Added ${user.email} to channel ${room.id}`);
            } catch (addError: any) {
              // User might already be a member
              if (addError.message?.includes('already a member')) {
                logger.log(`User ${user.email} already in channel ${room.id}`);
              } else {
                logger.error(`Failed to add user to ${room.id}:`, addError.message);
              }
            }
          } catch (channelError: any) {
            logger.error(`Failed to setup channel ${room.id}:`, channelError.message);
          }
        }
      }

      res.json({
        apiKey,
        userToken,
        streamUserId,
      });
    } catch (streamError) {
      logger.error('❌ Stream Chat user creation error:', streamError);
      res.status(500).json({
        error: 'Failed to create Stream user',
        message:
          streamError.message ||
          'Check Stream Chat credentials and network connectivity',
      });
    }
  } catch (error) {
    logger.error('❌ Stream credentials error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
});

// Create a channel for messaging (DMs and group chats)
streamRoutes.post('/channels', async (req, res) => {
  try {
    const user = req.user || req.session?.user;
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { participants, channelType = 'messaging', channelName } = req.body;

    if (!streamServerClient) {
      streamServerClient = initializeStreamServer();
      if (!streamServerClient) {
        return res.status(500).json({ error: 'Stream Chat not initialized' });
      }
    }

    const streamUserId = `user_${user.id}`;

    // First, ensure all participants are registered with Stream Chat
    // We need to get user details from the database
    const { storage } = await import('../storage-wrapper');

    for (const participantId of participants) {
      try {
        const participantUser = await storage.getUser(participantId);
        if (participantUser) {
          const participantStreamId = `user_${participantId}`;
          await streamServerClient.upsertUser({
            id: participantStreamId,
            name: participantUser.firstName && participantUser.lastName
              ? `${participantUser.firstName} ${participantUser.lastName}`
              : participantUser.email,
            email: participantUser.email,
            role: 'user',
          });
          logger.log(`✅ Registered user ${participantUser.email} with Stream Chat`);
        }
      } catch (upsertError) {
        logger.error(`Failed to upsert participant ${participantId}:`, upsertError);
      }
    }

    // Create the channel with all members
    const memberIds = [streamUserId, ...participants.map((p: string) => `user_${p}`)];

    const channelData: Record<string, any> = {
      members: memberIds,
      created_by_id: streamUserId,
    };

    // Add channel name if provided (for group chats)
    if (channelName) {
      channelData.name = channelName;
    }

    const channel = streamServerClient.channel(channelType, undefined, channelData);

    await channel.create();

    res.json({
      channelId: channel.id,
      channelCid: channel.cid,
      channelType: channel.type,
      members: memberIds,
    });
  } catch (error) {
    logger.error('Channel creation error:', error);
    res.status(500).json({ error: 'Failed to create channel', message: error.message });
  }
});

/**
 * Verify Stream Chat webhook signature
 */
function verifyStreamWebhook(body: string, signature: string): boolean {
  const apiSecret = process.env.STREAM_API_SECRET;
  if (!apiSecret) {
    logger.error('STREAM_API_SECRET not configured for webhook verification');
    return false;
  }

  const expectedSignature = crypto
    .createHmac('sha256', apiSecret)
    .update(body)
    .digest('hex');

  return signature === expectedSignature;
}

/**
 * Track user online status for notifications
 * Users are considered "online" if they've been active in the last 5 minutes
 */
const userLastSeen: Map<string, number> = new Map();

// Update user's last seen timestamp when they make API calls
streamRoutes.post('/heartbeat', async (req, res) => {
  const user = req.user || req.session?.user;
  if (user?.id) {
    userLastSeen.set(`user_${user.id}`, Date.now());
  }
  res.json({ success: true });
});

/**
 * Check if a user is currently online (active in last 5 minutes)
 */
function isUserOnline(streamUserId: string): boolean {
  const lastSeen = userLastSeen.get(streamUserId);
  if (!lastSeen) return false;
  const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
  return lastSeen > fiveMinutesAgo;
}

/**
 * Stream Chat webhook endpoint for push notifications
 * This receives events from Stream Chat when messages are sent
 */
streamRoutes.post('/webhook', async (req, res) => {
  try {
    // Get raw body for signature verification
    const rawBody = JSON.stringify(req.body);
    const signature = req.headers['x-signature'] as string;

    // Verify webhook signature (optional but recommended)
    if (signature && !verifyStreamWebhook(rawBody, signature)) {
      logger.warn('⚠️ Invalid Stream Chat webhook signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const event = req.body;
    logger.log(`📨 Stream Chat webhook received: ${event.type}`);

    // Handle new message events
    if (event.type === 'message.new') {
      const message = event.message;
      const channelType = event.channel_type;
      const channelId = event.channel_id;
      const senderId = event.user?.id;
      const senderName = event.user?.name || 'Someone';
      const messageText = message?.text || '';

      // Get channel members to notify
      const members = event.members || [];

      logger.log(`💬 New message in ${channelType}:${channelId} from ${senderName}`);

      // Notify each member (except the sender)
      for (const member of members) {
        const recipientStreamId = member.user_id || member.user?.id;

        // Skip sender
        if (recipientStreamId === senderId) continue;

        // Check if user is online - if so, skip notification (they'll see it in-app)
        if (isUserOnline(recipientStreamId)) {
          logger.log(`User ${recipientStreamId} is online, skipping notification`);
          continue;
        }

        // Extract app user ID from stream user ID (format: user_<id>)
        const appUserId = recipientStreamId?.replace('user_', '');
        if (!appUserId) continue;

        try {
          // Get user from database
          const recipientUser = await storage.getUser(appUserId);
          if (!recipientUser) {
            logger.warn(`User ${appUserId} not found for notification`);
            continue;
          }

          const metadata = getUserMetadata(recipientUser);
          const notificationPrefs = metadata.notificationPreferences || {};
          const smsConsent = metadata.smsConsent;

          // Determine notification channel
          const truncatedMessage = messageText.length > 100
            ? messageText.substring(0, 100) + '...'
            : messageText;

          // Get channel/group name for context
          let channelName = 'Team Chat';
          if (channelType === 'team') {
            channelName = event.channel?.name || channelId || 'Team Chat';
          } else if (channelType === 'messaging') {
            const memberCount = members.length;
            if (memberCount === 2) {
              channelName = 'Direct Message';
            } else {
              channelName = event.channel?.name || `Group Chat (${memberCount} members)`;
            }
          }

          // Send SMS notification if user has SMS enabled
          if (smsConsent?.status === 'confirmed' && smsConsent?.enabled && smsConsent?.phoneNumber) {
            try {
              const { sendTestSMS } = await import('../sms-service');

              // Use a simpler SMS format
              const smsMessage = `TSP: New message from ${senderName} in ${channelName}: "${truncatedMessage}"`;

              // We'll reuse sendTestSMS but with our custom message
              const provider = (await import('../sms-providers/provider-factory')).SMSProviderFactory.getInstance();
              const smsProvider = await provider.getProviderAsync();

              if (smsProvider?.isConfigured()) {
                await smsProvider.sendSMS({
                  to: smsConsent.phoneNumber,
                  body: smsMessage,
                });
                logger.log(`✅ SMS notification sent to ${recipientUser.email} for new message`);
              }
            } catch (smsError) {
              logger.error(`Failed to send SMS notification to ${recipientUser.email}:`, smsError);
            }
          }
          // Otherwise send email notification
          else if (recipientUser.email) {
            try {
              await NotificationService.sendChatNotification(
                recipientUser.email,
                recipientUser.firstName || recipientUser.name || 'Team Member',
                senderName,
                channelName,
                truncatedMessage
              );
              logger.log(`✅ Email notification sent to ${recipientUser.email} for new message`);
            } catch (emailError) {
              logger.error(`Failed to send email notification to ${recipientUser.email}:`, emailError);
            }
          }

          // Create in-app notification (deduped per user+channel)
          try {
            // Check for existing unread chat_message notification for this user+channel
            const existingNotifications = await db
              .select()
              .from(notifications)
              .where(
                and(
                  eq(notifications.userId, appUserId),
                  eq(notifications.type, 'chat_message'),
                  eq(notifications.isRead, false),
                  eq(notifications.isArchived, false)
                )
              );

            // Find one matching this channel (stored in metadata)
            const existingForChannel = existingNotifications.find(
              (n) => {
                const meta = n.metadata as any;
                return meta?.channelId === channelId;
              }
            );

            const messagePreview = truncatedMessage.length > 80
              ? truncatedMessage.substring(0, 80) + '...'
              : truncatedMessage;

            if (existingForChannel) {
              // Update existing notification with latest message info
              const currentMeta = (existingForChannel.metadata as any) || {};
              const messageCount = (currentMeta.messageCount || 1) + 1;
              await db
                .update(notifications)
                .set({
                  message: `${senderName}: ${messagePreview}`,
                  title: `${messageCount} new messages in ${channelName}`,
                  metadata: {
                    ...currentMeta,
                    channelId,
                    channelName,
                    lastSenderName: senderName,
                    messageCount,
                    lastMessageAt: new Date().toISOString(),
                  },
                  createdAt: new Date(), // Bump to top of list
                })
                .where(eq(notifications.id, existingForChannel.id));
              logger.log(`✅ Updated existing in-app notification for ${appUserId} in ${channelName} (${messageCount} messages)`);
            } else {
              // Create new notification
              await storage.createNotification({
                userId: appUserId,
                type: 'chat_message',
                priority: 'low',
                title: `New message in ${channelName}`,
                message: `${senderName}: ${messagePreview}`,
                isRead: false,
                isArchived: false,
                category: 'social',
                actionUrl: `/dashboard?section=chat&channel=${channelId}`,
                metadata: {
                  channelId,
                  channelName,
                  channelType,
                  lastSenderName: senderName,
                  messageCount: 1,
                  lastMessageAt: new Date().toISOString(),
                },
              });
              logger.log(`✅ Created in-app notification for ${appUserId} in ${channelName}`);
            }

            // Emit real-time notification update via Socket.IO
            const io = getSocketInstance();
            if (io) {
              io.to(`notifications:${appUserId}`).emit('notification_update', {
                type: 'chat_message',
                channelId,
                channelName,
              });
            }
          } catch (notifError) {
            logger.error(`Failed to create in-app notification for ${appUserId}:`, notifError);
          }
        } catch (userError) {
          logger.error(`Error processing notification for user ${appUserId}:`, userError);
        }
      }
    }

    // Always respond with 200 to acknowledge receipt
    res.status(200).json({ success: true });
  } catch (error) {
    logger.error('Stream Chat webhook error:', error);
    // Still return 200 to prevent retries
    res.status(200).json({ success: false, error: 'Internal error' });
  }
});

// Team room definitions (same as client-side)
const TEAM_ROOMS = [
  { id: 'general', name: 'General Chat', permission: 'CHAT_GENERAL' },
  { id: 'core-team', name: 'Core Team', permission: 'CHAT_CORE_TEAM' },
  { id: 'grants-committee', name: 'Grants Committee', permission: 'CHAT_GRANTS_COMMITTEE' },
  { id: 'events-committee', name: 'Events Committee', permission: 'CHAT_EVENTS_COMMITTEE' },
  { id: 'board-chat', name: 'Board Chat', permission: 'CHAT_BOARD' },
  { id: 'web-committee', name: 'Web Committee', permission: 'CHAT_WEB_COMMITTEE' },
  { id: 'volunteer-management', name: 'Volunteer Management', permission: 'CHAT_VOLUNTEER_MANAGEMENT' },
  { id: 'host', name: 'Host Chat', permission: 'CHAT_HOST' },
  { id: 'driver', name: 'Driver Chat', permission: 'CHAT_DRIVER' },
  { id: 'recipient', name: 'Recipient Chat', permission: 'CHAT_RECIPIENT' },
];

/**
 * Sync all users to their appropriate Stream Chat channels based on permissions
 * This ensures member counts are accurate even if users haven't opened chat yet
 */
streamRoutes.post('/sync-members', requirePermission(PERMISSIONS.ADMIN_PANEL_ACCESS), async (req, res) => {
  try {
    const user = req.user || req.session?.user;
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!streamServerClient) {
      initializeStreamServer();
    }

    if (!streamServerClient) {
      return res.status(500).json({ error: 'Stream Chat not configured' });
    }

    logger.log('🔄 Starting Stream Chat member sync...');

    // Get all active users (exclude pending/unapproved users)
    const allUsers = await storage.getAllUsers();
    const activeUsers = allUsers.filter(u => u.isActive === true);

    logger.log(`Found ${activeUsers.length} active users to process`);

    // Debug: Log first user's permissions to understand the format
    if (activeUsers.length > 0) {
      const sampleUser = activeUsers[0];
      logger.log(`Sample user permissions for ${sampleUser.email}:`, {
        permissions: sampleUser.permissions,
        type: typeof sampleUser.permissions,
        isArray: Array.isArray(sampleUser.permissions),
      });
    }

    const results: Record<string, { added: number; errors: number; members: string[] }> = {};

    // Process each team room
    for (const room of TEAM_ROOMS) {
      results[room.id] = { added: 0, errors: 0, members: [] };

      // Get or create the channel
      const channel = streamServerClient.channel('team', room.id, {
        name: room.name,
        created_by_id: 'system',
      });

      try {
        // Use create() which creates if not exists, or returns existing
        await channel.create();
      } catch (createError: any) {
        // If channel already exists, that's fine - continue with adding members
        if (!createError.message?.includes('already exists')) {
          logger.error(`Failed to get/create channel ${room.id}:`, createError);
          continue;
        }
      }

      // Find users with permission for this room
      const eligibleUsers = activeUsers.filter(u => {
        let userPermissions = u.permissions;

        // Handle case where permissions might be a JSON string
        if (typeof userPermissions === 'string') {
          try {
            userPermissions = JSON.parse(userPermissions);
          } catch {
            return false;
          }
        }

        // Check if it's an array and includes the permission
        if (Array.isArray(userPermissions)) {
          return userPermissions.includes(room.permission);
        }

        return false;
      });

      logger.log(`Channel ${room.id}: ${eligibleUsers.length} eligible users`);

      // Add each eligible user to the channel
      for (const eligibleUser of eligibleUsers) {
        const streamUserId = `user_${eligibleUser.id}`;

        try {
          // First ensure user exists in Stream
          await streamServerClient.upsertUser({
            id: streamUserId,
            name: eligibleUser.firstName && eligibleUser.lastName
              ? `${eligibleUser.firstName} ${eligibleUser.lastName}`
              : eligibleUser.email || 'User',
            email: eligibleUser.email,
          });

          // Add user as member
          await channel.addMembers([streamUserId]);
          results[room.id].added++;
          results[room.id].members.push(eligibleUser.email || streamUserId);
        } catch (addError: any) {
          if (addError.message?.includes('already a member')) {
            // Already a member, still count them
            results[room.id].members.push(eligibleUser.email || streamUserId);
          } else {
            logger.error(`Failed to add ${eligibleUser.email} to ${room.id}:`, addError.message);
            results[room.id].errors++;
          }
        }
      }

      logger.log(`✅ Channel ${room.id}: ${results[room.id].members.length} members total`);
    }

    // Calculate summary
    const summary = {
      totalChannels: TEAM_ROOMS.length,
      totalUsersProcessed: activeUsers.length,
      channelResults: Object.entries(results).map(([channelId, data]) => ({
        channelId,
        memberCount: data.members.length,
        newlyAdded: data.added,
        errors: data.errors,
      })),
    };

    logger.log('🎉 Stream Chat member sync complete!', summary);

    res.json({
      success: true,
      message: 'Member sync completed',
      summary,
    });
  } catch (error) {
    logger.error('Stream Chat member sync error:', error);
    res.status(500).json({ error: 'Failed to sync members' });
  }
});
