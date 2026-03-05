import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { isDateInPast, normalizeDate } from '@/lib/date-utils';
import type { Meeting } from './useMeetings';
import { logger } from '@/lib/logger';

// Interfaces
export interface AgendaItem {
  id: number;
  title: string;
  description?: string;
  submittedBy?: string;
  type?: string;
  status?: string;
  estimatedTime?: string;
  meetingId?: number;
  section?: string;
  submittedAt?: string;
  isOffAgendaItem?: boolean;
  projectId?: number;
  content?: string;
}

export interface AgendaSection {
  id: number;
  title: string;
  items: AgendaItem[];
}

export interface CompiledAgenda {
  id: number;
  meetingId: number;
  date: string;
  status: string;
  totalEstimatedTime?: string;
  sections?: AgendaSection[];
}

export interface OffAgendaItemData {
  title: string;
  section: string;
  meetingId: number;
}

// Custom hook for all agenda-related operations
export function useAgenda(selectedMeetingId?: number | null, meetings?: Meeting[]) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch agenda items for selected meeting
  const agendaItemsQuery = useQuery<AgendaItem[]>({
    queryKey: ['agenda-items', selectedMeetingId],
    queryFn: async () => {
      logger.log('[Frontend] Fetching agenda items from /api/agenda-items for meeting:', selectedMeetingId);
      const response = await apiRequest('GET', `/api/agenda-items?meetingId=${selectedMeetingId || ''}`);
      logger.log('[Frontend] Agenda items response:', response);
      return response || [];
    },
    enabled: !!selectedMeetingId,
  });

  // Fetch compiled agenda for selected meeting
  const compiledAgendaQuery = useQuery<CompiledAgenda>({
    queryKey: ['/api/meetings', selectedMeetingId, 'compiled-agenda'],
    enabled: !!selectedMeetingId,
  });

  // Create off-agenda item mutation
  const createOffAgendaItemMutation = useMutation({
    mutationFn: async (itemData: OffAgendaItemData) => {
      logger.log('[Frontend] Creating agenda item via /api/meetings/agenda-items:', itemData);
      return await apiRequest('POST', '/api/meetings/agenda-items', {
        title: itemData.title,
        description: '', // Clear description since section is separate now
        section: itemData.section, // Send section as proper field
        meetingId: itemData.meetingId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agenda-items'] });
      toast({
        title: 'Agenda Item Added',
        description: 'Off-agenda item has been successfully added to the meeting',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to Add Item',
        description: error.message || 'Failed to add off-agenda item',
        variant: 'destructive',
      });
    },
  });

  // Delete agenda item mutation
  const deleteAgendaItemMutation = useMutation({
    mutationFn: async (itemId: number) => {
      return await apiRequest('DELETE', `/api/agenda-items/${itemId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agenda-items'] });
      toast({
        title: 'Agenda Item Deleted',
        description: 'The agenda item has been successfully removed',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to delete agenda item',
        variant: 'destructive',
      });
    },
  });

  // Update agenda item mutation (for editing existing items)
  const updateAgendaItemMutation = useMutation({
    mutationFn: async ({
      itemId,
      updates,
    }: {
      itemId: number;
      updates: Partial<AgendaItem>;
    }) => {
      return await apiRequest('PATCH', `/api/agenda-items/${itemId}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agenda-items'] });
      toast({
        title: 'Agenda Item Updated',
        description: 'The agenda item has been successfully updated',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Update Failed',
        description: error.message || 'Failed to update agenda item',
        variant: 'destructive',
      });
    },
  });

  // Helper function to auto-select appropriate meeting for agenda items
  const autoSelectMeetingForAgenda = (meetings: Meeting[]): Meeting | null => {
    if (!meetings || meetings.length === 0) return null;

    try {
      // Separate meetings by past/future using proper date utilities
      const upcomingMeetings: Meeting[] = [];
      const pastMeetings: Meeting[] = [];
      
      meetings.forEach((meeting) => {
        try {
          if (isDateInPast(meeting.date, meeting.time)) {
            pastMeetings.push(meeting);
          } else {
            upcomingMeetings.push(meeting);
          }
        } catch (error) {
          logger.warn('Date parsing issue for meeting:', meeting.id, meeting.date, error);
          // If date parsing fails, default to upcoming to be safe
          upcomingMeetings.push(meeting);
        }
      });

      logger.log('🗓️ Meeting Classification:', {
        upcoming: upcomingMeetings.map(m => ({ id: m.id, date: m.date })),
        past: pastMeetings.map(m => ({ id: m.id, date: m.date })),
      });

      // Priority 1: Most recent upcoming meeting
      if (upcomingMeetings.length > 0) {
        // Sort by date ascending (earliest first) for upcoming meetings
        // Create a copy to avoid mutating the array
        const targetMeeting = [...upcomingMeetings].sort((a, b) => {
          try {
            const dateA = new Date(normalizeDate(a.date) + 'T12:00:00');
            const dateB = new Date(normalizeDate(b.date) + 'T12:00:00');
            return dateA.getTime() - dateB.getTime();
          } catch (error) {
            logger.warn('Date sorting error:', error);
            return 0; // Keep original order if sorting fails
          }
        })[0];
        logger.log('✅ Selected upcoming meeting:', targetMeeting.id, targetMeeting.date);
        return targetMeeting;
      }
      
      // Priority 2: Most recent past meeting
      if (pastMeetings.length > 0) {
        // Sort by date descending (most recent first) for past meetings
        // Create a copy to avoid mutating the array
        const targetMeeting = [...pastMeetings].sort((a, b) => {
          try {
            const dateA = new Date(normalizeDate(a.date) + 'T12:00:00');
            const dateB = new Date(normalizeDate(b.date) + 'T12:00:00');
            return dateB.getTime() - dateA.getTime();
          } catch (error) {
            logger.warn('Date sorting error:', error);
            return 0; // Keep original order if sorting fails
          }
        })[0];
        logger.log('✅ Selected past meeting:', targetMeeting.id, targetMeeting.date);
        return targetMeeting;
      }
      
      // Priority 3: Fallback - just pick the first available meeting
      const targetMeeting = meetings[0];
      logger.log('⚠️ Using fallback meeting selection:', targetMeeting.id);
      return targetMeeting;

    } catch (error) {
      logger.error('Error in meeting selection logic:', error);
      // Ultimate fallback - just pick any available meeting
      if (meetings.length > 0) {
        const targetMeeting = meetings[0];
        logger.log('🚨 Emergency fallback meeting selection:', targetMeeting.id);
        return targetMeeting;
      }
    }

    return null;
  };

  // Enhanced function to add off-agenda items with intelligent meeting selection
  const addOffAgendaItem = async (
    title: string,
    section: string,
    selectedMeeting?: Meeting | null,
    availableMeetings?: Meeting[]
  ) => {
    // Validate input
    if (!title.trim()) {
      toast({
        title: 'Title Required',
        description: 'Please enter a title for the agenda item',
        variant: 'destructive',
      });
      return;
    }

    if (!section) {
      toast({
        title: 'Section Required',
        description: 'Please select a section for the agenda item',
        variant: 'destructive',
      });
      return;
    }

    // Auto-select meeting if none is selected
    let targetMeeting = selectedMeeting;
    
    if (!targetMeeting && availableMeetings && availableMeetings.length > 0) {
      targetMeeting = autoSelectMeetingForAgenda(availableMeetings);
      
      // Debug logging for meeting selection
      logger.log('🔍 Meeting Auto-Selection Debug:', {
        selectedMeeting: selectedMeeting?.id,
        totalMeetings: availableMeetings.length,
        meetings: availableMeetings.map(m => ({ id: m.id, title: m.title, date: m.date, status: m.status })),
        targetMeeting: targetMeeting?.id,
        timestamp: new Date().toISOString(),
      });
    }

    // Final validation
    if (!targetMeeting) {
      logger.error('❌ No target meeting found despite', availableMeetings?.length, 'meetings available');
      toast({
        title: 'No Meetings Available',
        description: `Unable to find a suitable meeting from ${availableMeetings?.length || 0} available meetings. Please select a meeting manually or create a new one.`,
        variant: 'destructive',
      });
      return;
    }

    logger.log('🎯 Final target meeting selected:', {
      id: targetMeeting.id,
      title: targetMeeting.title,
      date: targetMeeting.date,
      time: targetMeeting.time,
    });

    await createOffAgendaItemMutation.mutateAsync({
      title,
      section,
      meetingId: targetMeeting.id,
    });
  };

  return {
    // Queries
    agendaItems: agendaItemsQuery.data || [],
    agendaItemsLoading: agendaItemsQuery.isLoading,
    agendaItemsError: agendaItemsQuery.error,
    compiledAgenda: compiledAgendaQuery.data,
    compiledAgendaLoading: compiledAgendaQuery.isLoading,
    
    // Mutations
    createOffAgendaItemMutation,
    deleteAgendaItemMutation,
    updateAgendaItemMutation,
    
    // Helper functions
    addOffAgendaItem,
    autoSelectMeetingForAgenda,
    
    // Utility to refresh queries
    refreshAgendaItems: () => queryClient.invalidateQueries({ queryKey: ['agenda-items'] }),
  };
}