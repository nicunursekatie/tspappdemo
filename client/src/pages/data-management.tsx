import { ErrorBoundary } from '@/components/error-boundary';
import { DataManagementDashboard } from '@/components/data-management-dashboard';
import { useActivityTracker } from '@/hooks/useActivityTracker';
import { useEffect } from 'react';

export default function DataManagementPage() {
  const { trackView } = useActivityTracker();

  useEffect(() => {
    trackView(
      'Data Management',
      'Data Management',
      'Data Management Page',
      'User accessed data management page'
    );
  }, [trackView]);

  return (
    <ErrorBoundary>
      <DataManagementDashboard />
    </ErrorBoundary>
  );
}
