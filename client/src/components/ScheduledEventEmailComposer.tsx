import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import {
  Mail,
  Send,
  FileText,
  X,
  Loader2,
  Building,
  User,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface EventRequest {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  organizationName: string;
}

interface Document {
  id: number;
  title: string;
  fileName: string;
  category: string;
  filePath: string;
}

interface ScheduledEventEmailComposerProps {
  isOpen: boolean;
  onClose: () => void;
  eventRequest: EventRequest;
  onEmailSent?: () => void;
}

export function ScheduledEventEmailComposer({
  isOpen,
  onClose,
  eventRequest,
  onEmailSent,
}: ScheduledEventEmailComposerProps) {
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [selectedAttachments, setSelectedAttachments] = useState<string[]>([]);
  const { toast } = useToast();

  // Fetch available documents
  const { data: documents = [], isLoading: isDocumentsLoading } = useQuery<Document[]>({
    queryKey: ['/api/storage/documents'],
    enabled: isOpen,
  });

  // Send email mutation
  const sendEmailMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', `/api/event-requests/${eventRequest.id}/send-email`, {
        recipientEmail: eventRequest.email,
        subject,
        content,
        attachments: selectedAttachments,
      });
    },
    onSuccess: () => {
      toast({
        title: 'Email Sent',
        description: `Email successfully sent to ${eventRequest.firstName} ${eventRequest.lastName}`,
      });
      onEmailSent?.();
      handleClose();
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to Send Email',
        description: error.message || 'An error occurred while sending the email.',
        variant: 'destructive',
      });
    },
  });

  const handleClose = () => {
    setSubject('');
    setContent('');
    setSelectedAttachments([]);
    onClose();
  };

  const handleSend = () => {
    if (!subject.trim()) {
      toast({
        title: 'Subject Required',
        description: 'Please enter a subject line for the email.',
        variant: 'destructive',
      });
      return;
    }

    if (!content.trim()) {
      toast({
        title: 'Message Required',
        description: 'Please enter a message for the email.',
        variant: 'destructive',
      });
      return;
    }

    sendEmailMutation.mutate();
  };

  const toggleAttachment = (filePath: string) => {
    if (selectedAttachments.includes(filePath)) {
      setSelectedAttachments(selectedAttachments.filter((p) => p !== filePath));
    } else {
      setSelectedAttachments([...selectedAttachments, filePath]);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Send Email to Event Organizer
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Recipient Info */}
          <Card className="bg-brand-primary-lighter border-brand-primary-border">
            <CardContent className="p-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <User className="w-4 h-4 text-brand-primary-muted" />
                  <span className="font-medium">Recipient:</span>
                  <span>
                    {eventRequest.firstName} {eventRequest.lastName}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="w-4 h-4 text-brand-primary-muted" />
                  <span className="font-medium">Email:</span>
                  <span>{eventRequest.email}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Building className="w-4 h-4 text-brand-primary-muted" />
                  <span className="font-medium">Organization:</span>
                  <span>{eventRequest.organizationName}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Subject */}
          <div className="space-y-2">
            <Label htmlFor="subject">Subject *</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Enter email subject"
              data-testid="input-email-subject"
            />
          </div>

          {/* Message */}
          <div className="space-y-2">
            <Label htmlFor="content">Message *</Label>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your message here..."
              rows={12}
              className="font-mono text-sm"
              data-testid="textarea-email-content"
            />
          </div>

          {/* Document Attachments */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Attach Toolkit Documents
            </Label>
            <p className="text-sm text-gray-500 mb-3">
              Selected documents will be included as links in the email body.
            </p>
            {isDocumentsLoading ? (
              <div className="flex items-center justify-center p-4">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto border rounded-lg p-3">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-start gap-2 p-2 hover:bg-gray-50 rounded"
                  >
                    <Checkbox
                      id={`doc-${doc.id}`}
                      checked={selectedAttachments.includes(doc.filePath)}
                      onCheckedChange={() => toggleAttachment(doc.filePath)}
                      data-testid={`checkbox-doc-${doc.id}`}
                    />
                    <label
                      htmlFor={`doc-${doc.id}`}
                      className="flex-1 cursor-pointer text-sm"
                    >
                      <div className="font-medium">{doc.title}</div>
                      <div className="text-xs text-gray-500">
                        {doc.category} • {doc.fileName}
                      </div>
                    </label>
                  </div>
                ))}
              </div>
            )}
            {selectedAttachments.length > 0 && (
              <p className="text-sm text-gray-600 mt-2">
                {selectedAttachments.length} document
                {selectedAttachments.length === 1 ? '' : 's'} selected
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={sendEmailMutation.isPending}
              data-testid="button-cancel"
            >
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button
              onClick={handleSend}
              disabled={sendEmailMutation.isPending}
              className="bg-[#236383] hover:bg-[#1a4d63]"
              data-testid="button-send-email"
            >
              {sendEmailMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Send Email
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
