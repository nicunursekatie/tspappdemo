import { useState, useEffect, useRef } from 'react';
import { X, Minus, Maximize2, Send, Paperclip, Smile } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { useChatWindows, type ChatWindow } from '@/context/chat-windows-context';
import { useAuth } from '@/hooks/useAuth';
import { formatDistanceToNow } from 'date-fns';

interface Message {
  id: string;
  content: string;
  senderId: string;
  senderName: string;
  timestamp: Date;
}

interface FloatingChatWindowProps {
  window: ChatWindow;
  index: number;
  totalWindows: number;
}

export function FloatingChatWindow({ window, index, totalWindows }: FloatingChatWindowProps) {
  const { closeWindow, toggleMinimize } = useChatWindows();
  const { user } = useAuth();
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = () => {
    if (!message.trim() || !user) return;

    const newMessage: Message = {
      id: `msg-${Date.now()}`,
      content: message,
      senderId: user.id,
      senderName: user.fullName || user.email || 'You',
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, newMessage]);
    setMessage('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Calculate position from right
  const windowWidth = 320;
  const windowGap = 10;
  const rightOffset = index * (windowWidth + windowGap) + 20;

  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  return (
    <div
      className={cn(
        'fixed bottom-0 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-t-lg shadow-2xl flex flex-col transition-all duration-200',
        window.isMinimized ? 'h-12' : 'h-[500px]'
      )}
      style={{
        right: `${rightOffset}px`,
        width: `${windowWidth}px`,
        zIndex: 1000 + index,
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-brand-primary to-brand-primary-dark text-white rounded-t-lg cursor-pointer"
        onClick={() => toggleMinimize(window.id)}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Avatar className="h-6 w-6 flex-shrink-0">
            <AvatarFallback className="text-xs bg-white/20 text-white">
              {getInitials(window.userName)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm truncate">{window.userName}</div>
            {window.type === 'channel' && (
              <div className="text-xs opacity-80">#{window.channelName}</div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0 hover:bg-white/20 text-white"
            onClick={(e) => {
              e.stopPropagation();
              toggleMinimize(window.id);
            }}
          >
            {window.isMinimized ? (
              <Maximize2 className="h-3 w-3" />
            ) : (
              <Minus className="h-3 w-3" />
            )}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0 hover:bg-white/20 text-white"
            onClick={(e) => {
              e.stopPropagation();
              closeWindow(window.id);
            }}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Chat Content */}
      {!window.isMinimized && (
        <>
          {/* Messages Area */}
          <ScrollArea className="flex-1 p-3">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center text-slate-400 dark:text-slate-500 p-4">
                <Smile className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm">No messages yet</p>
                <p className="text-xs mt-1">Start a conversation!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((msg) => {
                  const isOwn = msg.senderId === user?.id;
                  return (
                    <div
                      key={msg.id}
                      className={cn(
                        'flex gap-2',
                        isOwn ? 'flex-row-reverse' : 'flex-row'
                      )}
                    >
                      <Avatar className="h-6 w-6 flex-shrink-0">
                        <AvatarFallback className="text-xs bg-brand-primary text-white">
                          {getInitials(msg.senderName)}
                        </AvatarFallback>
                      </Avatar>
                      <div
                        className={cn(
                          'flex-1 min-w-0',
                          isOwn ? 'text-right' : 'text-left'
                        )}
                      >
                        <div className="flex items-baseline gap-2 mb-1">
                          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                            {isOwn ? 'You' : msg.senderName}
                          </span>
                          <span className="text-xs text-slate-400">
                            {formatDistanceToNow(msg.timestamp, { addSuffix: true })}
                          </span>
                        </div>
                        <div
                          className={cn(
                            'inline-block px-3 py-2 rounded-lg text-sm',
                            isOwn
                              ? 'bg-brand-primary text-white'
                              : 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-slate-100'
                          )}
                        >
                          {msg.content}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            )}
          </ScrollArea>

          {/* Input Area */}
          <div className="border-t border-slate-200 dark:border-slate-700 p-2">
            <div className="flex gap-2">
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message..."
                className="min-h-[60px] max-h-[120px] resize-none text-sm"
              />
              <div className="flex flex-col gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0"
                  title="Attach file"
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  onClick={handleSend}
                  disabled={!message.trim()}
                  className="h-8 w-8 p-0"
                  title="Send message"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="text-xs text-slate-400 mt-1">
              Press Enter to send, Shift+Enter for new line
            </div>
          </div>
        </>
      )}
    </div>
  );
}
