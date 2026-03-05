import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Edit3, CheckCircle2, Trash2 } from 'lucide-react';
import { normalizeDate } from '@/lib/date-utils';

interface EditMeetingData {
  title: string;
  date: string;
  time: string;
  type: string;
  location: string;
  description: string;
}

interface EditMeetingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editMeetingData: EditMeetingData;
  setEditMeetingData: (data: EditMeetingData) => void;
  handleUpdateMeeting: () => void;
  handleDeleteMeeting: () => void;
  isUpdating: boolean;
  isDeleting: boolean;
}

export function EditMeetingDialog({
  open,
  onOpenChange,
  editMeetingData,
  setEditMeetingData,
  handleUpdateMeeting,
  handleDeleteMeeting,
  isUpdating,
  isDeleting,
}: EditMeetingDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-md p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit3 className="w-5 h-5 text-orange-600" />
            Edit Meeting Details
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-title">Meeting Title *</Label>
            <Input
              id="edit-title"
              data-testid="input-edit-meeting-title"
              value={editMeetingData.title}
              onChange={(e) =>
                setEditMeetingData({
                  ...editMeetingData,
                  title: e.target.value,
                })
              }
              placeholder="Core Team Meeting"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="edit-date">Date *</Label>
              <Input
                id="edit-date"
                data-testid="input-edit-meeting-date"
                type="date"
                value={editMeetingData.date}
                onChange={(e) =>
                  setEditMeetingData({
                    ...editMeetingData,
                    date: normalizeDate(e.target.value),
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-time">Time</Label>
              <Input
                id="edit-time"
                data-testid="input-edit-meeting-time"
                type="time"
                value={editMeetingData.time}
                onChange={(e) =>
                  setEditMeetingData({
                    ...editMeetingData,
                    time: e.target.value,
                  })
                }
                placeholder="TBD"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-type">Meeting Type</Label>
            <Select
              value={editMeetingData.type}
              onValueChange={(value) =>
                setEditMeetingData({ ...editMeetingData, type: value })
              }
            >
              <SelectTrigger data-testid="select-edit-meeting-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="core_team">Core Team Meeting</SelectItem>
                <SelectItem value="committee">Committee Meeting</SelectItem>
                <SelectItem value="board">Board Meeting</SelectItem>
                <SelectItem value="planning">Planning Session</SelectItem>
                <SelectItem value="training">Training Session</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-location">Location</Label>
            <Input
              id="edit-location"
              data-testid="input-edit-meeting-location"
              value={editMeetingData.location}
              onChange={(e) =>
                setEditMeetingData({
                  ...editMeetingData,
                  location: e.target.value,
                })
              }
              placeholder="Conference room, Zoom link, etc."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-description">Description</Label>
            <Textarea
              id="edit-description"
              data-testid="textarea-edit-meeting-description"
              value={editMeetingData.description}
              onChange={(e) =>
                setEditMeetingData({
                  ...editMeetingData,
                  description: e.target.value,
                })
              }
              placeholder="Brief description of the meeting purpose..."
              rows={3}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              data-testid="button-cancel-edit-meeting"
              onClick={() => onOpenChange(false)}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              data-testid="button-delete-meeting"
              onClick={handleDeleteMeeting}
              disabled={isDeleting}
              className="px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDeleting ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
            </button>
            <button
              data-testid="button-update-meeting"
              onClick={handleUpdateMeeting}
              disabled={isUpdating}
              style={{ backgroundColor: '#FBAD3F' }}
              onMouseEnter={e => {
                if (!isUpdating) {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#e09d36';
                }
              }}
              onMouseLeave={e => {
                if (!isUpdating) {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#FBAD3F';
                }
              }}
              className="flex-1 flex items-center justify-center gap-2 disabled:from-gray-400 disabled:to-gray-500 text-white px-4 py-2 rounded-lg font-medium transition-all duration-200 disabled:cursor-not-allowed"
            >
              {isUpdating ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              Update Meeting
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}