import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useDashboardNavigation } from '@/contexts/dashboard-navigation-context';
import { useActivityTracker } from '@/hooks/useActivityTracker';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  Plus,
  Edit,
  Trash2,
  Video,
  Phone,
  ArrowLeft,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { queryClient } from '@/lib/queryClient';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { useToast } from '@/hooks/use-toast';
import { useCollaboration } from '@/hooks/use-collaboration';
import { useAuth } from '@/hooks/useAuth';

interface Meeting {
  id: number;
  title: string;
  description: string;
  meetingDate: string;
  startTime: string;
  endTime: string;
  location: string;
  meetingType: 'in_person' | 'virtual' | 'hybrid';
  maxAttendees?: number;
  organizer: string;
  agenda?: string;
  meetingLink?: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  createdAt: string;
}

interface MeetingCalendarProps {
  isEmbedded?: boolean;
}

// Helper functions for presence indicators
const getInitials = (name: string | null | undefined) => {
  if (!name || typeof name !== 'string') return '??';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
};

const getAvatarColor = (name: string | null | undefined) => {
  const colors = [
    'bg-[#236383]', 'bg-[#007E8C]', 'bg-[#47B3CB]', 'bg-[#FBAD3F]',
    'bg-[#A31C41]', 'bg-[#2E7D32]',
  ];
  if (!name || typeof name !== 'string') return colors[0];
  const index = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
  return colors[index];
};

