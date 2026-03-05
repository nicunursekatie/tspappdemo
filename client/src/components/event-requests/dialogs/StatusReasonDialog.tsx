import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { XCircle, Ban } from 'lucide-react';
import type { EventRequest } from '@shared/schema';
import { logger } from '@/lib/logger';

const reasonFormSchema = z.object({
  reason: z.string().min(1, 'A reason is required'),
  notes: z.string().optional(),
});

type ReasonFormData = z.infer<typeof reasonFormSchema>;

type StatusReasonType = 'declined' | 'cancelled';

interface StatusReasonDialogProps {
  isOpen: boolean;
  onClose: () => void;
  request: EventRequest | null;
  type: StatusReasonType;
  onConfirm: (eventId: number, data: {
    status: string;
    declinedReason?: string;
    declinedNotes?: string;
    cancelledReason?: string;
    cancelledNotes?: string;
  }) => Promise<void>;
}

const CONFIG: Record<StatusReasonType, {
  title: string;
  description: string;
  reasonLabel: string;
  reasonPlaceholder: string;
  notesPlaceholder: string;
  buttonLabel: string;
  buttonClass: string;
  icon: typeof XCircle;
}> = {
  declined: {
    title: 'Decline Event Request',
    description: 'This event did not proceed to a scheduled date. Record the reason for your records.',
    reasonLabel: 'Reason for Declining',
    reasonPlaceholder: 'e.g., Organizer decided not to proceed, scheduling conflict they couldn\'t resolve, etc.',
    notesPlaceholder: 'Any additional context about why this event was declined...',
    buttonLabel: 'Mark as Declined',
    buttonClass: 'bg-red-700 hover:bg-red-800 text-white',
    icon: XCircle,
  },
  cancelled: {
    title: 'Cancel Scheduled Event',
    description: 'This event was previously scheduled but will no longer take place. Record the reason for your records.',
    reasonLabel: 'Reason for Cancellation',
    reasonPlaceholder: 'e.g., Organizer cancelled, venue no longer available, insufficient attendance, etc.',
    notesPlaceholder: 'Any additional context about why this event was cancelled...',
    buttonLabel: 'Mark as Cancelled',
    buttonClass: 'bg-red-700 hover:bg-red-800 text-white',
    icon: Ban,
  },
};

export const StatusReasonDialog: React.FC<StatusReasonDialogProps> = ({
  isOpen,
  onClose,
  request,
  type,
  onConfirm,
}) => {
  const config = CONFIG[type];
  const Icon = config.icon;

  const form = useForm<ReasonFormData>({
    resolver: zodResolver(reasonFormSchema),
    defaultValues: {
      reason: '',
      notes: '',
    },
  });

  React.useEffect(() => {
    if (isOpen) {
      form.reset({ reason: '', notes: '' });
    }
  }, [isOpen, request, form]);

  const onSubmit = async (data: ReasonFormData) => {
    if (!request) return;

    try {
      const submitData: any = {
        status: type,
      };

      if (type === 'declined') {
        submitData.declinedReason = data.reason;
        submitData.declinedNotes = data.notes || undefined;
      } else {
        submitData.cancelledReason = data.reason;
        submitData.cancelledNotes = data.notes || undefined;
      }

      await onConfirm(request.id, submitData);
      form.reset();
      onClose();
    } catch (error) {
      logger.error(`Failed to ${type} event:`, error);
    }
  };

  if (!request) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        form.reset();
        onClose();
      }
    }}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="w-5 h-5 text-red-600" />
            {config.title}
          </DialogTitle>
          <DialogDescription>
            Event: <strong>{request.organizationName}</strong>
            {request.department && ` - ${request.department}`}
          </DialogDescription>
        </DialogHeader>

        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
          {config.description}
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-base font-semibold">
                    {config.reasonLabel} <span className="text-red-500">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder={config.reasonPlaceholder}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-semibold">
                    Additional Notes (Optional)
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder={config.notesPlaceholder}
                      rows={3}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  form.reset();
                  onClose();
                }}
                disabled={form.formState.isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={form.formState.isSubmitting}
                className={config.buttonClass}
              >
                <Icon className="w-4 h-4 mr-2" />
                {form.formState.isSubmitting ? 'Processing...' : config.buttonLabel}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
