import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronUp, ChevronDown, Save, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';

interface AdminDocument {
  id: string;
  name: string;
  description: string;
  category: string;
  importance: 'critical' | 'high' | 'normal';
}

interface DashboardDocument {
  id: number;
  documentId: string;
  displayOrder: number;
  isActive: boolean;
  addedBy: string;
  createdAt: string;
  updatedAt: string;
}

interface SelectedDocument {
  documentId: string;
  displayOrder: number;
}

interface Props {
  adminDocuments: AdminDocument[];
}

export function DashboardDocumentSelector({ adminDocuments }: Props) {
  const { toast } = useToast();
  const [selectedDocs, setSelectedDocs] = useState<SelectedDocument[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  const { data: dashboardDocs, isLoading } = useQuery<DashboardDocument[]>({
    queryKey: ['/api/dashboard-documents'],
  });

  useEffect(() => {
    if (dashboardDocs) {
      const docs = dashboardDocs.map((doc) => ({
        documentId: doc.documentId,
        displayOrder: doc.displayOrder,
      }));
      setSelectedDocs(docs);
    }
  }, [dashboardDocs]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const currentDocIds = new Set(selectedDocs.map((d) => d.documentId));
      const existingDocIds = new Set(dashboardDocs?.map((d) => d.documentId) || []);

      const toAdd = selectedDocs.filter((d) => !existingDocIds.has(d.documentId));
      const toRemove = Array.from(existingDocIds).filter((id) => !currentDocIds.has(id));
      const toReorder = selectedDocs.filter((d) => existingDocIds.has(d.documentId));

      for (const doc of toRemove) {
        await apiRequest('DELETE', `/api/dashboard-documents/${doc}`);
      }

      for (const doc of toAdd) {
        await apiRequest('POST', '/api/dashboard-documents', {
          documentId: doc.documentId,
          displayOrder: doc.displayOrder,
        });
      }

      if (toReorder.length > 0) {
        await apiRequest('PUT', '/api/dashboard-documents/reorder', toReorder);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard-documents'] });
      setHasChanges(false);
      toast({
        title: 'Success',
        description: 'Dashboard documents configuration saved successfully',
      });
    },
    onError: (error: any) => {
      logger.error('Error saving dashboard documents:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save dashboard documents configuration',
        variant: 'destructive',
      });
    },
  });

  const toggleDocument = (documentId: string) => {
    const isSelected = selectedDocs.some((d) => d.documentId === documentId);
    
    if (isSelected) {
      setSelectedDocs((prev) => prev.filter((d) => d.documentId !== documentId));
    } else {
      const newDisplayOrder = selectedDocs.length > 0
        ? Math.max(...selectedDocs.map((d) => d.displayOrder)) + 1
        : 0;
      setSelectedDocs((prev) => [...prev, { documentId, displayOrder: newDisplayOrder }]);
    }
    
    setHasChanges(true);
  };

  const moveUp = (documentId: string) => {
    const index = selectedDocs.findIndex((d) => d.documentId === documentId);
    if (index <= 0) return;

    const newDocs = [...selectedDocs];
    [newDocs[index - 1], newDocs[index]] = [newDocs[index], newDocs[index - 1]];

    newDocs.forEach((doc, idx) => {
      doc.displayOrder = idx;
    });

    setSelectedDocs(newDocs);
    setHasChanges(true);
  };

  const moveDown = (documentId: string) => {
    const index = selectedDocs.findIndex((d) => d.documentId === documentId);
    if (index < 0 || index >= selectedDocs.length - 1) return;

    const newDocs = [...selectedDocs];
    [newDocs[index], newDocs[index + 1]] = [newDocs[index + 1], newDocs[index]];

    newDocs.forEach((doc, idx) => {
      doc.displayOrder = idx;
    });

    setSelectedDocs(newDocs);
    setHasChanges(true);
  };

  const handleSave = () => {
    saveMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8" data-testid="loading-dashboard-config">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const selectedCount = selectedDocs.length;
  const selectedDocIds = new Set(selectedDocs.map((d) => d.documentId));

  return (
    <div className="space-y-6" data-testid="dashboard-document-selector">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Configure Dashboard Documents</h3>
          <p className="text-sm text-muted-foreground">
            Select which important documents should appear on the dashboard and arrange their order.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="secondary" data-testid="selected-count">
            {selectedCount} {selectedCount === 1 ? 'document' : 'documents'} selected
          </Badge>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || saveMutation.isPending}
            data-testid="button-save-dashboard-config"
          >
            {saveMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="grid gap-4">
        <Card data-testid="card-selected-documents">
          <CardHeader>
            <CardTitle>Selected Documents (in order)</CardTitle>
            <CardDescription>
              These documents will appear on the dashboard in this order.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {selectedDocs.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4" data-testid="text-no-selected-docs">
                No documents selected. Choose documents from the list below.
              </p>
            ) : (
              <div className="space-y-2">
                {selectedDocs.map((doc, index) => {
                  const adminDoc = adminDocuments.find((d) => d.id === doc.documentId);
                  if (!adminDoc) return null;

                  return (
                    <div
                      key={doc.documentId}
                      className="flex items-center gap-3 p-3 border rounded-lg bg-card"
                      data-testid={`selected-doc-${doc.documentId}`}
                    >
                      <div className="flex flex-col gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => moveUp(doc.documentId)}
                          disabled={index === 0}
                          className="h-6 w-6 p-0"
                          data-testid={`button-move-up-${doc.documentId}`}
                        >
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => moveDown(doc.documentId)}
                          disabled={index === selectedDocs.length - 1}
                          className="h-6 w-6 p-0"
                          data-testid={`button-move-down-${doc.documentId}`}
                        >
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                      </div>
                      <Badge variant="outline" className="w-8 text-center">
                        {index + 1}
                      </Badge>
                      <div className="flex-1">
                        <p className="font-medium text-sm">{adminDoc.name}</p>
                        <p className="text-xs text-muted-foreground">{adminDoc.category}</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleDocument(doc.documentId)}
                        data-testid={`button-remove-${doc.documentId}`}
                      >
                        Remove
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-available-documents">
          <CardHeader>
            <CardTitle>Available Documents</CardTitle>
            <CardDescription>
              Check documents to add them to the dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {adminDocuments.map((doc) => {
                const isSelected = selectedDocIds.has(doc.id);
                
                return (
                  <div
                    key={doc.id}
                    className="flex items-start gap-3 p-3 border rounded-lg hover:bg-accent transition-colors"
                    data-testid={`available-doc-${doc.id}`}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleDocument(doc.id)}
                      id={`doc-${doc.id}`}
                      data-testid={`checkbox-${doc.id}`}
                    />
                    <label
                      htmlFor={`doc-${doc.id}`}
                      className="flex-1 cursor-pointer space-y-1"
                    >
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">{doc.name}</p>
                        {doc.importance === 'critical' && (
                          <Badge variant="destructive" className="text-xs">
                            Critical
                          </Badge>
                        )}
                        {doc.importance === 'high' && (
                          <Badge variant="default" className="text-xs">
                            High
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{doc.description}</p>
                      <p className="text-xs text-muted-foreground">Category: {doc.category}</p>
                    </label>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
