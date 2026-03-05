import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Project, InsertProject } from '@shared/schema';
import { useProjectContext } from '../context/ProjectContext';
import { logger } from '@/lib/logger';

export const useProjectMutations = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const {
    setShowCreateDialog,
    setShowEditDialog,
    setEditingProject,
    resetNewProject,
  } = useProjectContext();

  // Create project mutation
  const createProjectMutation = useMutation({
    mutationFn: async (projectData: Partial<InsertProject>) => {
      return await apiRequest('POST', '/api/projects', projectData);
    },
    onSuccess: (data: Project) => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      setShowCreateDialog(false);
      resetNewProject();
      toast({
        title: 'Project created successfully!',
        description: `"${data.title}" has been added to your projects.`,
      });
    },
    onError: (error: any) => {
      logger.error('Create project error:', error);
      toast({
        title: 'Error',
        description: error?.message || 'Failed to create project.',
        variant: 'destructive',
      });
    },
  });

  // Update project mutation
  const updateProjectMutation = useMutation({
    mutationFn: async ({ id, ...projectData }: { id: number } & Partial<InsertProject>) => {
      return await apiRequest('PATCH', `/api/projects/${id}`, projectData);
    },
    onSuccess: (data: Project) => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      setShowEditDialog(false);
      setEditingProject(null);
      toast({
        title: 'Project updated successfully!',
        description: `"${data.title}" has been updated.`,
      });
    },
    onError: (error: any) => {
      logger.error('Update project error:', error);
      toast({
        title: 'Error',
        description: error?.message || 'Failed to update project.',
        variant: 'destructive',
      });
    },
  });

  // Delete project mutation
  const deleteProjectMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest('DELETE', `/api/projects/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      toast({
        title: 'Project deleted successfully!',
        description: 'The project has been removed.',
      });
    },
    onError: (error: any) => {
      logger.error('Delete project error:', error);
      toast({
        title: 'Error',
        description: error?.message || 'Failed to delete project.',
        variant: 'destructive',
      });
    },
  });

  // Update project status mutation
  const updateProjectStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      return await apiRequest('PATCH', `/api/projects/${id}`, { status });
    },
    onSuccess: (data: Project) => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });

      if (data.status === 'completed') {
        toast({
          title: '🎉 Project completed!',
          description: `"${data.title}" has been marked as complete.`,
        });
      } else {
        toast({
          title: 'Status updated',
          description: `"${data.title}" status changed to ${data.status}.`,
        });
      }
    },
    onError: (error: any) => {
      logger.error('Update status error:', error);
      toast({
        title: 'Error',
        description: error?.message || 'Failed to update project status.',
        variant: 'destructive',
      });
    },
  });

  // Archive project mutation - FIXED: Use proper POST /archive endpoint
  const archiveProjectMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest('POST', `/api/projects/${id}/archive`);
    },
    onSuccess: () => {
      // Invalidate all project-related queries to ensure UI refreshes
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects/archived'] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects/for-review'] });
      toast({
        title: 'Project archived',
        description: 'Project has been moved to archives and removed from active projects.',
      });
    },
    onError: (error: any) => {
      logger.error('Archive project error:', error);
      toast({
        title: 'Error',
        description: error?.message || 'Failed to archive project.',
        variant: 'destructive',
      });
    },
  });

  // Unarchive project mutation
  const unarchiveProjectMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      return await apiRequest('PATCH', `/api/projects/${id}`, { status });
    },
    onSuccess: (data: Project) => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects/archived'] });
      toast({
        title: 'Project restored',
        description: `"${data.title}" has been restored from archives.`,
      });
    },
    onError: (error: any) => {
      logger.error('Unarchive project error:', error);
      toast({
        title: 'Error',
        description: error?.message || 'Failed to restore project.',
        variant: 'destructive',
      });
    },
  });

  return {
    createProjectMutation,
    updateProjectMutation,
    deleteProjectMutation,
    updateProjectStatusMutation,
    archiveProjectMutation,
    unarchiveProjectMutation,
  };
};