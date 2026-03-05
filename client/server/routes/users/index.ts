import { Router } from 'express';
import { userService } from '../../services/users';
import { requirePermission, createErrorHandler } from '../../middleware';
import { applyPermissionDependencies } from '@shared/auth-utils';
import { storage } from '../../storage';
import { db } from '../../db';
import { userActivityLogs } from '@shared/schema';
import { sql, gte } from 'drizzle-orm';

const usersRouter = Router();

// Error handling for this module (standard middleware applied at mount level)
const errorHandler = createErrorHandler('users');

// User list for project assignments (available to anyone who can create projects)
usersRouter.get('/for-assignments', async (req, res, next) => {
  try {
    const assignableUsers = await userService.getUsersForAssignments();
    res.json(assignableUsers);
  } catch (error) {
    next(error);
  }
});

// Basic user info for resolving user IDs to names (read-only, no special permission needed)
usersRouter.get('/basic', async (req, res, next) => {
  try {
    const users = await userService.getUsersForAssignments(); // Reuse the same method for now
    res.json(users);
  } catch (error) {
    next(error);
  }
});

// User management routes requiring USERS_EDIT permission
usersRouter.get(
  '/',
  requirePermission('USERS_EDIT'),
  async (req, res, next) => {
    try {
      const users = await userService.getAllUsers();
      res.json(users);
    } catch (error) {
      next(error);
    }
  }
);

usersRouter.post(
  '/',
  requirePermission('USERS_EDIT'),
  async (req, res, next) => {
    try {
      const { email, firstName, lastName, role, password } = req.body;

      const newUser = await userService.createUser({
        email,
        firstName,
        lastName,
        role,
        password,
      });

      res.status(201).json(newUser);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('already exists')) {
          return res.status(409).json({ message: error.message });
        }
        if (error.message.includes('required')) {
          return res.status(400).json({ message: error.message });
        }
      }
      next(error);
    }
  }
);

usersRouter.patch(
  '/:id',
  requirePermission('USERS_EDIT'),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { role, permissions, metadata } = req.body;

      // Apply permission dependencies (e.g., NAV_EVENT_PLANNING automatically grants EVENT_REQUESTS_VIEW)
      const finalPermissions = permissions ? applyPermissionDependencies(permissions) : permissions;

      const updatedUser = await userService.updateUser(
        id,
        {
          role,
          permissions: finalPermissions,
          metadata,
        },
        req.user?.id
      );

      res.json(updatedUser);
    } catch (error) {
      next(error);
    }
  }
);

usersRouter.patch(
  '/:id/status',
  requirePermission('USERS_EDIT'),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { isActive } = req.body;

      const updatedUser = await userService.updateUserStatus(id, isActive);
      res.json(updatedUser);
    } catch (error) {
      next(error);
    }
  }
);

usersRouter.patch(
  '/:id/profile',
  requirePermission('USERS_EDIT'),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { email, firstName, lastName, phoneNumber, preferredEmail, address, role, isActive } = req.body;

      const updatedUser = await userService.updateUserProfile(
        id,
        { email, firstName, lastName, phoneNumber, preferredEmail, address, role, isActive },
        req.user?.id
      );

      res.json(updatedUser);
    } catch (error) {
      next(error);
    }
  }
);

usersRouter.delete(
  '/:id',
  requirePermission('USERS_EDIT'),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      await userService.deleteUser(id);
      res.json({ success: true, message: 'User deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
);

usersRouter.patch(
  '/:id/password',
  requirePermission('USERS_EDIT'),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { password } = req.body;

      await userService.setUserPassword(id, password);
      res.json({ success: true, message: 'Password updated successfully' });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes('must be at least')
      ) {
        return res.status(400).json({ message: error.message });
      }
      next(error);
    }
  }
);

// Get online users (active in last 15 minutes by default)
// Queries BOTH in-memory heartbeat map AND persistent userActivityLogs DB table
// so online users are shown even after a server restart/deployment
usersRouter.get('/online', async (req, res, next) => {
  try {
    const sinceMinutes = parseInt(req.query.minutes as string) || 15;

    // Source 1: In-memory heartbeat map (populated by POST /heartbeat)
    const heartbeatUsers = await storage.getOnlineUsers(sinceMinutes);

    // Source 2: Persistent database activity logs
    const cutoff = new Date(Date.now() - sinceMinutes * 60 * 1000);
    const dbUsers = await db
      .select({
        userId: userActivityLogs.userId,
        firstName: sql<string | null>`(SELECT first_name FROM users WHERE id = ${userActivityLogs.userId})`,
        lastName: sql<string | null>`(SELECT last_name FROM users WHERE id = ${userActivityLogs.userId})`,
        displayName: sql<string | null>`(SELECT display_name FROM users WHERE id = ${userActivityLogs.userId})`,
        email: sql<string | null>`(SELECT email FROM users WHERE id = ${userActivityLogs.userId})`,
        profileImageUrl: sql<string | null>`(SELECT profile_image_url FROM users WHERE id = ${userActivityLogs.userId})`,
        lastActivity: sql<string>`max(${userActivityLogs.createdAt})::text`,
      })
      .from(userActivityLogs)
      .where(gte(userActivityLogs.createdAt, cutoff))
      .groupBy(userActivityLogs.userId);

    // Merge both sources, heartbeat takes priority (fresher data)
    const userMap = new Map<string, any>();

    // Add DB users first
    for (const dbUser of dbUsers) {
      userMap.set(dbUser.userId, {
        id: dbUser.userId,
        firstName: dbUser.firstName,
        lastName: dbUser.lastName,
        displayName: dbUser.displayName,
        email: dbUser.email,
        profileImageUrl: dbUser.profileImageUrl,
        lastActiveAt: dbUser.lastActivity,
      });
    }

    // Heartbeat users override (fresher data)
    for (const hbUser of heartbeatUsers) {
      userMap.set(hbUser.id, hbUser);
    }

    res.json(Array.from(userMap.values()));
  } catch (error) {
    next(error);
  }
});

// Heartbeat endpoint to update user's last active timestamp
// Called periodically by the client to mark the user as still online
usersRouter.post('/heartbeat', async (req, res, next) => {
  try {
    const user = (req as any).user;
    if (user?.id) {
      await storage.updateUserLastActive(user.id);
      res.json({ success: true });
    } else {
      res.status(401).json({ error: 'Not authenticated' });
    }
  } catch (error) {
    next(error);
  }
});

// Get users with geocoded addresses for map display (driver planning tool)
usersRouter.get('/map', async (req, res, next) => {
  try {
    const allUsers = await storage.getAllUsers();
    const usersWithCoords = allUsers
      .filter((u: any) => u.isActive && u.latitude && u.longitude && u.address)
      .map((u: any) => ({
        id: u.id,
        name: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.displayName || u.email || 'Unknown',
        email: u.email,
        phoneNumber: u.phoneNumber,
        address: u.address,
        latitude: String(u.latitude),
        longitude: String(u.longitude),
        role: u.role,
      }));
    res.json(usersWithCoords);
  } catch (error) {
    next(error);
  }
});

// Apply error handler
usersRouter.use(errorHandler);

export default usersRouter;
