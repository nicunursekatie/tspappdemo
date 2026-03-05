import * as React from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Bell,
  MessageCircle,
  AlertCircle,
  CheckCircle,
  Info,
  Star,
  X,
  Archive,
  ExternalLink,
  Calendar,
  Users,
  Settings,
  Filter,
  MoreVertical,
  Hash,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { NotificationActionButton } from './NotificationActionButton';
import { useNotificationSocket } from '@/hooks/useNotificationSocket';
import { useStreamChatUnread } from '@/hooks/useStreamChatUnread';
import { OnboardingTooltip } from '@/components/ui/onboarding-tooltip';
import { useOnboarding } from '@/hooks/useOnboarding';

interface Notification {
  id: number;
  userId: string;
  type: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  title: string;
  message: string;
  category?: string;
  actionUrl?: string;
  actionText?: string;
  isRead: boolean;
  isArchived: boolean;
  createdAt: string;
  expiresAt?: string;
  metadata?: any;
  relatedType?: string;
  relatedId?: number;
}

interface NotificationCounts {
  total: number;
  byCategory: Record<string, number>;
  byPriority: Record<string, number>;
}

interface EnhancedNotificationsProps {
  user: any;
}

const getPriorityIcon = (priority: string) => {
  switch (priority) {
    case 'urgent':
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    case 'high':
      return <AlertCircle className="h-4 w-4 text-orange-500" />;
    case 'medium':
      return <Info className="h-4 w-4 text-blue-500" />;
    case 'low':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    default:
      return <Info className="h-4 w-4 text-blue-500" />;
  }
};

const getCategoryIcon = (category?: string) => {
  switch (category) {
    case 'social':
      return <Users className="h-4 w-4" />;
    case 'system':
      return <Settings className="h-4 w-4" />;
    case 'event':
      return <Calendar className="h-4 w-4" />;
    case 'task':
      return <CheckCircle className="h-4 w-4" />;
    default:
      return <Bell className="h-4 w-4" />;
  }
};

