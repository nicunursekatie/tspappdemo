import { ErrorBoundary } from '@/components/error-boundary';
import { PlanningSheetProposals } from '@/components/planning-sheet-proposals';
import { useActivityTracker } from '@/hooks/useActivityTracker';
import { useEffect } from 'react';

export default function PlanningSheetProposalsPage() {
  const { trackView } = useActivityTracker();

  useEffect(() => {
    trackView(
      'Planning Sheet Proposals',
      'Data Sync',
      'Planning Sheet Proposals',
      'User accessed planning sheet proposals review page'
    );
  }, [trackView]);

  return (
    <div className="p-4 sm:p-6">
      <ErrorBoundary>
        <PlanningSheetProposals />
      </ErrorBoundary>
    </div>
  );
}
