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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { CalendarIcon, Clock, ArrowRight } from 'lucide-react';
import type { EventRequest } from '@shared/schema';
import { logger } from '@/lib/logger';

const postponementFormSchema = z.object({
  postponementReason: z.string().min(1, 'Postponement reason is required'),
  hasNewDate: z.boolean(),
  newScheduledDate: z.date().optional().nullable(),
  tentativeNewDate: z.date().optional().nullable(),
  postponementNotes: z.string().optional(),
}).refine(
  (data) => {
    // If they say they have a new date, the newScheduledDate is required
    if (data.hasNewDate && !data.newScheduledDate) {
      return false;
    }
    return true;
  },
  {
    message: 'New event date is required when you have a confirmed date',
    path: ['newScheduledDate'],
  }
);

type PostponementFormData = z.infer<typeof postponementFormSchema>;

interface PostponementDialogProps {
  isOpen: boolean;
  onClose: () => void;
  request: EventRequest | null;
  onPostpone: (eventId: number, data: {
    postponementReason: string;
    hasNewDate?: boolean;
    newScheduledDate?: string;
    tentativeNewDate?: string;
    postponementNotes?: string;
  }) => Promise<void>;
}

export const PostponementDialog: React.FC<PostponementDialogProps> = ({
  isOpen,
  onClose,
  request,
  onPostpone,
}) => {
  const form = useForm<PostponementFormData>({
    resolver: zodResolver(postponementFormSchema),
    defaultValues: {
      postponementReason: '',
      hasNewDate: false,
      newScheduledDate: null,
      tentativeNewDate: null,
      postponementNotes: '',
    },
  });

  const hasNewDate = form.watch('hasNewDate');

  // Reset form when dialog opens or request changes
  React.useEffect(() => {
    if (isOpen) {
      form.reset({
        postponementReason: '',
        hasNewDate: false,
        newScheduledDate: null,
        tentativeNewDate: null,
        postponementNotes: '',
      });
    }
  }, [isOpen, request, form]);

  const onSubmit = async (data: PostponementFormData) => {
    if (!request) return;

    try {
      const submitData: {
        postponementReason: string;
        hasNewDate?: boolean;
        newScheduledDate?: string;
        tentativeNewDate?: string;
        postponementNotes?: string;
      } = {
        postponementReason: data.postponementReason,
        postponementNotes: data.postponementNotes || undefined,
      };

      if (data.hasNewDate && data.newScheduledDate) {
        submitData.hasNewDate = true;
        submitData.newScheduledDate = format(data.newScheduledDate, 'yyyy-MM-dd');
      } else {
        submitData.hasNewDate = false;
        if (data.tentativeNewDate) {
          submitData.tentativeNewDate = format(data.tentativeNewDate, 'yyyy-MM-dd');
        }
      }

      await onPostpone(request.id, submitData);
      form.reset();
      onClose();
    } catch (error) {
      logger.error('Failed to postpone event:', error);
    }
  };

  if (!request) return null;

  const originalDate = request.scheduledEventDate
    ? new Date(request.scheduledEventDate)
    : request.desiredEventDate
      ? new Date(request.desiredEventDate)
      : null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        form.reset();
        onClose();
      }
    }}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-600" />
            Postpone Event
          </DialogTitle>
          <DialogDescription>
            Event: <strong>{request.organizationName}</strong>
            {request.department && ` - ${request.department}`}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Show current event details */}
            <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-gray-600">Contact:</span>
                <span className="font-medium">{request.firstName} {request.lastName}</span>
              </div>
              {originalDate && (
                <div className="flex items-center gap-2">
                  <span className="text-gray-600">Currently Scheduled:</span>
                  <span className="font-medium">{format(originalDate, 'PPP')}</span>
                </div>
              )}
            </div>

            {/* Postponement Reason */}
            <FormField
              control={form.control}
              name="postponementReason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-base font-semibold">
                    Postponement Reason <span className="text-red-500">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="e.g., Organizer requested different date, scheduling conflict, etc."
                      data-testid="input-postponement-reason"
                    />
                  </FormControl>
                  <FormDescription>
                    Briefly explain why this event is being postponed
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Do they have a new date? */}
            <FormField
              control={form.control}
              name="hasNewDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-base font-semibold">
                    Do you have the new date already?
                  </FormLabel>
                  <div className="flex gap-3 mt-2">
                    <Button
                      type="button"
                      variant={field.value ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => {
                        field.onChange(true);
                        form.setValue('tentativeNewDate', null);
                      }}
                      className={field.value ? 'bg-blue-600 hover:bg-blue-700' : ''}
                    >
                      Yes, I have the new date
                    </Button>
                    <Button
                      type="button"
                      variant={!field.value ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => {
                        field.onChange(false);
                        form.setValue('newScheduledDate', null);
                      }}
                      className={!field.value ? 'bg-amber-600 hover:bg-amber-700' : ''}
                    >
                      No, not yet
                    </Button>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Branch A: Has new date - show new date picker */}
            {hasNewDate && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2 text-blue-800 text-sm font-medium">
                  <ArrowRight className="w-4 h-4" />
                  The event will stay Scheduled with the new date. The original date will be preserved for reference.
                </div>
                <FormField
                  control={form.control}
                  name="newScheduledDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel className="text-sm font-semibold">
                        New Event Date <span className="text-red-500">*</span>
                      </FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                'w-full pl-3 text-left font-normal',
                                !field.value && 'text-muted-foreground'
                              )}
                            >
                              {field.value ? (
                                format(field.value, 'PPP')
                              ) : (
                                <span>Select the new event date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value || undefined}
                            onSelect={field.onChange}
                            disabled={(date) =>
                              date < new Date(new Date().setHours(0, 0, 0, 0))
                            }
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {/* Branch B: No new date - move to postponed, optional tentative date */}
            {!hasNewDate && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2 text-amber-800 text-sm font-medium">
                  <ArrowRight className="w-4 h-4" />
                  The event will move to Postponed status until a new date is confirmed.
                </div>
                <FormField
                  control={form.control}
                  name="tentativeNewDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel className="text-sm font-semibold">
                        Tentative New Date (Optional)
                      </FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                'w-full pl-3 text-left font-normal',
                                !field.value && 'text-muted-foreground'
                              )}
                              data-testid="button-select-tentative-date"
                            >
                              {field.value ? (
                                format(field.value, 'PPP')
                              ) : (
                                <span>Pick a tentative date (if available)</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value || undefined}
                            onSelect={field.onChange}
                            disabled={(date) =>
                              date < new Date(new Date().setHours(0, 0, 0, 0))
                            }
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormDescription>
                        If the organizer mentioned a possible future date, enter it here for tracking
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {/* Postponement Notes */}
            <FormField
              control={form.control}
              name="postponementNotes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-base font-semibold">
                    Additional Notes (Optional)
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Any additional details about the postponement, follow-up plans, or context..."
                      rows={3}
                      data-testid="textarea-postponement-notes"
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
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={form.formState.isSubmitting}
                className={hasNewDate ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-amber-600 hover:bg-amber-700 text-white'}
                data-testid="button-submit"
              >
                <Clock className="w-4 h-4 mr-2" />
                {form.formState.isSubmitting
                  ? 'Processing...'
                  : hasNewDate
                    ? 'Reschedule Event'
                    : 'Mark as Postponed'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
