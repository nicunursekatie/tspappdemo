/**
 * CollaborationManager - Singleton Socket.IO manager for real-time collaboration
 * 
 * Key principles:
 * 1. ONE socket connection per browser session (not per component)
 * 2. Polling-only transport for Replit/proxy environments
 * 3. Room-based multiplexing - components join/leave rooms
 * 4. Socket is OPTIONAL for functionality - HTTP is source of truth
 * 5. Let Socket.IO handle reconnection with sensible defaults
 */

import { io, Socket } from 'socket.io-client';
import { logger } from '@/lib/logger';

// Module loaded (debug logging disabled for cleaner console)

export interface PresenceUser {
  userId: string;
  userName: string;
  joinedAt: Date;
  lastHeartbeat: Date;
  socketId: string;
}

export interface ResourceFieldLock {
  fieldName: string;
  lockedBy: string;
  lockedByName: string;
  lockedAt: Date;
}

export interface ResourceState {
  resourceId: number | string;
  activeUsers: PresenceUser[];
  activeLocks: ResourceFieldLock[];
}

export interface CollaborationHandlers {
  onConnect?: () => void;
  onDisconnect?: () => void;
  onPresenceUpdate?: (users: PresenceUser[]) => void;
  onUserJoined?: (user: PresenceUser) => void;
  onUserLeft?: (userId: string) => void;
  onLocksUpdated?: (locks: ResourceFieldLock[]) => void;
  onInitialState?: (state: ResourceState) => void;
  onActivityUpdate?: (activity: any) => void;
  onCommentAdded?: (comment: any) => void;
  onCommentUpdated?: (comment: any) => void;
  onCommentDeleted?: (commentId: number) => void;
  onFieldUpdate?: (data: { fieldName: string; value: any; updatedAt: Date }) => void;
}

interface Subscription {
  resourceType: string;
  resourceId: number | string;
  handlers: CollaborationHandlers;
}

// Singleton socket instance
let socketInstance: Socket | null = null;
let currentUser: { id: string; email: string; firstName?: string; lastName?: string } | null = null;
const subscriptions = new Map<string, Subscription>();
let heartbeatInterval: NodeJS.Timeout | null = null;
let isConnected = false;

function getSocketUrl(): string {
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  const port = window.location.port;

  const isReplit = hostname.includes('replit.dev') ||
                   hostname.includes('replit.app') ||
                   hostname.includes('replit.com') ||
                   hostname.includes('spock.replit');

  if (isReplit) {
    if (port && port !== '443' && port !== '80') {
      return `${protocol}//${hostname}:${port}`;
    }
    return `${protocol}//${hostname}`;
  }

  const devPort = port || (protocol === 'https:' ? '443' : '80');
  return `${protocol}//${hostname}:${devPort}`;
}

function getResourceKey(resourceType: string, resourceId: number | string): string {
  return `${resourceType}:${resourceId}`;
}

function findSubscriptionByResourceId(resourceId: number | string): Subscription | undefined {
  for (const [, sub] of subscriptions) {
    if (String(sub.resourceId) === String(resourceId)) {
      return sub;
    }
  }
  return undefined;
}

function startHeartbeat(): void {
  stopHeartbeat();
  heartbeatInterval = setInterval(() => {
    if (socketInstance?.connected && subscriptions.size > 0) {
      subscriptions.forEach((sub) => {
        socketInstance?.emit('heartbeat', {
          resourceType: sub.resourceType,
          resourceId: sub.resourceId,
        });
      });
    }
  }, 30000);
}

