import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Clock,
  RefreshCw,
  Mail,
  Phone,
  Eye,
  Trash2,
  Calendar,
  AlertTriangle,
  Edit2,
  Save,
  X,
  MessageSquare,
  FileText,
} from 'lucide-react';
import { formatEventDate } from '@/components/event-requests/utils';
import { statusColors, statusIcons, statusOptions, statusBorderColors, statusBgColors } from '@/components/event-requests/constants';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { MessageComposer } from '@/components/message-composer';
import { useEventCollaboration } from '@/hooks/use-event-collaboration';
import { CommentThread, CompactPresenceBadge } from '@/components/collaboration';
import { useAuth } from '@/hooks/useAuth';
import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { EventRequest } from '@shared/schema';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface PostponedCardProps {
  request: EventRequest;
  onView: () => void;
  onDelete: () => void;
  onContact: () => void;
  onCall: () => void;
  onReactivate: () => void;
  onLogContact: () => void;
  canDelete?: boolean;
  resolveUserName?: (id: string) => string;
}

// CardHeader component
interface CardHeaderProps {
  request: EventRequest;
  isInProcessStale?: boolean;
  canEdit?: boolean;
  isEditingThisCard?: boolean;
  editingField?: string;
  editingValue?: string;
  startEditing?: (field: string, value: string) => void;
  saveEdit?: () => void;
  cancelEdit?: () => void;
  setEditingValue?: (value: string) => void;
  resolveUserName?: (id: string) => string;
  presentUsers?: Array<{ userId: string; userName: string; joinedAt: Date; lastHeartbeat: Date; socketId: string }>;
  currentUserId?: string;
}

