/**
 * Warning dialog shown when trying to schedule an event without confirming refrigeration status
 */
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
import { AlertTriangle } from 'lucide-react';

interface RefrigerationWarningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function RefrigerationWarningDialog({
  open,
  onOpenChange,
  onConfirm,
  onCancel,
}: RefrigerationWarningDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <AlertDialogTitle>Refrigeration Status Not Confirmed</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="space-y-3 pt-2">
            <p className="font-semibold text-foreground">
              Please confirm refrigeration availability before scheduling this event.
            </p>

            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-md p-3 space-y-2">
              <p className="text-sm text-foreground">
                <span className="font-medium">Why this matters:</span>
              </p>
              <ul className="text-sm space-y-1 ml-4 list-disc text-muted-foreground">
                <li>The group needs refrigeration <strong>onsite</strong></li>
                <li>They must have <strong>access to it</strong> during the event</li>
                <li>It must have <strong>room for ingredients AND finished sandwiches</strong> after the event</li>
              </ul>
            </div>

            <p className="text-sm text-muted-foreground">
              If refrigeration is <strong>not available</strong>, that's okay! Just make sure to mark it as "No"
              so we can plan accordingly (PB&J sandwiches don't require refrigeration).
            </p>

            <p className="text-sm font-medium text-foreground pt-2">
              Do you want to go back and confirm the refrigeration status?
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel onClick={onCancel} className="sm:order-1">
            Go Back & Confirm
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-amber-600 hover:bg-amber-700 sm:order-2"
          >
            Schedule Anyway
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
