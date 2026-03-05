import { GoogleSheetsViewer } from '@/components/google-sheets-viewer';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/useResourcePermissions';
import { useActivityTracker } from '@/hooks/useActivityTracker';
import { useEffect } from 'react';

export default function GoogleSheetsPage() {
  const { user } = useAuth();
  const { VIEW_SANDWICH_DATA: canView } = usePermissions(['VIEW_SANDWICH_DATA']);
  const { trackView } = useActivityTracker();

  useEffect(() => {
    if (canView) {
      trackView(
        'Data',
        'Data',
        'Google Sheets Data',
        'User accessed Google Sheets data viewer'
      );
    }
  }, [canView, trackView]);

  if (!canView) {
    return (
      <div className="flex items-center justify-center h-64 p-4">
        <div className="text-center">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">
            Access Restricted
          </h2>
          <p className="text-sm sm:text-base text-gray-600">
            You don't have permission to view the sandwich data spreadsheet.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 p-4 sm:p-0">
      <div className="border-b border-gray-200 pb-3 sm:pb-4">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
          Sandwich Totals Data Sheet
        </h1>
        <p className="text-sm sm:text-base text-gray-600 mt-1 sm:mt-2">
          Complete sandwich collection data from 2023-2025. This displays the
          latest version of the sandwich totals spreadsheet in read-only format.
        </p>
      </div>

      <GoogleSheetsViewer title="Sandwich Totals Data Sheet" height={700} />

      <div className="bg-brand-primary-lighter border border-brand-primary-border rounded-lg p-3 sm:p-4">
        <h3 className="font-semibold text-brand-primary-darker mb-2 text-sm sm:text-base">
          About This Data Sheet:
        </h3>
        <ul className="text-xs sm:text-sm text-brand-primary-dark space-y-1">
          <li>• Complete sandwich collection totals spanning 2023-2025</li>
          <li>• Shows the most recent version of the data spreadsheet</li>
          <li>
            • Automatically displays static backup if live version isn't
            accessible
          </li>
          <li>• Data is read-only for viewing and analysis purposes</li>
          <li>• Click "Open" to view in a new tab for better navigation</li>
        </ul>
      </div>
    </div>
  );
}