const getPriorityBadgeColor = (priority: string) => {
  switch (priority) {
    case 'urgent':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'high':
      return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'medium':
      return 'bg-brand-primary-light text-brand-primary-dark border-brand-primary-border';
    case 'low':
      return 'bg-green-100 text-green-800 border-green-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

function EnhancedNotifications({ user }: EnhancedNotificationsProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = React.useState(false);
  const [currentTab, setCurrentTab] = React.useState('all');
  const [showFilters, setShowFilters] = React.useState(false);
  const [filters, setFilters] = React.useState({
    unreadOnly: false,
    categories: [] as string[],
    priorities: [] as string[],
  });

  // Onboarding tooltip state
  const { shouldShowStep, completeStep } = useOnboarding();

  // Connect to Socket.IO for real-time notification updates
  const { connected: socketConnected } = useNotificationSocket();

  // Get Stream Chat unread counts
  const {
    totalUnread: streamChatUnread,
    roomsUnread,
    dmsUnread,
    groupsUnread,
    roomDetails,
  } = useStreamChatUnread();

  // Keyboard navigation support
  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    },
    [isOpen]
  );

  if (!user) return null;

  // Query for notification counts
  const { data: counts } = useQuery<NotificationCounts>({
    queryKey: ['/api/notifications/counts'],
    enabled: !!user,
    refetchInterval: 5 * 60 * 1000, // Poll every 5 minutes (reduced from 30 seconds)
  });

  // Query for notifications with filters
  const { data: notificationsData, isLoading } = useQuery({
    queryKey: ['/api/notifications', currentTab, filters],
    enabled: !!user && isOpen,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (currentTab === 'unread') params.set('unread_only', 'true');
      if (filters.categories.length > 0)
        params.set('category', filters.categories[0]);
      if (filters.unreadOnly) params.set('unread_only', 'true');

      return apiRequest('GET', `/api/notifications?${params.toString()}`);
    },
  });

  // Mark notification as read mutation with optimistic update
  const markAsReadMutation = useMutation({
    mutationFn: (notificationId: number) =>
      apiRequest('PATCH', `/api/notifications/${notificationId}/read`),
    onMutate: async (notificationId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['/api/notifications'] });

      // Snapshot previous value
      const previousNotifications = queryClient.getQueryData([
        '/api/notifications',
        currentTab,
        filters,
      ]);

      // Optimistically update to the new value
      queryClient.setQueryData(
        ['/api/notifications', currentTab, filters],
        (old: any) => {
          if (!old) return old;
          return old.map((notif: Notification) =>
            notif.id === notificationId ? { ...notif, isRead: true } : notif
          );
        }
      );

      // Return context with previous value
      return { previousNotifications };
    },
    onError: (err, notificationId, context: any) => {
      // Rollback on error
      if (context?.previousNotifications) {
        queryClient.setQueryData(
          ['/api/notifications', currentTab, filters],
          context.previousNotifications
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      queryClient.invalidateQueries({
        queryKey: ['/api/notifications/counts'],
      });
    },
  });

  // Archive notification mutation with optimistic update
  const archiveNotificationMutation = useMutation({
    mutationFn: (notificationId: number) =>
      apiRequest('PATCH', `/api/notifications/${notificationId}/archive`),
    onMutate: async (notificationId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['/api/notifications'] });

      // Snapshot previous value
      const previousNotifications = queryClient.getQueryData([
        '/api/notifications',
        currentTab,
        filters,
      ]);

      // Optimistically remove from list
      queryClient.setQueryData(
        ['/api/notifications', currentTab, filters],
        (old: any) => {
          if (!old) return old;
          return old.filter(
            (notif: Notification) => notif.id !== notificationId
          );
        }
      );

      // Return context with previous value
      return { previousNotifications };
    },
    onError: (err: any, notificationId, context: any) => {
      // Rollback on error
      if (context?.previousNotifications) {
        queryClient.setQueryData(
          ['/api/notifications', currentTab, filters],
          context.previousNotifications
        );
      }
      // Show error toast
      toast({
        title: 'Failed to archive notification',
        description:
          err?.message || 'An error occurred while archiving the notification',
        variant: 'destructive',
      });
      console.error('Archive notification error:', err);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      queryClient.invalidateQueries({
        queryKey: ['/api/notifications/counts'],
      });
      // Success is handled by optimistic update - no need for toast
    },
  });

  // Mark all as read mutation
  const markAllAsReadMutation = useMutation({
    mutationFn: () =>
      apiRequest('PATCH', '/api/notifications/bulk/read', {
        notificationIds: [],
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      queryClient.invalidateQueries({
        queryKey: ['/api/notifications/counts'],
      });
    },
  });

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      markAsReadMutation.mutate(notification.id);
    }

    // If there's an action button, don't auto-navigate - let the button handle it
    if (notification.actionUrl && !notification.actionText) {
      if (notification.actionUrl.startsWith('http')) {
        window.open(notification.actionUrl, '_blank');
      } else {
        window.location.href = notification.actionUrl;
      }
    }
  };

  const handleArchive = (notification: Notification, e: React.MouseEvent) => {
    e.stopPropagation();
    archiveNotificationMutation.mutate(notification.id);
  };

  const notifications = notificationsData?.notifications || [];
  const systemUnreadCount = counts?.total || 0;
  // Combined count includes both system notifications and chat messages
  const totalUnreadCount = systemUnreadCount + (streamChatUnread || 0);

  // Check if we should show the notifications onboarding tooltip
  const showNotificationsTooltip =
    totalUnreadCount > 0 &&
    !shouldShowStep('nav-badge-intro') && // Don't show until nav intro is done
    shouldShowStep('notifications-badge');

  return (
    <DropdownMenu
      open={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open);
        // Complete the onboarding step when user opens notifications
        if (open && showNotificationsTooltip) {
          completeStep('notifications-badge');
        }
      }}
    >
      <OnboardingTooltip
        step="notifications-badge"
        position="bottom"
        showWhen={showNotificationsTooltip && !isOpen}
        delay={2500}
        completeOnChildClick={true}
      >
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'relative h-9 w-9 p-0 text-white/80 hover:text-white hover:bg-white/15',
              showNotificationsTooltip && 'animate-pulse'
            )}
            data-testid="button-notifications-enhanced"
            aria-label={`Notifications ${totalUnreadCount > 0 ? `(${totalUnreadCount} unread)` : ''}`}
            aria-expanded={isOpen}
            aria-haspopup="menu"
          >
            <Bell className="h-4 w-4" aria-hidden="true" />
            {totalUnreadCount > 0 && (
              <Badge
                variant="destructive"
                className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
                data-testid="badge-notification-count"
                aria-label={`${totalUnreadCount} unread notifications`}
              >
                {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
      </OnboardingTooltip>

      <DropdownMenuContent
        align="end"
        className="w-[calc(100vw-2rem)] sm:w-96 max-h-[80vh] sm:max-h-96"
        data-testid="dropdown-notifications-enhanced"
        role="menu"
        aria-label="Notification center"
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center justify-between p-4 pb-2">
          <h4 className="font-semibold text-sm">Notifications</h4>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="h-7 w-7 p-0"
              data-testid="button-toggle-filters"
            >
              <Filter className="h-3 w-3" />
            </Button>
            {systemUnreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => markAllAsReadMutation.mutate()}
                className="text-xs h-7 px-2 hidden sm:inline-flex"
                data-testid="button-mark-all-read"
              >
                Mark all read
              </Button>
            )}
          </div>
        </div>

        {showFilters && (
          <div className="px-4 pb-2">
            <div className="flex flex-wrap gap-1">
              {counts?.byCategory &&
                Object.keys(counts.byCategory).map((category) => (
                  <Badge
                    key={category}
                    variant={
                      filters.categories.includes(category)
                        ? 'default'
                        : 'outline'
                    }
                    className="text-xs cursor-pointer"
                    onClick={() => {
                      setFilters((prev) => ({
                        ...prev,
                        categories: prev.categories.includes(category)
                          ? prev.categories.filter((c) => c !== category)
                          : [category],
                      }));
                    }}
                    data-testid={`filter-category-${category}`}
                  >
                    {category} ({counts.byCategory[category]})
                  </Badge>
                ))}
            </div>
          </div>
        )}

        <Separator />

        <Tabs
          value={currentTab}
          onValueChange={setCurrentTab}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-3 m-2 mb-0">
            <TabsTrigger value="all" className="text-xs" data-testid="tab-all">
              All
            </TabsTrigger>
            <TabsTrigger
              value="chat"
              className="text-xs"
              data-testid="tab-chat"
            >
              Chat {streamChatUnread > 0 && `(${streamChatUnread})`}
            </TabsTrigger>
            <TabsTrigger
              value="unread"
              className="text-xs"
              data-testid="tab-unread"
            >
              Unread ({systemUnreadCount})
            </TabsTrigger>
          </TabsList>

          {/* Chat Tab Content */}
          <TabsContent value="chat" className="mt-2">
            <ScrollArea className="max-h-64">
              {streamChatUnread === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No unread chat messages
                </div>
              ) : (
                <div className="space-y-1">
                  {roomsUnread > 0 && roomDetails.length > 0 && (
                    roomDetails.map((room) => (
                      <div
                        key={room.id}
                        className="flex items-start gap-3 p-3 cursor-pointer hover:bg-muted/50 transition-all bg-brand-primary-lighter/50"
                        onClick={() => {
                          setIsOpen(false);
                          window.location.href = `/dashboard?section=chat&channel=${room.id}`;
                        }}
                      >
                        <div className="flex-shrink-0 mt-0.5">
                          <Hash className="h-4 w-4 text-[#236383]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{room.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {room.unread} new message
                            {room.unread !== 1 ? 's' : ''}
                          </p>
                        </div>
                        <Badge variant="destructive" className="text-xs">
                          {room.unread}
                        </Badge>
                      </div>
                    ))
                  )}
                  {dmsUnread > 0 && (
                    <div
                      className="flex items-start gap-3 p-3 cursor-pointer hover:bg-muted/50 transition-all bg-brand-primary-lighter/50"
                      onClick={() => {
                        setIsOpen(false);
                        window.location.href = '/dashboard?section=chat';
                      }}
                    >
                      <div className="flex-shrink-0 mt-0.5">
                        <MessageCircle className="h-4 w-4 text-[#236383]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">Direct Messages</p>
                        <p className="text-xs text-muted-foreground">
                          {dmsUnread} unread direct message
                          {dmsUnread !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <Badge variant="destructive" className="text-xs">
                        {dmsUnread}
                      </Badge>
                    </div>
                  )}
                  {groupsUnread > 0 && (
                    <div
                      className="flex items-start gap-3 p-3 cursor-pointer hover:bg-muted/50 transition-all bg-brand-primary-lighter/50"
                      onClick={() => {
                        setIsOpen(false);
                        window.location.href = '/dashboard?section=chat';
                      }}
                    >
                      <div className="flex-shrink-0 mt-0.5">
                        <Users className="h-4 w-4 text-[#236383]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">Group Chats</p>
                        <p className="text-xs text-muted-foreground">
                          {groupsUnread} unread message
                          {groupsUnread !== 1 ? 's' : ''} in group chats
                        </p>
                      </div>
                      <Badge variant="destructive" className="text-xs">
                        {groupsUnread}
                      </Badge>
                    </div>
                  )}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          {/* All/Unread Tab Content */}
          <TabsContent value="all" className="mt-2">
            <ScrollArea className="max-h-64">
              {isLoading ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  Loading notifications...
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No notifications
                </div>
              ) : (
                <div className="space-y-1">
                  {notifications.map(
                    (notification: Notification, index: number) => (
                      <div
                        key={notification.id}
                        className={cn(
                          'group flex items-start gap-3 p-3 cursor-pointer hover:bg-muted/50 transition-all duration-200 ease-in-out',
                          'animate-in fade-in slide-in-from-right-2',
                          !notification.isRead && 'bg-brand-primary-lighter/50'
                        )}
                        style={{ animationDelay: `${index * 50}ms` }}
                        onClick={() => handleNotificationClick(notification)}
                        data-testid={`notification-${notification.id}`}
                        role="menuitem"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleNotificationClick(notification);
                          }
                        }}
                      >
                        <div className="flex-shrink-0 mt-0.5">
                          {getCategoryIcon(notification.category)}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-medium text-sm truncate">
                              {notification.title}
                            </p>
                            {!notification.isRead && (
                              <div className="w-2 h-2 bg-brand-primary rounded-full flex-shrink-0" />
                            )}
                          </div>

                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {notification.message}
                          </p>

                          <div className="flex items-center gap-2 mt-2">
                            <Badge
                              className={cn(
                                'text-xs',
                                getPriorityBadgeColor(notification.priority)
                              )}
                            >
                              {notification.priority}
                            </Badge>

                            {notification.category && (
                              <Badge variant="outline" className="text-xs">
                                {notification.category}
                              </Badge>
                            )}

                            <span className="text-xs text-muted-foreground ml-auto">
                              {format(
                                new Date(notification.createdAt),
                                'MMM d, h:mm a'
                              )}
                            </span>
                          </div>

                          {notification.actionText && (
                            <div
                              className="flex items-center gap-2 mt-3 pt-3 border-t"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <NotificationActionButton
                                notificationId={notification.id}
                                actionType={notification.actionText
                                  .toLowerCase()
                                  .replace(/\s+/g, '_')}
                                actionText={notification.actionText}
                                actionUrl={notification.actionUrl}
                                onSuccess={() => {
                                  // Notification list will auto-refresh via query invalidation
                                }}
                              />
                            </div>
                          )}
                        </div>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="opacity-0 group-hover:opacity-100 h-8 w-8 p-0"
                              onClick={(e) => e.stopPropagation()}
                              data-testid={`button-notification-menu-${notification.id}`}
                            >
                              <MoreVertical className="h-3 w-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            {!notification.isRead && (
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  markAsReadMutation.mutate(notification.id);
                                }}
                                data-testid={`button-mark-read-${notification.id}`}
                              >
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Mark as read
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={(e) => handleArchive(notification, e)}
                              data-testid={`button-archive-${notification.id}`}
                            >
                              <Archive className="h-4 w-4 mr-2" />
                              Archive
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    )
                  )}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="unread" className="mt-2">
            <ScrollArea className="max-h-64">
              {isLoading ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  Loading notifications...
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No unread notifications
                </div>
              ) : (
                <div className="space-y-1">
                  {notifications.map(
                    (notification: Notification, index: number) => (
                      <div
                        key={notification.id}
                        className={cn(
                          'group flex items-start gap-3 p-3 cursor-pointer hover:bg-muted/50 transition-all duration-200 ease-in-out',
                          'animate-in fade-in slide-in-from-right-2',
                          !notification.isRead && 'bg-brand-primary-lighter/50'
                        )}
                        style={{ animationDelay: `${index * 50}ms` }}
                        onClick={() => handleNotificationClick(notification)}
                        data-testid={`notification-${notification.id}`}
                        role="menuitem"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleNotificationClick(notification);
                          }
                        }}
                      >
                        <div className="flex-shrink-0 mt-0.5">
                          {getCategoryIcon(notification.category)}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-medium text-sm truncate">
                              {notification.title}
                            </p>
                            {!notification.isRead && (
                              <div className="w-2 h-2 bg-brand-primary rounded-full flex-shrink-0" />
                            )}
                          </div>

                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {notification.message}
                          </p>

                          <div className="flex items-center gap-2 mt-2">
                            <Badge
                              className={cn(
                                'text-xs',
                                getPriorityBadgeColor(notification.priority)
                              )}
                            >
                              {notification.priority}
                            </Badge>

                            {notification.category && (
                              <Badge variant="outline" className="text-xs">
                                {notification.category}
                              </Badge>
                            )}

                            <span className="text-xs text-muted-foreground ml-auto">
                              {format(
                                new Date(notification.createdAt),
                                'MMM d, h:mm a'
                              )}
                            </span>
                          </div>

                          {notification.actionText && (
                            <div
                              className="flex items-center gap-2 mt-3 pt-3 border-t"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <NotificationActionButton
                                notificationId={notification.id}
                                actionType={notification.actionText
                                  .toLowerCase()
                                  .replace(/\s+/g, '_')}
                                actionText={notification.actionText}
                                actionUrl={notification.actionUrl}
                                onSuccess={() => {
                                  // Notification list will auto-refresh via query invalidation
                                }}
                              />
                            </div>
                          )}
                        </div>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="opacity-0 group-hover:opacity-100 h-8 w-8 p-0"
                              onClick={(e) => e.stopPropagation()}
                              data-testid={`button-notification-menu-${notification.id}`}
                            >
                              <MoreVertical className="h-3 w-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            {!notification.isRead && (
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  markAsReadMutation.mutate(notification.id);
                                }}
                                data-testid={`button-mark-read-${notification.id}`}
                              >
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Mark as read
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={(e) => handleArchive(notification, e)}
                              data-testid={`button-archive-${notification.id}`}
                            >
                              <Archive className="h-4 w-4 mr-2" />
                              Archive
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    )
                  )}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>

        {notifications.length > 0 && (
          <>
            <Separator />
            <div className="p-2">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs"
                onClick={() => {
                  setIsOpen(false);
                  // Navigate to full notifications page if implemented
                }}
                data-testid="button-view-all-notifications"
              >
                View all notifications
              </Button>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default React.memo(EnhancedNotifications);
