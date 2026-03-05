import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import {
  Check,
  X,
  Eye,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileSpreadsheet,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { format } from 'date-fns';

interface Proposal {
  id: number;
  eventRequestId: number | null;
  targetSheetId: string;
  targetSheetName: string | null;
  targetRowIndex: number | null;
  changeType: string;
  fieldName: string | null;
  currentValue: string | null;
  proposedValue: string | null;
  proposedRowData: string[] | null;
  proposedBy: string | null;
  proposedByName: string | null;
  proposedAt: string;
  proposalReason: string | null;
  status: string;
  reviewedBy: string | null;
  reviewedByName: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  appliedAt: string | null;
  applyError: string | null;
  eventOrganization: string | null;
  eventDate: string | null;
}

const COLUMN_LABELS: Record<number, string> = {
  0: 'Date',
  1: 'Day of Week',
  2: 'Group Name',
  3: 'Event Start Time',
  4: 'Event End Time',
  5: 'Pick Up Time',
  6: 'Pick Up Next Day?',
  7: 'All Details',
  8: 'Van Booked?',
  9: 'Staffing',
  10: 'Estimate # Sandwiches',
  11: 'Deli or PBJ?',
  12: 'Final # Sandwiches',
  13: 'Social Post',
  14: 'Sent Toolkit?',
  15: 'Contact Name',
  16: 'Email',
  17: 'Phone',
  18: 'TSP Contact',
  19: 'Address',
  20: 'Recipient/Host',
  21: 'After Event Notes',
  22: 'Cancelled',
  23: 'Notes',
  24: "Add'l Notes",
  25: 'Waiting On',
};

function getStatusBadge(status: string) {
  switch (status) {
    case 'pending':
      return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200"><Clock className="w-3 h-3 mr-1" /> Pending</Badge>;
    case 'approved':
      return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200"><CheckCircle2 className="w-3 h-3 mr-1" /> Approved</Badge>;
    case 'applied':
      return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200"><Check className="w-3 h-3 mr-1" /> Applied</Badge>;
    case 'rejected':
      return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200"><XCircle className="w-3 h-3 mr-1" /> Rejected</Badge>;
    case 'failed':
      return <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200"><AlertCircle className="w-3 h-3 mr-1" /> Failed</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function ProposalRowPreview({ rowData }: { rowData: string[] }) {
  const [expanded, setExpanded] = useState(false);

  // Show key fields in collapsed view
  const keyFields = [
    { label: 'Date', value: rowData[0] },
    { label: 'Group', value: rowData[2] },
    { label: 'Staffing', value: rowData[9] },
    { label: 'Sandwiches', value: rowData[10] },
  ].filter(f => f.value);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {keyFields.map((field, i) => (
          <span key={i} className="text-xs bg-gray-100 px-2 py-1 rounded">
            <strong>{field.label}:</strong> {field.value}
          </span>
        ))}
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setExpanded(!expanded)}
        className="text-xs"
      >
        {expanded ? <ChevronUp className="w-3 h-3 mr-1" /> : <ChevronDown className="w-3 h-3 mr-1" />}
        {expanded ? 'Hide details' : 'Show all fields'}
      </Button>
      {expanded && (
        <div className="grid grid-cols-2 gap-1 text-xs bg-gray-50 p-2 rounded mt-2">
          {rowData.map((value, idx) => (
            value && (
              <div key={idx} className="flex">
                <span className="font-medium text-gray-600 mr-1">{COLUMN_LABELS[idx] || `Col ${idx}`}:</span>
                <span className="text-gray-900 truncate">{value}</span>
              </div>
            )
          ))}
        </div>
      )}
    </div>
  );
}

