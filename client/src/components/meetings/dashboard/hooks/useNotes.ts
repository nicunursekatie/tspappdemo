import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

// Types based on the schema
export interface MeetingNote {
  id: number;
  projectId: number;
  meetingId?: number;
  type: 'discussion' | 'meeting';
  content: string;
  status: 'active' | 'archived';
  createdBy?: string;
  createdByName?: string;
  createdAt: string;
  // Additional fields that may come from joins
  projectTitle?: string;
  meetingTitle?: string | null;
}

export interface NotesFilters {
  projectId?: number;
  meetingId?: number;
  type?: 'discussion' | 'meeting' | 'all';
  status?: 'active' | 'archived' | 'all';
  search?: string;
}

export interface CreateNoteData {
  projectId: number;
  meetingId?: number;
  type: 'discussion' | 'meeting';
  content: string;
  status?: 'active' | 'archived';
}

export interface UpdateNoteData {
  content?: string;
  type?: 'discussion' | 'meeting';
  status?: 'active' | 'archived';
}

// Custom hook for all meeting notes operations
export function useNotes(filters?: NotesFilters) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Build query string from filters
  const buildQueryString = (filters: NotesFilters) => {
    const params = new URLSearchParams();
    
    if (filters.projectId) params.append('projectId', filters.projectId.toString());
    if (filters.meetingId) params.append('meetingId', filters.meetingId.toString());
    if (filters.type && filters.type !== 'all') params.append('type', filters.type);
    if (filters.status && filters.status !== 'all') params.append('status', filters.status);
    
    return params.toString() ? `?${params.toString()}` : '';
  };

  // Fetch all notes with optional filters
  const notesQuery = useQuery<MeetingNote[]>({
    queryKey: ['/api/meetings/notes', filters],
    queryFn: async () => {
      const queryString = filters ? buildQueryString(filters) : '';
      const data = await apiRequest('GET', `/api/meetings/notes${queryString}`);
      return Array.isArray(data) ? data : [];
    },
  });

  // Apply client-side search filter if provided
  const filteredNotes = notesQuery.data?.filter(note => {
    if (!filters?.search) return true;
    const searchLower = filters.search.toLowerCase();
    return (
      note.content.toLowerCase().includes(searchLower) ||
      note.projectTitle?.toLowerCase().includes(searchLower) ||
      note.meetingTitle?.toLowerCase().includes(searchLower) ||
      note.createdByName?.toLowerCase().includes(searchLower)
    );
  }) || [];

  // Get single note
  const useNoteQuery = (id: number) => {
    return useQuery<MeetingNote>({
      queryKey: ['/api/meetings/notes', id],
      queryFn: async () => {
        return await apiRequest('GET', `/api/meetings/notes/${id}`);
      },
      enabled: !!id,
    });
  };

  // Create note mutation
  const createNoteMutation = useMutation({
    mutationFn: async (noteData: CreateNoteData) => {
      return await apiRequest('POST', '/api/meetings/notes', noteData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/meetings/notes'] });
      toast({
        title: 'Note Created',
        description: 'Meeting note has been successfully created.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to Create Note',
        description: error?.message || 'Failed to create the meeting note',
        variant: 'destructive',
      });
    },
  });

  // Update note mutation
  const updateNoteMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: UpdateNoteData }) => {
      return await apiRequest('PATCH', `/api/meetings/notes/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/meetings/notes'] });
      toast({
        title: 'Note Updated',
        description: 'Meeting note has been successfully updated.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to Update Note',
        description: error?.message || 'Failed to update the meeting note',
        variant: 'destructive',
      });
    },
  });

  // Delete note mutation
  const deleteNoteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest('DELETE', `/api/meetings/notes/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/meetings/notes'] });
      toast({
        title: 'Note Deleted',
        description: 'Meeting note has been successfully deleted.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to Delete Note',
        description: error?.message || 'Failed to delete the meeting note',
        variant: 'destructive',
      });
    },
  });

  // Bulk operations
  const bulkUpdateStatusMutation = useMutation({
    mutationFn: async ({ noteIds, status }: { noteIds: number[]; status: 'active' | 'archived' }) => {
      const promises = noteIds.map(id => 
        apiRequest('PATCH', `/api/meetings/notes/${id}`, { status })
      );
      return await Promise.all(promises);
    },
    onSuccess: (_, { noteIds, status }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/meetings/notes'] });
      toast({
        title: 'Notes Updated',
        description: `${noteIds.length} note(s) have been ${status === 'active' ? 'activated' : 'archived'}.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Bulk Update Failed',
        description: error?.message || 'Failed to update selected notes',
        variant: 'destructive',
      });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (noteIds: number[]) => {
      const promises = noteIds.map(id => 
        apiRequest('DELETE', `/api/meetings/notes/${id}`)
      );
      return await Promise.all(promises);
    },
    onSuccess: (_, noteIds) => {
      queryClient.invalidateQueries({ queryKey: ['/api/meetings/notes'] });
      toast({
        title: 'Notes Deleted',
        description: `${noteIds.length} note(s) have been deleted.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Bulk Delete Failed',
        description: error?.message || 'Failed to delete selected notes',
        variant: 'destructive',
      });
    },
  });

  return {
    // Data
    notes: filteredNotes,
    notesLoading: notesQuery.isLoading,
    notesError: notesQuery.error,
    
    // Single note query
    useNoteQuery,
    
    // Mutations
    createNoteMutation,
    updateNoteMutation,
    deleteNoteMutation,
    bulkUpdateStatusMutation,
    bulkDeleteMutation,
    
    // Utilities
    refetchNotes: () => queryClient.invalidateQueries({ queryKey: ['/api/meetings/notes'] }),
  };
}