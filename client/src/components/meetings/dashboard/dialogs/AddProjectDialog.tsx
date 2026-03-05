import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ProjectAssigneeSelector } from '@/components/project-assignee-selector';
import { Plus } from 'lucide-react';
import type { NewProjectData } from '../hooks/useProjects';

interface AddProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  newProjectData: NewProjectData;
  setNewProjectData: (data: NewProjectData) => void;
  handleCreateProject: () => void;
  isCreating: boolean;
}

export function AddProjectDialog({
  open,
  onOpenChange,
  newProjectData,
  setNewProjectData,
  handleCreateProject,
  isCreating,
}: AddProjectDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-2xl max-h-[85vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-teal-600" />
            Add New Project
          </DialogTitle>
          <DialogDescription>
            Create a new project that will appear in the agenda planning list and sync to Google Sheets
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Project Title - Required */}
          <div className="space-y-2">
            <Label htmlFor="project-title">
              Project Title <span className="text-red-500">*</span>
            </Label>
            <Input
              id="project-title"
              data-testid="input-project-title"
              value={newProjectData.title}
              onChange={(e) =>
                setNewProjectData({
                  ...newProjectData,
                  title: e.target.value,
                })
              }
              placeholder="Enter project title"
              className="text-base"
            />
          </div>

          {/* Project Description */}
          <div className="space-y-2">
            <Label htmlFor="project-description">Description</Label>
            <Textarea
              id="project-description"
              data-testid="textarea-project-description"
              value={newProjectData.description}
              onChange={(e) =>
                setNewProjectData({
                  ...newProjectData,
                  description: e.target.value,
                })
              }
              placeholder="Describe what this project involves..."
              rows={3}
            />
          </div>

          {/* Project Owner */}
          <div className="space-y-2">
            <Label htmlFor="project-owner">Project Owner</Label>
            <ProjectAssigneeSelector
              value={newProjectData.assigneeName || ''}
              onChange={(value, userIds) => {
                const normalizedIds = userIds?.length ? [userIds[0]] : [];
                setNewProjectData({
                  ...newProjectData,
                  assigneeName: value || '',
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

          {/* Support People */}
          <div className="space-y-2">
            <Label htmlFor="project-support">Support People</Label>
            <ProjectAssigneeSelector
              value={newProjectData.supportPeople || ''}
              onChange={(value, userIds) => {
                setNewProjectData({
                  ...newProjectData,
                  supportPeople: value || '',
                  supportPeopleIds:
                    userIds && userIds.length > 0
                      ? userIds
                          .map((id) => id?.toString())
                          .filter((id): id is string => Boolean(id))
                      : [],
                });
              }}
              placeholder="Select or enter support team members"
              multiple={true}
            />
          </div>

          {/* Due Date */}
          <div className="space-y-2">
            <Label htmlFor="project-due-date">Due Date</Label>
            <Input
              id="project-due-date"
              data-testid="input-project-due-date"
              type="date"
              value={newProjectData.dueDate}
              onChange={(e) =>
                setNewProjectData({
                  ...newProjectData,
                  dueDate: e.target.value,
                })
              }
            />
          </div>

          {/* Priority and Category */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="project-priority">Priority</Label>
              <Select
                value={newProjectData.priority}
                onValueChange={(value) =>
                  setNewProjectData({
                    ...newProjectData,
                    priority: value,
                  })
                }
              >
                <SelectTrigger data-testid="select-project-priority">
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

            <div className="space-y-2">
              <Label htmlFor="project-category">Category</Label>
              <Select
                value={newProjectData.category}
                onValueChange={(value) =>
                  setNewProjectData({
                    ...newProjectData,
                    category: value,
                  })
                }
              >
                <SelectTrigger data-testid="select-project-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="technology">Technology</SelectItem>
                  <SelectItem value="events">Events</SelectItem>
                  <SelectItem value="grants">Grants</SelectItem>
                  <SelectItem value="outreach">Outreach</SelectItem>
                  <SelectItem value="marketing">Marketing</SelectItem>
                  <SelectItem value="operations">Operations</SelectItem>
                  <SelectItem value="community">Community</SelectItem>
                  <SelectItem value="fundraising">Fundraising</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1"
            data-testid="button-cancel-project"
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreateProject}
            disabled={isCreating || !newProjectData.title.trim()}
            className="flex-1 bg-teal-600 hover:bg-teal-700 text-white"
            data-testid="button-create-project"
          >
            {isCreating ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Creating...
              </div>
            ) : (
              <>
                <Plus className="w-4 h-4 mr-2" />
                Create Project
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}