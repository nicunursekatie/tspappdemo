/**
 * useCollaboration - Generic React hook for real-time collaboration on any resource type
 * 
 * This hook provides a complete solution for multi-user collaboration on any resource,
 * including presence tracking, field locking, real-time updates, comments, and revision history.
 * 
 * REFACTORED: Now uses the shared CollaborationManager singleton instead of creating
 * individual socket connections per component instance.
 * 
 * @example
 * ```tsx
 * function ResourceEditor({ resourceId }: { resourceId: number }) {
 *   const {
 *     isConnected,
 *     presentUsers,
 *     locks,
 *     acquireFieldLock,
 *     releaseFieldLock,
 *     isFieldLockedByOther,
 *     comments,
 *     addComment,
 *     onFieldUpdate,
 *     updateField,
 *   } = useCollaboration({
 *     resourceType: 'event',
 *     resourceId,
 *   });
 * 
 *   // Show who's currently viewing
 *   <div>
 *     Viewers: {presentUsers.map(u => u.userName).join(', ')}
 *   </div>
 * 
 *   // Lock a field before editing
 *   const handleFieldFocus = async (fieldName: string) => {
 *     try {
 *       await acquireFieldLock(fieldName);
 *     } catch (error) {
 *       console.error('Field is locked by another user');
 *     }
 *   };
 * 
 *   // Save field with conflict detection
 *   const handleFieldSave = async (fieldName: string, value: any, currentVersion: Date) => {
 *     try {
 *       await updateField(fieldName, value, currentVersion);
 *       await releaseFieldLock(fieldName);
 *     } catch (error) {
 *       if (error.message.includes('Conflict')) {
 *         alert('This field was modified by another user. Please refresh.');
 *       }
 *     }
 *   };
 * }
 * ```
 * 
 * Features:
 * - Resource-type agnostic (works for events, tasks, planning items, etc.)
 * - Real-time presence tracking (see who's viewing the resource)
 * - Field-level locking to prevent edit conflicts
 * - Optimistic concurrency control with version-based conflict detection
 * - Real-time comments with create/update/delete
 * - Revision history tracking
 * - Auto-cleanup on unmount
 * - Custom event broadcasting
 * - Uses shared socket connection via CollaborationManager for efficiency
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from './useAuth';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { logger } from '@/lib/logger';
import {
  subscribeToResource,
  setCollaborationUser,
  isCollaborationConnected,
  emitCollaborationEvent,
  type PresenceUser,
  type ResourceFieldLock,
  type ResourceState,
} from '@/lib/collaboration-manager';
import { useBatchedCollaborationContext } from '@/contexts/batched-collaboration-context';
import type { EventCollaborationComment, EventEditRevision } from '@shared/schema';

export type ResourceType = 'event' | 'holding-zone' | 'planning-workspace';

export type { PresenceUser, ResourceFieldLock, ResourceState };

export interface FieldUpdateData {
  fieldName: string;
  value: any;
  updatedAt: Date;
  updatedBy: string;
  updatedByName: string;
}

export interface FieldUpdateCallback {
  (fieldName: string, value: any, version: Date): void;
}

export interface UseCollaborationParams {
  resourceType: ResourceType;
  resourceId: number | string;
  namespace?: string; // deprecated - namespace is now handled by the collaboration manager
  enabled?: boolean; // defaults to true - set to false to disable socket connection
}

export interface MentionNotification {
  id: string;
  resourceType: string;
  resourceId: number | string;
  mentionedBy: string;
  mentionedById: string;
  comment: string;
  commentId?: number;
  timestamp: string;
}

export interface ActivityItem {
  id: string;
  type: 'status_change' | 'field_update' | 'comment' | 'assignment' | 'join' | 'leave';
  userId: string;
  userName: string;
  description: string;
  details?: string;
  timestamp: Date;
  fieldName?: string;
  oldValue?: string;
  newValue?: string;
}

export interface UseCollaborationReturn {
  // Connection state
  isConnected: boolean;
  error: string | null;
  reconnect: () => void;

  // Presence
  presentUsers: PresenceUser[];

  // Field locking
  locks: Map<string, ResourceFieldLock>;
  acquireFieldLock: (fieldName: string) => Promise<void>;
  releaseFieldLock: (fieldName: string) => Promise<void>;
  isFieldLocked: (fieldName: string) => boolean;
  isFieldLockedByMe: (fieldName: string) => boolean;
  isFieldLockedByOther: (fieldName: string) => boolean;

  // Comments
  comments: EventCollaborationComment[];
  addComment: (content: string, parentId?: number) => Promise<void>;
  updateComment: (id: number, content: string) => Promise<void>;
  deleteComment: (id: number) => Promise<void>;
  commentsLoading: boolean;

  // Mentions
  mentions: MentionNotification[];
  clearMentions: () => void;
  clearMention: (id: string) => void;

  // Real-time updates
  onFieldUpdate: (callback: FieldUpdateCallback) => () => void;
  updateField: (fieldName: string, value: any, expectedVersion: Date) => Promise<void>;

  // Revision history
  revisions: EventEditRevision[];
  loadRevisions: () => Promise<EventEditRevision[]>;
  revisionsLoading: boolean;

  // Activity feed
  activities: ActivityItem[];
  clearActivities: () => void;

  // Custom events
  emit: (eventName: string, data: any) => void;
  on: (eventName: string, handler: (data: any) => void) => () => void;
}

export function useCollaboration({
  resourceType,
  resourceId,
  enabled = true,
}: UseCollaborationParams): UseCollaborationReturn {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if batched collaboration data is available from parent context
  const batchedContext = useBatchedCollaborationContext();
  const isInsideBatchedProvider = batchedContext !== null;
  const batchedLoading = batchedContext?.isLoading ?? false;
  const batchedData = resourceType === 'event' && typeof resourceId === 'number'
    ? batchedContext?.getEventCollaboration(resourceId)
    : undefined;

  // Presence tracking
  const [presentUsers, setPresentUsers] = useState<PresenceUser[]>([]);

  // Field locking
  const [locks, setLocks] = useState<Map<string, ResourceFieldLock>>(new Map());

  // Comments
  const [comments, setComments] = useState<EventCollaborationComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);

  // Revisions
  const [revisions, setRevisions] = useState<EventEditRevision[]>([]);
  const [revisionsLoading, setRevisionsLoading] = useState(false);

  // Mentions
  const [mentions, setMentions] = useState<MentionNotification[]>([]);

  // Activities
  const [activities, setActivities] = useState<ActivityItem[]>([]);

  // Field update callbacks
  const fieldUpdateCallbacks = useRef<Set<FieldUpdateCallback>>(new Set());

  // Custom event handlers (kept for backward compatibility but limited functionality)
  const customEventHandlers = useRef<Map<string, Set<(data: any) => void>>>(new Map());

  // ==================== Set Collaboration User ====================

  useEffect(() => {
    if (user) {
      setCollaborationUser({
        id: String(user.id),
        email: user.email || '',
        firstName: user.first_name || undefined,
        lastName: user.last_name || undefined,
      });
    } else {
      setCollaborationUser(null);
    }
  }, [user]);

  // ==================== Subscribe to Resource ====================

  useEffect(() => {
    // Don't subscribe if disabled or missing required data
    if (!enabled || !user || !resourceId) {
      setIsConnected(false);
      setPresentUsers([]);
      setLocks(new Map());
      return;
    }

    // Subscribe to the resource using the shared collaboration manager
    const unsubscribe = subscribeToResource(resourceType, resourceId, {
      onConnect: () => {
        logger.log('[Collaboration] ✅ Connected via shared manager');
        setIsConnected(true);
        setError(null);
      },

      onDisconnect: () => {
        logger.log('[Collaboration] ❌ Disconnected from shared manager');
        setIsConnected(false);
      },

      onPresenceUpdate: (users) => {
        if (users.length > 0) {
          logger.log('[Collaboration] Presence updated:', users);
        }
        setPresentUsers(users);
      },

      onUserJoined: (newUser) => {
        logger.log('[Collaboration] User joined:', newUser);
        setPresentUsers((prev) => {
          const existing = prev.find((u) => u.userId === newUser.userId);
          if (existing) return prev;
          return [...prev, newUser];
        });
      },

      onUserLeft: (userId) => {
        logger.log('[Collaboration] User left:', userId);
        setPresentUsers((prev) => prev.filter((u) => u.userId !== userId));
      },

      onLocksUpdated: (updatedLocks) => {
        logger.log('[Collaboration] Locks updated:', updatedLocks);
        const locksMap = new Map<string, ResourceFieldLock>();
        (updatedLocks || []).forEach((lock) => {
          if (lock && lock.fieldName) {
            locksMap.set(lock.fieldName, lock);
          } else {
            logger.error('[Collaboration] Invalid lock in activeLocks:', lock);
          }
        });
        setLocks(locksMap);
      },

      onInitialState: (state: ResourceState) => {
        logger.log('[Collaboration] Received initial state:', state);
        setPresentUsers(state.activeUsers || []);

        const locksMap = new Map<string, ResourceFieldLock>();
        (state.activeLocks || []).forEach((lock) => {
          locksMap.set(lock.fieldName, lock);
        });
        setLocks(locksMap);
      },

      onActivityUpdate: (activity: ActivityItem) => {
        logger.log('[Collaboration] Activity update:', activity);
        setActivities((prev) => {
          // Keep last 50 activities
          const updated = [activity, ...prev].slice(0, 50);
          return updated;
        });
      },

      onCommentAdded: (comment: EventCollaborationComment) => {
        logger.log('[Collaboration] Comment created:', comment);
        setComments((prev) => [...prev, comment]);
      },

      onCommentUpdated: (comment: EventCollaborationComment) => {
        logger.log('[Collaboration] Comment updated:', comment);
        setComments((prev) =>
          prev.map((c) => (c.id === comment.id ? comment : c))
        );
      },

      onCommentDeleted: (commentId: number) => {
        logger.log('[Collaboration] Comment deleted:', commentId);
        setComments((prev) => prev.filter((c) => c.id !== commentId));
      },

      onFieldUpdate: (data) => {
        logger.log('[Collaboration] Field updated:', data);

        // Notify all registered callbacks
        fieldUpdateCallbacks.current.forEach((callback) => {
          callback(data.fieldName, data.value, data.updatedAt);
        });

        // Invalidate query to refresh data
        const queryKey = resourceType === 'event'
          ? ['/api/event-requests', resourceId]
          : [`/api/${resourceType}`, resourceId];

        queryClient.invalidateQueries({ queryKey });
      },
    });

    // Update connection state based on current manager state
    setIsConnected(isCollaborationConnected());

    // Cleanup on unmount or dependency change
    return () => {
      logger.log('[Collaboration] Cleaning up subscription...');
      unsubscribe();
    };
  }, [user, resourceId, resourceType, enabled]);

  // ==================== Load Initial Comments and Locks ====================

  useEffect(() => {
    if (!resourceId || !user) return;

    // If we're inside a batched provider, wait for it to finish loading
    // before deciding whether to use batched data or make individual calls
    if (isInsideBatchedProvider && batchedLoading) {
      logger.log('[Collaboration] Waiting for batched data to load for resource:', resourceId);
      setCommentsLoading(true);
      return;
    }

    // If batched data is available from parent context, use it instead of making API calls
    if (batchedData) {
      logger.log('[Collaboration] Using batched data from context for resource:', resourceId);
      setComments(batchedData.comments || []);
      
      const locksMap = new Map<string, ResourceFieldLock>();
      (batchedData.locks || []).forEach((lock: ResourceFieldLock) => {
        if (lock && lock.fieldName) {
          locksMap.set(lock.fieldName, lock);
        }
      });
      setLocks(locksMap);
      setCommentsLoading(false);
      return;
    }

    // If we're inside a batched provider but no data for this event,
    // still use empty data (provider handles the batch fetch)
    if (isInsideBatchedProvider && !batchedLoading) {
      logger.log('[Collaboration] Inside batched provider, using empty data for resource:', resourceId);
      setComments([]);
      setLocks(new Map());
      setCommentsLoading(false);
      return;
    }

    // Only make individual API calls if NOT inside a batched provider
    const loadInitialData = async () => {
      setCommentsLoading(true);
      try {
        const commentsEndpoint = resourceType === 'event'
          ? `/api/event-requests/${resourceId}/collaboration/comments`
          : `/api/${resourceType}/${resourceId}/collaboration/comments`;

        const locksEndpoint = resourceType === 'event'
          ? `/api/event-requests/${resourceId}/collaboration/locks`
          : `/api/${resourceType}/${resourceId}/collaboration/locks`;

        const [commentsResponse, locksResponse] = await Promise.all([
          apiRequest('GET', commentsEndpoint).catch(err => {
            logger.error('[Collaboration] Error loading comments:', err);
            return { comments: [] };
          }),
          apiRequest('GET', locksEndpoint).catch(err => {
            logger.error('[Collaboration] Error loading locks:', err);
            return { locks: [] };
          }),
        ]);

        setComments(commentsResponse.comments || []);
        
        const locksMap = new Map<string, ResourceFieldLock>();
        (locksResponse.locks || []).forEach((lock: ResourceFieldLock) => {
          if (lock && lock.fieldName) {
            locksMap.set(lock.fieldName, lock);
          }
        });
        setLocks(locksMap);
      } catch (err) {
        logger.error('[Collaboration] Error loading initial data:', err);
        setError('Failed to load collaboration data');
      } finally {
        setCommentsLoading(false);
      }
    };

    loadInitialData();
  }, [resourceId, resourceType, user, batchedData, isInsideBatchedProvider, batchedLoading]);

  // ==================== Field Locking (HTTP-based with optional real-time sync) ====================

  const acquireFieldLock = useCallback(
    async (fieldName: string): Promise<void> => {
      if (!user) {
        throw new Error('User not authenticated');
      }

      try {
        const endpoint = resourceType === 'event'
          ? `/api/event-requests/${resourceId}/collaboration/locks`
          : `/api/${resourceType}/${resourceId}/collaboration/locks`;

        const response = await apiRequest('POST', endpoint, {
          fieldName,
          expiresInMinutes: 5,
        });

        logger.log('[Collaboration] Lock acquired via HTTP:', response);

        if (response.lock) {
          setLocks((prev) => {
            const newLocks = new Map(prev);
            newLocks.set(fieldName, response.lock);
            return newLocks;
          });
        }

        if (isCollaborationConnected()) {
          const userName = user.display_name || 
            (user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : '') ||
            user.email || 'Anonymous';

          const payload = resourceType === 'event'
            ? {
                eventRequestId: resourceId,
                fieldName,
                userId: user.id,
                userName,
              }
            : {
                resourceType,
                resourceId,
                fieldName,
                userId: user.id,
                userName,
              };

          emitCollaborationEvent('acquire-lock', payload);
        }
      } catch (err) {
        logger.error('[Collaboration] Error acquiring lock:', err);
        throw err;
      }
    },
    [user, resourceId, resourceType]
  );

  const releaseFieldLock = useCallback(
    async (fieldName: string): Promise<void> => {
      if (!user) {
        logger.warn('[Collaboration] Cannot release lock: no user');
        return;
      }

      try {
        const endpoint = resourceType === 'event'
          ? `/api/event-requests/${resourceId}/collaboration/locks/${encodeURIComponent(fieldName)}`
          : `/api/${resourceType}/${resourceId}/collaboration/locks/${encodeURIComponent(fieldName)}`;

        await apiRequest('DELETE', endpoint);

        logger.log('[Collaboration] Lock released via HTTP:', fieldName);

        setLocks((prev) => {
          const newLocks = new Map(prev);
          newLocks.delete(fieldName);
          return newLocks;
        });

        if (isCollaborationConnected()) {
          const payload = resourceType === 'event'
            ? { eventRequestId: resourceId, fieldName }
            : { resourceType, resourceId, fieldName };

          emitCollaborationEvent('release-lock', payload);
        }
      } catch (err) {
        logger.error('[Collaboration] Error releasing lock:', err);
      }
    },
    [user, resourceId, resourceType]
  );

  const isFieldLocked = useCallback(
    (fieldName: string): boolean => {
      return locks.has(fieldName);
    },
    [locks]
  );

  const isFieldLockedByMe = useCallback(
    (fieldName: string): boolean => {
      if (!user) return false;
      const lock = locks.get(fieldName);
      return lock ? String(lock.lockedBy) === String(user.id) : false;
    },
    [locks, user]
  );

  const isFieldLockedByOther = useCallback(
    (fieldName: string): boolean => {
      if (!user) return false;
      const lock = locks.get(fieldName);
      return lock ? String(lock.lockedBy) !== String(user.id) : false;
    },
    [locks, user]
  );

  // ==================== Comments (HTTP-based) ====================

  const addComment = useCallback(
    async (content: string, parentId?: number): Promise<void> => {
      if (!user) {
        throw new Error('User not authenticated');
      }

      try {
        const endpoint = resourceType === 'event'
          ? `/api/event-requests/${resourceId}/collaboration/comments`
          : `/api/${resourceType}/${resourceId}/collaboration/comments`;

        const response = await apiRequest('POST', endpoint, {
          content,
          parentCommentId: parentId,
        });

        logger.log('[Collaboration] Comment created, response:', response);

        // Real-time update will come via socket, but update local state as backup
        if (response && response.comment) {
          setComments((prev) => {
            // Avoid duplicates if socket event already added it
            const exists = prev.some((c) => c.id === response.comment.id);
            if (exists) return prev;
            return [...prev, response.comment];
          });
        } else {
          // If response doesn't contain comment, refetch all comments
          logger.warn('[Collaboration] Response missing comment, refetching all comments');
          const refetchEndpoint = resourceType === 'event'
            ? `/api/event-requests/${resourceId}/collaboration/comments`
            : `/api/${resourceType}/${resourceId}/collaboration/comments`;
          const refreshResponse = await apiRequest('GET', refetchEndpoint);
          if (refreshResponse && refreshResponse.comments) {
            setComments(refreshResponse.comments);
          }
        }
      } catch (err) {
        logger.error('[Collaboration] Error adding comment:', err);
        throw err;
      }
    },
    [resourceId, resourceType, user]
  );

  const updateComment = useCallback(
    async (id: number, content: string): Promise<void> => {
      if (!user) {
        throw new Error('User not authenticated');
      }

      try {
        const endpoint = resourceType === 'event'
          ? `/api/event-requests/${resourceId}/collaboration/comments/${id}`
          : `/api/${resourceType}/${resourceId}/collaboration/comments/${id}`;

        const response = await apiRequest('PATCH', endpoint, { content });

        // Real-time update will come via socket, but update local state as backup
        if (response.comment) {
          setComments((prev) =>
            prev.map((c) => (c.id === id ? response.comment : c))
          );
        }
      } catch (err) {
        logger.error('[Collaboration] Error updating comment:', err);
        throw err;
      }
    },
    [resourceId, resourceType, user]
  );

  const deleteComment = useCallback(
    async (id: number): Promise<void> => {
      if (!user) {
        throw new Error('User not authenticated');
      }

      try {
        const endpoint = resourceType === 'event'
          ? `/api/event-requests/${resourceId}/collaboration/comments/${id}`
          : `/api/${resourceType}/${resourceId}/collaboration/comments/${id}`;

        await apiRequest('DELETE', endpoint);

        // Real-time update will come via socket, but update local state as backup
        setComments((prev) => prev.filter((c) => c.id !== id));
      } catch (err) {
        logger.error('[Collaboration] Error deleting comment:', err);
        throw err;
      }
    },
    [resourceId, resourceType, user]
  );

  // ==================== Field Updates ====================

  const onFieldUpdate = useCallback((callback: FieldUpdateCallback) => {
    fieldUpdateCallbacks.current.add(callback);

    // Return cleanup function
    return () => {
      fieldUpdateCallbacks.current.delete(callback);
    };
  }, []);

  const updateField = useCallback(
    async (fieldName: string, value: any, expectedVersion: Date): Promise<void> => {
      if (!user) {
        throw new Error('User not authenticated');
      }

      if (!isCollaborationConnected()) {
        throw new Error('Not connected to collaboration server');
      }

      const userName = user.display_name ||
        (user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : '') ||
        user.email || 'Anonymous';

      const payload = resourceType === 'event'
        ? {
            eventRequestId: resourceId,
            fieldName,
            value,
            expectedVersion: expectedVersion.toISOString(),
            userId: user.id,
            userName,
          }
        : {
            resourceType,
            resourceId,
            fieldName,
            value,
            expectedVersion: expectedVersion.toISOString(),
            userId: user.id,
            userName,
          };

      emitCollaborationEvent('field-update', payload);

      // The field update result will be received via onFieldUpdate callback
    },
    [user, resourceId, resourceType]
  );

  // ==================== Revision History (HTTP-based) ====================

  const loadRevisions = useCallback(async (): Promise<EventEditRevision[]> => {
    if (!resourceId || !user) {
      throw new Error('Cannot load revisions: missing resource ID or user');
    }

    setRevisionsLoading(true);
    try {
      const endpoint = resourceType === 'event'
        ? `/api/event-requests/${resourceId}/collaboration/revisions`
        : `/api/${resourceType}/${resourceId}/collaboration/revisions`;

      const response = await apiRequest('GET', endpoint);
      const revs = response.revisions || [];
      setRevisions(revs);
      return revs;
    } catch (err) {
      logger.error('[Collaboration] Error loading revisions:', err);
      throw err;
    } finally {
      setRevisionsLoading(false);
    }
  }, [resourceId, resourceType, user]);

  // ==================== Custom Events ====================

  const emit = useCallback(
    (eventName: string, data: any) => {
      if (!isCollaborationConnected()) {
        logger.warn('[Collaboration] Cannot emit event: not connected');
        return;
      }

      emitCollaborationEvent(eventName, data);
    },
    []
  );

  const on = useCallback(
    (eventName: string, handler: (data: any) => void) => {
      // Track custom event handlers for reference
      if (!customEventHandlers.current.has(eventName)) {
        customEventHandlers.current.set(eventName, new Set());
      }
      customEventHandlers.current.get(eventName)!.add(handler);

      // Note: With the shared collaboration manager, custom events are not directly
      // supported. For built-in events, use the appropriate callback in subscribeToResource.
      // This function is kept for backward compatibility but has limited functionality.
      logger.warn(`[Collaboration] Custom event listener for '${eventName}' registered but may not receive events. Use subscribeToResource handlers for built-in events.`);

      // Return cleanup function
      return () => {
        const handlers = customEventHandlers.current.get(eventName);
        if (handlers) {
          handlers.delete(handler);
          if (handlers.size === 0) {
            customEventHandlers.current.delete(eventName);
          }
        }
      };
    },
    []
  );

  // ==================== Mentions ====================

  const clearMentions = useCallback(() => {
    setMentions([]);
  }, []);

  const clearMention = useCallback((id: string) => {
    setMentions((prev) => prev.filter((m) => m.id !== id));
  }, []);

  // ==================== Activities ====================

  const clearActivities = useCallback(() => {
    setActivities([]);
  }, []);

  // ==================== Reconnection ====================

  const reconnect = useCallback(() => {
    // With the shared collaboration manager, reconnection is handled automatically.
    // This function triggers a re-subscription by forcing a state update.
    logger.log('[Collaboration] Manual reconnection requested');
    setError(null);
    
    // The collaboration manager handles reconnection automatically.
    // If the socket is disconnected, it will reconnect on its own.
    // Users can refresh the page if they need to force a reconnection.
    if (!isCollaborationConnected()) {
      setError('Connection lost. The system will attempt to reconnect automatically.');
    }
  }, []);

  // ==================== Return Hook API ====================

  return {
    // Connection state
    isConnected,
    error,
    reconnect,

    // Presence
    presentUsers,

    // Field locking
    locks,
    acquireFieldLock,
    releaseFieldLock,
    isFieldLocked,
    isFieldLockedByMe,
    isFieldLockedByOther,

    // Comments
    comments,
    addComment,
    updateComment,
    deleteComment,
    commentsLoading,

    // Mentions
    mentions,
    clearMentions,
    clearMention,

    // Real-time updates
    onFieldUpdate,
    updateField,

    // Revision history
    revisions,
    loadRevisions,
    revisionsLoading,

    // Activities
    activities,
    clearActivities,

    // Custom events
    emit,
    on,
  };
}
