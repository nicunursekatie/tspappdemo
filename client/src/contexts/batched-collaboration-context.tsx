/**
 * BatchedCollaborationContext - Provider for pre-fetched collaboration data
 * 
 * This context allows parent components (like tab views) to batch-fetch collaboration
 * data for all visible events and make it available to child card components.
 * Child components can check this context before making individual API calls.
 */

import { createContext, useContext, useMemo } from 'react';
import { useBatchedCollaboration, type BatchedCollaborationResult } from '@/hooks/use-batched-collaboration';
import type { EventCollaborationComment, EventFieldLock } from '@shared/schema';

interface BatchedCollaborationContextValue {
  batchedData: BatchedCollaborationResult | undefined;
  isLoading: boolean;
  getEventCollaboration: (eventId: number) => {
    comments: EventCollaborationComment[];
    locks: EventFieldLock[];
  } | undefined;
}

const BatchedCollaborationContext = createContext<BatchedCollaborationContextValue | null>(null);

interface BatchedCollaborationProviderProps {
  eventIds: number[];
  children: React.ReactNode;
  enabled?: boolean;
}

export function BatchedCollaborationProvider({
  eventIds,
  children,
  enabled = true,
}: BatchedCollaborationProviderProps) {
  const { data, isLoading } = useBatchedCollaboration(eventIds, { enabled });

  const value = useMemo(
    () => ({
      batchedData: data,
      isLoading,
      getEventCollaboration: (eventId: number) => data?.[eventId],
    }),
    [data, isLoading]
  );

  return (
    <BatchedCollaborationContext.Provider value={value}>
      {children}
    </BatchedCollaborationContext.Provider>
  );
}

export function useBatchedCollaborationContext() {
  return useContext(BatchedCollaborationContext);
}
