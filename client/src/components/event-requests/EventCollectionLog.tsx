import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Calendar,
  CheckCircle,
  Edit,
  X,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import type { EventRequest } from '@shared/schema';
import { getSandwichTypesSummary } from './utils';
import SandwichDestinationTracker from './SandwichDestinationTracker';
import { logger } from '@/lib/logger';

// Event Collection Log Component
interface EventCollectionLogProps {
  eventRequest: EventRequest | null;
  isVisible: boolean;
  onClose: () => void;
}

const EventCollectionLog: React.FC<EventCollectionLogProps> = ({
  eventRequest,
  isVisible,
  onClose,
}) => {
  const [collections, setCollections] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedCollectionId, setSelectedCollectionId] = useState<
    number | null
  >(null);

  // State for editing collection destinations
  const [editingDestination, setEditingDestination] = useState<{
    id: number;
    value: string;
  } | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch collections for this event request
  const { data: collectionsData, refetch: refetchCollections } = useQuery({
    queryKey: ['/api/collections', { eventRequestId: eventRequest?.id }],
    enabled: isVisible && !!eventRequest?.id,
  });

  useEffect(() => {
    if (Array.isArray(collectionsData)) {
      setCollections(collectionsData);
    } else if (collectionsData && typeof collectionsData === 'object') {
      setCollections([collectionsData]);
    } else {
      setCollections([]);
    }
  }, [collectionsData]);
  const handleDestinationEdit = (
    collectionId: number,
    currentValue: string
  ) => {
    setEditingDestination({ id: collectionId, value: currentValue || '' });
  };

  const handleDestinationSave = async () => {
    if (!editingDestination) return;

    try {
      await apiRequest('PATCH', `/api/collections/${editingDestination.id}`, {
        sandwichDestination: editingDestination.value,
      });

      // Update local state
      setCollections(
        collections.map((collection) =>
          collection.id === editingDestination.id
            ? { ...collection, sandwichDestination: editingDestination.value }
            : collection
        )
      );

      setEditingDestination(null);
      queryClient.invalidateQueries({
        queryKey: ['/api/collections'],
      });

      toast({
        title: 'Destination Updated',
        description: 'Sandwich destination has been updated successfully.',
      });
    } catch (error) {
      logger.error('Error updating destination:', error);
      toast({
        title: 'Update Failed',
        description: 'Failed to update sandwich destination.',
        variant: 'destructive',
      });
    }
  };

  const handleDestinationCancel = () => {
    setEditingDestination(null);
  };

  if (!isVisible || !eventRequest) return null;

  const totals = collections.reduce(
    (acc, collection) => {
      acc.totalSandwiches += collection.sandwichCount || 0;
      return acc;
    },
    { totalSandwiches: 0 }
  );
  return (
    <div
      className="fixed inset-0 bg-[#236383] bg-opacity-50 z-50 flex items-center justify-center p-4"
      style={{
        left: window.innerWidth > 768 ? 240 : 0, // 240px nav bar width on desktop
        width: window.innerWidth > 768 ? `calc(100vw - 240px)` : '100vw',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">
                Collection Log for {eventRequest?.organizationName}
              </h2>
              <p className="text-[#236383]">
                {eventRequest?.firstName} {eventRequest?.lastName}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              data-testid="button-close-collection-log"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="p-6 max-h-[calc(90vh-120px)] overflow-y-auto">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <span className="text-2xl">🥪</span>
                  <div>
                    <p className="text-sm text-[#236383]">Total Sandwiches</p>
                    <p className="text-2xl font-bold text-brand-primary">
                      {totals.totalSandwiches.toLocaleString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <span className="text-2xl">📅</span>
                  <div>
                    <p className="text-sm text-[#236383]">Collection Days</p>
                    <p className="text-2xl font-bold text-brand-teal">
                      {collections.length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                  <div>
                    <p className="text-sm text-[#236383]">Status</p>
                    <p className="text-sm font-medium text-green-600">
                      {collections.length > 0 ? 'Active' : 'No Collections'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Collections List */}
          {collections.length > 0 ? (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Collection Records</h3>
              {collections.map((collection) => (
                <Card key={collection.id} className="p-4">
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                        <div className="flex items-center space-x-2">
                          <Calendar className="w-5 h-5 text-brand-primary flex-shrink-0" />
                          <span className="font-medium text-sm sm:text-base">
                            {new Date(
                              collection.collectionDate
                            ).toLocaleDateString('en-US', {
                              weekday: 'long',
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                            })}
                          </span>
                        </div>
                        <Badge
                          variant="secondary"
                          className="bg-brand-primary text-white self-start sm:self-auto"
                        >
                          {collection.sandwichCount || 0} sandwiches
                        </Badge>
                      </div>

                      {/* Sandwich Types Breakdown */}
                      {collection.sandwichTypes && (
                        <div className="ml-0 sm:ml-8 pl-7 sm:pl-0">
                          <p className="text-sm text-[#236383]">
                            Types:{' '}
                            {getSandwichTypesSummary(collection).breakdown}
                          </p>
                        </div>
                      )}

                      {/* Destination with inline editing */}
                      <div className="ml-0 sm:ml-8 pl-7 sm:pl-0 flex flex-col sm:flex-row sm:items-center gap-2">
                        {editingDestination?.id === collection.id ? (
                          <SandwichDestinationTracker
                            value={editingDestination?.value || ''}
                            onChange={(value) =>
                              setEditingDestination((prev) =>
                                prev ? { ...prev, value } : null
                              )
                            }
                            onSave={handleDestinationSave}
                            onCancel={handleDestinationCancel}
                          />
                        ) : (
                          <div className="flex items-center flex-wrap gap-2">
                            <span className="text-sm text-[#236383]">
                              <strong>Destination:</strong>{' '}
                              {collection.sandwichDestination ||
                                'Not specified'}
                            </span>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                handleDestinationEdit(
                                  collection.id,
                                  collection.sandwichDestination || ''
                                )
                              }
                              className="text-brand-primary hover:bg-brand-primary hover:text-white"
                              data-testid={`button-edit-destination-${collection.id}`}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                      </div>

                      {collection.notes && (
                        <div className="ml-0 sm:ml-8 pl-7 sm:pl-0">
                          <p className="text-sm text-[#236383]">
                            <strong>Notes:</strong> {collection.notes}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-[#236383] mb-4">
                No collections recorded for this event yet.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EventCollectionLog;