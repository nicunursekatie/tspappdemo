import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  CheckCircle,
  Shield,
  Mail,
  Phone,
  MessageCircle,
} from 'lucide-react';
import { EventEmailComposer } from '@/components/event-email-composer';
import type { EventRequest } from '@shared/schema';
import { useIsMobile } from '@/hooks/use-mobile';

// Contact attempt info to log along with toolkit
interface ContactAttemptInfo {
  method: string;
  outcome: string;
  notes?: string;
}

// ToolkitSentDialog Component - handles marking toolkit as sent and optionally sending email
interface ToolkitSentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  eventRequest: EventRequest | null;
  onToolkitSent: (toolkitSentDate: string, contactAttempt?: ContactAttemptInfo) => void;
  isLoading: boolean;
}

const CALL_OUTCOMES = [
  { value: 'successful', label: 'Spoke with contact' },
  { value: 'left_message', label: 'Left voicemail' },
  { value: 'no_answer', label: 'No answer' },
];

const ToolkitSentDialog = ({
  isOpen,
  onClose,
  eventRequest,
  onToolkitSent,
  isLoading,
}: ToolkitSentDialogProps) => {
  const isMobile = useIsMobile();
  const [toolkitSentDate, setToolkitSentDate] = useState('');
  const [toolkitSentTime, setToolkitSentTime] = useState('');
  const [showEmailComposer, setShowEmailComposer] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  // Phone call logging
  const [alsoLoggedCall, setAlsoLoggedCall] = useState(false);
  const [callOutcome, setCallOutcome] = useState('');
  const [callNotes, setCallNotes] = useState('');

  // Initialize date/time when dialog opens
  useEffect(() => {
    if (isOpen && eventRequest) {
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD format
      const timeStr = now.toTimeString().slice(0, 5); // HH:MM format
      setToolkitSentDate(dateStr);
      setToolkitSentTime(timeStr);
      setShowEmailComposer(false);
      setEmailSent(false);
      setAlsoLoggedCall(false);
      setCallOutcome('');
      setCallNotes('');
    }
  }, [isOpen, eventRequest]);

  const handleSubmit = () => {
    if (!toolkitSentDate || !toolkitSentTime) return;
    if (alsoLoggedCall && !callOutcome) return; // Require outcome if logging call

    // Combine date and time into ISO string
    const combinedDateTime = new Date(
      `${toolkitSentDate}T${toolkitSentTime}`
    ).toISOString();

    // Build contact attempt info if logging a call
    const contactAttempt = alsoLoggedCall ? {
      method: 'phone_and_toolkit',
      outcome: callOutcome === 'successful' ? 'toolkit_sent' :
               callOutcome === 'left_message' ? 'toolkit_sent_left_message' :
               'toolkit_sent',
      notes: callNotes || `Toolkit sent${callOutcome === 'left_message' ? ' and left voicemail' : callOutcome === 'successful' ? ' after speaking with contact' : ''}`,
    } : undefined;

    onToolkitSent(combinedDateTime, contactAttempt);
  };

  const handleEmailSent = () => {
    setEmailSent(true);
    setShowEmailComposer(false);
  };

  if (!eventRequest) return null;

  return (
    <>
      <Dialog open={isOpen && !showEmailComposer} onOpenChange={onClose}>
        <DialogContent className="w-[95vw] max-w-4xl max-h-[85vh] flex flex-col">
          <DialogHeader className="border-b border-[#007E8C]/10 pb-4 flex-shrink-0">
            <DialogTitle className="flex items-center space-x-2 text-[#236383] text-xl">
              <Shield className="w-5 h-5 text-[#007E8C]" aria-hidden="true" />
              <span>Mark Toolkit as Sent</span>
            </DialogTitle>
            <DialogDescription className="text-gray-600 mt-2">
              Record when the toolkit was sent to{' '}
              <strong>
                {eventRequest?.firstName} {eventRequest?.lastName}
              </strong>{' '}
              at <strong>{eventRequest?.organizationName}</strong>. This will move
              the event to &quot;In Process&quot; status.
            </DialogDescription>
          </DialogHeader>

          <div className="overflow-y-auto flex-1">
            <div className="space-y-6 pt-4">
            {/* Date and Time Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="toolkit-sent-date" className="text-[#236383] font-medium">Toolkit Sent Date</Label>
                <Input
                  id="toolkit-sent-date"
                  type="date"
                  value={toolkitSentDate}
                  onChange={(e) => setToolkitSentDate(e.target.value)}
                  className="border-[#007E8C]/30 focus:border-[#007E8C] focus:ring-[#007E8C]/20"
                  data-testid="input-toolkit-sent-date"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="toolkit-sent-time" className="text-[#236383] font-medium">Toolkit Sent Time</Label>
                <Input
                  id="toolkit-sent-time"
                  type="time"
                  value={toolkitSentTime}
                  onChange={(e) => setToolkitSentTime(e.target.value)}
                  className="border-[#007E8C]/30 focus:border-[#007E8C] focus:ring-[#007E8C]/20"
                  data-testid="input-toolkit-sent-time"
                />
              </div>
            </div>

            {/* Email Status Display */}
            {emailSent && (
              <div className="p-4 bg-[#007E8C]/5 border border-[#007E8C]/30 rounded-lg">
                <div className="flex items-center space-x-2 text-[#007E8C]">
                  <CheckCircle className="w-5 h-5" aria-hidden="true" />
                  <span className="font-semibold">Email successfully sent!</span>
                </div>
                <p className="text-sm text-[#236383] mt-1">
                  The toolkit email has been sent to {eventRequest?.email}
                </p>
              </div>
            )}

            {/* Also Log Phone Call Option */}
            {eventRequest?.phone && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg space-y-3">
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="also-logged-call"
                    checked={alsoLoggedCall}
                    onCheckedChange={(checked) => setAlsoLoggedCall(checked === true)}
                    className="border-amber-400 data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500"
                  />
                  <Label
                    htmlFor="also-logged-call"
                    className="text-amber-800 font-medium cursor-pointer flex items-center gap-2"
                  >
                    <Phone className="w-4 h-4" />
                    I also called {eventRequest.firstName}
                  </Label>
                </div>

                {alsoLoggedCall && (
                  <div className="ml-7 space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="call-outcome" className="text-amber-800 text-sm">
                        What happened on the call? *
                      </Label>
                      <Select value={callOutcome} onValueChange={setCallOutcome}>
                        <SelectTrigger id="call-outcome" className="w-full border-amber-300">
                          <SelectValue placeholder="Select call outcome" />
                        </SelectTrigger>
                        <SelectContent>
                          {CALL_OUTCOMES.map((outcome) => (
                            <SelectItem key={outcome.value} value={outcome.value}>
                              {outcome.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="call-notes" className="text-amber-800 text-sm">
                        Call notes (optional)
                      </Label>
                      <Textarea
                        id="call-notes"
                        placeholder="Any notes from the call..."
                        value={callNotes}
                        onChange={(e) => setCallNotes(e.target.value)}
                        rows={2}
                        className="resize-none border-amber-300"
                      />
                    </div>

                    <p className="text-xs text-amber-600">
                      This will log a contact attempt with method &quot;Phone + Toolkit&quot;
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Information */}
            <div className="bg-[#47B3CB]/5 border border-[#47B3CB]/30 rounded-lg p-4">
              <h4 className="font-semibold text-[#236383] uppercase tracking-wide text-sm mb-3">
                What happens when you mark toolkit as sent:
              </h4>
              <ul className="text-sm text-[#236383] space-y-2">
                <li>• Event status will change from &quot;New&quot; to &quot;In Process&quot;</li>
                <li>• Event will appear in the &quot;In Process&quot; tab</li>
                {!emailSent && (
                  <li>
                    • You can optionally send an email to{' '}
                    {eventRequest?.firstName} with toolkit attachments
                  </li>
                )}
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row sm:justify-between gap-3 pt-4 border-t border-[#007E8C]/10">
              <div className="flex flex-wrap gap-2">
              {!emailSent && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const recipient = eventRequest?.email || '';
                      const subject = encodeURIComponent(`${eventRequest?.organizationName || 'Event'} - Sandwich Making Event`);
                      const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${recipient}&su=${subject}`;
                      window.open(gmailUrl, '_blank');
                    }}
                    className="flex items-center space-x-2 border-[#007E8C]/30 text-[#007E8C] hover:bg-[#007E8C]/5"
                    data-testid="button-compose-gmail"
                  >
                    <Mail className="w-4 h-4" aria-hidden="true" />
                    <span>Compose in Gmail</span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowEmailComposer(true)}
                    className="flex items-center space-x-2 border-[#007E8C]/30 text-[#007E8C] hover:bg-[#007E8C]/5"
                    data-testid="button-send-toolkit-email"
                  >
                    <Mail className="w-4 h-4" aria-hidden="true" />
                    <span>Send Toolkit Email</span>
                  </Button>
                </>
              )}

                {eventRequest?.phone && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const phoneNumber = eventRequest?.phone;

                      if (isMobile) {
                        // On mobile, open the dialer
                        window.location.href = `tel:${phoneNumber}`;
                      } else {
                        // On desktop, copy to clipboard
                        if (phoneNumber) {
                          navigator.clipboard.writeText(phoneNumber)
                            .then(() => {
                              window.alert(`Phone number copied!\n${phoneNumber} has been copied to your clipboard.`);
                            })
                            .catch(() => {
                              window.alert(`Failed to copy phone number.\nPlease copy manually: ${phoneNumber}`);
                            });
                        } else {
                          window.alert('No phone number available to copy.');
                        }
                      }
                    }}
                    className="flex items-center space-x-2 border-[#47B3CB]/30 text-[#47B3CB] hover:bg-[#47B3CB]/5"
                    data-testid="button-call-contact"
                    title={eventRequest?.phone || ''}
                  >
                    <Phone className="w-4 h-4" aria-hidden="true" />
                    <span>{isMobile ? 'Call' : 'Copy Number'}</span>
                  </Button>
                )}
              </div>

              <div className="flex flex-wrap gap-2 sm:ml-auto">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  disabled={isLoading}
                  className="border-gray-300 text-gray-700 hover:bg-gray-50 flex-1 sm:flex-initial"
                  data-testid="button-cancel-toolkit-sent"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!toolkitSentDate || !toolkitSentTime || isLoading}
                  className="bg-[#007E8C] hover:bg-[#236383] text-white shadow-sm flex-1 sm:flex-initial whitespace-nowrap"
                  data-testid="button-confirm-toolkit-sent"
                >
                  <Shield className="w-4 h-4 mr-2" aria-hidden="true" />
                  {isLoading ? 'Marking...' : 'Mark as Sent'}
                </Button>
              </div>
            </div>
          </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Email Composer as a separate dialog */}
      <EventEmailComposer
        eventRequest={{
          id: eventRequest?.id || 0,
          firstName: eventRequest?.firstName || '',
          lastName: eventRequest?.lastName || '',
          email: eventRequest?.email || '',
          phone: eventRequest?.phone || undefined,
          organizationName: eventRequest?.organizationName || '',
          department: eventRequest?.department || undefined,
          desiredEventDate: eventRequest?.desiredEventDate?.toString() || undefined,
          eventAddress: eventRequest?.eventAddress || undefined,
          estimatedSandwichCount: eventRequest?.estimatedSandwichCount || undefined,
          eventStartTime: eventRequest?.eventStartTime || undefined,
          eventEndTime: eventRequest?.eventEndTime || undefined,
          message: eventRequest?.message || undefined,
        }}
        onEmailSent={handleEmailSent}
        isOpen={showEmailComposer}
        onClose={() => setShowEmailComposer(false)}
      />
    </>
  );
};

export default ToolkitSentDialog;