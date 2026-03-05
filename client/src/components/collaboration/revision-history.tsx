import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { History, ArrowRight, RotateCcw, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow, format } from "date-fns";
import type { EventEditRevision } from "@shared/schema";

/**
 * RevisionHistoryDrawer displays a drawer with revision history for event fields.
 * 
 * @remarks
 * This component supports two modes:
 * 
 * **Single Field Mode**: When `fieldName` is provided, shows revision history for only that specific field.
 * - Example: `<RevisionHistoryDrawer fieldName="status" revisions={revisions} />`
 * - Displays a filtered view of changes to the specified field
 * 
 * **All Fields Mode**: When `fieldName` is undefined/not provided, shows all revision history grouped by field.
 * - Example: `<RevisionHistoryDrawer revisions={revisions} />`
 * - Displays all changes across all fields, organized by field name
 */
interface RevisionHistoryDrawerProps {
  /** Array of all event revision records */
  revisions: EventEditRevision[];
  /** Optional field name to filter revisions. When undefined, shows all fields grouped together. */
  fieldName?: string;
  /** Optional callback to revert to a specific revision */
  onRevert?: (revisionId: number) => Promise<void>;
  /** Loading state indicator */
  isLoading?: boolean;
  /** Custom trigger element to open the drawer */
  trigger?: React.ReactNode;
  /** Additional CSS classes for the drawer */
  className?: string;
}

interface GroupedRevisions {
  [fieldName: string]: EventEditRevision[];
}

function formatValue(value: string | null, fieldName: string): string {
  if (value === null || value === "") {
    return "(empty)";
  }

  try {
    const parsed = JSON.parse(value);
    if (typeof parsed === 'object') {
      return JSON.stringify(parsed, null, 2);
    }
    return parsed.toString();
  } catch {
    return value;
  }
}

function getChangeTypeColor(changeType: string): string {
  switch (changeType) {
    case 'create':
      return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300';
    case 'update':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300';
    case 'delete':
      return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300';
  }
}

