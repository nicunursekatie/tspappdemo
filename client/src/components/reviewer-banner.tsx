import { Eye, Info } from 'lucide-react';
import { useReviewerOptional } from '@/contexts/reviewer-context';

export function ReviewerBanner() {
  const reviewerContext = useReviewerOptional();

  // Don't render if not in reviewer mode or context not available
  if (!reviewerContext?.isReviewer) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-b-2 border-amber-300 px-4 py-3">
      <div className="max-w-7xl mx-auto flex items-center gap-3">
        <div className="flex-shrink-0 p-2 bg-amber-100 rounded-full">
          <Eye className="w-5 h-5 text-amber-700" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-amber-900">
            You're viewing this app in a read-only reviewer account.
          </p>
          <p className="text-xs text-amber-700 mt-0.5">
            In normal use, admins can create, edit, and delete everything you see here.
            This login is locked to prevent changes to live data.
          </p>
        </div>
        <div className="flex-shrink-0 hidden sm:flex items-center gap-1 text-xs text-amber-600 bg-amber-100 px-2 py-1 rounded">
          <Info className="w-3.5 h-3.5" />
          <span>Read-Only Mode</span>
        </div>
      </div>
    </div>
  );
}
