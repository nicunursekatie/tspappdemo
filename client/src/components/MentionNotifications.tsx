import { Bell, X, MessageSquare, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useLocation } from 'wouter';
import { formatDistanceToNow } from 'date-fns';
import type { MentionNotification } from '@/hooks/use-collaboration';

interface MentionNotificationsProps {
  mentions: MentionNotification[];
  onClearMention: (id: string) => void;
  onClearAll: () => void;
}

export function MentionNotifications({
  mentions,
  onClearMention,
  onClearAll,
}: MentionNotificationsProps) {
  const [, navigate] = useLocation();

  const handleNavigate = (mention: MentionNotification) => {
    // Navigate to the resource based on type
    if (mention.resourceType === 'event') {
      navigate(`/event-requests?id=${mention.resourceId}`);
    } else if (mention.resourceType === 'holding-zone') {
      navigate(`/team-board`);
    } else {
      // Default navigation for other resource types
      navigate(`/${mention.resourceType}`);
    }
    
    // Clear the mention after navigating
    onClearMention(mention.id);
  };

  const getResourceIcon = (type: string) => {
    switch (type) {
      case 'event':
        return <Calendar className="h-4 w-4" />;
      case 'holding-zone':
        return <MessageSquare className="h-4 w-4" />;
      default:
        return <MessageSquare className="h-4 w-4" />;
    }
  };

  const getResourceLabel = (type: string) => {
    switch (type) {
      case 'event':
        return 'Event';
      case 'holding-zone':
        return 'Team Board';
      default:
        return 'Resource';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
    } catch {
      return 'recently';
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          data-testid="button-mentions"
          aria-label={mentions.length > 0 ? `${mentions.length} new mentions` : "View mentions"}
        >
          <Bell className="h-5 w-5" />
          {mentions.length > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
              data-testid="badge-mention-count"
            >
              {mentions.length}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end" data-testid="popover-mentions">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-gray-700 dark:text-gray-300" />
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">
              Mentions
            </h3>
            {mentions.length > 0 && (
              <Badge variant="secondary" data-testid="badge-total-mentions">
                {mentions.length}
              </Badge>
            )}
          </div>
          {mentions.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearAll}
              className="text-xs"
              data-testid="button-clear-all"
            >
              Clear all
            </Button>
          )}
        </div>

        <ScrollArea className="max-h-96">
          {mentions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <Bell className="h-12 w-12 text-gray-300 dark:text-gray-600 mb-3" />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No new mentions
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                You'll be notified when someone mentions you in a comment
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {mentions.map((mention, index) => (
                <div
                  key={mention.id}
                  className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer group"
                  onClick={() => handleNavigate(mention)}
                  data-testid={`mention-${index}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
                          {getResourceIcon(mention.resourceType)}
                          <span className="font-medium">
                            {getResourceLabel(mention.resourceType)}
                          </span>
                        </div>
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                          {formatTimestamp(mention.timestamp)}
                        </span>
                      </div>
                      
                      <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          {mention.mentionedBy}
                        </span>{' '}
                        mentioned you
                      </p>

                      <div className="bg-gray-100 dark:bg-gray-800 rounded-md p-2 border border-gray-200 dark:border-gray-700">
                        <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
                          {mention.comment}
                        </p>
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        onClearMention(mention.id);
                      }}
                      data-testid={`button-clear-mention-${index}`}
                      aria-label="Dismiss this mention"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
