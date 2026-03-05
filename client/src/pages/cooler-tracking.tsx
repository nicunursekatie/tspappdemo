import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@shared/auth-utils';
import { hasPermission as checkPermission } from '@shared/unified-auth-utils';
import { useActivityTracker } from '@/hooks/useActivityTracker';
import { PageBreadcrumbs } from '@/components/page-breadcrumbs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Package,
  MapPin,
  Users,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Clock,
  Edit,
  Trash2,
  Plus
} from 'lucide-react';

interface CoolerType {
  id: number;
  name: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
}

interface InventoryItem {
  coolerTypeId: number;
  quantity: number;
  notes?: string;
}

interface MyInventory {
  id: number;
  coolerTypeId: number;
  coolerTypeName: string;
  quantity: number;
  notes: string | null;
  reportedAt: string;
}

interface InventorySummary {
  coolerTypeId: number;
  coolerTypeName: string;
  totalQuantity: number;
  locationCount: number;
}

interface FullInventory {
  id: number;
  hostHomeId: string;
  hostFirstName: string | null;
  hostLastName: string | null;
  coolerTypeId: number;
  coolerTypeName: string;
  quantity: number;
  notes: string | null;
  reportedAt: string;
  reportedBy: string;
}

export default function CoolerTrackingPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { trackView, trackFormSubmit } = useActivityTracker();

  useEffect(() => {
    trackView(
      'Cooler Tracking',
      'Cooler Tracking',
      'Cooler Tracking Page',
      'User accessed cooler tracking page'
    );
  }, [trackView]);

  // Permission checks
  const canViewCoolers = user ? checkPermission(user, PERMISSIONS.COOLERS_VIEW) : false;
  const canReportCoolers = user ? checkPermission(user, PERMISSIONS.COOLERS_REPORT) : false;
  const canManageCoolers = user ? checkPermission(user, PERMISSIONS.COOLERS_MANAGE) : false;

  const [inventory, setInventory] = useState<InventoryItem[]>([]);

  // Admin edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<FullInventory | null>(null);
  const [editQuantity, setEditQuantity] = useState(0);
  const [editNotes, setEditNotes] = useState('');

  // Admin add dialog state
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedHostId, setSelectedHostId] = useState('');
  const [selectedCoolerTypeId, setSelectedCoolerTypeId] = useState('');
  const [addQuantity, setAddQuantity] = useState(0);
  const [addNotes, setAddNotes] = useState('');

  // Fetch cooler types
  const { data: coolerTypes = [], isLoading: typesLoading } = useQuery<CoolerType[]>({
    queryKey: ['/api/cooler-types'],
    retry: 1,
  });

  // Fetch my current inventory
  const { data: myInventory = [] } = useQuery<MyInventory[]>({
    queryKey: ['/api/cooler-inventory/my-inventory'],
    retry: 1,
  });

  // Fetch summary (for everyone to see)
  const { data: summary = [] } = useQuery<InventorySummary[]>({
    queryKey: ['/api/cooler-inventory/summary'],
    retry: 1,
  });

  // Fetch full inventory (everyone can see it now!)
  const { data: fullInventory = [] } = useQuery<FullInventory[]>({
    queryKey: ['/api/cooler-inventory'],
    retry: 1,
  });

  // Fetch all users (for admin add dialog)
  const { data: allUsers = [] } = useQuery<any[]>({
    queryKey: ['/api/users'],
    enabled: canManageCoolers,
    retry: 1,
  });

  // Initialize inventory form with current values
  useEffect(() => {
    if (coolerTypes.length > 0) {
      const initialInventory = coolerTypes.map((type) => {
        const existing = myInventory.find((item) => item.coolerTypeId === type.id);
        return {
          coolerTypeId: type.id,
          quantity: existing?.quantity || 0,
          notes: existing?.notes || '',
        };
      });
      setInventory(initialInventory);
    }
  }, [coolerTypes, myInventory]);

  // Submit inventory mutation
  const submitInventoryMutation = useMutation({
    mutationFn: async () => {
      // Only submit items with quantity > 0 or with notes
      const itemsToSubmit = inventory.filter(
        (item) => item.quantity > 0 || (item.notes && item.notes.trim() !== '')
      );

      if (itemsToSubmit.length === 0) {
        throw new Error('Please enter at least one cooler quantity');
      }

      return apiRequest('POST', '/api/cooler-inventory', {
        inventory: itemsToSubmit,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/cooler-inventory/my-inventory'] });
      queryClient.invalidateQueries({ queryKey: ['/api/cooler-inventory/summary'] });
      queryClient.invalidateQueries({ queryKey: ['/api/cooler-inventory'] });
      toast({
        title: 'Report Submitted',
        description: 'Your cooler inventory has been recorded successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Submission Failed',
        description: error.message || 'There was an error submitting your report',
        variant: 'destructive',
      });
    },
  });

  const handleQuantityChange = (coolerTypeId: number, value: string) => {
    const quantity = parseInt(value) || 0;
    setInventory((prev) =>
      prev.map((item) =>
        item.coolerTypeId === coolerTypeId ? { ...item, quantity } : item
      )
    );
  };

  const handleNotesChange = (coolerTypeId: number, value: string) => {
    setInventory((prev) =>
      prev.map((item) =>
        item.coolerTypeId === coolerTypeId ? { ...item, notes: value } : item
      )
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitInventoryMutation.mutate();
  };

  // Admin: Update existing cooler entry
  const updateInventoryMutation = useMutation({
    mutationFn: async (data: { id: number; quantity: number; notes: string }) => {
      return apiRequest('POST', '/api/cooler-inventory/admin-add', {
        hostHomeId: editingEntry!.hostHomeId,
        coolerTypeId: editingEntry!.coolerTypeId,
        quantity: data.quantity,
        notes: data.notes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/cooler-inventory'] });
      queryClient.invalidateQueries({ queryKey: ['/api/cooler-inventory/summary'] });
      setEditDialogOpen(false);
      setEditingEntry(null);
      toast({
        title: 'Updated',
        description: 'Cooler inventory updated successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Update Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Admin: Add cooler for any user
  const addInventoryMutation = useMutation({
    mutationFn: async () => {
      if (!selectedHostId || !selectedCoolerTypeId) {
        throw new Error('Please select a host and cooler type');
      }
      return apiRequest('POST', '/api/cooler-inventory/admin-add', {
        hostHomeId: selectedHostId,
        coolerTypeId: parseInt(selectedCoolerTypeId),
        quantity: addQuantity,
        notes: addNotes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/cooler-inventory'] });
      queryClient.invalidateQueries({ queryKey: ['/api/cooler-inventory/summary'] });
      setAddDialogOpen(false);
      setSelectedHostId('');
      setSelectedCoolerTypeId('');
      setAddQuantity(0);
      setAddNotes('');
      toast({
        title: 'Added',
        description: 'Cooler inventory added successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Add Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Admin: Delete cooler entry
  const deleteInventoryMutation = useMutation({
    mutationFn: async (entryId: number) => {
      return apiRequest('DELETE', `/api/cooler-inventory/${entryId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/cooler-inventory'] });
      queryClient.invalidateQueries({ queryKey: ['/api/cooler-inventory/summary'] });
      toast({
        title: 'Deleted',
        description: 'Cooler entry removed successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Delete Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleEditEntry = (entry: FullInventory) => {
    setEditingEntry(entry);
    setEditQuantity(entry.quantity);
    setEditNotes(entry.notes || '');
    setEditDialogOpen(true);
  };

  const handleUpdateEntry = () => {
    if (!editingEntry) return;
    updateInventoryMutation.mutate({
      id: editingEntry.id,
      quantity: editQuantity,
      notes: editNotes,
    });
  };

  const handleDeleteEntry = (entryId: number) => {
    if (confirm('Are you sure you want to delete this cooler entry?')) {
      deleteInventoryMutation.mutate(entryId);
    }
  };

  const handleAddEntry = () => {
    addInventoryMutation.mutate();
  };

  const getLastReportTime = () => {
    if (myInventory.length === 0) return null;
    const latest = myInventory.reduce((prev, current) =>
      new Date(current.reportedAt) > new Date(prev.reportedAt) ? current : prev
    );
    return new Date(latest.reportedAt);
  };

  const lastReportTime = getLastReportTime();
  const daysSinceLastReport = lastReportTime
    ? Math.floor((Date.now() - lastReportTime.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  if (typesLoading) {
    return (
      <div className="container mx-auto p-6 max-w-6xl">
        <p className="text-center text-slate-600">Loading cooler types...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl space-y-6">
      <PageBreadcrumbs segments={[
        { label: 'Operations' },
        { label: 'Cooler Tracking' }
      ]} />

      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-slate-800 flex items-center justify-center gap-3">
          <Package className="w-8 h-8 text-brand-orange" />
          Cooler Tracking
        </h1>
        <p className="text-slate-600 max-w-2xl mx-auto">
          Keep track of where our coolers are located so we can coordinate pickups and
          distributions more efficiently.
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <Package className="w-8 h-8 text-brand-primary" />
              <div>
                <p className="text-2xl font-bold">
                  {summary.reduce((sum, item) => sum + item.totalQuantity, 0)}
                </p>
                <p className="text-xs text-slate-600">Total Coolers</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <MapPin className="w-8 h-8 text-brand-orange" />
              <div>
                <p className="text-2xl font-bold">
                  {canViewCoolers ? new Set(fullInventory.map((i) => i.hostHomeId)).size : '—'}
                </p>
                <p className="text-xs text-slate-600">Host Locations</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              {daysSinceLastReport === null ? (
                <AlertCircle className="w-8 h-8 text-yellow-600" />
              ) : daysSinceLastReport <= 7 ? (
                <CheckCircle className="w-8 h-8 text-green-600" />
              ) : (
                <Clock className="w-8 h-8 text-orange-600" />
              )}
              <div>
                <p className="text-2xl font-bold">
                  {daysSinceLastReport === null
                    ? 'Never'
                    : daysSinceLastReport === 0
                      ? 'Today'
                      : `${daysSinceLastReport}d ago`}
                </p>
                <p className="text-xs text-slate-600">Last Report</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cooler Summary by Type */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-brand-primary" />
            Cooler Distribution Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          {summary.length === 0 ? (
            <p className="text-slate-500 text-center py-4">
              No cooler inventory reported yet
            </p>
          ) : (
            <div className="space-y-3">
              {summary.map((item) => (
                <div
                  key={item.coolerTypeId}
                  className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                >
                  <div>
                    <p className="font-medium">{item.coolerTypeName}</p>
                    <p className="text-sm text-slate-600">
                      At {item.locationCount} location{item.locationCount !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <Badge variant="secondary" className="text-lg px-4 py-1">
                    {item.totalQuantity}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Report Your Inventory */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-brand-primary" />
            Report Your Cooler Inventory
          </CardTitle>
        </CardHeader>
        <CardContent>
          {coolerTypes.length === 0 ? (
            <div className="text-center py-8">
              <AlertCircle className="w-12 h-12 mx-auto text-yellow-600 mb-3" />
              <p className="text-slate-700 font-medium mb-2">
                No Cooler Types Configured Yet
              </p>
              <p className="text-sm text-slate-600 mb-4">
                An administrator needs to set up cooler types before you can report inventory.
              </p>
              {canManageCoolers && (
                <p className="text-sm text-slate-500 bg-slate-50 p-3 rounded">
                  <strong>Admin:</strong> Run the seed script: <code className="bg-slate-200 px-2 py-1 rounded">npx tsx server/scripts/seed-cooler-types.ts</code>
                </p>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {coolerTypes.map((type) => {
              const item = inventory.find((i) => i.coolerTypeId === type.id);
              return (
                <div key={type.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor={`quantity-${type.id}`} className="font-medium">
                        {type.name}
                      </Label>
                      {type.description && (
                        <p className="text-sm text-slate-500">{type.description}</p>
                      )}
                    </div>
                    <Input
                      id={`quantity-${type.id}`}
                      type="number"
                      min="0"
                      value={item?.quantity || 0}
                      onChange={(e) => handleQuantityChange(type.id, e.target.value)}
                      className="w-24 text-center"
                    />
                  </div>
                  <Textarea
                    id={`notes-${type.id}`}
                    placeholder="Optional notes (e.g., condition, location details)"
                    value={item?.notes || ''}
                    onChange={(e) => handleNotesChange(type.id, e.target.value)}
                    rows={2}
                    className="text-sm"
                  />
                </div>
              );
            })}

              <Button
                type="submit"
                className="w-full"
                disabled={submitInventoryMutation.isPending}
              >
                {submitInventoryMutation.isPending ? 'Submitting...' : 'Submit Report'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      {/* All Cooler Locations - Everyone can see this! */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-brand-burgundy" />
              All Cooler Locations
            </div>
            {canManageCoolers && (
              <Button
                onClick={() => setAddDialogOpen(true)}
                size="sm"
                variant="outline"
                className="gap-2"
              >
                <Plus className="w-4 h-4" />
                Add for User
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {fullInventory.length === 0 ? (
            <p className="text-slate-500 text-center py-4">
              No inventory reports yet
            </p>
          ) : (
            <div className="space-y-4">
              {Object.entries(
                fullInventory.reduce(
                  (acc, item) => {
                    const key = item.hostHomeId;
                    if (!acc[key]) {
                      acc[key] = {
                        hostName: `${item.hostFirstName || ''} ${item.hostLastName || ''}`.trim() || 'Unknown',
                        items: [],
                      };
                    }
                    acc[key].items.push(item);
                    return acc;
                  },
                  {} as Record<string, { hostName: string; items: FullInventory[] }>
                )
              ).map(([hostId, data]) => (
                <div key={hostId} className="border rounded-lg p-4 bg-slate-50">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-lg">{data.hostName}</h4>
                    <Badge variant="outline">
                      {data.items.reduce((sum, item) => sum + item.quantity, 0)} coolers
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    {data.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-start justify-between text-sm"
                      >
                        <div className="flex-1">
                          <p className="font-medium">{item.coolerTypeName}</p>
                          {item.notes && (
                            <p className="text-slate-600 text-xs mt-1">{item.notes}</p>
                          )}
                          <p className="text-slate-500 text-xs mt-1">
                            Reported {new Date(item.reportedAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className="ml-2">{item.quantity}</Badge>
                          {canManageCoolers && (
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleEditEntry(item)}
                                className="h-8 w-8 p-0"
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDeleteEntry(item.id)}
                                className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Admin Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Cooler Entry</DialogTitle>
            <DialogDescription>
              Update cooler quantity and notes for {editingEntry?.hostFirstName} {editingEntry?.hostLastName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Cooler Type</Label>
              <p className="text-sm font-medium text-slate-700 mt-1">{editingEntry?.coolerTypeName}</p>
            </div>
            <div>
              <Label htmlFor="edit-quantity">Quantity</Label>
              <Input
                id="edit-quantity"
                type="number"
                min="0"
                value={editQuantity}
                onChange={(e) => setEditQuantity(parseInt(e.target.value) || 0)}
              />
            </div>
            <div>
              <Label htmlFor="edit-notes">Notes</Label>
              <Textarea
                id="edit-notes"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateEntry} disabled={updateInventoryMutation.isPending}>
              {updateInventoryMutation.isPending ? 'Updating...' : 'Update'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Admin Add Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Cooler for User</DialogTitle>
            <DialogDescription>
              Add cooler inventory on behalf of a user
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="select-host">Select Host</Label>
              <Select value={selectedHostId} onValueChange={setSelectedHostId}>
                <SelectTrigger id="select-host">
                  <SelectValue placeholder="Choose a host..." />
                </SelectTrigger>
                <SelectContent>
                  {allUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.firstName} {u.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="select-cooler-type">Cooler Type</Label>
              <Select value={selectedCoolerTypeId} onValueChange={setSelectedCoolerTypeId}>
                <SelectTrigger id="select-cooler-type">
                  <SelectValue placeholder="Choose cooler type..." />
                </SelectTrigger>
                <SelectContent>
                  {coolerTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id.toString()}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="add-quantity">Quantity</Label>
              <Input
                id="add-quantity"
                type="number"
                min="0"
                value={addQuantity}
                onChange={(e) => setAddQuantity(parseInt(e.target.value) || 0)}
              />
            </div>
            <div>
              <Label htmlFor="add-notes">Notes</Label>
              <Textarea
                id="add-notes"
                value={addNotes}
                onChange={(e) => setAddNotes(e.target.value)}
                placeholder="Optional notes..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddEntry} disabled={addInventoryMutation.isPending}>
              {addInventoryMutation.isPending ? 'Adding...' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
