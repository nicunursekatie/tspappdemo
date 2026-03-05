/**
 * useEventCollaborationLite - Lightweight event collaboration hook
 * 
 * Uses the shared CollaborationManager instead of creating individual socket connections.
 * This dramatically reduces connection overhead when multiple event cards are visible.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from './useAuth';
import { collaborationManager, PresenceUser, ResourceFieldLock } from '@/lib/collaboration-manager';

export interface UseEventCollaborationLiteReturn {
  isConnected: boolean;
  presentUsers: PresenceUser[];
  locks: Map<string, ResourceFieldLock>;
}

export function useEventCollaborationLite(eventId: number | undefined): UseEventCollaborationLiteReturn {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [presentUsers, setPresentUsers] = useState<PresenceUser[]>([]);
  const [locks, setLocks] = useState<Map<string, ResourceFieldLock>>(new Map());
  const subscribed = useRef(false);

  useEffect(() => {
    if (!user || !eventId) {
      setIsConnected(false);
      setPresentUsers([]);
      setLocks(new Map());
      return;
    }

    collaborationManager.setUser({
      id: user.id,
      email: user.email || '',
      firstName: user.first_name,
      lastName: user.last_name,
    });

    if (subscribed.current) return;
    subscribed.current = true;

    const unsubscribe = collaborationManager.subscribe('event', eventId, {
      onConnect: () => setIsConnected(true),
      onDisconnect: () => setIsConnected(false),
      onPresenceUpdate: (users) => setPresentUsers(users),
      onUserJoined: (user) => {
        setPresentUsers((prev) => {
          if (prev.find((u) => u.userId === user.userId)) return prev;
          return [...prev, user];
        });
      },
      onUserLeft: (userId) => {
        setPresentUsers((prev) => prev.filter((u) => u.userId !== userId));
      },
      onLocksUpdated: (newLocks) => {
        const locksMap = new Map<string, ResourceFieldLock>();
        newLocks.forEach((lock) => locksMap.set(lock.fieldName, lock));
        setLocks(locksMap);
      },
      onInitialState: (state) => {
        setPresentUsers(state.activeUsers || []);
        const locksMap = new Map<string, ResourceFieldLock>();
        (state.activeLocks || []).forEach((lock: ResourceFieldLock) => {
          locksMap.set(lock.fieldName, lock);
        });
        setLocks(locksMap);
      },
    });

    setIsConnected(collaborationManager.isConnected());

    return () => {
      subscribed.current = false;
      unsubscribe();
    };
  }, [user, eventId]);

  return {
    isConnected,
    presentUsers,
    locks,
  };
}
