import React, { useEffect, useState } from 'react';
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
import { InsertProject } from '@shared/schema';

export const EditProjectDialog: React.FC = () => {
  const {
    showEditDialog,
    setShowEditDialog,
    editingProject,
    setEditingProject,
  } = useProjectContext();

  const { updateProjectMutation } = useProjectMutations();
  const [formData, setFormData] = useState<Partial<InsertProject>>({});

  // Populate form when editing project changes
  useEffect(() => {
    if (editingProject) {
      const derivedAssigneeIds = Array.isArray(editingProject.assigneeIds)
        ? editingProject.assigneeIds.map((id) => id?.toString())
        : editingProject.assigneeId !== null && editingProject.assigneeId !== undefined
          ? [editingProject.assigneeId.toString()]
          : [];
      const derivedSupportPeopleIds = Array.isArray(editingProject.supportPeopleIds)
        ? editingProject.supportPeopleIds.map((id) => id?.toString())
        : [];

      setFormData({
        title: editingProject.title || '',
        description: editingProject.description || '',
        status: editingProject.status || 'tabled',
        priority: editingProject.priority || 'medium',
        category: editingProject.category || 'technology',
        assigneeName: editingProject.assigneeName || '',
        assigneeIds: derivedAssigneeIds,
        supportPeople: editingProject.supportPeople || '',
        supportPeopleIds: derivedSupportPeopleIds,
        dueDate: editingProject.dueDate ? editingProject.dueDate.split('T')[0] : '',
        estimatedHours: editingProject.estimatedHours || 0,
        actualHours: editingProject.actualHours || 0,
        isMeetingProject: !!editingProject.googleSheetRowId,
        reviewInNextMeeting: editingProject.reviewInNextMeeting || false,
      });
    }
  }, [editingProject]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProject || !formData.title) {
      return;
    }
    updateProjectMutation.mutate({
      id: editingProject.id,
      ...formData,
    });
  };

  const handleClose = () => {
    setShowEditDialog(false);
    setEditingProject(null);
    setFormData({});
  };

  if (!editingProject) return null;

  return (
    <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-brand-primary">
            Edit Project
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
              value={formData.title || ''}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
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
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Enter project description"
              className="font-roboto min-h-[100px]"
            />
          </div>

          {/* Meeting Project Indicator (read-only) */}
          {editingProject.googleSheetRowId && (
            <div className="p-3 bg-brand-primary-lighter rounded-lg">
              <div className="flex items-center gap-2">
                <span className="text-sm font-roboto">📊 Meeting Project</span>
                <span className="text-xs text-gray-500">
                  (Synced with Google Sheets - Row #{editingProject.googleSheetRowId})
                </span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {/* Status */}
            <div className="space-y-2">
              <Label htmlFor="status" className="font-roboto">
                Status
              </Label>
              <Select
                value={formData.status || 'tabled'}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger className="font-roboto">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tabled">Tabled</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Priority */}
            <div className="space-y-2">
              <Label htmlFor="priority" className="font-roboto">
                Priority
              </Label>
              <Select
                value={formData.priority || 'medium'}
                onValueChange={(value) => setFormData({ ...formData, priority: value })}
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
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label htmlFor="category" className="font-roboto">
              Category
            </Label>
            <Select
              value={formData.category || 'technology'}
              onValueChange={(value) => setFormData({ ...formData, category: value })}
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

          {/* Assignees */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <ProjectAssigneeSelector
                label="Project Owner"
                value={formData.assigneeName || ''}
                onChange={(assigneeName, userIds) => {
                  const normalizedIds = userIds?.length ? [userIds[0]] : [];
                  setFormData({
                    ...formData,
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
              value={formData.supportPeople || ''}
              onChange={(supportPeople, userIds) => {
                setFormData({
                  ...formData,
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
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dueDate" className="font-roboto">
                Due Date
              </Label>
              <Input
                id="dueDate"
                type="date"
                value={formData.dueDate || ''}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
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
                value={formData.estimatedHours || 0}
                onChange={(e) =>
                  setFormData({ ...formData, estimatedHours: parseInt(e.target.value) || 0 })
                }
                placeholder="0"
                className="font-roboto"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="actualHours" className="font-roboto">
                Actual Hours
              </Label>
              <Input
                id="actualHours"
                type="number"
                value={formData.actualHours || 0}
                onChange={(e) =>
                  setFormData({ ...formData, actualHours: parseInt(e.target.value) || 0 })
                }
                placeholder="0"
                className="font-roboto"
              />
            </div>
          </div>

          {/* Review in Next Meeting */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="reviewInNextMeeting"
              checked={formData.reviewInNextMeeting || false}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, reviewInNextMeeting: checked as boolean })
              }
            />
            <label htmlFor="reviewInNextMeeting" className="text-sm font-roboto cursor-pointer">
              Review in next meeting
            </label>
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
              disabled={updateProjectMutation.isPending}
            >
              {updateProjectMutation.isPending ? 'Updating...' : 'Update Project'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};