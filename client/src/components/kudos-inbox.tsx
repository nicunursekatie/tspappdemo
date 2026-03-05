import { useQuery, useMutation } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Heart,
  Trophy,
  CheckCircle,
  Clock,
  Plus,
  Send,
  Star,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { logger } from '@/lib/logger';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';

interface KudosMessage {
  id: number;
  content: string;
  sender: string;
  senderName: string;
  contextType: 'task' | 'project' | 'general';
  contextId: string;
  entityName: string;
  createdAt: string;
  read: boolean;
}

interface User {
  id: string;
  name: string;
  email: string;
}

export function KudosInbox() {
  const { user } = useAuth();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedRecipient, setSelectedRecipient] = useState<string>('');
  const [kudosMessage, setKudosMessage] = useState('');
  const [markedAsReadIds, setMarkedAsReadIds] = useState<Set<number>>(
    new Set()
  );

  const {
    data: kudosMessages = [],
    isLoading,
    refetch,
  } = useQuery<KudosMessage[]>({
    queryKey: ['/api/messaging/kudos/received'],
    enabled: !!user,
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes for new kudos (reduced from 30 seconds)
  });

  // Fetch all users for the recipient dropdown
  const { data: allUsers = [] } = useQuery<User[]>({
    queryKey: ['/api/users'],
    enabled: !!user && showCreateDialog,
  });

  // Filter out current user from recipients
  const availableRecipients = allUsers.filter((u) => u.id !== user?.id);

  // Mutation to send kudos
  const sendKudosMutation = useMutation({
    mutationFn: async (data: { recipientId: string; content: string }) => {
      return apiRequest('POST', '/api/messaging/kudos/send', {
        recipientId: data.recipientId,
        content: data.content,
        contextType: 'general',
      });
    },
    onSuccess: () => {
      setShowCreateDialog(false);
      setSelectedRecipient('');
      setKudosMessage('');
      // Show success feedback
      queryClient.invalidateQueries({
        queryKey: ['/api/messaging/kudos/received'],
      });
    },
    onError: (error) => {
      logger.error('Failed to send kudos:', error);
    },
  });

  // Mutation to mark kudos as read
  const markKudosAsReadMutation = useMutation({
    mutationFn: async (kudosIds: number[]) => {
      return apiRequest('POST', '/api/messaging/kudos/mark-read', { kudosIds });
    },
    onSuccess: () => {
      // Invalidate kudos to update read status
      queryClient.invalidateQueries({
        queryKey: ['/api/messaging/kudos/received'],
      });
      // Also invalidate notification counts to update the bell icon
      queryClient.invalidateQueries({
        queryKey: ['/api/message-notifications/unread-counts'],
      });
    },
    onError: (error) => {
      logger.error('Failed to mark kudos as read:', error);
    },
  });

  // Auto-mark unread kudos as read when component is viewed
  useEffect(() => {
    if (!user || !kudosMessages || kudosMessages.length === 0) return;

    // Filter out kudos we've already marked as read in this session
    const unreadKudos = kudosMessages.filter(
      (k) => !k.read && !markedAsReadIds.has(k.id)
    );
    if (unreadKudos.length === 0) return;

    // Mark as read after a short delay to ensure user is actually viewing
    const timeoutId = setTimeout(() => {
      const unreadIds = unreadKudos.map((k) => k.id);
      // Track that we're marking these as read to prevent re-triggering
      setMarkedAsReadIds((prev) => {
        const newSet = new Set(prev);
        unreadIds.forEach((id) => newSet.add(id));
        return newSet;
      });
      markKudosAsReadMutation.mutate(unreadIds);
    }, 1500); // 1.5 second delay

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kudosMessages, user]);

  const unreadCount = kudosMessages.filter((k) => !k.read).length;

  const handleMarkAsRead = (kudosId: number) => {
    if (markedAsReadIds.has(kudosId)) return;
    setMarkedAsReadIds((prev) => {
      const newSet = new Set(prev);
      newSet.add(kudosId);
      return newSet;
    });
    markKudosAsReadMutation.mutate([kudosId]);
  };

  const handleSendKudos = () => {
    if (!selectedRecipient || !kudosMessage.trim()) return;
    sendKudosMutation.mutate({
      recipientId: selectedRecipient,
      content: kudosMessage.trim(),
    });
  };

  // Create Kudos Dialog component
  const CreateKudosDialog = () => (
    <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="w-5 h-5 text-yellow-500" />
            Send Kudos
          </DialogTitle>
          <DialogDescription>
            Show appreciation to a team member for their great work!
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="recipient">Recipient</Label>
            <Select
              value={selectedRecipient}
              onValueChange={setSelectedRecipient}
            >
              <SelectTrigger id="recipient">
                <SelectValue placeholder="Select a team member" />
              </SelectTrigger>
              <SelectContent>
                {availableRecipients.map((recipient) => (
                  <SelectItem key={recipient.id} value={recipient.id}>
                    {recipient.name || recipient.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              placeholder="Write your kudos message..."
              value={kudosMessage}
              onChange={(e) => setKudosMessage(e.target.value)}
              rows={4}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSendKudos}
            disabled={
              !selectedRecipient ||
              !kudosMessage.trim() ||
              sendKudosMutation.isPending
            }
            className="bg-yellow-500 hover:bg-yellow-600 text-white"
          >
            {sendKudosMutation.isPending ? (
              <span className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Sending...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Send className="w-4 h-4" />
                Send Kudos
              </span>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  if (kudosMessages.length === 0) {
    return (
      <>
        <CreateKudosDialog />
        <div className="text-center p-8">
          <Heart className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No kudos yet
          </h3>
          <p className="text-gray-500 mb-4">
            When team members send you appreciation for your work, it will
            appear here!
          </p>
          <Button
            onClick={() => setShowCreateDialog(true)}
            className="bg-yellow-500 hover:bg-yellow-600 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Send Kudos to a Team Member
          </Button>
        </div>
      </>
    );
  }

  return (
    <div className="space-y-4">
      <CreateKudosDialog />

      {/* Header with count */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-500" />
          <h2 className="text-lg font-semibold text-gray-900">
            Your Kudos ({kudosMessages.length})
          </h2>
          {unreadCount > 0 && (
            <Badge variant="destructive" className="bg-red-500">
              {unreadCount} new
            </Badge>
          )}
        </div>
        <Button
          onClick={() => setShowCreateDialog(true)}
          size="sm"
          className="bg-yellow-500 hover:bg-yellow-600 text-white"
        >
          <Plus className="w-4 h-4 mr-1" />
          Send Kudos
        </Button>
      </div>

      {/* Kudos list */}
      <div className="space-y-3">
        {kudosMessages.map((kudos) => (
          <Card
            key={kudos.id}
            onClick={() => !kudos.read && handleMarkAsRead(kudos.id)}
            className={`transition-all duration-200 ${
              !kudos.read
                ? 'bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-200 shadow-md cursor-pointer hover:shadow-lg'
                : 'bg-white hover:bg-gray-50'
            }`}
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                {/* Icon based on context */}
                <div
                  className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                    !kudos.read ? 'bg-yellow-100' : 'bg-gray-100'
                  }`}
                >
                  {kudos.contextType === 'task' ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : kudos.contextType === 'general' ? (
                    <Star className="w-5 h-5 text-yellow-500" />
                  ) : (
                    <Trophy className="w-5 h-5 text-yellow-600" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 mb-1">
                        From {kudos.senderName}
                      </p>
                      <p className="text-gray-700 mb-2">{kudos.content}</p>

                      {/* Context info */}
                      {kudos.contextType !== 'general' && (
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <Badge variant="outline" className="text-xs">
                            {kudos.contextType === 'task' ? 'Task' : 'Project'}
                          </Badge>
                          <span>"{kudos.entityName}"</span>
                        </div>
                      )}
                      {kudos.contextType === 'general' && (
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <Badge
                            variant="outline"
                            className="text-xs bg-yellow-50 border-yellow-200"
                          >
                            General Recognition
                          </Badge>
                        </div>
                      )}
                    </div>

                    {/* Timestamp and status */}
                    <div className="flex flex-col items-end gap-1 ml-4">
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <Clock className="w-3 h-3" />
                        {formatDistanceToNow(new Date(kudos.createdAt), {
                          addSuffix: true,
                        })}
                      </div>
                      {!kudos.read && (
                        <div className="flex flex-col items-end gap-1">
                          <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                          <span className="text-[10px] text-yellow-600">
                            Click to mark read
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
