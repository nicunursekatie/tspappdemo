import { FC, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
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

interface NotificationActionButtonProps {
  notificationId: number;
  actionType: string;
  actionText: string;
  actionUrl?: string;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary';
  actionData?: any;
  onSuccess?: () => void;
  requireConfirmation?: boolean;
  confirmationMessage?: string;
}

export const NotificationActionButton: FC<NotificationActionButtonProps> = ({
  notificationId,
  actionType,
  actionText,
  actionUrl,
  variant = 'default',
  actionData,
  onSuccess,
  requireConfirmation = false,
  confirmationMessage,
}) => {
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async () => {
      // If action has URL and no special action type, navigate instead of POST
      if (actionUrl && !isActionTypeExecutable(actionType)) {
        if (actionUrl.startsWith('http')) {
          window.open(actionUrl, '_blank');
        } else {
          window.location.href = actionUrl;
        }
        return { navigated: true };
      }

      // Otherwise, execute the action via API
      return await apiRequest(
        'POST',
        `/api/notifications/${notificationId}/actions/${actionType}`,
        { actionData }
      );
    },
    onSuccess: (data) => {
      if (!data.navigated) {
        setStatus('success');

        toast({
          title: 'Action completed',
          description: data.result?.message || `${actionText} completed successfully`,
          variant: 'default',
        });

        // Invalidate notifications query to refresh the list
        queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
        queryClient.invalidateQueries({ queryKey: ['/api/notifications/counts'] });

        onSuccess?.();

        // Reset status after animation
        setTimeout(() => setStatus('idle'), 2000);
      }
    },
    onError: (error: any) => {
      setStatus('error');

      toast({
        title: 'Action failed',
        description: error.message || 'Failed to complete action',
        variant: 'destructive',
      });

      // Reset status after showing error
      setTimeout(() => setStatus('idle'), 3000);
    },
  });

  // Determine if action type requires API execution
  const isActionTypeExecutable = (type: string): boolean => {
    const executableTypes = [
      'approve',
      'accept',
      'decline',
      'reject',
      'mark_complete',
      'complete',
      'assign',
      'assign_tsp_contact',
      'mark_toolkit_sent',
      'start',
    ];
    return executableTypes.some((t) => type.toLowerCase().includes(t));
  };

  // Determine if this is a destructive action
  const isDestructive = (type: string): boolean => {
    const destructiveTypes = ['decline', 'reject', 'delete', 'cancel'];
    return destructiveTypes.some((t) => type.toLowerCase().includes(t));
  };

  const handleClick = () => {
    if (requireConfirmation || isDestructive(actionType)) {
      setShowConfirmDialog(true);
    } else {
      mutation.mutate();
    }
  };

  const handleConfirm = () => {
    setShowConfirmDialog(false);
    mutation.mutate();
  };

  // Auto-determine variant based on action type if not specified
  const buttonVariant =
    variant === 'default' && isDestructive(actionType) ? 'destructive' : variant;

  return (
    <>
      <Button
        onClick={handleClick}
        disabled={mutation.isPending || status === 'success'}
        variant={buttonVariant}
        size="sm"
        className="gap-1 sm:gap-2 text-xs sm:text-sm"
        aria-label={`${actionText} notification action`}
        aria-busy={mutation.isPending}
        aria-live="polite"
      >
        {mutation.isPending && <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin" />}
        {status === 'success' && <CheckCircle2 className="h-3 w-3 sm:h-4 sm:w-4" />}
        {status === 'error' && <AlertCircle className="h-3 w-3 sm:h-4 sm:w-4" />}
        <span className="truncate max-w-[120px] sm:max-w-none">
          {status === 'success' ? 'Done!' : actionText}
        </span>
      </Button>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Action</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmationMessage ||
                `Are you sure you want to ${actionText.toLowerCase()}? This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

// Helper component for multiple action buttons
interface NotificationActionsProps {
  notificationId: number;
  actions: Array<{
    type: string;
    text: string;
    url?: string;
    variant?: 'default' | 'destructive' | 'outline' | 'secondary';
    data?: any;
  }>;
  onActionSuccess?: () => void;
}

export const NotificationActions: FC<NotificationActionsProps> = ({
  notificationId,
  actions,
  onActionSuccess,
}) => {
  if (!actions || actions.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t">
      {actions.map((action, index) => (
        <NotificationActionButton
          key={`${action.type}-${index}`}
          notificationId={notificationId}
          actionType={action.type}
          actionText={action.text}
          actionUrl={action.url}
          variant={action.variant}
          actionData={action.data}
          onSuccess={onActionSuccess}
        />
      ))}
    </div>
  );
};
