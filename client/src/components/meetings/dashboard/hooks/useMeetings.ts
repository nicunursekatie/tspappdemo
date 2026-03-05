import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { formatDateForInput } from '@/lib/date-utils';
import { logger } from '@/lib/logger';

// Interfaces
export interface Meeting {
  id: number;
  title: string;
  date: string;
  time: string;
  type: string;
  status: string;
  location?: string;
  description?: string;
  finalAgenda?: string;
}

export interface MeetingFormData {
  title: string;
  date: string;
  time: string;
  type: string;
  location: string;
  description: string;
}

export interface CompiledAgenda {
  id: number;
  meetingId: number;
  date: string;
  status: string;
  totalEstimatedTime?: string;
  sections?: AgendaSection[];
}

export interface AgendaSection {
  id: number;
  title: string;
  items: any[];
}

// Custom hook for all meeting-related operations
export function useMeetings(selectedMeetingId?: number | null) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all meetings
  const meetingsQuery = useQuery<Meeting[]>({
    queryKey: ['/api/meetings'],
  });

  // Fetch compiled agenda for selected meeting
  const compiledAgendaQuery = useQuery<CompiledAgenda>({
    queryKey: ['/api/meetings', selectedMeetingId, 'compiled-agenda'],
    enabled: !!selectedMeetingId,
  });

  // Create meeting mutation
  const createMeetingMutation = useMutation({
    mutationFn: async (meetingData: MeetingFormData) => {
      return await apiRequest('POST', '/api/meetings', meetingData);
    },
    onSuccess: () => {
      toast({
        title: 'Meeting Scheduled',
        description: 'Your new meeting has been scheduled successfully.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/meetings'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to Schedule Meeting',
        description: error.message || 'Failed to schedule the meeting. Please try again.',
        variant: 'destructive',
      });
    },
  });

  // Update meeting mutation
  const updateMeetingMutation = useMutation({
    mutationFn: async (meetingData: { id: number } & MeetingFormData) => {
      return await apiRequest('PATCH', `/api/meetings/${meetingData.id}`, meetingData);
    },
    onSuccess: () => {
      toast({
        title: 'Meeting Updated',
        description: 'Meeting details have been updated successfully.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/meetings'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to Update Meeting',
        description: error.message || 'Failed to update the meeting. Please try again.',
        variant: 'destructive',
      });
    },
  });

  // Delete meeting mutation
  const deleteMeetingMutation = useMutation({
    mutationFn: async (meetingId: number) => {
      return await apiRequest('DELETE', `/api/meetings/${meetingId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/meetings'] });
      toast({
        title: 'Meeting Deleted',
        description: 'The meeting has been successfully deleted.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to delete meeting',
        variant: 'destructive',
      });
    },
  });

  // Compile agenda mutation
  const compileAgendaMutation = useMutation({
    mutationFn: async (meetingId: number) => {
      return await apiRequest('POST', `/api/meetings/${meetingId}/compile-agenda`);
    },
    onSuccess: () => {
      toast({
        title: 'Agenda Compiled Successfully',
        description: 'The meeting agenda has been compiled from Google Sheet projects and submitted items.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/meetings'] });
      if (selectedMeetingId) {
        queryClient.invalidateQueries({
          queryKey: ['/api/meetings', selectedMeetingId, 'compiled-agenda'],
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Compilation Failed',
        description: error.message || 'Failed to compile agenda. Please try again.',
        variant: 'destructive',
      });
    },
  });

  // Export to sheets mutation
  const exportToSheetsMutation = useMutation({
    mutationFn: async (meetingId: number) => {
      return await apiRequest('POST', `/api/meetings/${meetingId}/export-to-sheets`);
    },
    onSuccess: () => {
      toast({
        title: 'Export Successful',
        description: 'Meeting agenda has been exported to Google Sheets.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Export Failed',
        description: error.message || 'Failed to export to Google Sheets. Please try again.',
        variant: 'destructive',
      });
    },
  });

  // Helper function to download PDF
  const downloadMeetingPDF = async (meeting: Meeting) => {
    try {
      const response = await fetch(`/api/meetings/${meeting.id}/download-pdf`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage;
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.message || errorJson.error || `Failed to download PDF: ${response.statusText}`;
        } catch {
          errorMessage = `Failed to download PDF: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${meeting.title.replace(/[^a-zA-Z0-9\s]/g, '_')}_${meeting.date}.pdf`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: 'PDF Downloaded',
        description: 'Meeting agenda PDF has been downloaded successfully.',
      });
    } catch (error) {
      logger.error('PDF download error:', error);
      toast({
        title: 'Download Failed',
        description: 'Failed to download the meeting agenda PDF. Please try again.',
        variant: 'destructive',
      });
    }
  };

  return {
    // Queries
    meetings: meetingsQuery.data || [],
    meetingsLoading: meetingsQuery.isLoading,
    meetingsError: meetingsQuery.error,
    compiledAgenda: compiledAgendaQuery.data,
    compiledAgendaLoading: compiledAgendaQuery.isLoading,
    
    // Mutations
    createMeetingMutation,
    updateMeetingMutation,
    deleteMeetingMutation,
    compileAgendaMutation,
    exportToSheetsMutation,
    
    // Helper functions
    downloadMeetingPDF,
    
    // Utility to refresh queries
    refreshMeetings: () => queryClient.invalidateQueries({ queryKey: ['/api/meetings'] }),
  };
}