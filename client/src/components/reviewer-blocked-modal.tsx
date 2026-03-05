import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Eye, Lock } from 'lucide-react';
import { useReviewerOptional } from '@/contexts/reviewer-context';

export function ReviewerBlockedModal() {
  const reviewerContext = useReviewerOptional();

  if (!reviewerContext) {
    return null;
  }

  const { isModalVisible, hideBlockedModal, blockedAction } = reviewerContext;

  return (
    <Dialog open={isModalVisible} onOpenChange={(open) => !open && hideBlockedModal()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-amber-100 rounded-full">
              <Lock className="w-6 h-6 text-amber-700" />
            </div>
            <DialogTitle className="text-xl font-semibold text-gray-900">
              Read-Only Mode
            </DialogTitle>
          </div>
          <DialogDescription className="text-gray-600 text-left">
            In production, this action would save your changes. This reviewer account
            is read-only to protect live data.
          </DialogDescription>
        </DialogHeader>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 my-4">
          <div className="flex items-start gap-3">
            <Eye className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-900">
                {blockedAction || 'This action'} is available to full admin users.
              </p>
              <p className="text-xs text-amber-700 mt-1">
                You're logged in as a reviewer, so all edit, create, and delete
                actions are blocked. You can still explore all features and see
                how they work.
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button
            onClick={hideBlockedModal}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            Got it
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