const CardHeader: React.FC<CardHeaderProps> = ({
  request,
  isInProcessStale,
  canEdit = false,
  isEditingThisCard = false,
  editingField = '',
  editingValue = '',
  startEditing,
  saveEdit,
  cancelEdit,
  setEditingValue,
  resolveUserName,
  presentUsers = [],
  currentUserId = '',
}) => {
  const StatusIcon = statusIcons[request.status as keyof typeof statusIcons] || statusIcons.new;
  
  // Get the proper status label from constants instead of just replacing underscores
  const getStatusLabel = (status: string) => {
    const statusOption = statusOptions.find(option => option.value === status);
    return statusOption ? statusOption.label : status.replace('_', ' ');
  };

  // Hide requested date once there's a scheduled date (keep requested date in database but don't display)
  const displayDate = request.scheduledEventDate || request.desiredEventDate;

  // Format the date for display
  const dateInfo = displayDate ? formatEventDate(displayDate.toString()) : null;

  // Calculate if date is past (compare dates in local timezone, not UTC)
  const isPast = (() => {
    if (!displayDate) return false;
    // Parse the event date as midnight local time (not UTC)
    const eventDate = new Date(displayDate + 'T00:00:00');
    // Get today's date at midnight local time
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // Event is past if the event date is before today
    return eventDate < today;
  })();

  // Calculate relative time
  const getRelativeTime = (dateString: string) => {
    // Fix timezone issue by treating both dates as local
    const date = new Date(dateString + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset time to start of day for fair comparison
    
    const diffTime = date.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays === -1) return 'Yesterday';
    if (diffDays > 0 && diffDays <= 7) return `In ${diffDays} days`;
    if (diffDays < 0 && diffDays >= -7) return `${Math.abs(diffDays)} days ago`;
    return '';
  };

  // Determine the date label and field to edit based on what date we're showing
  let dateLabel = 'Requested Date';
  let dateFieldToEdit = 'desiredEventDate';
  if (request.scheduledEventDate) {
    dateFieldToEdit = 'scheduledEventDate';
    if (request.status === 'completed') {
      dateLabel = 'Event Date';
    } else {
      dateLabel = 'Scheduled Date';
    }
  }

  // Parse date string safely without timezone issues
  const parseLocalDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  // Format date for input (YYYY-MM-DD)
  const formatDateForInput = (dateStr: string) => {
    if (!dateStr) return '';
    return dateStr.split('T')[0]; // Remove time part if present
  };

  // Check if we're editing this date field
  const isEditingDate = isEditingThisCard && editingField === dateFieldToEdit;

  return (
    <div className="flex items-start justify-between mb-4">
      <div className="flex items-start space-x-3 min-w-0 flex-1">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Real-time Presence Indicator */}
            {presentUsers && presentUsers.length > 0 && currentUserId && (
              <CompactPresenceBadge 
                users={presentUsers} 
                currentUserId={currentUserId}
                className="mr-1"
              />
            )}
            <h3 className="font-bold text-lg sm:text-xl text-[#236383] break-words min-w-0">
              {request.organizationName}
              {request.department && (
                <span className="text-[#236383]/70 font-medium ml-1">
                  &bull; {request.department}
                </span>
              )}
            </h3>
            {/* Partner Organizations */}
            {request.partnerOrganizations && Array.isArray(request.partnerOrganizations) && request.partnerOrganizations.length > 0 && (
              <div className="text-base sm:text-lg text-gray-600 mt-1">
                <span className="font-medium">Partner:</span>{' '}
                {request.partnerOrganizations.map((partner, index) => (
                  <span key={index}>
                    {partner.name}
                    {partner.department && ` • ${partner.department}`}
                    {index < request.partnerOrganizations.length - 1 && ', '}
                  </span>
                ))}
              </div>
            )}
            <Badge className="inline-flex items-center rounded-full px-2.5 py-0.5 font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 hover:bg-primary/80 bg-gradient-to-br from-amber-100 to-amber-200 text-amber-800 border border-amber-400/50 text-sm whitespace-nowrap">
              <StatusIcon className="w-3 h-3 mr-1" />
              {getStatusLabel(request.status)}
            </Badge>
            {isInProcessStale && (
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 whitespace-nowrap">
                <AlertTriangle className="w-3 h-3 mr-1" />
                Needs follow-up
              </Badge>
            )}
          </div>
          <div className="text-sm text-[#236383] mt-1 space-y-1">
            {/* Contact Information */}
            <div className="text-sm text-gray-700 mb-2">
              <strong>{request.firstName} {request.lastName}</strong>
              {request.email && (
                <span className="ml-2">• {request.email}</span>
              )}
              {request.phone && (
                <span className="ml-2">• {request.phone}</span>
              )}
            </div>
            {/* TSP Contact */}
            {(request.tspContact || request.customTspContact) && (
              <div className="text-sm text-[#D68319] mb-2">
                <span className="font-medium">TSP Contact: </span>
                <span className="font-normal">
                  {request.tspContact ? (resolveUserName ? resolveUserName(request.tspContact) : request.tspContact) : request.customTspContact}
                </span>
                {request.tspContactAssignedDate && (
                  <span className="ml-2 text-xs text-gray-500">
                    (assigned {new Date(request.tspContactAssignedDate).toLocaleDateString()})
                  </span>
                )}
              </div>
            )}
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {isEditingDate ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{dateLabel}:</span>
                  <Input
                    type="date"
                    value={formatDateForInput(editingValue)}
                    onChange={(e) => setEditingValue?.(e.target.value)}
                    className="h-8 w-40"
                    autoFocus
                    data-testid="input-date"
                  />
                  <Button size="sm" onClick={saveEdit} data-testid="button-save-date">
                    <Save className="w-3 h-3" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={cancelEdit} data-testid="button-cancel-date">
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 group">
                  <span data-testid="text-date-label" className="text-[16px]">
                    {dateLabel}: {' '}
                    <strong className="text-[16px]" data-testid="text-date-value">
                      {displayDate && dateInfo ? dateInfo.text : 'No date set'}
                    </strong>
                    {displayDate && getRelativeTime(displayDate.toString()) && (
                      <span className="text-[#236383] ml-1">({getRelativeTime(displayDate.toString())})</span>
                    )}
                  </span>
                  {canEdit && startEditing && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => startEditing(dateFieldToEdit, formatDateForInput(displayDate?.toString() || ''))}
                      className="h-6 px-2 opacity-30 group-hover:opacity-70 hover:opacity-100 transition-opacity"
                      title={`Edit ${dateLabel}`}
                      data-testid="button-edit-date"
                    >
                      <Edit2 className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const PostponedCard: React.FC<PostponedCardProps> = ({
  request,
  onView,
  onDelete,
  onContact,
  onCall,
  onReactivate,
  onLogContact,
  canDelete = true,
  resolveUserName,
}) => {
  const [showMessageDialog, setShowMessageDialog] = React.useState(false);
  const [showComments, setShowComments] = React.useState(false);
  const { user } = useAuth();
  const collaboration = useEventCollaboration(request.id);
  const dateInfo = formatEventDate(request.desiredEventDate || '');
  const tentativeDateInfo = request.tentativeNewDate ? formatEventDate(request.tentativeNewDate.toString()) : null;

  return (
    <Card 
      className={`transition-all duration-200 hover:shadow-[0_2px_6px_rgba(0,0,0,0.10)] border-l-[4px] bg-amber-50 shadow-[0_1px_4px_rgba(0,0,0,0.08)] border-[#D8DEE2] rounded-xl`}
      style={{ borderLeftColor: '#FBAD3F' }}
      data-testid={`card-postponed-${request.id}`}
    >
      <CardContent className="p-3">
        <CardHeader 
          request={request} 
          resolveUserName={resolveUserName}
          presentUsers={collaboration.presentUsers}
          currentUserId={user?.id}
        />

        {/* Postponement Info - Prominent Display */}
        <div className="space-y-3 mb-4">
          <div className="bg-amber-100 rounded-lg p-4 border-2 border-amber-300">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-5 h-5 text-amber-700" />
              <span className="text-base font-semibold text-amber-900">
                Event Postponed
              </span>
              {request.statusChangedAt && (
                <span className="text-sm text-amber-700">
                  on {new Date(request.statusChangedAt).toLocaleDateString()}
                </span>
              )}
            </div>
            
            {request.postponementReason && (
              <div className="mt-3">
                <p className="text-sm font-medium text-amber-900 mb-1">Reason:</p>
                <p className="text-sm text-amber-800">{request.postponementReason}</p>
              </div>
            )}

            {request.tentativeNewDate && (
              <div className="mt-3 bg-white/50 rounded p-2">
                <p className="text-sm font-medium text-amber-900 mb-1">Tentative New Date:</p>
                <p className="text-base font-semibold text-amber-900 flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {tentativeDateInfo?.display}
                </p>
              </div>
            )}

            {request.postponementNotes && (
              <div className="mt-3">
                <p className="text-sm font-medium text-amber-900 mb-1">Notes:</p>
                <p className="text-sm text-amber-800 whitespace-pre-wrap">{request.postponementNotes}</p>
              </div>
            )}
          </div>

          {/* Original Date Info */}
          <div className="bg-white/70 rounded-lg p-3 space-y-2">
            {request.originalScheduledDate && (
              <div>
                <p className="text-sm text-gray-500">Was Scheduled For</p>
                <p className="font-medium flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {new Date(request.originalScheduledDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              </div>
            )}
            <div>
              <p className="text-sm text-gray-500">Originally Requested Date</p>
              <p className="font-medium flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {dateInfo.display}
              </p>
            </div>
            {request.estimatedAttendance && (
              <div>
                <p className="text-sm text-gray-500">Estimated Attendance</p>
                <p className="font-medium">{request.estimatedAttendance}</p>
              </div>
            )}
            {request.estimatedSandwichCount && (
              <div>
                <p className="text-sm text-gray-500">Sandwich Count Requested</p>
                <p className="font-medium">{request.estimatedSandwichCount}</p>
              </div>
            )}
          </div>

          {/* Contact Info */}
          <div className="bg-white/70 rounded-lg p-3">
            <p className="text-sm font-medium mb-1">Contact:</p>
            <p className="text-sm">{request.firstName} {request.lastName}</p>
            <p className="text-sm text-gray-600">{request.email}</p>
            {request.phone && <p className="text-sm text-gray-600">{request.phone}</p>}
          </div>

          {/* General Notes */}
          {request.message && (
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-sm font-medium mb-1">Event Notes:</p>
              <p className="text-sm text-gray-600">{request.message}</p>
            </div>
          )}
        </div>

        {/* Communication & Notes Section */}
        {request.id && (
          <div className="bg-white rounded-lg p-4 mb-4 border border-gray-200">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowComments(!showComments)}
              className="w-full justify-between text-gray-700 hover:text-gray-700 hover:bg-gray-50 font-medium p-2 h-auto mb-2"
            >
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-gray-600" />
                <h3 className="text-sm font-semibold">Team Comments</h3>
                {collaboration.comments && collaboration.comments.length > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {collaboration.comments.length}
                  </Badge>
                )}
              </div>
              {showComments ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>

            {showComments && (
              <div className="mt-3 max-h-[500px]">
                <CommentThread
                  comments={collaboration.comments || []}
                  currentUserId={user?.id || ''}
                  currentUserName={user?.fullName || user?.email || ''}
                  eventId={request.id}
                  onAddComment={collaboration.addComment}
                  onEditComment={collaboration.updateComment}
                  onDeleteComment={collaboration.deleteComment}
                  isLoading={collaboration.commentsLoading || false}
                />
              </div>
            )}

          </div>
        )}

        {/* Action Buttons */}
        <TooltipProvider>
          <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t items-center">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="default"
                  onClick={onReactivate}
                  className="bg-[#FBAD3F] hover:bg-[#e89a2d] text-white h-8"
                  data-testid="button-reactivate"
                >
                  <RefreshCw className="w-4 h-4 mr-1" />
                  Reactivate Request
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Reactivate this postponed request</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" variant="outline" onClick={onView} data-testid="button-view" className="h-8">
                  <Eye className="w-4 h-4 mr-1" />
                  View Details
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>View event details</p>
              </TooltipContent>
            </Tooltip>

            {request.phone && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="sm" variant="outline" onClick={onCall} data-testid="button-call" className="h-8">
                    <Phone className="w-4 h-4 mr-1" />
                    Call
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Call the organizer</p>
                </TooltipContent>
              </Tooltip>
            )}

            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" variant="outline" onClick={onContact} data-testid="button-contact" className="h-8">
                  <Mail className="w-4 h-4 mr-1" />
                  Email
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Email the organizer</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onLogContact}
                  className="border-[#007E8C] text-[#007E8C] hover:bg-[#007E8C]/10 h-8"
                  data-testid="button-log-contact-bottom"
                >
                  <FileText className="w-4 h-4 mr-1" />
                  Log Contact
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Log a contact attempt or conversation</p>
              </TooltipContent>
            </Tooltip>

            <div className="flex-1" />

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  onClick={() => setShowMessageDialog(true)}
                  variant="ghost"
                  className="text-[#007E8C] hover:text-[#007E8C] hover:bg-[#007E8C]/10 h-8"
                  aria-label="Message about this event"
                  data-testid="button-message"
                >
                  <MessageSquare className="w-4 h-4" aria-hidden="true" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Message about this event</p>
              </TooltipContent>
            </Tooltip>

            {canDelete && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <ConfirmationDialog
                      trigger={
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-600 hover:text-red-700 h-8"
                          data-testid="button-delete-request"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      }
                      title="Delete Postponed Event"
                      description={`Are you sure you want to delete the postponed event request from ${request.organizationName}? This action cannot be undone.`}
                      confirmText="Delete Request"
                      cancelText="Cancel"
                      onConfirm={onDelete}
                      variant="destructive"
                    />
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Delete this event request</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </TooltipProvider>
      </CardContent>

      {/* Message Composer Dialog */}
      <Dialog open={showMessageDialog} onOpenChange={setShowMessageDialog}>
        <DialogContent className="w-[95vw] max-w-2xl">
          <DialogHeader>
            <DialogTitle>Message About Event: {request.organizationName}</DialogTitle>
          </DialogHeader>
          <MessageComposer
            contextType="event"
            contextId={request.id.toString()}
            contextTitle={`${request.organizationName} event`}
            onSent={() => setShowMessageDialog(false)}
            onCancel={() => setShowMessageDialog(false)}
          />
        </DialogContent>
      </Dialog>
    </Card>
  );
};