// Presence Indicators Component
function PresenceIndicators({ 
  presentUsers, 
  isConnected 
}: { 
  presentUsers: Array<{ userId: string; userName: string }>;
  isConnected: boolean;
}) {
  const { user } = useAuth();
  
  const otherUsers = presentUsers.filter(u => u.userId !== user?.id);
  const totalViewers = presentUsers.length;

  return (
    <TooltipProvider>
      <div className="flex items-center gap-3 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5">
              {isConnected ? (
                <Wifi className="h-4 w-4 text-green-500" data-testid="icon-connected" />
              ) : (
                <WifiOff className="h-4 w-4 text-red-500" data-testid="icon-disconnected" />
              )}
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>{isConnected ? 'Connected' : 'Disconnected'}</p>
          </TooltipContent>
        </Tooltip>

        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {totalViewers} {totalViewers === 1 ? 'person' : 'people'} viewing
          </span>
        </div>

        {otherUsers.length > 0 && (
          <div className="flex -space-x-2">
            {otherUsers.slice(0, 5).map((u, index) => (
              <Tooltip key={u.userId}>
                <TooltipTrigger asChild>
                  <Avatar 
                    className={`h-8 w-8 border-2 border-white dark:border-gray-800 ${getAvatarColor(u.userName)}`}
                    data-testid={`avatar-presence-${index}`}
                  >
                    <AvatarFallback className="text-white text-xs">
                      {getInitials(u.userName)}
                    </AvatarFallback>
                  </Avatar>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{u.userName}</p>
                </TooltipContent>
              </Tooltip>
            ))}
            {otherUsers.length > 5 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Avatar className="h-8 w-8 border-2 border-white dark:border-gray-800 bg-gray-500">
                    <AvatarFallback className="text-white text-xs">
                      +{otherUsers.length - 5}
                    </AvatarFallback>
                  </Avatar>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{otherUsers.slice(5).map(u => u.userName).join(', ')}</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

export default function MeetingCalendar({
  isEmbedded = false,
}: MeetingCalendarProps) {
  const { trackView, trackCreate, trackUpdate } = useActivityTracker();
  const { setActiveSection } = useDashboardNavigation();
  const { user } = useAuth();
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (!isEmbedded) {
      trackView(
        'Meetings',
        'Meetings',
        'Meeting Calendar',
        'User accessed meeting calendar page'
      );
    }
  }, [isEmbedded, trackView]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    meetingDate: '',
    startTime: '',
    agenda: '',
    meetingLink: '',
  });
  const { toast } = useToast();

  // Real-time collaboration hook
  const collaboration = useCollaboration({
    resourceType: 'planning-workspace',
    resourceId: 'meeting-calendar',
  });
  
  const isConnected = collaboration.isConnected;
  const presentUsers = collaboration.presentUsers;
  const onFieldUpdate = collaboration.onFieldUpdate;
  const emit = collaboration.emit;

  // Listen for real-time updates and refresh the meetings list
  useEffect(() => {
    const unsubscribe = onFieldUpdate((fieldName, value, version) => {
      // Invalidate queries to refresh meetings when any field is updated
      queryClient.invalidateQueries({ queryKey: ['/api/meetings'] });
      
      // Show a subtle toast notification with the user who made the change
      const updatedByName = presentUsers.find(u => u.userId !== user?.id)?.userName || 'Another team member';
      toast({
        title: 'Meeting calendar updated',
        description: `${updatedByName} made changes to the calendar`,
        duration: 3000,
      });
    });

    return unsubscribe;
  }, [onFieldUpdate, presentUsers, user, toast]);

  // Helper function to safely format dates
  const formatMeetingDate = (dateString: string) => {
    if (!dateString) return 'No date';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid date';
      return date.toLocaleDateString();
    } catch {
      return 'Invalid date';
    }
  };

  // Helper function to convert 24-hour time to 12-hour format
  const formatTime12Hour = (time24: string) => {
    if (!time24) return null;
    try {
      const [hours, minutes] = time24.split(':');
      const hour = parseInt(hours);
      const meridiem = hour >= 12 ? 'PM' : 'AM';
      const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
      return `${hour12}:${minutes} ${meridiem}`;
    } catch {
      return null;
    }
  };

  // Helper function to render time display only when both times exist
  const renderTimeInfo = (startTime: string, endTime: string) => {
    const formattedStart = formatTime12Hour(startTime);
    const formattedEnd = formatTime12Hour(endTime);

    if (!formattedStart && !formattedEnd) return null;
    if (formattedStart && formattedEnd)
      return `${formattedStart} - ${formattedEnd}`;
    if (formattedStart) return formattedStart;
    return null;
  };

  const { data: meetings = [], isLoading } = useQuery<Meeting[]>({
    queryKey: ['/api/meetings'],
  });

  // Ensure meetings is always an array to prevent filter errors
  const safeMeetings: Meeting[] = Array.isArray(meetings) ? meetings : [];

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create meeting');
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/meetings'] });
      
      // Broadcast the change to other connected users
      emit('meeting-created', {
        meetingId: data.id,
        title: data.title,
        userName: user?.display_name || `${user?.first_name} ${user?.last_name}` || 'Someone',
      });
      
      setIsCreating(false);
      setFormData({
        title: '',
        description: '',
        meetingDate: '',
        startTime: '',
        agenda: '',
        meetingLink: '',
      });
      if (!isEmbedded) {
        trackCreate(
          'Meetings',
          'Meetings',
          'Meeting Calendar',
          `Created meeting: ${data.title || formData.title}`
        );
      }
      toast({ title: 'Meeting scheduled successfully' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { id: number } & typeof formData) => {
      const response = await fetch(`/api/meetings/${data.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: data.title,
          description: data.description,
          meetingDate: data.meetingDate,
          startTime: data.startTime,
          agenda: data.agenda,
          meetingLink: data.meetingLink,
        }),
      });
      if (!response.ok) throw new Error('Failed to update meeting');
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/meetings'] });
      
      // Broadcast the change to other connected users
      emit('meeting-updated', {
        meetingId: data.id,
        title: data.title,
        userName: user?.display_name || `${user?.first_name} ${user?.last_name}` || 'Someone',
      });
      
      setEditingId(null);
      setFormData({
        title: '',
        description: '',
        meetingDate: '',
        startTime: '',
        agenda: '',
        meetingLink: '',
      });
      if (!isEmbedded) {
        trackUpdate(
          'Meetings',
          'Meetings',
          'Meeting Calendar',
          `Updated meeting: ${data.title || formData.title}`
        );
      }
      toast({ title: 'Meeting updated successfully' });
    },
    onError: () => {
      toast({ 
        title: 'Failed to update meeting',
        variant: 'destructive'
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (meetingId: number) => {
      const response = await fetch(`/api/meetings/${meetingId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete meeting');
      return response.json();
    },
    onSuccess: (deletedMeeting, meetingId) => {
      queryClient.invalidateQueries({ queryKey: ['/api/meetings'] });
      
      // Broadcast the deletion to other connected users
      emit('meeting-deleted', {
        meetingId,
        userName: user?.display_name || `${user?.first_name} ${user?.last_name}` || 'Someone',
      });
      
      toast({ title: 'Meeting deleted successfully' });
    },
    onError: () => {
      toast({ 
        title: 'Failed to delete meeting',
        variant: 'destructive'
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      updateMutation.mutate({ ...formData, id: editingId });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEditMeeting = (meeting: Meeting) => {
    setEditingId(meeting.id);
    setFormData({
      title: meeting.title,
      description: meeting.description || '',
      meetingDate: meeting.meetingDate ? new Date(meeting.meetingDate).toISOString().split('T')[0] : '',
      startTime: meeting.startTime || '',
      agenda: meeting.agenda || '',
      meetingLink: meeting.meetingLink || '',
    });
    setIsCreating(true);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setIsCreating(false);
    setFormData({
      title: '',
      description: '',
      meetingDate: '',
      startTime: '',
      agenda: '',
      meetingLink: '',
    });
  };

  const handleDeleteMeeting = (meetingId: number) => {
    deleteMutation.mutate(meetingId);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled':
        return 'bg-brand-primary-light text-brand-primary-dark';
      case 'in_progress':
        return 'bg-green-100 text-green-800';
      case 'completed':
        return 'bg-gray-100 text-gray-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getMeetingTypeIcon = (type: string) => {
    switch (type) {
      case 'virtual':
        return <Video className="w-4 h-4" />;
      case 'hybrid':
        return <Phone className="w-4 h-4" />;
      default:
        return <MapPin className="w-4 h-4" />;
    }
  };

  const isUpcoming = (meetingDate: string, startTime: string) => {
    const meetingDateTime = new Date(`${meetingDate}T${startTime}`);
    return meetingDateTime > new Date();
  };

  const upcomingMeetings = safeMeetings.filter(
    (meeting: Meeting) =>
      isUpcoming(meeting.meetingDate, meeting.startTime) &&
      meeting.status === 'scheduled'
  );

  const pastMeetings = safeMeetings.filter(
    (meeting: Meeting) =>
      !isUpcoming(meeting.meetingDate, meeting.startTime) ||
      meeting.status === 'completed'
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Navigation Header - only show when not embedded */}
      {!isEmbedded && (
        <div className="flex items-center gap-3 pb-4 border-b border-gray-200">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setActiveSection('meetings')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Meetings Hub
          </Button>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>Meetings</span>
            <span>•</span>
            <span className="text-gray-900 font-medium">Calendar</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center w-12 h-12 bg-brand-primary-light rounded-xl">
            <Calendar className="w-6 h-6 text-brand-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Calendar</h1>
            <p className="text-gray-600">
              Schedule and manage team meetings and events
            </p>
          </div>
        </div>
        <Button onClick={() => setIsCreating(true)} className="self-start">
          <Plus className="w-4 h-4 mr-2" />
          Schedule Meeting
        </Button>
      </div>

      {/* Presence Indicators - Real-time collaboration */}
      {presentUsers.length > 0 && (
        <PresenceIndicators 
          presentUsers={presentUsers} 
          isConnected={isConnected}
        />
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Calendar className="w-8 h-8 text-brand-primary" />
              <div>
                <p className="text-2xl font-bold">{upcomingMeetings.length}</p>
                <p className="text-sm text-gray-600">Upcoming</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Clock className="w-8 h-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{pastMeetings.length}</p>
                <p className="text-sm text-gray-600">Past</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Users className="w-8 h-8 text-purple-500" />
              <div>
                <p className="text-2xl font-bold">{meetings.length}</p>
                <p className="text-sm text-gray-600">Total Meetings</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Create/Edit Form */}
      {isCreating && (
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? 'Edit Meeting' : 'Schedule New Meeting'}</CardTitle>
            <CardDescription>
              {editingId ? 'Update meeting details' : 'Create a new meeting and send invitations'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Meeting Title
                </label>
                <Input
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  Description
                </label>
                <Textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Date</label>
                  <Input
                    type="date"
                    value={formData.meetingDate}
                    onChange={(e) =>
                      setFormData({ ...formData, meetingDate: e.target.value })
                    }
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Start Time (optional)
                  </label>
                  <Input
                    type="time"
                    value={formData.startTime}
                    onChange={(e) =>
                      setFormData({ ...formData, startTime: e.target.value })
                    }
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  Meeting Link (optional)
                </label>
                <Input
                  value={formData.meetingLink}
                  onChange={(e) =>
                    setFormData({ ...formData, meetingLink: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  Agenda (optional)
                </label>
                <Textarea
                  value={formData.agenda}
                  onChange={(e) =>
                    setFormData({ ...formData, agenda: e.target.value })
                  }
                  rows={4}
                />
              </div>
              <div className="flex gap-2">
                <Button 
                  type="submit" 
                  disabled={editingId ? updateMutation.isPending : createMutation.isPending}
                >
                  {editingId 
                    ? (updateMutation.isPending ? 'Updating...' : 'Update Meeting')
                    : (createMutation.isPending ? 'Scheduling...' : 'Schedule Meeting')
                  }
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancelEdit}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Upcoming Meetings */}
      {upcomingMeetings.length > 0 && (
        <div>
          <h2 className="text-base font-semibold mb-4">Upcoming Meetings</h2>
          <div className="space-y-4">
            {upcomingMeetings.map((meeting: Meeting) => (
              <Card key={meeting.id} className="border-l-4 border-l-brand-primary">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-base">
                          {meeting.title}
                        </h3>
                        <Badge className={getStatusColor(meeting.status)}>
                          {meeting.status.replace('_', ' ')}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 mb-2">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {formatMeetingDate(meeting.meetingDate)}
                        </span>
                        {renderTimeInfo(meeting.startTime, meeting.endTime) && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {renderTimeInfo(meeting.startTime, meeting.endTime)}
                          </span>
                        )}
                        {meeting.location && (
                          <span className="flex items-center gap-1">
                            {getMeetingTypeIcon(meeting.meetingType)}
                            {meeting.location}
                          </span>
                        )}
                      </div>
                      {meeting.description && (
                        <p className="text-gray-600 mb-2">
                          {meeting.description}
                        </p>
                      )}
                      {meeting.meetingLink && (
                        <p className="text-sm text-brand-primary">
                          Meeting Link:{' '}
                          <a
                            href={meeting.meetingLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline hover:no-underline"
                          >
                            {meeting.meetingLink}
                          </a>
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleEditMeeting(meeting)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <ConfirmationDialog
                        trigger={
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                            disabled={deleteMutation.isPending}
                            data-testid="button-delete-meeting"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        }
                        title="Delete Meeting"
                        description={`Are you sure you want to delete the meeting "${meeting.title}"? This action cannot be undone.`}
                        confirmText="Delete Meeting"
                        cancelText="Cancel"
                        onConfirm={() => handleDeleteMeeting(meeting.id)}
                        variant="destructive"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Past Meetings */}
      {pastMeetings.length > 0 && (
        <div>
          <h2 className="text-base font-semibold mb-4">Past Meetings</h2>
          <div className="space-y-4">
            {pastMeetings.slice(0, 5).map((meeting: Meeting) => (
              <Card key={meeting.id} className="opacity-75">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-base">
                          {meeting.title}
                        </h3>
                        <Badge className={getStatusColor(meeting.status)}>
                          {meeting.status.replace('_', ' ')}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {formatMeetingDate(meeting.meetingDate)}
                        </span>
                        {renderTimeInfo(meeting.startTime, meeting.endTime) && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {renderTimeInfo(meeting.startTime, meeting.endTime)}
                          </span>
                        )}
                        {meeting.location && (
                          <span className="flex items-center gap-1">
                            {getMeetingTypeIcon(meeting.meetingType)}
                            {meeting.location}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {meetings.length === 0 && !isCreating && (
        <Card>
          <CardContent className="text-center py-12">
            <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-base font-medium text-gray-900 mb-2">
              No meetings scheduled
            </h3>
            <p className="text-gray-600 mb-4">
              Start by scheduling your first team meeting
            </p>
            <Button onClick={() => setIsCreating(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Schedule First Meeting
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
