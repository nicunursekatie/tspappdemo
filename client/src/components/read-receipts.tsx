import { Check, CheckCheck } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  getReaderDisplayName,
  getReaderInitials,
  formatReadTime,
} from '@/hooks/useReadReceipts';

interface MessageReader {
  id: string;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  profileImageUrl: string | null;
  readAt: string;
}

interface ReadReceiptsProps {
  readers: MessageReader[];
  isOwnMessage?: boolean;
  compact?: boolean;
  maxAvatars?: number;
}

// Display read receipts for chat messages
export function ReadReceipts({
  readers,
  isOwnMessage = false,
  compact = false,
  maxAvatars = 3,
}: ReadReceiptsProps) {
  if (!isOwnMessage) return null;

  const hasReaders = readers.length > 0;
  const displayedReaders = readers.slice(0, maxAvatars);
  const remainingCount = readers.length - maxAvatars;

  if (compact) {
    // Just show checkmarks
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center ml-1">
            {hasReaders ? (
              <CheckCheck className="w-3.5 h-3.5 text-blue-500" />
            ) : (
              <Check className="w-3.5 h-3.5 text-gray-400" />
            )}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          {hasReaders ? (
            <div className="text-xs">
              <p className="font-medium mb-1">Read by:</p>
              {readers.map((reader) => (
                <p key={reader.id} className="text-gray-300">
                  {getReaderDisplayName(reader)} · {formatReadTime(reader.readAt)}
                </p>
              ))}
            </div>
          ) : (
            <p className="text-xs">Sent</p>
          )}
        </TooltipContent>
      </Tooltip>
    );
  }

  // Full display with avatars
  return (
    <div className="flex items-center gap-1 mt-1">
      {hasReaders ? (
        <>
          <CheckCheck className="w-3 h-3 text-blue-500 flex-shrink-0" />
          <div className="flex -space-x-1.5">
            {displayedReaders.map((reader) => (
              <Tooltip key={reader.id}>
                <TooltipTrigger asChild>
                  <Avatar className="h-4 w-4 border border-white">
                    <AvatarImage src={reader.profileImageUrl || undefined} />
                    <AvatarFallback className="text-[8px] bg-teal-100 text-teal-700">
                      {getReaderInitials(reader)}
                    </AvatarFallback>
                  </Avatar>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  {getReaderDisplayName(reader)} · {formatReadTime(reader.readAt)}
                </TooltipContent>
              </Tooltip>
            ))}
            {remainingCount > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="h-4 w-4 rounded-full bg-gray-200 text-[8px] flex items-center justify-center text-gray-600 border border-white">
                    +{remainingCount}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  {readers.slice(maxAvatars).map((r) => getReaderDisplayName(r)).join(', ')}
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </>
      ) : (
        <Tooltip>
          <TooltipTrigger asChild>
            <Check className="w-3 h-3 text-gray-400" />
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            Sent
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

// Simpler inline read indicator (for inbox messages)
interface InboxReadIndicatorProps {
  isRead: boolean;
  readAt?: string | null;
  readerName?: string;
}

export function InboxReadIndicator({
  isRead,
  readAt,
  readerName,
}: InboxReadIndicatorProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center">
          {isRead ? (
            <CheckCheck className="w-4 h-4 text-blue-500" />
          ) : (
            <Check className="w-4 h-4 text-gray-400" />
          )}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        {isRead ? (
          <span>
            Read{readerName ? ` by ${readerName}` : ''}{readAt ? ` · ${formatReadTime(readAt)}` : ''}
          </span>
        ) : (
          <span>Sent</span>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

export default ReadReceipts;
