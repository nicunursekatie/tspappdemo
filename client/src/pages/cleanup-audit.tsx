import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle, Info, AlertCircle } from 'lucide-react';
import { useActivityTracker } from '@/hooks/useActivityTracker';
import { useEffect } from 'react';

export default function CleanupAudit() {
  const { trackView } = useActivityTracker();

  useEffect(() => {
    trackView(
      'Admin',
      'Admin',
      'Cleanup Audit',
      'User accessed cleanup audit page'
    );
  }, [trackView]);

  const { data: auditData, isLoading } = useQuery({
    queryKey: ['/api/sandwich-collections/audit-cleanup-impact'],
    queryFn: async () => {
      const response = await fetch('/api/sandwich-collections/audit-cleanup-impact', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch audit data');
      return response.json();
    },
  });

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-center">Loading audit data...</div>
      </div>
    );
  }

  if (!auditData) {
    return (
      <div className="p-6">
        <div className="text-center text-red-600">Failed to load audit data</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Data Cleanup Impact Audit</h1>
        <p className="text-gray-600">
          Review which records were affected by the data cleanup process
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{auditData.totalCollections}</div>
            <div className="text-sm text-gray-600">Total Collections</div>
          </CardContent>
        </Card>

        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-orange-600">
              {auditData.potentialFix1Victims.count}
            </div>
            <div className="text-sm text-gray-600">Potential Fix #1 Victims</div>
          </CardContent>
        </Card>

        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-blue-600">
              {auditData.currentEqualCounts.count}
            </div>
            <div className="text-sm text-gray-600">Equal Counts (Safe)</div>
          </CardContent>
        </Card>

        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">
              {auditData.groupsEntriesStatus.clean}
            </div>
            <div className="text-sm text-gray-600">Clean Groups Entries</div>
          </CardContent>
        </Card>
      </div>

      {/* Fix #1 Status */}
      <Card className="border-2 border-green-500">
        <CardHeader className="bg-green-50">
          <CardTitle className="flex items-center gap-2 text-green-700">
            <CheckCircle className="w-5 h-5" />
            Fix #1 is Now DISABLED
          </CardTitle>
          <CardDescription>
            The aggressive cleanup that removed individual counts when they equaled group totals is now disabled.
            No further modifications will occur.
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Potential Victims */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-orange-500" />
            Records That MAY Have Been Modified ({auditData.potentialFix1Victims.count})
          </CardTitle>
          <CardDescription>
            {auditData.potentialFix1Victims.description}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {auditData.potentialFix1Victims.count === 0 ? (
            <p className="text-gray-600 text-center py-4">No records found that match this pattern.</p>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {auditData.potentialFix1Victims.records.map((record: any) => (
                <div key={record.id} className="p-4 border rounded-lg bg-orange-50">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-semibold">ID: {record.id} - {record.hostName}</div>
                      <div className="text-sm text-gray-600">Date: {record.collectionDate}</div>
                    </div>
                    <Badge variant="outline" className="bg-orange-100 text-orange-700">
                      Suspicious
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-sm mt-2">
                    <div>
                      <span className="text-gray-600">Individual:</span>
                      <span className="ml-2 font-semibold text-orange-600">{record.individual}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Group Total:</span>
                      <span className="ml-2 font-semibold">{record.groupTotal}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Total:</span>
                      <span className="ml-2 font-semibold">{record.total}</span>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 mt-2">
                    Submitted: {new Date(record.submittedAt).toLocaleString()} by {record.createdBy}
                  </div>
                  <div className="text-xs text-orange-600 mt-1 italic">
                    {record.note}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Current Equal Counts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="w-5 h-5 text-blue-500" />
            Current Records with Equal Counts ({auditData.currentEqualCounts.count})
          </CardTitle>
          <CardDescription>
            {auditData.currentEqualCounts.description}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {auditData.currentEqualCounts.count === 0 ? (
            <p className="text-gray-600 text-center py-4">No records with equal individual and group counts.</p>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {auditData.currentEqualCounts.records.map((record: any) => (
                <div key={record.id} className="p-4 border rounded-lg bg-blue-50">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-semibold">ID: {record.id} - {record.hostName}</div>
                      <div className="text-sm text-gray-600">Date: {record.collectionDate}</div>
                    </div>
                    <Badge variant="outline" className="bg-green-100 text-green-700">
                      Protected
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm mt-2">
                    <div>
                      <span className="text-gray-600">Individual:</span>
                      <span className="ml-2 font-semibold">{record.individual}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Group Total:</span>
                      <span className="ml-2 font-semibold">{record.groupTotal}</span>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 mt-2">
                    Submitted: {new Date(record.submittedAt).toLocaleString()}
                  </div>
                  <div className="text-xs text-green-600 mt-1 italic font-semibold">
                    ✓ {record.note}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Groups Entries Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-purple-500" />
            "Groups" Entries Status
          </CardTitle>
          <CardDescription>
            Checking if any "Groups" entries have individual counts (Fix #2 status)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center p-4 bg-gray-50 rounded">
              <div className="text-2xl font-bold">{auditData.groupsEntriesStatus.total}</div>
              <div className="text-sm text-gray-600">Total Groups Entries</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded">
              <div className="text-2xl font-bold text-green-600">{auditData.groupsEntriesStatus.clean}</div>
              <div className="text-sm text-gray-600">Clean (No Individual)</div>
            </div>
            <div className="text-center p-4 bg-red-50 rounded">
              <div className="text-2xl font-bold text-red-600">{auditData.groupsEntriesStatus.needsFix}</div>
              <div className="text-sm text-gray-600">Need Fix #2</div>
            </div>
          </div>

          {auditData.groupsEntriesStatus.needsFix > 0 && (
            <div className="space-y-2 mt-4">
              <h4 className="font-semibold">Problematic "Groups" Entries:</h4>
              {auditData.groupsEntriesStatus.problematicRecords.map((record: any) => (
                <div key={record.id} className="p-3 border rounded bg-red-50 text-sm">
                  <div className="flex justify-between">
                    <span>ID: {record.id}</span>
                    <span>Individual: {record.individual} | Group: {record.groupTotal}</span>
                  </div>
                  <div className="text-xs text-red-600 mt-1">{record.note}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Explanation */}
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle>What This Audit Shows</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <h4 className="font-semibold mb-1">Potential Fix #1 Victims (Orange)</h4>
            <p className="text-gray-700">
              These are records where individual=0 but group totals exist. They MAY have had their individual
              counts removed by the cleanup if the individual count originally equaled the group total.
              To recover these, you would need a database backup from before the cleanup ran.
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-1">Current Equal Counts (Blue)</h4>
            <p className="text-gray-700">
              These records currently have individual counts that equal their group totals. With Fix #1 now
              DISABLED, these are safe and will not be modified. This shows the cleanup would have affected
              {' '}{auditData.currentEqualCounts.count} more records if still enabled.
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-1">Groups Entries (Purple)</h4>
            <p className="text-gray-700">
              Fix #2 (still active) ensures "Groups" entries don't have individual counts. If any are found,
              they should be corrected by running the cleanup again (only Fix #2 will execute).
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
