import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';

interface MessageReader {
  id: string;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  profileImageUrl: string | null;
  readAt: string;
  messageId?: number;
}

interface EmailReadStatus {
  isRead: boolean;
  readAt: string | null;
  reader: MessageReader | null;
}

// Get readers for a single chat message
export function useChatMessageReaders(messageId: number | null) {
  return useQuery<MessageReader[]>({
    queryKey: ['/api/message-notifications/chat-readers', messageId],
    queryFn: async () => {
      if (!messageId) return [];
      const response = await apiRequest('GET', `/api/message-notifications/chat-readers/${messageId}`);
      return response;
    },
    enabled: !!messageId,
    staleTime: 30000, // Cache for 30 seconds
  });
}

// Get readers for multiple chat messages at once (more efficient)
export function useBatchChatMessageReaders(messageIds: number[]) {
  return useQuery<Record<number, MessageReader[]>>({
    queryKey: ['/api/message-notifications/chat-readers/batch', messageIds],
    queryFn: async () => {
      if (!messageIds.length) return {};
      const response = await apiRequest('POST', '/api/message-notifications/chat-readers/batch', {
        messageIds,
      });
      return response;
    },
    enabled: messageIds.length > 0,
    staleTime: 30000, // Cache for 30 seconds
  });
}

// Get read status for an email/inbox message
export function useEmailReadStatus(messageId: number | null) {
  return useQuery<EmailReadStatus>({
    queryKey: ['/api/message-notifications/email-read-status', messageId],
    queryFn: async () => {
      if (!messageId) return { isRead: false, readAt: null, reader: null };
      const response = await apiRequest('GET', `/api/message-notifications/email-read-status/${messageId}`);
      return response;
    },
    enabled: !!messageId,
    staleTime: 30000,
  });
}

// Helper to get display name
export function getReaderDisplayName(reader: MessageReader): string {
  if (reader.displayName) return reader.displayName;
  if (reader.firstName && reader.lastName) return `${reader.firstName} ${reader.lastName}`;
  if (reader.firstName) return reader.firstName;
  return 'Unknown';
}

// Helper to get initials
export function getReaderInitials(reader: MessageReader): string {
  if (reader.displayName) return reader.displayName.substring(0, 2).toUpperCase();
  if (reader.firstName && reader.lastName) {
    return `${reader.firstName.charAt(0)}${reader.lastName.charAt(0)}`.toUpperCase();
  }
  if (reader.firstName) return reader.firstName.substring(0, 2).toUpperCase();
  return 'U';
}

// Format read time
export function formatReadTime(readAt: string): string {
  const date = new Date(readAt);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}
