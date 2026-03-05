import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Users,
  Plus,
  Edit,
  Trash2,
  Phone,
  Mail,
  MapPin,
  Upload,
  Search,
  Filter,
  Download,
  ChevronDown,
  ChevronRight,
  HelpCircle,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import TSPContactManager from './tsp-contact-manager';
import { RecipientForm, RecipientCard } from './recipients';
import { useRecipientForm } from '@/hooks/useRecipientForm';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useResourcePermissions } from '@/hooks/useResourcePermissions';
import { usePageSession } from '@/hooks/usePageSession';
import type { Recipient } from '@shared/schema';
import { logger } from '@/lib/logger';

export default function RecipientsManagement() {
  const { toast } = useToast();
  const { canEdit } = useResourcePermissions('RECIPIENTS');

  // Track page session for activity logging
  usePageSession({
    section: 'Directory',
    page: 'Recipients Management',
  });

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [editingRecipient, setEditingRecipient] = useState<Recipient | null>(null);

  // Search and filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [contractFilter, setContractFilter] = useState<string>('all');
  const [showInactive, setShowInactive] = useState(false);
  const [regionFilter, setRegionFilter] = useState<string>('all');
  const [tspContactFilter, setTspContactFilter] = useState<string>('all');
  const [sandwichTypeFilter, setSandwichTypeFilter] = useState<string>('all');
  const [focusAreaFilter, setFocusAreaFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importResults, setImportResults] = useState<{
    imported: number;
    skipped: number;
  } | null>(null);

  // Form state hooks for add and edit modes
  const addForm = useRecipientForm({ initialData: null, mode: 'add' });
  const editForm = useRecipientForm({ initialData: editingRecipient, mode: 'edit' });

  // Sync edit form when editingRecipient changes
  useEffect(() => {
    if (editingRecipient) {
      editForm.setRecipient(editingRecipient);
    }
  }, [editingRecipient, editForm.setRecipient]);

  const { data: recipients = [], isLoading } = useQuery<Recipient[]>({
    queryKey: ['/api/recipients'],
    staleTime: 5 * 60 * 1000,
  });

  // Filtered and searched recipients
  const filteredRecipients = useMemo(() => {
    let filtered = recipients;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (recipient) =>
          recipient.name?.toLowerCase().includes(term) ||
          recipient.email?.toLowerCase().includes(term) ||
          recipient.phone?.toLowerCase().includes(term) ||
          recipient.address?.toLowerCase().includes(term) ||
          recipient.region?.toLowerCase().includes(term) ||
          recipient.contactPersonName?.toLowerCase().includes(term) ||
          recipient.contactPersonEmail?.toLowerCase().includes(term) ||
          (recipient as any).secondContactPersonName?.toLowerCase().includes(term) ||
          (recipient as any).secondContactPersonEmail?.toLowerCase().includes(term) ||
          recipient.reportingGroup?.toLowerCase().includes(term) ||
          (() => {
            const areas = Array.isArray((recipient as any).focusAreas)
              ? (recipient as any).focusAreas
              : (recipient as any).focusArea ? [(recipient as any).focusArea] : [];
            return areas.some((area: string) => area.toLowerCase().includes(term));
          })() ||
          (recipient as any).instagramHandle?.toLowerCase().includes(term)
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((recipient) => recipient.status === statusFilter);
    }

    if (contractFilter === 'signed') {
      filtered = filtered.filter((recipient) => recipient.contractSigned === true);
    } else if (contractFilter === 'unsigned') {
      filtered = filtered.filter((recipient) => !recipient.contractSigned);
    }

    if (regionFilter !== 'all') {
      filtered = filtered.filter((recipient) => recipient.region === regionFilter);
    }

    if (tspContactFilter !== 'all') {
      filtered = filtered.filter(
        (recipient) =>
          recipient.tspContact &&
          recipient.tspContact.toLowerCase().includes(tspContactFilter.toLowerCase())
      );
    }

    if (sandwichTypeFilter !== 'all') {
      filtered = filtered.filter((recipient) => recipient.sandwichType === sandwichTypeFilter);
    }

    if (focusAreaFilter !== 'all') {
      filtered = filtered.filter((recipient) => {
        const areas = Array.isArray((recipient as any).focusAreas)
          ? (recipient as any).focusAreas
          : (recipient as any).focusArea ? [(recipient as any).focusArea] : [];
        return areas.includes(focusAreaFilter);
      });
    }

    return filtered;
  }, [recipients, searchTerm, statusFilter, contractFilter, regionFilter, tspContactFilter, sandwichTypeFilter, focusAreaFilter]);

  const inactiveRecipients = useMemo(() => {
    return recipients.filter((r) => r.status === 'inactive');
  }, [recipients]);

  // Get unique values for filter dropdowns
  const uniqueRegions = useMemo(() => {
    const regions = recipients.map((r) => r.region).filter(Boolean);
    return [...new Set(regions)].sort();
  }, [recipients]);

  const uniqueTspContacts = useMemo(() => {
    const allContacts = recipients
      .map((r) => r.tspContact)
      .filter(Boolean)
      .flatMap((contact) => contact.split(/[/&,]|and/i).map((c) => c.trim()))
      .filter((contact) => contact.length > 0);
    return [...new Set(allContacts)].sort();
  }, [recipients]);

  const uniqueSandwichTypes = useMemo(() => {
    const types = recipients.map((r) => r.sandwichType).filter(Boolean);
    return [...new Set(types)].sort();
  }, [recipients]);

  const uniqueFocusAreas = useMemo(() => {
    const allAreas = recipients.flatMap((r) => {
      if (Array.isArray((r as any).focusAreas) && (r as any).focusAreas.length > 0) {
        return (r as any).focusAreas;
      } else if ((r as any).focusArea) {
        return [(r as any).focusArea];
      }
      return [];
    });
    return [...new Set(allAreas)].sort();
  }, [recipients]);

  // Mutations
  const createRecipientMutation = useMutation({
    mutationFn: (recipient: any) => {
      logger.log('[CREATE RECIPIENT] Sending data:', recipient);
      return apiRequest('POST', '/api/recipients', recipient);
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/recipients'] });
      queryClient.invalidateQueries({ queryKey: ['/api/recipients/map'] }); // Invalidate map data too
      setIsAddModalOpen(false);
      addForm.resetForm();
      
      // Show geocoding status if address was provided
      if (variables.address) {
        toast({ 
          title: 'Recipient added successfully',
          description: 'Geocoding is in progress. The recipient will appear on the Driver Planning map once coordinates are ready (usually within a few seconds).',
          duration: 6000,
        });
      } else {
        toast({ title: 'Success', description: 'Recipient added successfully' });
      }
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to add recipient', variant: 'destructive' });
    },
  });

  const updateRecipientMutation = useMutation({
    mutationFn: ({ id, ...updates }: any) => apiRequest('PUT', `/api/recipients/${id}`, updates),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/recipients'] });
      queryClient.invalidateQueries({ queryKey: ['/api/recipients/map'] }); // Invalidate map data too
      setEditingRecipient(null);
      
      // Show geocoding status if address was changed
      if (variables.address) {
        toast({ 
          title: 'Recipient updated successfully',
          description: 'If the address changed, geocoding is in progress. The recipient location will update on the Driver Planning map once coordinates are ready (usually within a few seconds).',
          duration: 6000,
        });
      } else {
        toast({ title: 'Success', description: 'Recipient updated successfully' });
      }
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to update recipient', variant: 'destructive' });
    },
  });

  const deleteRecipientMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/recipients/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/recipients'] });
      toast({ title: 'Success', description: 'Recipient deleted successfully' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to delete recipient', variant: 'destructive' });
    },
  });

  const importRecipientsMutation = useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return fetch('/api/recipients/import', { method: 'POST', body: formData }).then((res) => res.json());
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/recipients'] });
      setImportResults(data);
      setImportFile(null);
      toast({ title: 'Import Complete', description: `Successfully imported ${data.imported} recipients` });
    },
    onError: () => {
      toast({ title: 'Import Error', description: 'Failed to import recipients', variant: 'destructive' });
    },
  });

  // Event handlers
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const { valid, errors } = addForm.validate();
    if (!valid) {
      toast({ title: 'Validation Error', description: errors[0], variant: 'destructive' });
      return;
    }
    createRecipientMutation.mutate(addForm.prepareSubmissionData());
  };

  const handleEdit = (recipient: Recipient) => {
    setEditingRecipient(recipient);
    editForm.setRecipient(recipient);
  };

  const handleUpdate = () => {
    if (!editingRecipient) return;
    const submissionData = editForm.prepareSubmissionData();
    updateRecipientMutation.mutate({ id: editingRecipient.id, ...submissionData });
  };

  const handleDelete = (id: number) => {
    if (confirm('Are you sure you want to delete this recipient?')) {
      deleteRecipientMutation.mutate(id);
    }
  };

  const handleToggleStatus = (recipient: Recipient) => {
    const newStatus = recipient.status === 'active' ? 'inactive' : 'active';
    updateRecipientMutation.mutate({ ...recipient, status: newStatus });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImportFile(file);
      setImportResults(null);
    }
  };

  const handleImport = () => {
    if (importFile) {
      importRecipientsMutation.mutate(importFile);
    }
  };

  const handleExport = async () => {
    try {
      const response = await fetch('/api/recipients/export-csv', { credentials: 'include' });
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `recipients-export-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({ title: 'Export completed successfully', description: `Exported ${filteredRecipients.length} recipients to CSV` });
    } catch {
      toast({ title: 'Export failed', description: 'Failed to export recipients data', variant: 'destructive' });
    }
  };

  if (isLoading) {
    return <div className="p-6">Loading recipients...</div>;
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
          <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Users className="text-blue-500 w-6 h-6" />
              Recipients Management
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="text-teal-600 hover:text-teal-800 transition-colors">
                    <HelpCircle className="w-5 h-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="font-semibold mb-1">Recipients Management Help</p>
                  <p className="text-sm">Manage individuals and organizations who receive sandwiches. Track contact information, delivery addresses, and special requirements.</p>
                </TooltipContent>
              </Tooltip>
            </h1>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleExport} className="flex items-center gap-2">
                <Download className="w-4 h-4" />
                Export CSV
              </Button>
              <Dialog open={isImportModalOpen} onOpenChange={setIsImportModalOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="flex items-center gap-2">
                    <Upload className="w-4 h-4" />
                    Import CSV/XLSX
                  </Button>
                </DialogTrigger>
                <DialogContent aria-describedby="import-recipients-description">
                  <DialogHeader>
                    <DialogTitle>Import Recipients from CSV/XLSX</DialogTitle>
                  </DialogHeader>
                  <p id="import-recipients-description" className="text-sm text-slate-600 mb-4">
                    Upload a CSV or Excel file with recipient data. Required columns: name, phone. Optional: email, address, preferences, status.
                  </p>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="file-upload">Select File</Label>
                      <Input id="file-upload" type="file" accept=".csv,.xlsx,.xls" onChange={handleFileSelect} className="mt-1" />
                      {importFile && <p className="text-sm text-green-600 mt-2">Selected: {importFile.name}</p>}
                    </div>
                    {importResults && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <h4 className="font-medium text-green-800">Import Results</h4>
                        <p className="text-sm text-green-700 mt-1">
                          Successfully imported {importResults.imported} recipients
                          {importResults.skipped > 0 && `, skipped ${importResults.skipped} duplicates`}
                        </p>
                      </div>
                    )}
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => { setIsImportModalOpen(false); setImportFile(null); setImportResults(null); }}>
                        Cancel
                      </Button>
                      <Button onClick={handleImport} disabled={!importFile || importRecipientsMutation.isPending}>
                        {importRecipientsMutation.isPending ? 'Importing...' : 'Import'}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
                <DialogTrigger asChild>
                  <Button disabled={!canEdit} className="flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    Add Recipient
                  </Button>
                </DialogTrigger>
                <DialogContent aria-describedby="add-recipient-description" className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader className="flex-shrink-0">
                    <DialogTitle>Add New Recipient</DialogTitle>
                  </DialogHeader>
                  <div className="overflow-y-auto flex-grow pr-1">
                    <p id="add-recipient-description" className="text-sm text-slate-600 mb-4">
                      Add a new recipient to the system for sandwich deliveries.
                    </p>
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <RecipientForm
                        formData={addForm.formData}
                        sections={addForm.sections}
                        onFieldChange={addForm.updateField}
                        onSectionChange={addForm.updateSection}
                        mode="add"
                      />
                      <div className="flex justify-end space-x-2 mt-6 pt-4 border-t bg-white sticky bottom-0">
                        <Button type="button" variant="outline" onClick={() => setIsAddModalOpen(false)}>
                          Cancel
                        </Button>
                        <Button type="submit" disabled={createRecipientMutation.isPending}>
                          {createRecipientMutation.isPending ? 'Adding...' : 'Add Recipient'}
                        </Button>
                      </div>
                    </form>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>

        {/* Search and Filter Controls */}
        <div className="space-y-3 p-4 bg-slate-50 rounded-lg border">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
              <Input
                placeholder="Search recipients by name, email, phone, address, region..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline" onClick={() => setShowFilters(!showFilters)} className="flex items-center gap-2">
              <Filter className="w-4 h-4" />
              Filters
              {(statusFilter !== 'all' || contractFilter !== 'all' || regionFilter !== 'all' || tspContactFilter !== 'all' || sandwichTypeFilter !== 'all') && (
                <Badge variant="secondary" className="ml-1">
                  {[statusFilter !== 'all', contractFilter !== 'all', regionFilter !== 'all', tspContactFilter !== 'all', sandwichTypeFilter !== 'all'].filter(Boolean).length}
                </Badge>
              )}
            </Button>
          </div>

          {showFilters && (
            <div className="space-y-3 pt-3 border-t border-slate-200">
              <div className="flex flex-col md:flex-row gap-3">
                <div className="flex flex-col space-y-2">
                  <Label htmlFor="filter-status" className="text-xs font-medium text-slate-600">Status</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger id="filter-status" className="w-[140px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="active">Active Only</SelectItem>
                      <SelectItem value="inactive">Inactive Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col space-y-2">
                  <Label htmlFor="filter-contract" className="text-xs font-medium text-slate-600">Contract</Label>
                  <Select value={contractFilter} onValueChange={setContractFilter}>
                    <SelectTrigger id="filter-contract" className="w-[140px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="signed">Signed</SelectItem>
                      <SelectItem value="unsigned">Unsigned</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col space-y-2">
                  <Label htmlFor="filter-region" className="text-xs font-medium text-slate-600">Region</Label>
                  <Select value={regionFilter} onValueChange={setRegionFilter}>
                    <SelectTrigger id="filter-region" className="w-[160px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Regions</SelectItem>
                      {uniqueRegions.map((region) => (
                        <SelectItem key={region} value={region as string}>{region}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col space-y-2">
                  <Label htmlFor="filter-tsp-contact" className="text-xs font-medium text-slate-600">TSP Contact</Label>
                  <Select value={tspContactFilter} onValueChange={setTspContactFilter}>
                    <SelectTrigger id="filter-tsp-contact" className="w-[160px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Contacts</SelectItem>
                      {uniqueTspContacts.map((contact) => (
                        <SelectItem key={contact} value={contact as string}>{contact}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col space-y-2">
                  <Label htmlFor="filter-sandwich-type" className="text-xs font-medium text-slate-600">Sandwich Type</Label>
                  <Select value={sandwichTypeFilter} onValueChange={setSandwichTypeFilter}>
                    <SelectTrigger id="filter-sandwich-type" className="w-[160px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      {uniqueSandwichTypes.map((type) => (
                        <SelectItem key={type} value={type as string}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col space-y-2">
                  <Label htmlFor="filter-focus-area" className="text-xs font-medium text-slate-600">Focus Area</Label>
                  <Select value={focusAreaFilter} onValueChange={setFocusAreaFilter}>
                    <SelectTrigger id="filter-focus-area" className="w-[160px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Areas</SelectItem>
                      {uniqueFocusAreas.map((area) => (
                        <SelectItem key={area} value={area as string}>{area}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Results Count */}
        <div className="text-sm text-slate-600">
          Showing {filteredRecipients.length} of {recipients.length} recipients
        </div>

        {/* Recipients Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredRecipients.map((recipient) => (
            <RecipientCard
              key={recipient.id}
              recipient={recipient}
              canEdit={canEdit}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onToggleStatus={handleToggleStatus}
            />
          ))}

          {filteredRecipients.length === 0 && recipients.length > 0 && (
            <div className="col-span-full text-center py-12 text-slate-500">
              No recipients match your current filters. Try adjusting your search or filter criteria.
            </div>
          )}

          {recipients.length === 0 && (
            <div className="col-span-full text-center py-12 text-slate-500">
              No recipients found. Add a new recipient to get started.
            </div>
          )}
        </div>

        {/* Inactive Recipients Section */}
        {inactiveRecipients.length > 0 && (
          <div className="mt-8">
            <Collapsible open={showInactive} onOpenChange={setShowInactive}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between p-3 bg-slate-100 hover:bg-slate-200 rounded-lg">
                  <span className="font-medium text-slate-600">
                    Inactive Recipients ({inactiveRecipients.length})
                  </span>
                  {showInactive ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mt-4">
                  {inactiveRecipients.map((recipient) => (
                    <Card key={recipient.id} className="border border-slate-200 bg-slate-50">
                      <CardHeader className="py-2 px-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-sm font-normal text-slate-600">{recipient.name}</CardTitle>
                            <Badge variant="secondary" className="mt-1 text-xs">Inactive</Badge>
                          </div>
                          <Button size="sm" variant="outline" disabled={!canEdit} onClick={() => handleEdit(recipient)}>
                            <Edit className="w-3 h-3" />
                          </Button>
                        </div>
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        )}

        {/* Edit Modal */}
        {editingRecipient && (
          <Dialog open={!!editingRecipient} onOpenChange={() => setEditingRecipient(null)}>
            <DialogContent aria-describedby="edit-recipient-description" className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Edit Recipient</DialogTitle>
              </DialogHeader>
              <p id="edit-recipient-description" className="text-sm text-slate-600 mb-4">
                Update recipient information.
              </p>
              <div className="space-y-4">
                <RecipientForm
                  formData={editForm.formData}
                  sections={editForm.sections}
                  onFieldChange={editForm.updateField}
                  onSectionChange={editForm.updateSection}
                  mode="edit"
                  idPrefix="edit"
                />
                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button variant="outline" onClick={() => setEditingRecipient(null)}>
                    Cancel
                  </Button>
                  <Button onClick={handleUpdate} disabled={updateRecipientMutation.isPending}>
                    {updateRecipientMutation.isPending ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </TooltipProvider>
  );
}

