import { MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useChatWindows } from '@/context/chat-windows-context';
import { cn } from '@/lib/utils';

interface StartChatButtonProps {
  userId?: string;
  userName: string;
  channelId?: string;
  channelName?: string;
  type: 'direct' | 'channel';
  variant?: 'default' | 'outline' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
  children?: React.ReactNode;
}

/**
 * Button component to open a floating chat window
 * Can be used anywhere in the app to start a conversation
 */
export function StartChatButton({
  userId,
  userName,
  channelId,
  channelName,
  type,
  variant = 'ghost',
  size = 'sm',
  className,
  children,
}: StartChatButtonProps) {
  const { openWindow } = useChatWindows();

  const handleClick = () => {
    openWindow({
      userId,
      userName,
      channelId,
      channelName,
      type,
    });
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleClick}
      className={cn('gap-2', className)}
    >
      <MessageSquare className="h-4 w-4" />
      {children || 'Chat'}
    </Button>
  );
}
