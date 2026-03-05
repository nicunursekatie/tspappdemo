import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { MessageSquare, AlertTriangle, CheckCircle2, Phone, Mail } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import type { EventRequest, User } from '@shared/schema';
import { ScrollArea } from '@/components/ui/scroll-area';

interface SendEventDetailsSMSDialogProps {
  isOpen: boolean;
  onClose: () => void;
  eventRequest: EventRequest | null;
}

export function SendEventDetailsSMSDialog({
  isOpen,
  onClose,
  eventRequest,
}: SendEventDetailsSMSDialogProps) {
  const { toast } = useToast();
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch all users
  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ['/api/users'],
    enabled: isOpen,
  });

  // Send SMS mutation
  const sendSmsMutation = useMutation({
    mutationFn: async (userIds: string[]) => {
      return await apiRequest('POST', `/api/event-requests/${eventRequest?.id}/send-details-sms`, {
        userIds,
      });
    },
    onSuccess: (data: any) => {
      const successCount = data.results.filter((r: any) => r.success).length;
      toast({
        title: 'Event details sent!',
        description: `Successfully sent to ${successCount} of ${data.results.length} users`,
      });
      
      // Show errors if any
      const failures = data.results.filter((r: any) => !r.success);
      if (failures.length > 0) {
        failures.forEach((failure: any) => {
          toast({
            title: 'Failed to send',
            description: `${failure.userName}: ${failure.error}`,
            variant: 'destructive',
          });
        });
      }
      
      onClose();
      setSelectedUserIds([]);
    },
    onError: (error: any) => {
      toast({
        title: 'Error sending event details',
        description: error.message || 'Failed to send SMS',
        variant: 'destructive',
      });
    },
  });

  const handleSend = () => {
    if (selectedUserIds.length === 0) {
      toast({
        title: 'No users selected',
        description: 'Please select at least one user',
        variant: 'destructive',
      });
      return;
    }
    sendSmsMutation.mutate(selectedUserIds);
  };

  const handleToggleUser = (userId: string) => {
    setSelectedUserIds(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleToggleAll = () => {
    if (selectedUserIds.length === filteredUsers.length) {
      setSelectedUserIds([]);
    } else {
      setSelectedUserIds(filteredUsers.map(u => u.id));
    }
  };

  // Filter users based on search and SMS consent
  const filteredUsers = users.filter(user => {
    const searchLower = searchQuery.toLowerCase();
    const displayName = user.displayName || `${user.firstName} ${user.lastName}`.trim() || user.email;
    const smsConsent = (user.metadata as any)?.smsConsent;
    
    // Only show users who have confirmed SMS opt-in
    const hasConfirmedSmsConsent = 
      smsConsent?.status === 'confirmed' && 
      smsConsent?.enabled === true && 
      smsConsent?.phoneNumber;
    
    return (
      hasConfirmedSmsConsent && // Only show users with confirmed SMS consent
      (displayName.toLowerCase().includes(searchLower) ||
       user.email.toLowerCase().includes(searchLower))
    );
  });

  // Get preview of event details
  const getEventPreview = () => {
    if (!eventRequest) return '';
    
    const organizationName = eventRequest.organizationName || 'Organization';
    const eventDate = eventRequest.scheduledEventDate 
      ? new Date(eventRequest.scheduledEventDate).toLocaleDateString('en-US', { 
          month: 'long', day: 'numeric', year: 'numeric' 
        })
      : 'TBD';
    const location = eventRequest.eventAddress || 'Location TBD';
    
    return `${organizationName} - ${eventDate} at ${location}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-2xl max-h-[85vh] p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Send Event Details via SMS
          </DialogTitle>
          <DialogDescription>
            Select users to receive event information via text message
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Event Preview */}
          {eventRequest && (
            <Alert className="border-brand-primary-light bg-brand-primary-lighter">
              <CheckCircle2 className="h-4 w-4 text-brand-primary" />
              <AlertDescription>
                <strong>Event:</strong> {getEventPreview()}
              </AlertDescription>
            </Alert>
          )}

          {/* Search */}
          <div>
            <Label htmlFor="user-search">Search Users</Label>
            <Input
              id="user-search"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="mt-1"
              data-testid="input-user-search"
            />
          </div>

          {/* Select All */}
          {filteredUsers.length > 0 && (
            <div className="flex items-center space-x-2 pb-2 border-b">
              <Checkbox
                id="select-all"
                checked={selectedUserIds.length === filteredUsers.length}
                onCheckedChange={handleToggleAll}
                data-testid="checkbox-select-all"
              />
              <Label htmlFor="select-all" className="cursor-pointer font-medium">
                Select All ({filteredUsers.length} users with phone numbers)
              </Label>
            </div>
          )}

          {/* User List */}
          <ScrollArea className="h-[300px] pr-4">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading users...
              </div>
            ) : filteredUsers.length === 0 ? (
              <Alert variant="warning">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {searchQuery
                    ? 'No users found matching your search'
                    : 'No users with phone numbers found'}
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-2">
                {filteredUsers.map((user) => {
                  const displayName = user.displayName || `${user.firstName} ${user.lastName}`.trim() || user.email;
                  const phoneNumber = user.phoneNumber || (user.metadata as any)?.smsConsent?.phoneNumber;
                  const maskedPhone = phoneNumber ? phoneNumber.replace(/\d(?=\d{4})/g, '*') : 'No phone';

                  return (
                    <div
                      key={user.id}
                      className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                    >
                      <Checkbox
                        id={`user-${user.id}`}
                        checked={selectedUserIds.includes(user.id)}
                        onCheckedChange={() => handleToggleUser(user.id)}
                        className="mt-1"
                        data-testid={`checkbox-user-${user.id}`}
                      />
                      <div className="flex-1 min-w-0">
                        <Label
                          htmlFor={`user-${user.id}`}
                          className="cursor-pointer font-medium block"
                        >
                          {displayName}
                        </Label>
                        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {user.email}
                          </span>
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {maskedPhone}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          {/* Selected count */}
          {selectedUserIds.length > 0 && (
            <div className="text-sm font-medium text-brand-primary">
              {selectedUserIds.length} user{selectedUserIds.length !== 1 ? 's' : ''} selected
            </div>
          )}

          {/* Warning about SMS charges */}
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Each message will include event details, Google Maps link, and contact information.
              Standard SMS rates may apply for recipients.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={sendSmsMutation.isPending}
            data-testid="button-cancel"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={sendSmsMutation.isPending || selectedUserIds.length === 0}
            className="btn-tsp-primary"
            data-testid="button-send-sms"
          >
            <MessageSquare className="w-4 h-4 mr-2" />
            {sendSmsMutation.isPending
              ? 'Sending...'
              : `Send to ${selectedUserIds.length} User${selectedUserIds.length !== 1 ? 's' : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