export function PlanningSheetProposals() {
  const [activeTab, setActiveTab] = useState('pending');
  const [selectedProposals, setSelectedProposals] = useState<number[]>([]);
  const [previewProposal, setPreviewProposal] = useState<Proposal | null>(null);
  const [rejectNotes, setRejectNotes] = useState('');
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [proposalToReject, setProposalToReject] = useState<number | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch proposals
  const { data: proposals = [], isLoading, refetch } = useQuery<Proposal[]>({
    queryKey: ['planning-sheet-proposals', activeTab === 'all' ? undefined : activeTab],
    queryFn: async () => {
      const url = activeTab === 'all'
        ? '/api/planning-sheet-proposals'
        : `/api/planning-sheet-proposals?status=${activeTab}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch proposals');
      return res.json();
    },
  });

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/planning-sheet-proposals/${id}/approve`, {
        method: 'POST',
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to approve');
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Proposal approved and applied to sheet' });
      queryClient.invalidateQueries({ queryKey: ['planning-sheet-proposals'] });
      setSelectedProposals([]);
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to approve', description: error.message, variant: 'destructive' });
    },
  });

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: number; notes: string }) => {
      const res = await fetch(`/api/planning-sheet-proposals/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to reject');
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Proposal rejected' });
      queryClient.invalidateQueries({ queryKey: ['planning-sheet-proposals'] });
      setShowRejectDialog(false);
      setRejectNotes('');
      setProposalToReject(null);
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to reject', description: error.message, variant: 'destructive' });
    },
  });

  // Batch approve mutation
  const batchApproveMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      const res = await fetch('/api/planning-sheet-proposals/batch/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalIds: ids }),
      });
      if (!res.ok) throw new Error('Failed to batch approve');
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: data.message });
      queryClient.invalidateQueries({ queryKey: ['planning-sheet-proposals'] });
      setSelectedProposals([]);
    },
    onError: (error: Error) => {
      toast({ title: 'Batch approve failed', description: error.message, variant: 'destructive' });
    },
  });

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedProposals(proposals.filter(p => p.status === 'pending').map(p => p.id));
    } else {
      setSelectedProposals([]);
    }
  };

  const handleSelectOne = (id: number, checked: boolean) => {
    if (checked) {
      setSelectedProposals([...selectedProposals, id]);
    } else {
      setSelectedProposals(selectedProposals.filter(i => i !== id));
    }
  };

  const pendingCount = proposals.filter(p => p.status === 'pending').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6" />
            Planning Sheet Proposals
          </h1>
          <p className="text-gray-600 mt-1">
            Review and approve changes before they're written to the Google Sheet
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {pendingCount > 0 && (
        <Card className="bg-yellow-50 border-yellow-200">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-yellow-600" />
                <span className="font-medium text-yellow-800">
                  {pendingCount} proposal{pendingCount !== 1 ? 's' : ''} awaiting review
                </span>
              </div>
              {selectedProposals.length > 0 && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => batchApproveMutation.mutate(selectedProposals)}
                    disabled={batchApproveMutation.isPending}
                  >
                    <Check className="w-4 h-4 mr-1" />
                    Approve Selected ({selectedProposals.length})
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="pending">
            Pending {pendingCount > 0 && <Badge className="ml-2" variant="secondary">{pendingCount}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="applied">Applied</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">Loading proposals...</div>
          ) : proposals.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-gray-500">
                No {activeTab === 'all' ? '' : activeTab} proposals found
              </CardContent>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    {activeTab === 'pending' && (
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedProposals.length === proposals.filter(p => p.status === 'pending').length && pendingCount > 0}
                          onCheckedChange={handleSelectAll}
                        />
                      </TableHead>
                    )}
                    <TableHead>Event</TableHead>
                    <TableHead>Change Type</TableHead>
                    <TableHead>Proposed Data</TableHead>
                    <TableHead>Proposed By</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {proposals.map((proposal) => (
                    <TableRow key={proposal.id}>
                      {activeTab === 'pending' && (
                        <TableCell>
                          <Checkbox
                            checked={selectedProposals.includes(proposal.id)}
                            onCheckedChange={(checked) => handleSelectOne(proposal.id, !!checked)}
                            disabled={proposal.status !== 'pending'}
                          />
                        </TableCell>
                      )}
                      <TableCell>
                        <div>
                          <div className="font-medium">{proposal.eventOrganization || 'Unknown'}</div>
                          {proposal.eventDate && (
                            <div className="text-sm text-gray-500">
                              {format(new Date(proposal.eventDate), 'MMM d, yyyy')}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {proposal.changeType === 'create_row' ? 'New Row' : proposal.changeType}
                        </Badge>
                        {proposal.proposalReason && (
                          <div className="text-xs text-gray-500 mt-1">{proposal.proposalReason}</div>
                        )}
                      </TableCell>
                      <TableCell className="max-w-md">
                        {proposal.changeType === 'create_row' && proposal.proposedRowData ? (
                          <ProposalRowPreview rowData={proposal.proposedRowData} />
                        ) : proposal.changeType === 'update_cell' ? (
                          <div className="text-sm">
                            <div><strong>{proposal.fieldName}:</strong></div>
                            <div className="text-red-600 line-through">{proposal.currentValue || '(empty)'}</div>
                            <div className="text-green-600">{proposal.proposedValue || '(empty)'}</div>
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>{proposal.proposedByName || 'System'}</div>
                          <div className="text-gray-500 text-xs">
                            {format(new Date(proposal.proposedAt), 'MMM d, h:mm a')}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(proposal.status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setPreviewProposal(proposal)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          {proposal.status === 'pending' && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                onClick={() => approveMutation.mutate(proposal.id)}
                                disabled={approveMutation.isPending}
                              >
                                <Check className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() => {
                                  setProposalToReject(proposal.id);
                                  setShowRejectDialog(true);
                                }}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Preview Dialog */}
      <Dialog open={!!previewProposal} onOpenChange={() => setPreviewProposal(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Proposal Details</DialogTitle>
            <DialogDescription>
              Full details of the proposed change
            </DialogDescription>
          </DialogHeader>
          {previewProposal && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Event</label>
                  <p>{previewProposal.eventOrganization || 'Unknown'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Status</label>
                  <p>{getStatusBadge(previewProposal.status)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Proposed By</label>
                  <p>{previewProposal.proposedByName || 'System'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Proposed At</label>
                  <p>{format(new Date(previewProposal.proposedAt), 'PPpp')}</p>
                </div>
              </div>

              {previewProposal.proposalReason && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Reason</label>
                  <p>{previewProposal.proposalReason}</p>
                </div>
              )}

              {previewProposal.changeType === 'create_row' && previewProposal.proposedRowData && (
                <div>
                  <label className="text-sm font-medium text-gray-500 mb-2 block">Proposed Row Data</label>
                  <div className="bg-gray-50 p-4 rounded space-y-2">
                    {previewProposal.proposedRowData.map((value, idx) => (
                      value && (
                        <div key={idx} className="flex border-b border-gray-200 pb-1">
                          <span className="font-medium text-gray-600 w-40">{COLUMN_LABELS[idx] || `Column ${idx}`}</span>
                          <span className="text-gray-900">{value}</span>
                        </div>
                      )
                    ))}
                  </div>
                </div>
              )}

              {previewProposal.applyError && (
                <div className="bg-red-50 p-3 rounded border border-red-200">
                  <label className="text-sm font-medium text-red-700">Error</label>
                  <p className="text-red-600">{previewProposal.applyError}</p>
                </div>
              )}

              {previewProposal.reviewNotes && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Review Notes</label>
                  <p className="text-gray-700">{previewProposal.reviewNotes}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewProposal(null)}>Close</Button>
            {previewProposal?.status === 'pending' && (
              <>
                <Button
                  variant="destructive"
                  onClick={() => {
                    setProposalToReject(previewProposal.id);
                    setShowRejectDialog(true);
                    setPreviewProposal(null);
                  }}
                >
                  Reject
                </Button>
                <Button
                  onClick={() => {
                    approveMutation.mutate(previewProposal.id);
                    setPreviewProposal(null);
                  }}
                  disabled={approveMutation.isPending}
                >
                  Approve & Apply
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Proposal</DialogTitle>
            <DialogDescription>
              Optionally add notes explaining why this change was rejected.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Rejection notes (optional)"
            value={rejectNotes}
            onChange={(e) => setRejectNotes(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowRejectDialog(false);
              setRejectNotes('');
              setProposalToReject(null);
            }}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (proposalToReject) {
                  rejectMutation.mutate({ id: proposalToReject, notes: rejectNotes });
                }
              }}
              disabled={rejectMutation.isPending}
            >
              Reject Proposal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
