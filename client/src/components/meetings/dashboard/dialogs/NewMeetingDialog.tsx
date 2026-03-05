import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, CalendarDays } from 'lucide-react';
import { normalizeDate } from '@/lib/date-utils';

interface NewMeetingData {
  title: string;
  date: string;
  time: string;
  type: string;
  location: string;
  description: string;
}

interface NewMeetingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  newMeetingData: NewMeetingData;
  setNewMeetingData: (data: NewMeetingData) => void;
  handleCreateMeeting: () => void;
  isCreating: boolean;
}

export function NewMeetingDialog({
  open,
  onOpenChange,
  newMeetingData,
  setNewMeetingData,
  handleCreateMeeting,
  isCreating,
}: NewMeetingDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-md p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-teal-600" />
            Schedule New Meeting
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Meeting Title *</Label>
            <Input
              id="title"
              data-testid="input-meeting-title"
              value={newMeetingData.title}
              onChange={(e) =>
                setNewMeetingData({
                  ...newMeetingData,
                  title: e.target.value,
                })
              }
              placeholder="Core Team Meeting"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="date">Date *</Label>
              <Input
                id="date"
                data-testid="input-meeting-date"
                type="date"
                value={newMeetingData.date}
                onChange={(e) =>
                  setNewMeetingData({
                    ...newMeetingData,
                    date: normalizeDate(e.target.value),
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="time">Time</Label>
              <Input
                id="time"
                data-testid="input-meeting-time"
                type="time"
                value={newMeetingData.time}
                onChange={(e) =>
                  setNewMeetingData({
                    ...newMeetingData,
                    time: e.target.value,
                  })
                }
                placeholder="TBD"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Meeting Type</Label>
            <Select
              value={newMeetingData.type}
              onValueChange={(value) =>
                setNewMeetingData({ ...newMeetingData, type: value })
              }
            >
              <SelectTrigger data-testid="select-meeting-type">
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
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              data-testid="input-meeting-location"
              value={newMeetingData.location}
              onChange={(e) =>
                setNewMeetingData({
                  ...newMeetingData,
                  location: e.target.value,
                })
              }
              placeholder="Conference room, Zoom link, etc."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              data-testid="textarea-meeting-description"
              value={newMeetingData.description}
              onChange={(e) =>
                setNewMeetingData({
                  ...newMeetingData,
                  description: e.target.value,
                })
              }
              placeholder="Brief description of the meeting purpose..."
              rows={3}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              data-testid="button-cancel-meeting"
              onClick={() => onOpenChange(false)}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              data-testid="button-create-meeting"
              onClick={handleCreateMeeting}
              disabled={isCreating}
              className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 disabled:from-gray-400 disabled:to-gray-500 text-white px-4 py-2 rounded-lg font-medium transition-all duration-200 disabled:cursor-not-allowed"
            >
              {isCreating ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <CalendarDays className="w-4 h-4" />
              )}
              Schedule Meeting
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}