import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ProjectAssigneeSelector } from '@/components/project-assignee-selector';
import { useProjectContext } from '../context/ProjectContext';
import { useProjectMutations } from '../hooks/useProjectMutations';

export const CreateProjectDialog: React.FC = () => {
  const {
    showCreateDialog,
    setShowCreateDialog,
    newProject,
    setNewProject,
    resetNewProject,
  } = useProjectContext();

  const { createProjectMutation } = useProjectMutations();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProject.title) {
      return;
    }
    createProjectMutation.mutate(newProject);
  };

  const handleClose = () => {
    setShowCreateDialog(false);
    resetNewProject();
  };

  return (
    <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-brand-primary">
            Create New Project
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title" className="font-roboto">
              Project Title *
            </Label>
            <Input
              id="title"
              value={newProject.title || ''}
              onChange={(e) => setNewProject({ ...newProject, title: e.target.value })}
              placeholder="Enter project title"
              className="font-roboto"
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description" className="font-roboto">
              Description
            </Label>
            <Textarea
              id="description"
              value={newProject.description || ''}
              onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
              placeholder="Enter project description"
              className="font-roboto min-h-[100px]"
            />
          </div>

          {/* Meeting Project Toggle */}
          <div className="flex items-center space-x-2 p-3 bg-brand-primary-lighter rounded-lg">
            <Checkbox
              id="isMeetingProject"
              checked={newProject.isMeetingProject || false}
              onCheckedChange={(checked) =>
                setNewProject({ ...newProject, isMeetingProject: checked as boolean })
              }
            />
            <label htmlFor="isMeetingProject" className="flex items-center gap-2 cursor-pointer">
              <span className="text-sm font-roboto">📊 Meeting Project</span>
              <span className="text-xs text-gray-500">(Syncs with Google Sheets)</span>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Priority */}
            <div className="space-y-2">
              <Label htmlFor="priority" className="font-roboto">
                Priority
              </Label>
              <Select
                value={newProject.priority || 'medium'}
                onValueChange={(value) => setNewProject({ ...newProject, priority: value })}
              >
                <SelectTrigger className="font-roboto">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label htmlFor="category" className="font-roboto">
                Category
              </Label>
              <Select
                value={newProject.category || 'technology'}
                onValueChange={(value) => setNewProject({ ...newProject, category: value })}
              >
                <SelectTrigger className="font-roboto">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="technology">Technology</SelectItem>
                  <SelectItem value="marketing">Marketing</SelectItem>
                  <SelectItem value="operations">Operations</SelectItem>
                  <SelectItem value="community">Community</SelectItem>
                  <SelectItem value="fundraising">Fundraising</SelectItem>
                  <SelectItem value="event">Event</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Assignees */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <ProjectAssigneeSelector
                label="Project Owner"
                value={newProject.assigneeName || ''}
                onChange={(assigneeName, userIds) => {
                  const normalizedIds = userIds?.length ? [userIds[0]] : [];
                  setNewProject({
                    ...newProject,
                    assigneeName,
                    assigneeIds:
                      userIds && userIds.length > 0
                        ? userIds
                            .map((id) => id?.toString())
                            .filter((id): id is string => Boolean(id))
                        : [],
                  });
                }}
                placeholder="Select or enter project owner"
                multiple={false}
              />
            </div>
            <div className="space-y-2">
              <ProjectAssigneeSelector
                label="Support People"
                value={newProject.supportPeople || ''}
                onChange={(supportPeople, userIds) => {
                  setNewProject({
                    ...newProject,
                    supportPeople,
                    supportPeopleIds:
                      userIds && userIds.length > 0
                        ? userIds
                            .map((id) => id?.toString())
                            .filter((id): id is string => Boolean(id))
                        : [],
                  });
                }}
                placeholder="Select or enter support people"
                multiple={true}
              />
            </div>
          </div>

          {/* Dates and Hours */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dueDate" className="font-roboto">
                Due Date
              </Label>
              <Input
                id="dueDate"
                type="date"
                value={newProject.dueDate || ''}
                onChange={(e) => setNewProject({ ...newProject, dueDate: e.target.value })}
                className="font-roboto"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="estimatedHours" className="font-roboto">
                Estimated Hours
              </Label>
              <Input
                id="estimatedHours"
                type="number"
                value={newProject.estimatedHours || 0}
                onChange={(e) =>
                  setNewProject({ ...newProject, estimatedHours: parseInt(e.target.value) || 0 })
                }
                placeholder="0"
                className="font-roboto"
              />
            </div>
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label htmlFor="status" className="font-roboto">
              Initial Status
            </Label>
            <Select
              value={newProject.status || 'tabled'}
              onValueChange={(value) => setNewProject({ ...newProject, status: value })}
            >
              <SelectTrigger className="font-roboto">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tabled">Tabled</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              className="font-roboto"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-brand-orange hover:bg-brand-orange-dark text-white font-roboto"
              disabled={createProjectMutation.isPending}
            >
              {createProjectMutation.isPending ? 'Creating...' : 'Create Project'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};