function stopHeartbeat(): void {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

function setupSocketListeners(socket: Socket): void {
  socket.on('connect', () => {
    isConnected = true;
    logger.log('[CollaborationManager] ✅ Connected');
    
    // Rejoin all rooms on reconnect
    subscriptions.forEach((sub) => {
      joinRoom(sub.resourceType, sub.resourceId);
      sub.handlers.onConnect?.();
    });
    
    startHeartbeat();
  });

  socket.on('disconnect', (reason) => {
    isConnected = false;
    // Only log unexpected disconnects, not normal ones
    if (reason !== 'io client disconnect') {
      logger.log('[CollaborationManager] Disconnected:', reason);
    }
    stopHeartbeat();
    
    subscriptions.forEach((sub) => {
      sub.handlers.onDisconnect?.();
    });
  });

  // Presence events
  socket.on('presence-updated', (data: { resourceId?: number | string; eventRequestId?: number; activeUsers: PresenceUser[] }) => {
    const resourceId = data.resourceId ?? data.eventRequestId;
    if (resourceId === undefined) return;
    
    const sub = findSubscriptionByResourceId(resourceId);
    if (sub) {
      sub.handlers.onPresenceUpdate?.(data.activeUsers || []);
    }
  });

  socket.on('user-joined', (data: { resourceId?: number | string; eventRequestId?: number; user: PresenceUser }) => {
    const resourceId = data.resourceId ?? data.eventRequestId;
    if (resourceId === undefined) return;
    
    const sub = findSubscriptionByResourceId(resourceId);
    if (sub) {
      sub.handlers.onUserJoined?.(data.user);
    }
  });

  socket.on('user-left', (data: { resourceId?: number | string; eventRequestId?: number; userId: string }) => {
    const resourceId = data.resourceId ?? data.eventRequestId;
    if (resourceId === undefined) return;
    
    const sub = findSubscriptionByResourceId(resourceId);
    if (sub) {
      sub.handlers.onUserLeft?.(data.userId);
    }
  });

  // Initial state
  socket.on('event-state', (state: ResourceState) => {
    const resourceId = state.resourceId;
    if (resourceId === undefined) return;
    
    const sub = findSubscriptionByResourceId(resourceId);
    if (sub) {
      sub.handlers.onInitialState?.(state);
    }
  });

  socket.on('resource-state', (state: ResourceState) => {
    const resourceId = state.resourceId;
    if (resourceId === undefined) return;
    
    const sub = findSubscriptionByResourceId(resourceId);
    if (sub) {
      sub.handlers.onInitialState?.(state);
    }
  });

  // Lock events
  socket.on('locks-updated', (data: { resourceId?: number | string; eventRequestId?: number; activeLocks: ResourceFieldLock[] }) => {
    const resourceId = data.resourceId ?? data.eventRequestId;
    if (resourceId === undefined) return;
    
    const sub = findSubscriptionByResourceId(resourceId);
    if (sub) {
      sub.handlers.onLocksUpdated?.(data.activeLocks || []);
    }
  });

  // Activity events
  socket.on('activity-update', (data: { resourceId?: number | string; eventRequestId?: number; activity: any }) => {
    const resourceId = data.resourceId ?? data.eventRequestId;
    if (resourceId === undefined) return;
    
    const sub = findSubscriptionByResourceId(resourceId);
    if (sub) {
      sub.handlers.onActivityUpdate?.(data.activity);
    }
  });

  // Comment events
  socket.on('comment-added', (data: { resourceId?: number | string; eventRequestId?: number; comment: any }) => {
    const resourceId = data.resourceId ?? data.eventRequestId;
    if (resourceId === undefined) return;
    
    const sub = findSubscriptionByResourceId(resourceId);
    if (sub) {
      sub.handlers.onCommentAdded?.(data.comment);
    }
  });

  socket.on('comment-updated', (data: { resourceId?: number | string; eventRequestId?: number; comment: any }) => {
    const resourceId = data.resourceId ?? data.eventRequestId;
    if (resourceId === undefined) return;
    
    const sub = findSubscriptionByResourceId(resourceId);
    if (sub) {
      sub.handlers.onCommentUpdated?.(data.comment);
    }
  });

  socket.on('comment-deleted', (data: { resourceId?: number | string; eventRequestId?: number; commentId: number }) => {
    const resourceId = data.resourceId ?? data.eventRequestId;
    if (resourceId === undefined) return;
    
    const sub = findSubscriptionByResourceId(resourceId);
    if (sub) {
      sub.handlers.onCommentDeleted?.(data.commentId);
    }
  });

  // Field update events
  socket.on('field-updated', (data: { resourceId?: number | string; eventRequestId?: number; fieldName: string; value: any; updatedAt: Date }) => {
    const resourceId = data.resourceId ?? data.eventRequestId;
    if (resourceId === undefined) return;
    
    const sub = findSubscriptionByResourceId(resourceId);
    if (sub) {
      sub.handlers.onFieldUpdate?.({ fieldName: data.fieldName, value: data.value, updatedAt: data.updatedAt });
    }
  });
}

function getOrCreateSocket(): Socket {
  if (socketInstance) {
    return socketInstance;
  }

  logger.log('[CollaborationManager] Creating socket connection');
  const socketUrl = getSocketUrl();
  
  socketInstance = io(`${socketUrl}/collaboration`, {
    path: '/socket.io/',
    withCredentials: true,
    // Polling only - more reliable through Replit/proxies
    transports: ['polling'],
    // Let Socket.IO handle reconnection with sensible defaults
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 2000,
    reconnectionDelayMax: 10000,
    timeout: 20000,
    auth: currentUser ? {
      userId: currentUser.id,
      userEmail: currentUser.email,
    } : undefined,
  });

  setupSocketListeners(socketInstance);
  
  return socketInstance;
}

function joinRoom(resourceType: string, resourceId: number | string): void {
  if (!socketInstance?.connected || !currentUser) return;

  const fullName = currentUser.firstName && currentUser.lastName
    ? `${currentUser.firstName} ${currentUser.lastName}`
    : currentUser.email?.split('@')[0] || 'Unknown User';

  socketInstance.emit('join-resource', {
    resourceType,
    resourceId,
    userId: currentUser.id,
    userName: fullName,
  });
}

function leaveRoom(resourceType: string, resourceId: number | string): void {
  if (!socketInstance?.connected) return;

  socketInstance.emit('leave-resource', {
    resourceType,
    resourceId,
  });
}

// ==================== Public API ====================

export function setCollaborationUser(user: { id: string; email: string; firstName?: string; lastName?: string } | null): void {
  currentUser = user;
  
  if (!user && socketInstance) {
    // User logged out - disconnect and cleanup
    socketInstance.disconnect();
    socketInstance = null;
    subscriptions.clear();
    stopHeartbeat();
    isConnected = false;
  } else if (user && socketInstance) {
    // User changed - update auth
    socketInstance.auth = {
      userId: user.id,
      userEmail: user.email,
    };
  }
}

export function subscribeToResource(
  resourceType: string,
  resourceId: number | string,
  handlers: CollaborationHandlers
): () => void {
  // Subscription tracking (verbose logging disabled)
  const key = getResourceKey(resourceType, resourceId);
  
  // Store subscription
  subscriptions.set(key, {
    resourceType,
    resourceId,
    handlers,
  });

  // Ensure socket exists and is connected
  const socket = getOrCreateSocket();
  
  // If already connected, join the room immediately
  if (socket.connected) {
    joinRoom(resourceType, resourceId);
    handlers.onConnect?.();
  }

  // Return unsubscribe function
  return () => {
    leaveRoom(resourceType, resourceId);
    subscriptions.delete(key);
    
    // If no more subscriptions, we could disconnect, but let's keep the socket
    // alive for potential future subscriptions (more efficient)
  };
}

export function isCollaborationConnected(): boolean {
  return isConnected;
}

export function getSubscriptionCount(): number {
  return subscriptions.size;
}

// Emit an event through the shared socket
export function emitCollaborationEvent(eventName: string, data: any): void {
  if (socketInstance?.connected) {
    socketInstance.emit(eventName, data);
  }
}

// ==================== Object-based API (for backward compatibility) ====================

export const collaborationManager = {
  setUser: setCollaborationUser,
  subscribe: subscribeToResource,
  isConnected: isCollaborationConnected,
  getSubscriptionCount,
  emit: emitCollaborationEvent,
};
