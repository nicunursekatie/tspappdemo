import { useState, useMemo, memo, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { MessageContextBadge } from '@/components/message-context-badge';
import {
  Mail,
  Send,
  Inbox,
  Archive,
  Trash2,
  Search,
  Edit3,
  Reply,
  ReplyAll,
  Forward,
  Star,
  StarOff,
  Calendar,
  Paperclip,
  X,
  FileText,
  Image,
  File,
  Loader2,
} from 'lucide-react';
import { logger } from '@/lib/logger';

interface EmailMessage {
  id: string;
  from: {
    name: string;
    email: string;
  };
  to: string[];
  subject: string;
  content: string;
  timestamp: string;
  read: boolean;
  starred: boolean;
  folder: 'inbox' | 'sent' | 'drafts' | 'trash';
  attachments?: {
    name: string;
    size: string;
    type: string;
  }[];
}

// Attachment interface for uploads
interface MessageAttachment {
  name: string;
  url: string;
  type: string;
  size: number;
}

// Helper to format file size
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Helper to get icon for file type
function getFileIcon(type: string) {
  if (type.startsWith('image/')) return Image;
  if (type === 'application/pdf') return FileText;
  return File;
}

// Memoized utility functions
const getInitials = (name: string) => {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

const formatDate = (timestamp: string) => {
  const date = new Date(timestamp);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  if (isToday) {
    return date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  return date.toLocaleDateString();
};

// Memoized MessageListItem component
interface MessageListItemProps {
  message: EmailMessage;
  isSelected: boolean;
  isChecked: boolean;
  activeFolder: 'inbox' | 'sent' | 'drafts' | 'trash';
  onMessageClick: (message: EmailMessage) => void;
  onToggleSelection: (messageId: string) => void;
}

const MessageListItem = memo(({
  message,
  isSelected,
  isChecked,
  activeFolder,
  onMessageClick,
  onToggleSelection,
}: MessageListItemProps) => {
  const initials = useMemo(() => getInitials(message.from.name), [message.from.name]);
  const formattedDate = useMemo(() => formatDate(message.timestamp), [message.timestamp]);

  const className = useMemo(() => {
    const baseClass = 'px-3 py-4 cursor-pointer transition-colors border-b border-gray-100';
    const selectedClass = isSelected
      ? 'bg-brand-primary-lighter border-l-4 border-l-blue-500'
      : !message.read
        ? 'bg-blue-25 hover:bg-brand-primary-lighter'
        : 'bg-white hover:bg-gray-50';
    const checkedClass = isChecked ? 'bg-blue-25' : '';
    const unreadShadow = !message.read ? 'shadow-sm' : '';

    return `${baseClass} ${selectedClass} ${checkedClass} ${unreadShadow}`;
  }, [isSelected, isChecked, message.read]);

  return (
    <div
      className={className}
      onClick={() => onMessageClick(message)}
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={isChecked}
          onChange={() => onToggleSelection(message.id)}
          onClick={(e) => e.stopPropagation()}
          className="w-4 h-4 text-brand-primary bg-gray-100 border-gray-300 rounded focus:ring-brand-primary-muted mt-1"
        />

        <Avatar className="h-8 w-8 flex-shrink-0">
          <AvatarFallback className="text-xs bg-gray-200 text-gray-600">
            {initials}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          {/* Header Row - Fix timestamp cutoff */}
          <div className="flex items-center justify-between mb-1 gap-3">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span
                className={`text-sm truncate ${
                  !message.read
                    ? 'font-bold text-gray-900'
                    : 'font-normal text-gray-600'
                }`}
              >
                {activeFolder === 'sent'
                  ? Array.isArray(message.to)
                    ? message.to.join(', ')
                    : message.to || 'Unknown Recipient'
                  : message.from.name}
              </span>
              {!message.read && (
                <div className="w-2 h-2 bg-brand-primary rounded-full flex-shrink-0"></div>
              )}
            </div>

            <div className="flex items-center gap-1 flex-shrink-0 min-w-0">
              {message.starred && (
                <Star className="h-4 w-4 text-yellow-500 fill-current flex-shrink-0" />
              )}
              {message.attachments &&
                message.attachments.length > 0 && (
                  <Paperclip className="h-4 w-4 text-gray-400 flex-shrink-0" />
                )}
              <span
                className={`text-xs whitespace-nowrap ${
                  !message.read
                    ? 'text-gray-700 font-semibold'
                    : 'text-gray-500 font-normal'
                }`}
              >
                {formattedDate}
              </span>
            </div>
          </div>

          {/* Subject Line */}
          <div className="mb-2">
            <h4
              className={`text-sm truncate ${
                !message.read
                  ? 'font-bold text-gray-900'
                  : 'font-normal text-gray-700'
              }`}
            >
              {message.subject || '(No Subject)'}
            </h4>
          </div>

          {/* Message Preview */}
          <p
            className={`text-xs leading-relaxed line-clamp-2 pr-4 ${
              !message.read
                ? 'text-gray-700 font-medium'
                : 'text-gray-500 font-normal'
            }`}
          >
            {message.content}
          </p>

          {/* Tags and Status */}
          <div className="flex items-center gap-2 mt-2">
            {!message.read && (
              <Badge
                variant="secondary"
                className="text-xs px-2 py-1 bg-brand-primary-light text-brand-primary font-medium"
              >
                New
              </Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

MessageListItem.displayName = 'MessageListItem';

export default function EmailStyleMessaging() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedMessage, setSelectedMessage] = useState<EmailMessage | null>(
    null
  );
  const [activeFolder, setActiveFolder] = useState<
    'inbox' | 'sent' | 'drafts' | 'trash'
  >('inbox');

  // Clear selected message when switching tabs
  const handleTabChange = (folder: 'inbox' | 'sent' | 'drafts' | 'trash') => {
    setActiveFolder(folder);
    setSelectedMessage(null); // Clear selection when switching tabs
    setSelectedMessages([]); // Clear bulk selections too
  };
  const [searchQuery, setSearchQuery] = useState('');
  const [isComposing, setIsComposing] = useState(false);
  const [selectedMessages, setSelectedMessages] = useState<string[]>([]);
  const [composeData, setComposeData] = useState({
    to: '',
    subject: '',
    content: '',
  });
  const [replyData, setReplyData] = useState<EmailMessage | null>(null);

  // Attachment state
  const [attachments, setAttachments] = useState<MessageAttachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle file upload
  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    // Check total attachments limit
    if (attachments.length + files.length > 5) {
      toast({
        title: 'Too many attachments',
        description: 'Maximum 5 attachments allowed per message',
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        formData.append('files', file);
      }

      const response = await fetch('/api/messaging/attachments/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to upload files');
      }

      const result = await response.json();
      if (!result.attachments || !Array.isArray(result.attachments)) {
        throw new Error('Invalid response from server');
      }
      setAttachments(prev => [...prev, ...result.attachments]);

      toast({
        description: `${result.attachments.length} file(s) uploaded`,
      });
    } catch (error) {
      logger.error('Failed to upload attachments:', error);
      toast({
        title: 'Upload failed',
        description: error instanceof Error ? error.message : 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [attachments.length, toast]);

  // Remove an attachment
  const removeAttachment = useCallback((index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Get messages from API with error handling
  const {
    data: messages = [],
    isLoading,
    error: messagesError,
  } = useQuery({
    queryKey: ['/api/real-time-messages', activeFolder],
    queryFn: () =>
      apiRequest('GET', `/api/real-time-messages?folder=${activeFolder}`),
    retry: false,
  });

  // Get users for recipient selection (uses for-assignments endpoint - no special permissions needed)
  const { data: users = [] } = useQuery({
    queryKey: ['/api/users/for-assignments'],
    queryFn: () => apiRequest('GET', '/api/users/for-assignments'),
    retry: false,
  });

  // Fetch current user for authentication
  const { data: currentUser } = useQuery({
    queryKey: ['/api/auth/user'],
    retry: false,
  });

  // Send message mutation - Use messaging API for internal messages with graceful SendGrid handling
  const sendMessageMutation = useMutation({
    mutationFn: async (messageData: any) => {
      logger.log('Sending message data:', messageData);

      // Find recipient user by email
      const recipientUser = users.find((u: any) => u.email === messageData.to);
      if (!recipientUser) {
        logger.warn('Recipient not found in user list:', messageData.to);
        throw new Error(
          `Recipient ${messageData.to} not found. Please make sure the email address is correct and the user exists in the system.`
        );
      }

      // Format for messaging service API which handles internal storage + SendGrid gracefully
      const messagingData: any = {
        recipientIds: [recipientUser.id],
        content: `Subject: ${messageData.subject}\n\n${messageData.content}`,
        contextType: 'direct', // This triggers email notifications
      };

      // Include attachments if any
      if (messageData.attachments && messageData.attachments.length > 0) {
        messagingData.attachments = messageData.attachments;
      }

      const response = await apiRequest(
        'POST',
        '/api/messaging',
        messagingData
      );
      logger.log('Send message response:', response);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/real-time-messages'] });
      queryClient.invalidateQueries({ queryKey: ['/api/messaging'] });
      toast({
        title: 'Message sent',
        description:
          'Your message has been delivered successfully and the recipient will be notified by email.',
      });
      setIsComposing(false);
      setReplyData(null);
      setComposeData({ to: '', subject: '', content: '' });
      setAttachments([]); // Clear attachments after sending
    },
    onError: (error) => {
      logger.error('Send message error:', error);
      // More detailed error handling
      let errorMessage = 'Failed to send message. Please try again.';
      if (error.message?.includes('401')) {
        errorMessage = 'Authentication required. Please log in first.';
      } else if (error.message?.includes('403')) {
        errorMessage =
          'Permission denied. You may not have access to send messages.';
      }
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    },
  });

  const filteredMessages = Array.isArray(messages)
    ? messages.filter(
        (msg: EmailMessage) =>
          msg.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
          msg.from.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          msg.content.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  // Bulk actions
  const toggleMessageSelection = (messageId: string) => {
    setSelectedMessages((prev) =>
      prev.includes(messageId)
        ? prev.filter((id) => id !== messageId)
        : [...prev, messageId]
    );
  };

  const handleBulkMarkAsRead = async () => {
    for (const messageId of selectedMessages) {
      await markAsReadMutation.mutateAsync(messageId);
    }
    setSelectedMessages([]);
  };

  const handleBulkDelete = async () => {
    for (const messageId of selectedMessages) {
      await deleteMessageMutation.mutateAsync(messageId);
    }
    setSelectedMessages([]);
  };

  // Delete message mutation
  const deleteMessageMutation = useMutation({
    mutationFn: async (messageId: string) => {
      return apiRequest('DELETE', `/api/real-time-messages/${messageId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/real-time-messages'] });
      toast({
        title: 'Message deleted',
        description: 'The message has been moved to trash.',
      });
    },
  });

  // Mark message as read when clicked
  const markAsReadMutation = useMutation({
    mutationFn: async (messageId: string) => {
      return apiRequest('POST', `/api/real-time-messages/${messageId}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/real-time-messages'] });
    },
  });

  const handleMessageClick = (message: EmailMessage) => {
    setSelectedMessage(message);

    // Mark message as read if it's unread
    if (!message.read) {
      markAsReadMutation.mutate(message.id);
    }
  };

  const handleCompose = () => {
    if (!composeData.to || !composeData.subject || !composeData.content) {
      toast({
        title: 'Error',
        description: 'Please fill in all fields',
        variant: 'destructive',
      });
      return;
    }

    sendMessageMutation.mutate({
      ...composeData,
      attachments: attachments.length > 0 ? attachments : undefined,
    });
  };

  const handleReply = (message: EmailMessage) => {
    setReplyData(message);
    setComposeData({
      to: message.from.email,
      subject: message.subject.startsWith('Re:')
        ? message.subject
        : `Re: ${message.subject}`,
      content: `\n\n--- Original Message ---\nFrom: ${message.from.name} <${
        message.from.email
      }>nDate: ${formatDate(message.timestamp)}\nSubject: ${
        message.subject
      }\n\n${message.content}`,
    });
    setIsComposing(true);
  };

  const handleReplyAll = (message: EmailMessage) => {
    const currentUserEmail = (currentUser as any)?.email || '';
    const allRecipients = [
      message.from.email,
      ...message.to.filter((email) => email !== currentUserEmail),
    ];
    setReplyData(message);
    setComposeData({
      to: allRecipients.join(', '),
      subject: message.subject.startsWith('Re:')
        ? message.subject
        : `Re: ${message.subject}`,
      content: `\n\n--- Original Message ---\nFrom: ${message.from.name} <${
        message.from.email
      }>nDate: ${formatDate(message.timestamp)}\nSubject: ${
        message.subject
      }\n\n${message.content}`,
    });
    setIsComposing(true);
  };

  const handleForward = (message: EmailMessage) => {
    setReplyData(message);
    setComposeData({
      to: '',
      subject: message.subject.startsWith('Fwd:')
        ? message.subject
        : `Fwd: ${message.subject}`,
      content: `\n\n--- Forwarded Message ---\nFrom: ${message.from.name} <${
        message.from.email
      }>nDate: ${formatDate(message.timestamp)}\nSubject: ${
        message.subject
      }\n\n${message.content}`,
    });
    setIsComposing(true);
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">
          Please log in to access messages
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-120px)] bg-white rounded-lg border overflow-hidden">
      {/* Sidebar */}
      <div
        className={`${
          selectedMessage ? 'hidden md:block' : 'block'
        } w-56 lg:w-64 border-r bg-gray-50 flex-shrink-0`}
      >
        <div className="p-4 border-b">
          <Button className="w-full" onClick={() => setIsComposing(true)}>
            <Edit3 className="h-4 w-4 mr-2" />
            Compose
          </Button>
        </div>

        <div className="p-2">
          <nav className="space-y-1">
            <Button
              variant={activeFolder === 'inbox' ? 'default' : 'ghost'}
              className="w-full justify-start"
              onClick={() => handleTabChange('inbox')}
            >
              <Inbox className="h-4 w-4 mr-2" />
              Inbox
              <Badge variant="secondary" className="ml-auto">
                {Array.isArray(messages)
                  ? messages.filter(
                      (m: EmailMessage) => m.folder === 'inbox' && !m.read
                    ).length
                  : 0}
              </Badge>
            </Button>

            <Button
              variant={activeFolder === 'sent' ? 'default' : 'ghost'}
              className="w-full justify-start"
              onClick={() => handleTabChange('sent')}
            >
              <Send className="h-4 w-4 mr-2" />
              Sent
            </Button>

            <Button
              variant={activeFolder === 'drafts' ? 'default' : 'ghost'}
              className="w-full justify-start"
              onClick={() => handleTabChange('drafts')}
            >
              <Archive className="h-4 w-4 mr-2" />
              Drafts
            </Button>

            <Button
              variant={activeFolder === 'trash' ? 'default' : 'ghost'}
              className="w-full justify-start"
              onClick={() => handleTabChange('trash')}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Trash
            </Button>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-0">
        {isComposing ? (
          /* Compose View */
          <div className="flex-1 flex flex-col">
            <div className="p-4 border-b">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">
                  {replyData
                    ? replyData.subject.startsWith('Re:')
                      ? 'Reply to Message'
                      : replyData.subject.startsWith('Fwd:')
                        ? 'Forward Message'
                        : 'Reply to Message'
                    : 'New Message'}
                </h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsComposing(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex-1 p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">To:</label>
                {replyData ? (
                  <Input
                    value={composeData.to}
                    onChange={(e) =>
                      setComposeData((prev) => ({
                        ...prev,
                        to: e.target.value,
                      }))
                    }
                    placeholder="Recipient email..."
                  />
                ) : (
                  <select
                    value={composeData.to}
                    onChange={(e) =>
                      setComposeData((prev) => ({
                        ...prev,
                        to: e.target.value,
                      }))
                    }
                    className="w-full p-2 border rounded-md"
                  >
                    <option value="">Select recipient...</option>
                    {users.map((user: any) => (
                      <option key={user.id} value={user.email}>
                        {user.firstName || user.email} ({user.email})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Subject:
                </label>
                <Input
                  value={composeData.subject}
                  onChange={(e) =>
                    setComposeData((prev) => ({
                      ...prev,
                      subject: e.target.value,
                    }))
                  }
                  placeholder="Enter subject..."
                />
              </div>

              <div className="flex-1">
                <label className="block text-sm font-medium mb-1">
                  Message:
                </label>
                <Textarea
                  value={composeData.content}
                  onChange={(e) =>
                    setComposeData((prev) => ({
                      ...prev,
                      content: e.target.value,
                    }))
                  }
                  placeholder="Type your message..."
                  className="min-h-[200px]"
                />
              </div>

              {/* Attached files display */}
              {attachments.length > 0 && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                    <Paperclip className="h-4 w-4" />
                    Attachments ({attachments.length})
                  </h4>
                  <div className="space-y-2">
                    {attachments.map((attachment, index) => {
                      const FileIcon = getFileIcon(attachment.type);
                      return (
                        <div
                          key={index}
                          className="flex items-center justify-between p-2 bg-white rounded border"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <FileIcon className="h-4 w-4 text-gray-500 flex-shrink-0" />
                            <span className="text-sm truncate">{attachment.name}</span>
                            <span className="text-xs text-gray-500 flex-shrink-0">
                              ({formatFileSize(attachment.size)})
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 flex-shrink-0"
                            onClick={() => removeAttachment(index)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {/* Hidden file input */}
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    className="hidden"
                    multiple
                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading || attachments.length >= 5}
                  >
                    {isUploading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Paperclip className="h-4 w-4 mr-2" />
                    )}
                    {isUploading ? 'Uploading...' : 'Attach'}
                  </Button>
                  <Button variant="outline" size="sm">
                    <Calendar className="h-4 w-4 mr-2" />
                    Schedule
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsComposing(false);
                      setReplyData(null);
                      setComposeData({ to: '', subject: '', content: '' });
                      setAttachments([]); // Clear attachments on cancel
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCompose}
                    disabled={sendMessageMutation.isPending}
                  >
                    <Send className="h-4 w-4 mr-2" />
                    {sendMessageMutation.isPending ? 'Sending...' : 'Send'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Message List & Detail View */
          <div className="flex-1 flex min-h-0">
            {/* Message List */}
            <div
              className={`${
                selectedMessage ? 'hidden md:flex md:w-1/2 lg:w-2/5' : 'w-full'
              } min-w-0 border-r flex flex-col bg-white`}
            >
              <div className="p-4 border-b bg-gray-50 space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search messages..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>

                {/* Bulk Actions */}
                {selectedMessages.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {selectedMessages.length} selected
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleBulkMarkAsRead}
                    >
                      Mark Read
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleBulkDelete}
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      Delete
                    </Button>
                  </div>
                )}
              </div>

              <ScrollArea className="flex-1">
                <div className="">
                  {filteredMessages.length === 0 ? (
                    <div className="flex items-center justify-center h-32">
                      <p className="text-muted-foreground text-sm">
                        No messages
                      </p>
                    </div>
                  ) : (
                    filteredMessages.map((message: EmailMessage) => (
                      <MessageListItem
                        key={message.id}
                        message={message}
                        isSelected={selectedMessage?.id === message.id}
                        isChecked={selectedMessages.includes(message.id)}
                        activeFolder={activeFolder}
                        onMessageClick={handleMessageClick}
                        onToggleSelection={toggleMessageSelection}
                      />
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>

            {/* Message Detail */}
            <div
              className={`${
                selectedMessage ? 'flex-1' : 'hidden md:flex md:flex-1'
              } flex flex-col overflow-hidden`}
            >
              {selectedMessage ? (
                <>
                  <div className="p-4 border-b">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="md:hidden"
                          onClick={() => setSelectedMessage(null)}
                        >
                          ← Back
                        </Button>
                        <h2 className="text-lg font-semibold">
                          {selectedMessage.subject}
                        </h2>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm">
                          {selectedMessage.starred ? (
                            <StarOff className="h-4 w-4" />
                          ) : (
                            <Star className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            deleteMessageMutation.mutate(selectedMessage.id)
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>
                          {getInitials(selectedMessage.from.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        {activeFolder === 'sent' ? (
                          // For sent messages, show TO information prominently, FROM minimized
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-red-600">
                                TO:
                              </span>
                              <span className="font-medium">
                                {selectedMessage.to &&
                                Array.isArray(selectedMessage.to)
                                  ? selectedMessage.to.join(', ')
                                  : selectedMessage.to || 'Unknown Recipient'}
                              </span>
                            </div>
                          </div>
                        ) : (
                          // For received messages, show FROM information
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-brand-primary">
                              FROM:
                            </span>
                            <span className="font-medium">
                              {selectedMessage.from.name}
                            </span>
                            <span className="text-sm text-muted-foreground">
                              &lt;{selectedMessage.from.email}&gt;
                            </span>
                          </div>
                        )}
                        <div className="text-sm text-muted-foreground mt-1">
                          {formatDate(selectedMessage.timestamp)}
                        </div>
                      </div>
                    </div>
                  </div>

                  <ScrollArea className="flex-1">
                    <div className="p-4">
                      <div className="prose max-w-none">
                        <p className="whitespace-pre-wrap text-sm">
                          {selectedMessage.content}
                        </p>
                      </div>

                      {(selectedMessage as any).contextType &&
                        (selectedMessage as any).contextId && (
                          <div className="mt-4">
                            <MessageContextBadge
                              contextType={(selectedMessage as any).contextType}
                              contextId={(selectedMessage as any).contextId}
                              contextTitle={(selectedMessage as any).contextTitle}
                            />
                          </div>
                        )}

                      {selectedMessage.attachments &&
                        selectedMessage.attachments.length > 0 && (
                          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                            <h4 className="font-medium mb-2 flex items-center gap-2">
                              <Paperclip className="h-4 w-4" />
                              Attachments
                            </h4>
                            <div className="space-y-1">
                              {selectedMessage.attachments.map(
                                (attachment, index) => (
                                  <div
                                    key={index}
                                    className="flex items-center gap-2 text-sm"
                                  >
                                    <span>{attachment.name}</span>
                                    <span className="text-muted-foreground">
                                      ({attachment.size})
                                    </span>
                                  </div>
                                )
                              )}
                            </div>
                          </div>
                        )}
                    </div>
                  </ScrollArea>

                  <div className="p-4 border-t">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleReply(selectedMessage)}
                      >
                        <Reply className="h-4 w-4 mr-2" />
                        Reply
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleReplyAll(selectedMessage)}
                      >
                        <ReplyAll className="h-4 w-4 mr-2" />
                        Reply All
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleForward(selectedMessage)}
                      >
                        <Forward className="h-4 w-4 mr-2" />
                        Forward
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <Mail className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      Select a message to view
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
