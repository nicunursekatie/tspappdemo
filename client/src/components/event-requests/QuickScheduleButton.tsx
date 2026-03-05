/**
 * Emergency workaround button to mark events as scheduled
 * Bypasses the full form submission flow and makes a direct API call
 */
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { apiRequest, invalidateEventRequestQueries } from '@/lib/queryClient';
import { CalendarCheck } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { RefrigerationWarningDialog } from './RefrigerationWarningDialog';
import { needsRefrigerationConfirmation } from '@/lib/refrigeration-utils';

interface QuickScheduleButtonProps {
  eventId: number;
  eventName: string;
  currentStatus: string;
  scheduledDate?: string | null;
  hasRefrigeration?: boolean | null;
  sandwichTypes?: Array<{ type: string; quantity: number }> | null;
  onSuccess?: () => void;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export const QuickScheduleButton: React.FC<QuickScheduleButtonProps> = ({
  eventId,
  eventName,
  currentStatus,
  scheduledDate,
  hasRefrigeration,
  sandwichTypes,
  onSuccess,
  variant = 'outline',
  size = 'sm',
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showRefrigerationWarning, setShowRefrigerationWarning] = useState(false);
  const { toast} = useToast();
  const queryClient = useQueryClient();

  // Only show for events that can be scheduled
  if (currentStatus === 'scheduled' || currentStatus === 'completed' || currentStatus === 'declined' || currentStatus === 'cancelled') {
    return null;
  }

  const handleScheduleClick = () => {
    // Check refrigeration status before scheduling
    if (needsRefrigerationConfirmation(hasRefrigeration)) {
      setShowRefrigerationWarning(true);
    } else {
      setShowConfirm(true);
    }
  };

  const handleQuickSchedule = async () => {
    setIsLoading(true);
    console.log('🚀 [QuickSchedule] Starting direct API call', { eventId, eventName });

    try {
      const response = await apiRequest('PATCH', `/api/event-requests/${eventId}`, {
        status: 'scheduled',
        // If there's already a desired date, use it as the scheduled date
        ...(scheduledDate ? { scheduledEventDate: scheduledDate } : {}),
      });

      console.log('✅ [QuickSchedule] API response:', response);

      toast({
        title: '✓ Event Scheduled',
        description: `"${eventName}" has been marked as scheduled.`,
        duration: 5000,
      });

      // Refresh the event lists
      invalidateEventRequestQueries(queryClient);

      onSuccess?.();
      setShowConfirm(false);
    } catch (error) {
      console.error('❌ [QuickSchedule] Error:', error);
      toast({
        title: 'Failed to schedule event',
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
        variant: 'destructive',
        duration: 8000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={handleScheduleClick}
        disabled={isLoading}
        className="gap-1"
      >
        <CalendarCheck className="h-4 w-4" />
        {isLoading ? 'Scheduling...' : 'Quick Schedule'}
      </Button>

      <RefrigerationWarningDialog
        open={showRefrigerationWarning}
        onOpenChange={setShowRefrigerationWarning}
        onConfirm={() => {
          setShowRefrigerationWarning(false);
          setShowConfirm(true);
        }}
        onCancel={() => setShowRefrigerationWarning(false)}
      />

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark as Scheduled?</AlertDialogTitle>
            <AlertDialogDescription>
              This will change the status of "{eventName}" from "{currentStatus}" to "scheduled".
              {scheduledDate && (
                <span className="block mt-2">
                  Scheduled date: {new Date(scheduledDate).toLocaleDateString()}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleQuickSchedule}
              disabled={isLoading}
              className="bg-[#236383] hover:bg-[#1a4a63]"
            >
              {isLoading ? 'Scheduling...' : 'Yes, Schedule It'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
