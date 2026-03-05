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
import { Ban } from 'lucide-react';
import type { EventRequest } from '@shared/schema';
import { logger } from '@/lib/logger';

const nonEventFormSchema = z.object({
  nonEventReason: z.string().min(1, 'A reason is required'),
  nonEventNotes: z.string().optional(),
});

type NonEventFormData = z.infer<typeof nonEventFormSchema>;

interface NonEventDialogProps {
  isOpen: boolean;
  onClose: () => void;
  request: EventRequest | null;
  onConfirm: (eventId: number, data: {
    status: string;
    nonEventReason: string;
    nonEventNotes?: string;
  }) => Promise<void>;
}

export const NonEventDialog: React.FC<NonEventDialogProps> = ({
  isOpen,
  onClose,
  request,
  onConfirm,
}) => {
  const form = useForm<NonEventFormData>({
    resolver: zodResolver(nonEventFormSchema),
    defaultValues: {
      nonEventReason: '',
      nonEventNotes: '',
    },
  });

  React.useEffect(() => {
    if (isOpen) {
      form.reset({ nonEventReason: '', nonEventNotes: '' });
    }
  }, [isOpen, request, form]);

  const onSubmit = async (data: NonEventFormData) => {
    if (!request) return;

    try {
      await onConfirm(request.id, {
        status: 'non_event',
        nonEventReason: data.nonEventReason,
        nonEventNotes: data.nonEventNotes || undefined,
      });
      form.reset();
      onClose();
    } catch (error) {
      logger.error('Failed to mark event as non-event:', error);
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
            <Ban className="w-5 h-5 text-stone-600" />
            Mark as Non-Event
          </DialogTitle>
          <DialogDescription>
            Request: <strong>{request.organizationName}</strong>
            {request.department && ` - ${request.department}`}
          </DialogDescription>
        </DialogHeader>

        <div className="bg-stone-50 border border-stone-200 rounded-lg p-3 text-sm text-stone-700">
          This request was never a real event request. Record what it actually was for your records.
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="nonEventReason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-base font-semibold">
                    What was this request? <span className="text-red-500">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="e.g., Sandwich drop-off, general inquiry, duplicate submission, etc."
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="nonEventNotes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-semibold">
                    Additional Notes (Optional)
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Any additional context..."
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
                className="bg-stone-600 hover:bg-stone-700 text-white"
              >
                <Ban className="w-4 h-4 mr-2" />
                {form.formState.isSubmitting ? 'Processing...' : 'Mark as Non-Event'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
