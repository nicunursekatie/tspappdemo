import { AlertTriangle, Trash2, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import type { SandwichCollection } from '@shared/schema';

interface DuplicateAnalysis {
  totalCollections: number;
  duplicateGroups: number;
  totalDuplicateEntries: number;
  suspiciousPatterns: number;
  nearDuplicates: number;
  duplicates: Array<{
    entries: SandwichCollection[];
    count: number;
    keepNewest: SandwichCollection;
    toDelete: SandwichCollection[];
  }>;
  suspiciousEntries: SandwichCollection[];
  nearDuplicateEntries?: Array<{
    entry1: SandwichCollection;
    entry2: SandwichCollection;
    total1: number;
    total2: number;
    difference: number;
    percentDifference: string;
    reason: string;
  }>;
}

interface DuplicateAnalysisProps {
  isOpen: boolean;
  onClose: () => void;
  analysis: DuplicateAnalysis | null;
  onDeleteDuplicates: (ids: number[]) => void;
  isDeleting: boolean;
}

export function DuplicateAnalysisDialog({
  isOpen,
  onClose,
  analysis,
  onDeleteDuplicates,
  isDeleting,
}: DuplicateAnalysisProps) {
  if (!analysis) return null;

  // Helper to calculate group sandwich total
  // Use EITHER groupCollections OR group1/group2, never both to prevent double counting
  const getGroupTotal = (item: SandwichCollection) => {
    if (item.groupCollections && Array.isArray(item.groupCollections) && item.groupCollections.length > 0) {
      return item.groupCollections.reduce((sum, g) => sum + (g.count || 0), 0);
    }
    return (item.group1Count || 0) + (item.group2Count || 0);
  };

  const handleDeleteAllDuplicates = () => {
    const duplicateIds = analysis.duplicates.flatMap((group) =>
      group.toDelete.map((item) => item.id)
    );
    onDeleteDuplicates(duplicateIds);
  };

  const handleDeleteGroup = (groupIndex: number) => {
    const group = analysis.duplicates[groupIndex];
    const idsToDelete = group.toDelete.map((item) => item.id);
    onDeleteDuplicates(idsToDelete);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="max-w-4xl max-h-[80vh] overflow-y-auto"
        aria-describedby="duplicate-analysis-description"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Duplicate Collection Analysis
          </DialogTitle>
          <DialogDescription id="duplicate-analysis-description">
            Review and manage duplicate collection entries found in your data.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold">
                {analysis.totalCollections}
              </div>
              <div className="text-sm text-gray-600">Total Collections</div>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-600">
                {analysis.totalDuplicateEntries}
              </div>
              <div className="text-sm text-gray-600">Exact Duplicates</div>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {analysis.nearDuplicates || 0}
              </div>
              <div className="text-sm text-gray-600">Near Duplicates</div>
            </div>
            <div className="text-center p-4 bg-yellow-50 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">
                {analysis.suspiciousPatterns}
              </div>
              <div className="text-sm text-gray-600">Suspicious</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {analysis.totalCollections - analysis.totalDuplicateEntries - (analysis.nearDuplicates || 0) - analysis.suspiciousPatterns}
              </div>
              <div className="text-sm text-gray-600">Clean Records</div>
            </div>
          </div>

          {/* Action Buttons */}
          {analysis.duplicateGroups > 0 && (
            <div className="flex gap-2">
              <Button
                onClick={handleDeleteAllDuplicates}
                disabled={isDeleting}
                variant="destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete All Duplicates ({analysis.totalDuplicateEntries})
              </Button>
            </div>
          )}

          {/* Duplicate Groups */}
          {analysis.duplicates.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Duplicate Groups</h3>
              {analysis.duplicates.map((group, index) => (
                <div key={index} className="border rounded-lg p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <h4 className="font-medium">
                      Group {index + 1}: {group.count} entries
                    </h4>
                    <Button
                      onClick={() => handleDeleteGroup(index)}
                      disabled={isDeleting}
                      variant="outline"
                      size="sm"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete {group.toDelete.length} duplicates
                    </Button>
                  </div>

                  <div className="space-y-2">
                    {/* Keep this one */}
                    <div className="p-3 bg-green-50 rounded border-l-4 border-green-500">
                      <div className="flex justify-between items-center">
                        <Badge className="bg-green-100 text-green-800">
                          KEEP
                        </Badge>
                        <div className="text-sm text-gray-600">
                          {group.keepNewest.collectionDate} -{' '}
                          {group.keepNewest.hostName}
                        </div>
                      </div>
                      <div className="text-sm mt-1">
                        Individual: {group.keepNewest.individualSandwiches} |
                        Groups:{' '}
                        {(group.keepNewest.group1Count || 0) +
                          (group.keepNewest.group2Count || 0)}
                      </div>
                    </div>

                    {/* Delete these */}
                    {group.toDelete.map((item, itemIndex) => (
                      <div
                        key={itemIndex}
                        className="p-3 bg-red-50 rounded border-l-4 border-red-500"
                      >
                        <div className="flex justify-between items-center">
                          <Badge variant="destructive">DELETE</Badge>
                          <div className="text-sm text-gray-600">
                            {item.collectionDate} - {item.hostName}
                          </div>
                        </div>
                        <div className="text-sm mt-1">
                          Individual: {item.individualSandwiches} | Groups:{' '}
                          {getGroupTotal(item)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Near-Duplicates (Potential Duplicates) */}
          {analysis.nearDuplicateEntries && analysis.nearDuplicateEntries.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Potential Duplicates (Same Date & Location)</h3>
              <div className="text-sm text-gray-600 mb-2">
                These entries share the same date and host but have slightly different totals. They may be duplicates with data entry errors:
              </div>
              <div className="space-y-3">
                {analysis.nearDuplicateEntries.map((nearDup, index) => (
                  <div key={index} className="border rounded-lg p-4 bg-blue-50 border-l-4 border-blue-500">
                    <div className="flex justify-between items-center mb-2">
                      <Badge className="bg-blue-100 text-blue-800">
                        NEEDS REVIEW
                      </Badge>
                      <span className="text-sm text-gray-600 font-medium">
                        {nearDup.reason}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {/* Entry 1 */}
                      <div className="p-3 bg-white rounded border">
                        <div className="text-xs text-gray-500 mb-1">Entry 1 (ID: {nearDup.entry1.id})</div>
                        <div className="text-sm font-medium">
                          {nearDup.entry1.collectionDate} - {nearDup.entry1.hostName}
                        </div>
                        <div className="text-sm mt-1">
                          Individual: {nearDup.entry1.individualSandwiches}
                        </div>
                        <div className="text-sm">
                          Groups: {getGroupTotal(nearDup.entry1)}
                        </div>
                        <div className="text-sm font-bold mt-1">
                          Total: {nearDup.total1}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          Submitted: {new Date(nearDup.entry1.submittedAt).toLocaleString()}
                        </div>
                      </div>

                      {/* Entry 2 */}
                      <div className="p-3 bg-white rounded border">
                        <div className="text-xs text-gray-500 mb-1">Entry 2 (ID: {nearDup.entry2.id})</div>
                        <div className="text-sm font-medium">
                          {nearDup.entry2.collectionDate} - {nearDup.entry2.hostName}
                        </div>
                        <div className="text-sm mt-1">
                          Individual: {nearDup.entry2.individualSandwiches}
                        </div>
                        <div className="text-sm">
                          Groups: {getGroupTotal(nearDup.entry2)}
                        </div>
                        <div className="text-sm font-bold mt-1">
                          Total: {nearDup.total2}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          Submitted: {new Date(nearDup.entry2.submittedAt).toLocaleString()}
                        </div>
                      </div>
                    </div>

                    {nearDup.difference > 0 && (
                      <div className="mt-2 text-xs text-gray-600 text-center">
                        Difference: {nearDup.difference} sandwiches ({nearDup.percentDifference}%)
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Suspicious Patterns */}
          {analysis.suspiciousEntries.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Suspicious Patterns</h3>
              <div className="text-sm text-gray-600 mb-2">
                These entries have unusual patterns that may indicate data
                quality issues:
              </div>
              <div className="space-y-2">
                {analysis.suspiciousEntries.map((entry, index) => (
                  <div
                    key={index}
                    className="p-3 bg-yellow-50 rounded border-l-4 border-yellow-500"
                  >
                    <div className="flex justify-between items-center">
                      <Badge className="bg-yellow-100 text-yellow-800">
                        REVIEW
                      </Badge>
                      <div className="text-sm text-gray-600">
                        {entry.collectionDate} - {entry.hostName}
                      </div>
                    </div>
                    <div className="text-sm mt-1">
                      Individual: {entry.individualSandwiches} | Groups:{' '}
                      {getGroupTotal(entry)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
