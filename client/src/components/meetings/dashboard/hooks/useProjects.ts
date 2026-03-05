import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { getTodayString } from '@/lib/date-utils';
import { logger } from '@/lib/logger';

// Interfaces
export interface Project {
  id: number;
  title: string;
  status: string;
  priority?: string;
  description?: string;
  reviewInNextMeeting: boolean;
  meetingDiscussionPoints?: string;
  meetingDecisionItems?: string;
  supportPeople?: string;
  supportPeopleIds?: string[];
  assigneeName?: string;
  assigneeIds?: string[];
  category?: string;
  dueDate?: string;
  lastDiscussedDate?: string;
}

export interface NewProjectData {
  title: string;
  description: string;
  assigneeName: string;
  assigneeIds?: string[];
  supportPeople: string;
  supportPeopleIds?: string[];
  dueDate: string;
  priority: string;
  category: string;
  status: string;
}

export interface ProjectUpdateData {
  meetingDiscussionPoints?: string;
  meetingDecisionItems?: string;
  reviewInNextMeeting?: boolean;
  priority?: string;
  supportPeople?: string;
  supportPeopleIds?: string[];
  assigneeName?: string;
  assigneeIds?: string[];
}

// Custom hook for all project-related operations
export function useProjects(projectAgendaStatus?: Record<number, 'none' | 'agenda' | 'tabled'>, selectedMeeting?: { id: number } | null) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all projects
  const projectsQuery = useQuery<Project[]>({
    queryKey: ['/api/projects'],
  });

  // Fetch projects for review
  const projectsForReviewQuery = useQuery<Project[]>({
    queryKey: ['/api/projects/for-review'],
  });

  // Get all projects (including completed and archived) - deduplicate to prevent duplicates from multiple queries
  const allProjects = React.useMemo(() => {
    const mainProjects = projectsQuery.data || [];
    const reviewProjects = projectsForReviewQuery.data || [];
    
    // Create a Map to deduplicate by project ID
    const projectMap = new Map();
    
    // Add main projects first (these are the authoritative source)
    mainProjects.forEach(project => {
      projectMap.set(project.id, project);
    });
    
    // Add review projects, but only if they don't already exist (avoid duplicates)
    reviewProjects.forEach(project => {
      if (!projectMap.has(project.id)) {
        projectMap.set(project.id, project);
      }
    });
    
    return Array.from(projectMap.values());
  }, [projectsQuery.data, projectsForReviewQuery.data]);

  // Filter out completed and archived projects for active projects
  const activeProjects = React.useMemo(() => {
    return allProjects.filter(project =>
      project.status !== 'completed' &&
      project.status !== 'archived' &&
      project.status !== 'done'
    );
  }, [allProjects]);

  // Filter projects for review (also exclude completed/archived)
  const activeProjectsForReview = React.useMemo(() => {
    const reviewProjects = projectsForReviewQuery.data || [];
    return reviewProjects.filter(project => 
      project.status !== 'completed' && 
      project.status !== 'archived' &&
      project.status !== 'done'
    );
  }, [projectsForReviewQuery.data]);

  // Create project mutation
  const createProjectMutation = useMutation({
    mutationFn: async (projectData: NewProjectData) => {
      return await apiRequest('POST', '/api/projects', projectData);
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects/for-review'] });
      
      // Automatically sync the new project to Google Sheets
      try {
        await apiRequest('POST', '/api/google-sheets/projects/sync/to-sheets');
        toast({
          title: 'Project Created & Synced',
          description: 'New project has been created and synced to Google Sheets',
        });
      } catch (syncError) {
        logger.warn('Project created but sync to Google Sheets failed:', syncError);
        toast({
          title: 'Project Created',
          description: 'New project has been created. Note: Sync to Google Sheets failed - you can sync manually later.',
          variant: 'destructive',
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to Create Project',
        description: error?.message || 'Failed to create the new project',
        variant: 'destructive',
      });
    },
  });

  // Update project discussion mutation
  const updateProjectDiscussionMutation = useMutation({
    mutationFn: async ({
      projectId,
      updates,
    }: {
      projectId: number;
      updates: ProjectUpdateData;
    }) => {
      return await apiRequest('PATCH', `/api/projects/${projectId}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects/for-review'] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
    },
    onError: (error: Error, variables) => {
      // If 404, the project was probably archived - force refresh the project list
      if (error.message.includes('404') || error.message.includes('DATA_LOADING_ERROR')) {
        logger.error(`Project ${variables.projectId} not found - forcing refresh of project list`);
        queryClient.invalidateQueries({ queryKey: ['/api/projects/for-review'] });
        queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
        toast({
          title: 'Project Not Found',
          description: 'This project may have been archived. The project list has been refreshed.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Update Failed',
          description: error.message || 'Failed to update project discussion notes.',
          variant: 'destructive',
        });
      }
    },
  });

  // Update project priority mutation
  const updateProjectPriorityMutation = useMutation({
    mutationFn: async ({
      projectId,
      priority,
    }: {
      projectId: number;
      priority: string;
    }) => {
      return await apiRequest('PATCH', `/api/projects/${projectId}`, { priority });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects/for-review'] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      toast({
        title: 'Priority Updated',
        description: 'Project priority has been successfully updated.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Update Failed',
        description: error.message || 'Failed to update project priority.',
        variant: 'destructive',
      });
    },
  });

  // Update project support people mutation
  const updateProjectSupportPeopleMutation = useMutation({
    mutationFn: async ({
      projectId,
      supportPeople,
      supportPeopleIds,
    }: {
      projectId: number;
      supportPeople: string;
      supportPeopleIds?: string[];
    }) => {
      return await apiRequest('PATCH', `/api/projects/${projectId}`, {
        supportPeople,
        supportPeopleIds,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      toast({
        title: 'Support People Updated',
        description: 'Project support people have been updated successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Update Failed',
        description: error.message || 'Failed to update support people.',
        variant: 'destructive',
      });
    },
  });

  // Update project owner mutation
  const updateProjectOwnerMutation = useMutation({
    mutationFn: async ({
      projectId,
      assigneeName,
      assigneeIds,
    }: {
      projectId: number;
      assigneeName: string;
      assigneeIds?: string[];
    }) => {
      logger.log('🔄 Updating project owner:', { projectId, assigneeName, assigneeIds });
      return await apiRequest('PATCH', `/api/projects/${projectId}`, {
        assigneeName,
        assigneeIds,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects/for-review'] });
      toast({
        title: 'Project Owner Updated',
        description: 'Project owner has been updated successfully.',
      });
    },
    onError: (error: Error) => {
      logger.error('❌ Failed to update project owner:', error);
      let errorMessage = error.message || 'Failed to update project owner.';

      // Provide more helpful error messages
      if (errorMessage.includes('DATA_LOADING_ERROR') || errorMessage.includes('404')) {
        errorMessage = 'Project not found. It may have been deleted or not yet synced to the database.';
      }

      toast({
        title: 'Update Failed',
        description: errorMessage,
        variant: 'destructive',
      });
    },
  });

  // Convert meeting notes to meeting notes mutation
  const createTasksFromNotesMutation = useMutation({
    mutationFn: async () => {
      const allProjects = activeProjects;
      const projectsWithNotes = allProjects.filter(
        (project: Project) =>
          (project.meetingDiscussionPoints?.trim() ||
            project.meetingDecisionItems?.trim()) &&
          projectAgendaStatus &&
          (projectAgendaStatus[project.id] === 'agenda' ||
            projectAgendaStatus[project.id] === 'tabled')
      );

      const notePromises = projectsWithNotes.map(async (project: Project) => {
        const notes = [];

        // Create note from discussion points
        if (project.meetingDiscussionPoints?.trim()) {
          notes.push({
            projectId: project.id,
            meetingId: selectedMeeting?.id || null,
            type: 'discussion',
            content: project.meetingDiscussionPoints.trim(),
            status: 'active',
          });
        }

        // Create note from decision items
        if (project.meetingDecisionItems?.trim()) {
          notes.push({
            projectId: project.id,
            meetingId: selectedMeeting?.id || null,
            type: 'meeting',
            content: project.meetingDecisionItems.trim(),
            status: 'active',
          });
        }

        // Create meeting notes
        const noteResults = await Promise.all(
          notes.map((note) =>
            apiRequest('POST', '/api/meetings/notes', note)
          )
        );

        // Clear project fields after successful note creation
        if (noteResults.length > 0) {
          await apiRequest('PATCH', `/api/projects/${project.id}`, {
            meetingDiscussionPoints: '',
            meetingDecisionItems: '',
          });
        }

        return {
          projectTitle: project.title,
          notesCreated: noteResults.length,
        };
      });

      return Promise.all(notePromises);
    },
    onSuccess: (results) => {
      const totalNotes = results.reduce(
        (sum, result) => sum + result.notesCreated,
        0
      );
      const projectCount = results.length;

      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      queryClient.invalidateQueries({ queryKey: ['/api/meetings/notes'] });

      toast({
        title: 'Notes Saved Successfully!',
        description: `Created ${totalNotes} meeting note${
          totalNotes !== 1 ? 's' : ''
        } from ${projectCount} project${
          projectCount !== 1 ? 's' : ''
        }`,
        duration: 5000,
      });
    },
    onError: (error: any) => {
      logger.error('Failed to create meeting notes:', error);
      toast({
        title: 'Error Saving Notes',
        description: error?.message || 'Failed to save meeting notes',
        variant: 'destructive',
      });
    },
  });

  // Comprehensive reset for next week's agenda planning
  const resetAgendaPlanningMutation = useMutation({
    mutationFn: async () => {
      const allProjects = activeProjects;
      
      // Step 1: Create tasks from any remaining notes
      const projectsWithNotes = allProjects.filter(
        (project: Project) =>
          (project.meetingDiscussionPoints?.trim() ||
            project.meetingDecisionItems?.trim()) &&
          projectAgendaStatus &&
          (projectAgendaStatus[project.id] === 'agenda' ||
            projectAgendaStatus[project.id] === 'tabled')
      );

      if (projectsWithNotes.length > 0) {
        const taskPromises = projectsWithNotes.map(async (project: Project) => {
          const tasks = [];

          // Create task from discussion points
          if (project.meetingDiscussionPoints?.trim()) {
            tasks.push({
              title: `Follow up on: ${project.title}`,
              description: `Meeting Discussion Notes: ${project.meetingDiscussionPoints.trim()}`,
              assigneeName: project.assigneeName || 'Unassigned',
              priority: 'medium',
              status: 'pending',
              dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                .toISOString()
                .split('T')[0], // 7 days from now
            });
          }

          // Create task from decision items
          if (project.meetingDecisionItems?.trim()) {
            tasks.push({
              title: `Action item: ${project.title}`,
              description: `Meeting Decisions to Implement: ${project.meetingDecisionItems.trim()}`,
              assigneeName: project.assigneeName || 'Unassigned',
              priority: 'high',
              status: 'pending',
              dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
                .toISOString()
                .split('T')[0], // 3 days for decisions
            });
          }

          // Create tasks for this project
          if (tasks.length > 0) {
            const taskResults = await Promise.all(
              tasks.map((task) =>
                apiRequest('POST', `/api/projects/${project.id}/tasks`, task)
              )
            );
            return {
              projectTitle: project.title,
              tasksCreated: taskResults.length,
            };
          }
          return { projectTitle: project.title, tasksCreated: 0 };
        });

        await Promise.all(taskPromises);
      }

      // Step 2: Clear all meeting discussion points and decision items
      const clearNotesPromises = allProjects
        .filter(
          (project: Project) =>
            project.meetingDiscussionPoints?.trim() ||
            project.meetingDecisionItems?.trim()
        )
        .map(async (project: Project) => {
          return apiRequest('PATCH', `/api/projects/${project.id}`, {
            meetingDiscussionPoints: '',
            meetingDecisionItems: '',
            reviewInNextMeeting: false,
          });
        });

      if (clearNotesPromises.length > 0) {
        await Promise.all(clearNotesPromises);
      }

      // Step 3: Refresh projects from Google Sheets to get any updates made during the week
      await apiRequest('POST', '/api/google-sheets/projects/sync/from-sheets');

      return {
        notesProcessed: projectsWithNotes.length,
        notesCleared: clearNotesPromises.length,
      };
    },
    onSuccess: (results) => {
      // Refresh projects data
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });

      toast({
        title: 'Agenda Planning Reset Complete!',
        description: `✓ ${results.notesProcessed} projects converted to tasks\n✓ ${results.notesCleared} project notes cleared\n✓ Projects refreshed from Google Sheets\n✓ Ready for next week's planning`,
        duration: 8000,
      });
    },
    onError: (error: any) => {
      logger.error('Failed to reset agenda planning:', error);
      toast({
        title: 'Reset Failed',
        description: error?.message || 'Failed to complete agenda planning reset',
        variant: 'destructive',
      });
    },
  });

  // Helper function to generate agenda PDF
  const generateAgendaPDF = async (
    projectAgendaStatus: Record<number, 'none' | 'agenda' | 'tabled'>
  ) => {
    const allProjects = activeProjects;
    const agendaProjects = activeProjects.filter(
      (p: Project) => projectAgendaStatus[p.id] === 'agenda'
    );
    const tabledProjects = activeProjects.filter(
      (p: Project) => projectAgendaStatus[p.id] === 'tabled'
    );

    if (agendaProjects.length === 0 && tabledProjects.length === 0) {
      throw new Error('No agenda items to generate');
    }

    // Fetch tasks for each agenda project
    const projectsWithTasks = await Promise.all(
      agendaProjects.map(async (project: Project) => {
        try {
          const tasksResponse = await fetch(`/api/projects/${project.id}/tasks`, {
            credentials: 'include',
          });
          const tasks = tasksResponse.ok ? await tasksResponse.json() : [];

          return {
            title: project.title,
            owner: project.assigneeName || 'Unassigned',
            supportPeople: project.supportPeople || '',
            discussionPoints: project.meetingDiscussionPoints || '',
            decisionItems: project.meetingDecisionItems || '',
            status: project.status,
            priority: project.priority,
            tasks: tasks
              .filter((task: any) => task.status !== 'completed')
              .map((task: any) => ({
                title: task.title,
                status: task.status,
                priority: task.priority,
                description: task.description,
                assignee: task.assigneeName || task.assignee || 'Unassigned',
              })),
          };
        } catch (error) {
          // If task fetching fails, continue without tasks
          return {
            title: project.title,
            owner: project.assigneeName || 'Unassigned',
            supportPeople: project.supportPeople || '',
            discussionPoints: project.meetingDiscussionPoints || '',
            decisionItems: project.meetingDecisionItems || '',
            status: project.status,
            priority: project.priority,
            tasks: [],
          };
        }
      })
    );

    // Create agenda data structure
    const agendaData = {
      meetingDate: getTodayString(),
      agendaProjects: projectsWithTasks,
      tabledProjects: tabledProjects.map((p: Project) => ({
        title: p.title,
        owner: p.assigneeName || 'Unassigned',
        reason: p.meetingDiscussionPoints || 'No reason specified',
      })),
    };

    // Call API to generate PDF using fetch directly (for binary response)
    const response = await fetch('/api/meetings/finalize-agenda-pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(agendaData),
      credentials: 'include',
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage =
          errorJson.message || errorJson.error ||
          `HTTP ${response.status}: ${response.statusText}`;
      } catch {
        errorMessage =
          errorText || `HTTP ${response.status}: ${response.statusText}`;
      }
      throw new Error(errorMessage);
    }

    // Download the PDF
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `meeting-agenda-${getTodayString()}.pdf`;
    link.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: 'Agenda Finalized',
      description: `PDF agenda downloaded with ${agendaProjects.length} projects and ${tabledProjects.length} tabled items`,
    });
  };

  return {
    // Queries
    projects: allProjects,  // Return all projects including completed/archived
    activeProjects,         // Also provide filtered active projects
    projectsLoading: projectsQuery.isLoading,
    projectsError: projectsQuery.error,
    projectsForReview: activeProjectsForReview,
    projectsForReviewLoading: projectsForReviewQuery.isLoading,

    // Mutations
    createProjectMutation,
    updateProjectDiscussionMutation,
    updateProjectPriorityMutation,
    updateProjectSupportPeopleMutation,
    updateProjectOwnerMutation,
    createTasksFromNotesMutation,
    resetAgendaPlanningMutation,

    // Helper functions
    generateAgendaPDF,

    // Utility to refresh queries
    refreshProjects: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects/for-review'] });
    },
  };
}