function RevisionItem({ 
  revision, 
  onRevert,
  isReverting 
}: { 
  revision: EventEditRevision;
  onRevert?: (revisionId: number) => Promise<void>;
  isReverting: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleRevert = async () => {
    if (!onRevert || isReverting) return;
    
    if (window.confirm(`Revert ${revision.fieldName} to this version?`)) {
      await onRevert(revision.id);
    }
  };

  return (
    <div 
      className="group relative p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
      data-testid={`revision-${revision.id}`}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge className={cn("text-xs font-medium", getChangeTypeColor(revision.changeType))}>
              {revision.changeType}
            </Badge>
            <span className="text-sm font-semibold text-foreground">
              {revision.fieldName}
            </span>
          </div>
          
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{revision.changedByName}</span>
            <span>•</span>
            <span title={format(new Date(revision.createdAt), 'PPpp')}>
              {formatDistanceToNow(new Date(revision.createdAt), { addSuffix: true })}
            </span>
          </div>
        </div>

        {onRevert && revision.changeType === 'update' && (
          <Button
            size="sm"
            variant="ghost"
            className="h-8 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={handleRevert}
            disabled={isReverting}
            data-testid={`revert-button-${revision.id}`}
          >
            {isReverting ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <RotateCcw className="h-3 w-3 mr-1" />
            )}
            Revert
          </Button>
        )}
      </div>

      {revision.changeType === 'update' && (
        <div className="mt-3">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
            data-testid={`toggle-details-${revision.id}`}
          >
            <ArrowRight className={cn("h-3 w-3 transition-transform", isExpanded && "rotate-90")} />
            {isExpanded ? 'Hide' : 'Show'} changes
          </button>

          {isExpanded && (
            <div className="mt-3 space-y-2">
              <div className="rounded bg-muted/50 p-3">
                <div className="text-xs font-medium text-muted-foreground mb-1">
                  Old value:
                </div>
                <pre className="text-xs text-foreground whitespace-pre-wrap break-words font-mono">
                  {formatValue(revision.oldValue, revision.fieldName)}
                </pre>
              </div>

              <div className="flex justify-center">
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>

              <div className="rounded bg-primary/10 p-3">
                <div className="text-xs font-medium text-muted-foreground mb-1">
                  New value:
                </div>
                <pre className="text-xs text-foreground whitespace-pre-wrap break-words font-mono">
                  {formatValue(revision.newValue, revision.fieldName)}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}

      {revision.changeType === 'create' && (
        <div className="mt-3 rounded bg-green-50 dark:bg-green-950/20 p-3">
          <div className="text-xs font-medium text-muted-foreground mb-1">
            Initial value:
          </div>
          <pre className="text-xs text-foreground whitespace-pre-wrap break-words font-mono">
            {formatValue(revision.newValue, revision.fieldName)}
          </pre>
        </div>
      )}

      {revision.changeType === 'delete' && (
        <div className="mt-3 rounded bg-red-50 dark:bg-red-950/20 p-3">
          <div className="text-xs font-medium text-muted-foreground mb-1">
            Deleted value:
          </div>
          <pre className="text-xs text-foreground whitespace-pre-wrap break-words font-mono">
            {formatValue(revision.oldValue, revision.fieldName)}
          </pre>
        </div>
      )}
    </div>
  );
}

export function RevisionHistoryDrawer({
  revisions,
  fieldName,
  onRevert,
  isLoading = false,
  trigger,
  className,
}: RevisionHistoryDrawerProps) {
  const [revertingId, setRevertingId] = useState<number | null>(null);

  const fieldRevisions = fieldName 
    ? revisions.filter(r => r.fieldName === fieldName)
    : revisions;

  const groupedRevisions: GroupedRevisions = revisions.reduce((acc, revision) => {
    if (!acc[revision.fieldName]) {
      acc[revision.fieldName] = [];
    }
    acc[revision.fieldName].push(revision);
    return acc;
  }, {} as GroupedRevisions);

  const handleRevert = async (revisionId: number) => {
    if (!onRevert || revertingId) return;

    setRevertingId(revisionId);
    try {
      await onRevert(revisionId);
    } catch (error) {
      console.error('Failed to revert:', error);
    } finally {
      setRevertingId(null);
    }
  };

  return (
    <Sheet>
      <SheetTrigger asChild data-testid="revision-history-trigger">
        {trigger || (
          <Button variant="outline" size="sm">
            <History className="h-4 w-4 mr-2" />
            View History
          </Button>
        )}
      </SheetTrigger>

      <SheetContent 
        side="right" 
        className={cn("w-full sm:max-w-xl", className)}
        data-testid="revision-history-drawer"
      >
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Revision History
          </SheetTitle>
          <SheetDescription>
            {fieldName 
              ? `View all changes made to "${fieldName}"`
              : "View all changes made to this event"
            }
          </SheetDescription>
        </SheetHeader>

        <Separator className="my-4" />

        <ScrollArea className="h-[calc(100vh-180px)] pr-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : fieldRevisions.length === 0 ? (
            <div className="text-center py-12">
              <History className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
              <p className="text-sm text-muted-foreground">
                No revision history available
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Changes will appear here once edits are made
              </p>
            </div>
          ) : fieldName ? (
            <div className="space-y-3">
              {fieldRevisions.map((revision) => (
                <RevisionItem
                  key={revision.id}
                  revision={revision}
                  onRevert={onRevert ? handleRevert : undefined}
                  isReverting={revertingId === revision.id}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedRevisions).map(([field, fieldRevisions]) => (
                <div key={field}>
                  <h4 className="text-sm font-semibold mb-3 sticky top-0 bg-background py-2 z-10">
                    {field}
                    <span className="ml-2 text-xs text-muted-foreground font-normal">
                      ({fieldRevisions.length} {fieldRevisions.length === 1 ? 'change' : 'changes'})
                    </span>
                  </h4>
                  <div className="space-y-3">
                    {fieldRevisions.map((revision) => (
                      <RevisionItem
                        key={revision.id}
                        revision={revision}
                        onRevert={onRevert ? handleRevert : undefined}
                        isReverting={revertingId === revision.id}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
