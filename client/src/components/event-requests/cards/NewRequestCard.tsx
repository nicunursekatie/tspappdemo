import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEventQueries } from '../hooks/useEventQueries';
import { useReturningOrganization } from '@/hooks/use-returning-organization';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatDistanceToNow } from 'date-fns';
import {
  Calendar,
  Clock,
  Package,
  Phone,
  Mail,
  Edit,
  Trash2,
  Users,
  MapPin,
  UserPlus,
  Building,
  AlertTriangle,
  CalendarCheck,
  Edit2,
  Save,
  X,
  User,
  History,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Sparkles,
  CheckCircle,
  RefreshCw,
  Lock,
  Unlock,
  Ban,
} from 'lucide-react';
import { statusIcons, statusOptions, statusBorderColors, indicatorTooltips } from '@/components/event-requests/constants';
import { formatEventDate } from '@/components/event-requests/utils';
import { useDatePopulation, type DatePopulationInfo } from '@/components/event-requests/hooks/useDatePopulation';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { Input } from '@/components/ui/input';
import { formatSandwichTypesDisplay } from '@/lib/sandwich-utils';
import { getPrimaryContextualAction, getContextualTooltip } from '@/lib/contextual-actions';
import type { EventRequest } from '@shared/schema';
import { useAuth } from '@/hooks/useAuth';
import { hasPermission } from '@shared/unified-auth-utils';
import { PERMISSIONS } from '@shared/auth-utils';
import { EventRequestAuditLog } from '@/components/event-request-audit-log';
import { MessageComposer } from '@/components/message-composer';
import { useEventCollaboration } from '@/hooks/use-event-collaboration';
import { CommentThread, CompactPresenceBadge } from '@/components/collaboration';
import { invalidateEventRequestQueries } from '@/lib/queryClient';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface NewRequestCardProps {
  request: EventRequest;
  onEdit: () => void;
  onDelete: () => void;
  onCall?: () => void;
  onIntakeCall?: () => void;
  onContact: () => void;
  onToolkit: () => void;
  onScheduleCall: () => void;
  onAssignTspContact: () => void;
  onEditTspContact: () => void;
  onApprove: () => void;
  onDecline: () => void;
  onNonEvent?: () => void;
  onLogContact: () => void;
  onAiSuggest?: () => void;
  onAiIntakeAssist?: () => void;
  onAddNextAction?: () => void;
  onEditNextAction?: () => void;
  onCompleteNextAction?: () => void;
  onToggleCorporatePriority?: (isCorporatePriority: boolean) => void;
  canEdit?: boolean;
  canDelete?: boolean;
  // Inline editing props
  startEditing?: (field: string, value: string) => void;
  saveEdit?: () => void;
  cancelEdit?: () => void;
  setEditingValue?: (value: string) => void;
  isEditingThisCard?: boolean;
  editingField?: string;
  editingValue?: string;
  tempIsConfirmed?: boolean;
}

interface User {
  id: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  email: string;
  role?: string;
}

