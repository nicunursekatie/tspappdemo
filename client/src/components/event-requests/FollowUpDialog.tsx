import React from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Mail,
  Phone,
  Clock,
} from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import type { EventRequest } from '@shared/schema';

// Follow-up Dialog Component
interface FollowUpDialogProps {
  isOpen: boolean;
  onClose: () => void;
  eventRequest: EventRequest | null;
  onFollowUpCompleted: (notes: string) => void;
  isLoading: boolean;
  followUpType: '1-day' | '1-month';
  notes: string;
  setNotes: (notes: string) => void;
}

const FollowUpDialog: React.FC<FollowUpDialogProps> = ({
  isOpen,
  onClose,
  eventRequest,
  onFollowUpCompleted,
  isLoading,
  followUpType,
  notes,
  setNotes,
}) => {
  const isMobile = useIsMobile();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onFollowUpCompleted(notes);
  };

  if (!eventRequest) return null;

  const isOneDay = followUpType === '1-day';
  const title = isOneDay ? '1-Day Follow-up' : '1-Month Follow-up';
  const description = isOneDay 
    ? 'Record follow-up communication one day after the event'
    : 'Record follow-up communication one month after the event';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-2xl">
        <DialogHeader className="border-b border-[#007E8C]/10 pb-4">
          <DialogTitle className="flex items-center space-x-2 text-[#236383] text-xl">
            <Clock className="w-5 h-5 text-[#FBAD3F]" aria-hidden="true" />
            <span>{title}</span>
          </DialogTitle>
          <DialogDescription className="text-gray-600 mt-2">
            {description} with{' '}
            <strong>
              {eventRequest?.firstName} {eventRequest?.lastName}
            </strong>{' '}
            at <strong>{eventRequest?.organizationName}</strong>.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          {/* Event Information */}
          <div className="bg-[#007E8C]/5 border border-[#007E8C]/20 rounded-lg p-4">
            <h4 className="font-semibold text-[#236383] uppercase tracking-wide text-sm mb-3">Event Details</h4>
            <div className="space-y-2 text-sm">
              <div><strong className="text-[#236383]">Event Date:</strong> <span className="text-gray-700">{
                eventRequest?.desiredEventDate ?
                  new Date(eventRequest.desiredEventDate).toLocaleDateString() :
                  'Not specified'
              }</span></div>
              <div><strong className="text-[#236383]">Address:</strong> <span className="text-gray-700">{eventRequest?.eventAddress || 'Not specified'}</span></div>
              <div><strong className="text-[#236383]">Estimated Sandwiches:</strong> <span className="text-gray-700">{eventRequest?.estimatedSandwichCount || 'Not specified'}</span></div>
            </div>
          </div>

          {/* Contact Information */}
          <div className="bg-[#47B3CB]/5 border border-[#47B3CB]/20 rounded-lg p-4">
            <h4 className="font-semibold text-[#236383] uppercase tracking-wide text-sm mb-3">Contact Information</h4>
            <div className="space-y-2 text-sm">
              <div className="flex items-center space-x-2">
                <Mail className="w-4 h-4 text-[#007E8C]" aria-hidden="true" />
                <span className="text-gray-700">{eventRequest?.email}</span>
              </div>
              {eventRequest?.phone && (
                <div className="flex items-center space-x-2">
                  <Phone className="w-4 h-4 text-[#007E8C]" aria-hidden="true" />
                  <span className="text-gray-700">{eventRequest?.phone}</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const phoneNumber = eventRequest?.phone;

                      if (isMobile) {
                        window.location.href = `tel:${phoneNumber}`;
                      } else {
                        navigator.clipboard.writeText(phoneNumber || '');
                      }
                    }}
                    className="ml-auto text-xs border-[#007E8C]/30 text-[#007E8C] hover:bg-[#007E8C]/5"
                  >
                    {isMobile ? 'Call' : 'Copy'}
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Follow-up Notes */}
          <div className="space-y-2">
            <Label htmlFor="followup-notes">Follow-up Notes</Label>
            <Textarea
              id="followup-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={`Record notes from your ${followUpType} follow-up communication...`}
              className="min-h-[120px]"
              required
            />
          </div>

          {/* Information */}
          <div className={`${isOneDay ? 'bg-[#FBAD3F]/5 border-[#FBAD3F]/30' : 'bg-[#007E8C]/5 border-[#007E8C]/30'} border rounded-lg p-4`}>
            <h4 className={`font-semibold ${isOneDay ? 'text-[#FBAD3F]' : 'text-[#007E8C]'} uppercase tracking-wide text-sm mb-3`}>
              {title} Guidelines:
            </h4>
            <ul className={`text-sm ${isOneDay ? 'text-[#236383]' : 'text-[#236383]'} space-y-2`}>
              {isOneDay ? (
                <>
                  <li>• Ask how the event went and if there were any issues</li>
                  <li>• Gather feedback on sandwich quality and quantity</li>
                  <li>• Note any suggestions for future events</li>
                </>
              ) : (
                <>
                  <li>• Check if they&apos;re planning any future events</li>
                  <li>• Ask about their overall experience with TSP</li>
                  <li>• Gather feedback for program improvement</li>
                </>
              )}
            </ul>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-[#007E8C]/10">
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading} className="border-gray-300 text-gray-700 hover:bg-gray-50">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!notes.trim() || isLoading}
              className={`text-white shadow-sm ${isOneDay ? 'bg-[#FBAD3F] hover:bg-[#FBAD3F]/90' : 'bg-[#007E8C] hover:bg-[#236383]'}`}
              data-testid={`button-confirm-followup-${followUpType}`}
            >
              {isLoading ? 'Saving...' : `Complete ${title}`}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default FollowUpDialog;