// Helper to linkify addresses in text
// Matches patterns like "123 Main St" or "123 Main Street, City, ST 12345"
const LinkifyAddresses: React.FC<{ text: string | null | undefined }> = ({ text }) => {
  // Handle null/undefined text
  if (!text) {
    return null;
  }

  // Regex to match common US address patterns
  // Matches: number + street name (+ optional suite/apt) + optional city, state zip
  const addressRegex = /(\d+\s+[\w\s]+(?:St(?:reet)?|Ave(?:nue)?|Blvd|Boulevard|Dr(?:ive)?|Rd|Road|Ln|Lane|Way|Pl(?:ace)?|Ct|Court|Cir(?:cle)?|Pkwy|Parkway|Hwy|Highway)\.?(?:\s*(?:#|Suite|Ste|Apt|Unit)\s*[\w-]+)?(?:\s*,?\s*[\w\s]+,?\s*[A-Z]{2}\s*\d{5}(?:-\d{4})?)?)/gi;

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  // Reset regex state
  addressRegex.lastIndex = 0;

  while ((match = addressRegex.exec(text)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    // Add the address as a link
    const address = match[1];
    parts.push(
      <a
        key={match.index}
        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[#236383] hover:text-[#1a4a63] underline"
      >
        {address}
      </a>
    );

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  // If no addresses found, return original text
  if (parts.length === 0) {
    return <>{text}</>;
  }

  return <>{parts}</>;
};

// CardHeader component - copied from shared
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
  handleConfirmToggleClick?: () => void;
  presentUsers?: Array<{ userId: string; userName: string; joinedAt: Date; lastHeartbeat: Date; socketId: string }>;
  currentUserId?: string;
  datePopulationInfo?: DatePopulationInfo;
  returningOrgData?: {
    isReturning: boolean;
    isReturningContact: boolean;
    pastEventCount: number;
    collectionCount: number;
    pastDepartments?: string[];
    mostRecentEvent?: {
      id: number;
      eventDate: string | null;
      status: string | null;
    };
    mostRecentCollection?: {
      id: number;
      dateCollected: string | null;
    };
    pastContactName?: string;
  };
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
  handleConfirmToggleClick,
  presentUsers = [],
  currentUserId = '',
  datePopulationInfo,
  returningOrgData,
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
            <h3 className="text-lg sm:text-xl font-bold text-[#236383] break-words min-w-0">
              {request.organizationName}
              {request.department && (
                <span className="text-base sm:text-lg font-normal text-gray-600 ml-2">
                  &bull; {request.department}
                </span>
              )}
            </h3>
            {/* Returning Organization Indicator - two-tier: same contact vs new contact */}
            {returningOrgData?.isReturning && (() => {
              // Determine most recent activity date (event or collection, whichever is later)
              const eventDate = returningOrgData.mostRecentEvent?.eventDate ? new Date(returningOrgData.mostRecentEvent.eventDate) : null;
              const collectionDate = returningOrgData.mostRecentCollection?.dateCollected ? new Date(returningOrgData.mostRecentCollection.dateCollected) : null;
              const lastDate = eventDate && collectionDate
                ? (eventDate > collectionDate ? eventDate : collectionDate)
                : eventDate || collectionDate;
              const lastDateLabel = lastDate && !isNaN(lastDate.getTime())
                ? lastDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
                : null;
              return (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge
                    variant="outline"
                    className={`whitespace-nowrap cursor-help ${
                      returningOrgData.isReturningContact
                        ? 'bg-purple-50 text-purple-700 border-purple-300'
                        : 'bg-amber-50 text-amber-700 border-amber-300'
                    }`}
                  >
                    <RefreshCw className="w-3 h-3 mr-1" />
                    Returning Org
                    {lastDateLabel && (
                      <span className="ml-1 text-xs opacity-80">&middot; Last: {lastDateLabel}</span>
                    )}
                    {returningOrgData.isReturningContact
                      ? <span className="ml-1 text-xs opacity-80">&middot; Same Contact</span>
                      : <span className="ml-1 text-xs opacity-80">&middot; New Contact</span>
                    }
                    {returningOrgData.pastEventCount > 0 && (
                      <span className="ml-1 text-xs opacity-80">
                        ({returningOrgData.pastEventCount} past event{returningOrgData.pastEventCount !== 1 ? 's' : ''})
                      </span>
                    )}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <div className="space-y-1">
                    <p className="font-medium">This organization has worked with us before!</p>
                    {returningOrgData.pastEventCount > 0 && (
                      <p className="text-sm">
                        {returningOrgData.pastEventCount} previous event{returningOrgData.pastEventCount !== 1 ? 's' : ''} on file
                      </p>
                    )}
                    {returningOrgData.collectionCount > 0 && (
                      <p className="text-sm">
                        {returningOrgData.collectionCount} sandwich collection{returningOrgData.collectionCount !== 1 ? 's' : ''} recorded
                      </p>
                    )}
                    {returningOrgData.mostRecentEvent && (
                      <p className="text-xs text-muted-foreground">
                        Most recent: {returningOrgData.mostRecentEvent.eventDate
                          ? new Date(returningOrgData.mostRecentEvent.eventDate).toLocaleDateString()
                          : 'Date unknown'}
                        {returningOrgData.mostRecentEvent.status && ` (${returningOrgData.mostRecentEvent.status})`}
                      </p>
                    )}
                    {returningOrgData.pastDepartments && returningOrgData.pastDepartments.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Past department{returningOrgData.pastDepartments.length !== 1 ? 's' : ''}: {returningOrgData.pastDepartments.join(', ')}
                      </p>
                    )}
                    {returningOrgData.isReturningContact ? (
                      <p className="text-xs text-purple-600 font-medium mt-2">
                        Same contact as a previous event &mdash; personalize your outreach!
                      </p>
                    ) : (
                      <div className="mt-2">
                        {returningOrgData.pastContactName && (
                          <p className="text-xs text-muted-foreground">
                            Past contact: {returningOrgData.pastContactName}
                          </p>
                        )}
                        <p className="text-xs text-amber-600 font-medium">
                          New contact for this org &mdash; treat as a first-time outreach
                        </p>
                      </div>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
              );
            })()}
            {/* New Department Indicator - shows when returning org has a department not seen in past events */}
            {returningOrgData?.isReturning && request.department && returningOrgData.pastDepartments && returningOrgData.pastDepartments.length > 0 && !returningOrgData.pastDepartments.some(
              d => d === (request.department || '').trim().replace(/\s+/g, ' ').toLowerCase()
            ) && (
              <Badge
                variant="outline"
                className="whitespace-nowrap bg-blue-50 text-blue-700 border-blue-300"
              >
                New Department
              </Badge>
            )}
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
            {isInProcessStale && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 whitespace-nowrap cursor-help">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    Needs follow-up
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{indicatorTooltips.needsFollowUp}</p>
                </TooltipContent>
              </Tooltip>
            )}
            {/* Corporate Priority Badge - Display only (toggle via edit form) */}
            {(request as any).isCorporatePriority && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge
                    className="px-2.5 py-1 text-sm font-medium shadow-sm inline-flex items-center whitespace-nowrap bg-gradient-to-br from-[#B8860B] to-[#DAA520] text-white"
                  >
                    <Building className="w-3 h-3 mr-1" />
                    Corporate
                  </Badge>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <div className="space-y-1">
                    <p className="font-medium">This is a Corporate Event</p>
                    <p className="text-sm">Requires immediate contact and core team member attendance.</p>
                  </div>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
          <div className="text-sm text-[#007E8C] mt-1 space-y-1">
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
                <div className="flex items-center gap-2 group flex-wrap">
                  <span data-testid="text-date-label" className="text-sm uppercase text-gray-600">
                    {dateLabel}: {' '}
                    <strong className="text-base font-bold text-[#236383]" data-testid="text-date-value">
                      {displayDate && dateInfo ? dateInfo.text : 'No date set'}
                    </strong>
                    {displayDate && getRelativeTime(displayDate.toString()) && (
                      <span className="text-[#007E8C] ml-1">({getRelativeTime(displayDate.toString())})</span>
                    )}
                  </span>
                  {/* Date Population Badges */}
                  {datePopulationInfo && datePopulationInfo.isOpen && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge
                          className="flex items-center gap-1 text-white text-xs px-2 py-0.5 cursor-help"
                          style={{ backgroundColor: '#47B3CB' }}
                        >
                          <CalendarCheck className="w-3 h-3" />
                          Open date
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{indicatorTooltips.openDate}</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                  {datePopulationInfo && datePopulationInfo.scheduledCount > 0 && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge
                          className="flex items-center gap-1 text-white text-xs px-2 py-0.5 cursor-help"
                          style={{ backgroundColor: '#FBAD3F' }}
                        >
                          <AlertTriangle className="w-3 h-3" />
                          {datePopulationInfo.scheduledCount} scheduled
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{indicatorTooltips.scheduledConflict}</p>
                        <p className="text-xs text-muted-foreground mt-1">{datePopulationInfo.scheduledCount} event{datePopulationInfo.scheduledCount > 1 ? 's' : ''} on this date</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                  {datePopulationInfo && datePopulationInfo.inProcessCount > 0 && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge
                          className="flex items-center gap-1 text-white text-xs px-2 py-0.5 cursor-help"
                          style={{ backgroundColor: '#007E8C' }}
                        >
                          <Calendar className="w-3 h-3" />
                          {datePopulationInfo.inProcessCount} in process
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{indicatorTooltips.inProcessConflict}</p>
                        <p className="text-xs text-muted-foreground mt-1">{datePopulationInfo.inProcessCount} event{datePopulationInfo.inProcessCount > 1 ? 's' : ''} on this date</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                  {/* Date Flexibility Indicator - only show when explicitly set */}
                  {displayDate && request.dateFlexible !== null && request.dateFlexible !== undefined && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge
                          variant="outline"
                          className={`flex items-center gap-1 text-xs px-2 py-0.5 cursor-help ${
                            request.dateFlexible === false
                              ? 'border-red-300 bg-red-50 text-red-700'
                              : 'border-green-300 bg-green-50 text-green-700'
                          }`}
                        >
                          {request.dateFlexible === false ? (
                            <>
                              <Lock className="w-3 h-3" />
                              Fixed date
                            </>
                          ) : (
                            <>
                              <Unlock className="w-3 h-3" />
                              Flexible
                            </>
                          )}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        {request.dateFlexible === false
                          ? 'This organization has a pre-planned event and cannot change the date'
                          : 'This organization is flexible and can adjust their date if needed'}
                      </TooltipContent>
                    </Tooltip>
                  )}
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

// CardContactInfo component - copied from shared
interface CardContactInfoProps {
  request: EventRequest;
  onCall?: () => void;
  onIntakeCall?: () => void;
  onContact?: () => void;
}

const CardContactInfo: React.FC<CardContactInfoProps> = ({
  request,
  onCall,
  onIntakeCall,
  onContact
}) => {
  const hasBackupContact = (request as any).backupContactFirstName || (request as any).backupContactLastName || (request as any).backupContactEmail || (request as any).backupContactPhone;

  return (
    <div className="bg-gray-50 rounded-lg p-3 space-y-3">
      {/* Primary Contact */}
      <div className="flex items-center justify-between gap-2">
        <div className="space-y-1 min-w-0 flex-1">
          {hasBackupContact && (
            <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Primary Contact</div>
          )}
          <div className="flex items-center gap-2 text-sm">
            <User className="w-4 h-4 text-gray-500 flex-shrink-0" />
            <span className="font-medium text-base break-words min-w-0">
              {request.firstName} {request.lastName}
            </span>
          </div>
          {request.email && (
            <div className="flex items-center gap-2 text-sm text-gray-600 min-w-0">
              <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <a
                href={`mailto:${request.email}`}
                className="text-brand-primary-muted hover:text-brand-primary-dark text-base break-all min-w-0"
              >
                {request.email}
              </a>
            </div>
          )}
          {request.phone && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <a
                href={`tel:${request.phone}`}
                className="text-brand-primary-muted hover:text-brand-primary-dark text-base whitespace-nowrap"
              >
                {request.phone}
              </a>
            </div>
          )}
          {request.eventAddress && (
            <div className="flex items-center gap-2 text-sm text-gray-600 min-w-0">
              <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(request.eventAddress)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#236383] hover:text-[#1a4a63] underline text-base break-words min-w-0"
              >
                {request.eventAddress}
              </a>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2 flex-shrink-0">
          {request.phone && (
            <>
              {onIntakeCall && (
                <Button
                  size="sm"
                  variant="default"
                  onClick={onIntakeCall}
                  className="text-sm h-8 bg-[#007E8C] hover:bg-[#236383] text-white"
                >
                  <Phone className="w-4 h-4 mr-1" />
                  Intake Call
                </Button>
              )}
              {onCall && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onCall}
                  className="text-sm h-8"
                >
                  <Phone className="w-4 h-4 mr-1" />
                  Call
                </Button>
              )}
            </>
          )}
          {onContact && (
            <Button
              size="sm"
              variant="outline"
              onClick={onContact}
              className="text-sm h-8"
            >
              <Mail className="w-4 h-4 mr-1" />
              Email
            </Button>
          )}
        </div>
      </div>

      {/* Backup Contact */}
      {hasBackupContact && (
        <div className="border-t border-gray-200 pt-3">
          <div className="space-y-1">
            <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Backup Contact</div>
            {((request as any).backupContactFirstName || (request as any).backupContactLastName) && (
              <div className="flex items-center gap-2 text-sm">
                <User className="w-4 h-4 text-gray-500 flex-shrink-0" />
                <span className="font-medium text-base break-words min-w-0">
                  {(request as any).backupContactFirstName} {(request as any).backupContactLastName}
                  {(request as any).backupContactRole && (
                    <span className="text-gray-500 font-normal ml-2">({(request as any).backupContactRole})</span>
                  )}
                </span>
              </div>
            )}
            {(request as any).backupContactEmail && (
              <div className="flex items-center gap-2 text-sm text-gray-600 min-w-0">
                <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <a
                  href={`mailto:${(request as any).backupContactEmail}`}
                  className="text-brand-primary-muted hover:text-brand-primary-dark text-base break-all min-w-0"
                >
                  {(request as any).backupContactEmail}
                </a>
              </div>
            )}
            {(request as any).backupContactPhone && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <a
                  href={`tel:${(request as any).backupContactPhone}`}
                  className="text-brand-primary-muted hover:text-brand-primary-dark text-base whitespace-nowrap"
                >
                  {(request as any).backupContactPhone}
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export const NewRequestCard: React.FC<NewRequestCardProps> = ({
  request,
  onEdit,
  onDelete,
  onCall,
  onIntakeCall,
  onContact,
  onToolkit,
  onScheduleCall,
  onAssignTspContact,
  onEditTspContact,
  onApprove,
  onDecline,
  onNonEvent,
  onLogContact,
  onAiSuggest,
  onAiIntakeAssist,
  onAddNextAction,
  onEditNextAction,
  onCompleteNextAction,
  onToggleCorporatePriority,
  canEdit = true,
  canDelete = true,
  // Inline editing props
  startEditing,
  saveEdit,
  cancelEdit,
  setEditingValue,
  isEditingThisCard = false,
  editingField = '',
  editingValue = '',
  tempIsConfirmed = false,
}) => {
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [showMessageDialog, setShowMessageDialog] = useState(false);
  const [showConfirmToggle, setShowConfirmToggle] = useState(false);
  const [pendingConfirmValue, setPendingConfirmValue] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Collaboration hook for comments
  const collaboration = useEventCollaboration(request.id);

  // Check if this organization is returning (has past events) and if the contact is the same
  // Contact matching requires email OR (name + phone) to prevent false positives from same names
  const contactFullName = [request.firstName, request.lastName].filter(Boolean).join(' ') || null;
  const { data: returningOrgData } = useReturningOrganization(
    request.organizationName,
    request.id,
    request.email,        // contactEmail - primary way to identify returning contact
    contactFullName,      // contactName - used with phone for secondary matching
    request.phone,        // contactPhone - used with name for secondary matching
    request.department,   // department - used for umbrella org matching (churches, scouts)
    ['new', 'in_process', 'scheduled'].includes(request.status || '') // Check for new, in-process, and scheduled requests
  );

  // Date population hook - to show warnings for busy dates
  const { getDatePopulation } = useDatePopulation();
  const displayDate = request.scheduledEventDate || request.desiredEventDate;
  const datePopulationInfo = getDatePopulation(displayDate, request.id);

  // Mutation for toggling date confirmation
  const toggleConfirmMutation = useMutation({
    mutationFn: async (newValue: boolean) => {
      const response = await fetch(`/api/event-requests/${request.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isConfirmed: newValue }),
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to update confirmation status');
      return response.json();
    },
    onSuccess: () => {
      invalidateEventRequestQueries(queryClient);
      setShowConfirmToggle(false);
    },
  });

  const handleConfirmToggleClick = () => {
    setPendingConfirmValue(!request.isConfirmed);
    setShowConfirmToggle(true);
  };

  // Use shared reference data from useEventQueries (eliminates duplicate API calls)
  const { users } = useEventQueries();

  // Helper function to get user display name from user ID
  const getUserDisplayName = (userId: string): string => {
    const user = users.find((u) => u.id === userId);
    if (!user) return userId;
    return (
      `${user.firstName || ''} ${user.lastName || ''}`.trim() ||
      user.displayName ||
      user.email ||
      'Unknown User'
    );
  };

  // Check if user can edit TSP contact assignments
  const canEditTspContact = hasPermission(
    user,
    PERMISSIONS.EVENT_REQUESTS_EDIT_TSP_CONTACT
  );
  return (
    <Card
      className={`transition-all duration-200 hover:shadow-[0_2px_6px_rgba(0,0,0,0.10)] border-l-[4px] bg-[#E2F5F6] shadow-[0_1px_4px_rgba(0,0,0,0.08)] border-[#D8DEE2] rounded-xl`}
      style={{ borderLeftColor: statusBorderColors.new }}
    >
      <CardContent className="p-3">
        <CardHeader
          request={request}
          canEdit={!!startEditing}
          isEditingThisCard={isEditingThisCard}
          editingField={editingField}
          editingValue={editingValue}
          startEditing={startEditing}
          saveEdit={saveEdit}
          cancelEdit={cancelEdit}
          setEditingValue={setEditingValue}
          handleConfirmToggleClick={handleConfirmToggleClick}
          presentUsers={collaboration.presentUsers}
          currentUserId={user?.id}
          datePopulationInfo={datePopulationInfo}
          returningOrgData={returningOrgData}
        />

        {/* Next Action - Prominent display for intake tracking */}
        {request.nextAction ? (
          <div className="mb-4 p-3 bg-amber-50 border-2 border-amber-300 rounded-lg">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2 flex-1">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <span className="text-sm font-bold text-amber-800 uppercase tracking-wide">Next Action:</span>
                  <p className="mt-1 text-amber-900 font-medium">{request.nextAction}</p>
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                {onEditNextAction && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={onEditNextAction}
                    className="h-7 text-xs border-amber-400 text-amber-700 hover:bg-amber-100"
                  >
                    <Edit className="w-3 h-3 mr-1" />
                    Edit
                  </Button>
                )}
                {onCompleteNextAction && (
                  <Button
                    size="sm"
                    variant="default"
                    onClick={onCompleteNextAction}
                    className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white"
                  >
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Complete
                  </Button>
                )}
              </div>
            </div>
          </div>
        ) : (
          onAddNextAction && (
            <div className="mb-4 flex items-center justify-end">
              <Button
                size="sm"
                variant="outline"
                onClick={onAddNextAction}
                className="h-7 text-xs border-amber-400 text-amber-700 hover:bg-amber-100"
              >
                <AlertTriangle className="w-3 h-3 mr-1" />
                Add Action
              </Button>
            </div>
          )
        )}

        {/* Scheduled Call Info */}
        {request.scheduledCallDate && (
          <div className="mb-4 bg-brand-primary-lighter rounded-lg p-3">
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-brand-primary-muted" />
              <span className="text-sm font-medium">Call scheduled:</span>
              <span className="text-sm">
                {(() => {
                  const date = new Date(request.scheduledCallDate);
                  const hours = date.getHours();
                  const minutes = date.getMinutes();
                  // If time is midnight (00:00), show date only
                  if (hours === 0 && minutes === 0) {
                    return date.toLocaleDateString();
                  }
                  return date.toLocaleString();
                })()}
              </span>
            </div>
          </div>
        )}

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 mb-4">
          {/* Left Column - Event Details */}
          <div className="space-y-3">
            {/* Submitted Info */}
            <div className="bg-brand-primary-lighter rounded-lg p-3">
              <p className="text-sm uppercase font-bold tracking-wide text-[#236383] mb-1">
                Submitted
              </p>
              <div className="space-y-1">
                <div className="font-medium flex items-center gap-2 text-base">
                  <Clock className="w-4 h-4" />
                  {request.createdAt
                    ? new Date(request.createdAt).toLocaleDateString() +
                      ' at ' +
                      new Date(request.createdAt).toLocaleTimeString()
                    : 'Unknown date'}
                  {request.createdAt && (
                    <Badge className="ml-1 bg-[#236383] text-white border-0 shadow-lg hover:bg-[#007E8C] transition-all duration-200 text-sm">
                      {formatDistanceToNow(new Date(request.createdAt), {
                        addSuffix: true,
                      })}
                    </Badge>
                  )}
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mt-2">
                  {(request.contactAttempts || request.lastContactAttempt) && (
                    <div className="text-sm text-gray-600 flex flex-wrap items-center gap-2">
                      <Phone className="w-3 h-3 flex-shrink-0" />
                      {request.contactAttempts && request.contactAttempts > 0 && (
                        <span>Contact attempts: {request.contactAttempts}</span>
                      )}
                      {request.lastContactAttempt && (
                        <span className="text-xs">
                          (Last: {formatDistanceToNow(new Date(request.lastContactAttempt), { addSuffix: true })})
                        </span>
                      )}
                    </div>
                  )}
                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onScheduleCall}
                      className="h-7 text-xs flex items-center gap-1 border-blue-300 hover:bg-blue-50 text-blue-700"
                    >
                      <Calendar className="w-3 h-3" />
                      {request.scheduledCallDate ? 'Reschedule' : 'Schedule Call'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onLogContact}
                      className="h-7 text-xs flex items-center gap-1"
                    >
                      <Phone className="w-3 h-3" />
                      Log Contact
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Sandwich Info */}
            {(request.estimatedSandwichCount !== undefined && request.estimatedSandwichCount !== null) || request.sandwichTypes ? (
              <div className="bg-amber-50 rounded-lg p-3">
                <div className="flex items-center gap-2 text-sm">
                  <Package className="w-4 h-4 text-amber-600" />
                  <span className="font-medium">Sandwiches:</span>
                  <span>
                    {formatSandwichTypesDisplay(
                      request.sandwichTypes,
                      request.estimatedSandwichCount ?? undefined
                    )}
                  </span>
                </div>
              </div>
            ) : null}

            {/* Previous Host Status */}
            {typeof request.hasHostedBefore !== 'undefined' && (
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-sm uppercase font-bold tracking-wide text-[#236383]">
                    Previously hosted:
                  </span>
                  <Badge
                    className={
                      request.hasHostedBefore
                        ? 'inline-flex items-center rounded-full px-2.5 py-0.5 font-semibold focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-[#007E8C] text-white border-0 shadow-lg hover:bg-[#47B3CB] transition-all duration-200 text-sm'
                        : 'inline-flex items-center rounded-full px-2.5 py-0.5 font-semibold focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-[#236383] text-white border-0 shadow-lg hover:bg-[#007E8C] transition-all duration-200 text-sm'
                    }
                  >
                    {request.hasHostedBefore ? 'Yes' : 'No - First Time'}
                  </Badge>
                </div>
              </div>
            )}

            {/* Message from Event Request */}
            {request.message && request.message.trim() && (
              <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                <div className="flex items-start gap-2">
                  <MessageSquare className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm uppercase font-bold tracking-wide text-blue-700 mb-1">
                      Message from Request:
                    </p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">
                      <LinkifyAddresses text={request.message} />
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Contact Info */}
          <div className="space-y-3">
            <CardContactInfo
              request={request}
              onCall={onCall}
              onIntakeCall={onIntakeCall}
              onContact={onContact}
            />

            {/* TSP Contact Assignment Status */}
            {(request.tspContact || request.customTspContact) && (
              <div
                className="rounded-lg p-3 border border-[#FBAD3F] shadow-sm"
                style={{ backgroundColor: '#FFF4E6', borderColor: '#FBAD3F' }}
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <UserPlus className="w-4 h-4 text-[#E5901A] flex-shrink-0" />
                    <span className="font-semibold text-[#D68319] whitespace-nowrap">
                      TSP Contact:
                    </span>
                    <span className="font-medium text-[#C7761A] break-words min-w-0">
                      {request.tspContact
                        ? getUserDisplayName(request.tspContact)
                        : request.customTspContact}
                    </span>
                  </div>
                  {canEditTspContact && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={onEditTspContact}
                      className="h-7 px-2 text-[#D68319] hover:bg-[#FBAD3F]/20 flex-shrink-0"
                      data-testid="button-edit-tsp-contact"
                    >
                      <Edit className="w-3 h-3" />
                    </Button>
                  )}
                </div>
                {request.tspContactAssignedDate && (
                  <p className="text-sm text-[#D68319] mt-1">
                    Assigned on{' '}
                    {new Date(
                      request.tspContactAssignedDate
                    ).toLocaleDateString()}
                  </p>
                )}
              </div>
            )}
          </div>
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
            {/* TSP Contact Assignment - only show if not already assigned and user has permission */}
            {!(request.tspContact || request.customTspContact) && canEditTspContact && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={onAssignTspContact}
                    className="border-yellow-500 text-yellow-700 hover:bg-yellow-50 h-8"
                  >
                    <UserPlus className="w-4 h-4 mr-1" />
                    Assign TSP Contact
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Assign a TSP contact to this event request</p>
                </TooltipContent>
              </Tooltip>
            )}

            {/* AI Date Suggestion - show if there are dates to analyze */}
            {(request.desiredEventDate || request.backupDates?.length) && onAiSuggest && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={onAiSuggest}
                    className="border-[#236383] text-[#236383] hover:bg-[#236383]/10 h-8"
                    data-testid="button-ai-suggest-date"
                  >
                    <Sparkles className="w-4 h-4 mr-1" />
                    AI Date Suggest
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Get AI suggestions for the best event date</p>
                </TooltipContent>
              </Tooltip>
            )}

            {/* AI Intake Assistant - always available */}
            {onAiIntakeAssist && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={onAiIntakeAssist}
                    className="border-[#47B3CB] text-[#47B3CB] hover:bg-[#47B3CB]/10 h-8"
                    data-testid="button-ai-intake-assist"
                  >
                    <Sparkles className="w-4 h-4 mr-1" />
                    AI Intake Check
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Use AI to check intake information</p>
                </TooltipContent>
              </Tooltip>
            )}

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="default"
                  onClick={onToolkit}
                  className="bg-[#FBAD3F] hover:bg-[#e89a2d] text-white h-8"
                >
                  <Package className="w-4 h-4 mr-1" />
                  Send Toolkit
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Send toolkit email to the organizer</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onScheduleCall}
                  className="h-8"
                >
                  <Phone className="w-4 h-4 mr-1" />
                  Schedule Call
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Schedule a call with the organizer</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onLogContact}
                  className="border-[#007E8C] text-[#007E8C] hover:bg-[#007E8C]/10 h-8"
                >
                  <MessageSquare className="w-4 h-4 mr-1" />
                  Log Contact
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Log a contact attempt or conversation</p>
              </TooltipContent>
            </Tooltip>

            {onNonEvent && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={onNonEvent}
                    className="text-stone-500 hover:text-stone-700 hover:bg-stone-100 h-8"
                    data-testid="button-non-event"
                  >
                    <Ban className="w-4 h-4 mr-1" />
                    Non-Event
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Mark as non-event (not a real event request)</p>
                </TooltipContent>
              </Tooltip>
            )}

            <div className="flex-1" />

            {/* Edit Button - Always show for new requests */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onEdit}
                  className="h-8"
                  data-testid="button-edit-request"
                >
                  <Edit className="w-4 h-4 mr-1.5" />
                  <span className="hidden sm:inline">{getPrimaryContextualAction(request)?.label || 'Edit'}</span>
                  <span className="sm:hidden">Edit</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{getContextualTooltip(request)}</p>
              </TooltipContent>
            </Tooltip>
            {canDelete && (
              <ConfirmationDialog
                trigger={
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-600 hover:text-red-700 h-8"
                    data-testid="button-delete-request"
                    title="Delete this event request"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                }
                title="Delete Event Request"
                description={`Are you sure you want to delete the event request from ${request.organizationName}? This action cannot be undone.`}
                confirmText="Delete Request"
                cancelText="Cancel"
                onConfirm={onDelete}
                variant="destructive"
              />
            )}
          </div>
        </TooltipProvider>

        {/* Audit Log Section */}
        <div className="mt-4 border-t border-gray-200 pt-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setShowAuditLog(!showAuditLog);
            }}
            className="w-full justify-between text-gray-600 hover:text-gray-800 p-2 h-8"
            data-testid="button-toggle-audit-log"
            type="button"
          >
            <div className="flex items-center gap-2">
              <History className="w-4 h-4" />
              <span className="text-sm">Activity History</span>
            </div>
            {showAuditLog ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </Button>
          
          {showAuditLog && (
            <div className="mt-3" data-testid="audit-log-section">
              <EventRequestAuditLog
                eventId={request.id?.toString()}
                showFilters={false}
                compact={true}
              />
            </div>
          )}
        </div>

        {/* Confirmation Toggle Dialog */}
        <ConfirmationDialog
          isOpen={showConfirmToggle}
          onClose={() => setShowConfirmToggle(false)}
          onConfirm={() => toggleConfirmMutation.mutate(pendingConfirmValue)}
          title={pendingConfirmValue ? 'Confirm Date' : 'Mark Date as Pending'}
          message={
            pendingConfirmValue
              ? 'Are you sure you want to mark this date as confirmed?'
              : 'Are you sure you want to mark this date as pending?'
          }
          confirmText="Yes, Update"
          cancelText="Cancel"
        />
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
