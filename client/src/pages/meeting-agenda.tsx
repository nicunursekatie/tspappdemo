import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useDashboardNavigation } from '@/contexts/dashboard-navigation-context';
import { useActivityTracker } from '@/hooks/useActivityTracker';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Calendar,
  Clock,
  ListTodo,
  Plus,
  Edit,
  Trash2,
  CheckCircle2,
  Circle,
  ArrowLeft,
} from 'lucide-react';
import { queryClient } from '@/lib/queryClient';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@shared/auth-utils';
import { hasPermission } from '@shared/unified-auth-utils';
import { useLocation } from 'wouter';

interface AgendaItem {
  id: number;
  meetingId: number;
  submittedBy: string;
  title: string;
  description: string;
  status: 'pending' | 'approved' | 'rejected' | 'postponed';
  submittedAt: string;
}

interface MeetingAgendaProps {
  isEmbedded?: boolean;
}

export default function MeetingAgenda({
  isEmbedded = false,
}: MeetingAgendaProps) {
  const { user } = useAuth();
  const { trackView, trackCreate, trackUpdate } = useActivityTracker();
  const canModifyAgenda = (user as any)?.role !== 'committee_member';
  const [, setLocation] = useLocation();
  const { setActiveSection } = useDashboardNavigation();

  useEffect(() => {
    if (!isEmbedded) {
      trackView(
        'Meetings',
        'Meetings',
        'Meeting Agenda',
        'User accessed meeting agenda page'
      );
    }
  }, [isEmbedded, trackView]);

  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    submittedBy: (user as any)?.firstName || 'User',
  });
  const { toast } = useToast();

  const { data: agendaItems = [], isLoading } = useQuery({
    queryKey: ['/api/agenda-items'],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/agenda-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          meetingId: 1,
        }),
      });
      if (!response.ok) throw new Error('Failed to create agenda item');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/agenda-items'] });
      setIsCreating(false);
      setFormData({
        title: '',
        description: '',
        submittedBy: (user as any)?.firstName || 'User',
      });
      toast({ title: 'Agenda item created successfully' });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const response = await fetch(`/api/agenda-items/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error('Failed to update status');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/agenda-items'] });
      toast({ title: 'Status updated successfully' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/agenda-items/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete agenda item');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/agenda-items'] });
      toast({ title: 'Agenda item deleted successfully' });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const handleStatusChange = (item: AgendaItem, newStatus: string) => {
    updateStatusMutation.mutate({ id: item.id, status: newStatus });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      case 'postponed':
        return 'bg-orange-100 text-orange-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle2 className="w-4 h-4 text-green-600" />;
      case 'rejected':
        return <Circle className="w-4 h-4 text-red-600" />;
      case 'postponed':
        return <Clock className="w-4 h-4 text-orange-600" />;
      case 'pending':
        return <Circle className="w-4 h-4 text-yellow-600" />;
      default:
        return <Circle className="w-4 h-4 text-gray-600" />;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  const approvedItems = (agendaItems as AgendaItem[]).filter(
    (item) => item.status === 'approved'
  ).length;
  const pendingItems = (agendaItems as AgendaItem[]).filter(
    (item) => item.status === 'pending'
  ).length;

  return (
    <div className="space-y-6">
      {/* Navigation Header - only show when not embedded */}
      {!isEmbedded && (
        <div className="flex items-center gap-3 pb-4 border-b border-gray-200">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setActiveSection('meetings')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Meetings Hub
          </Button>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>Meetings</span>
            <span>•</span>
            <span className="text-gray-900 font-medium">Agenda</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 bg-brand-primary-light rounded-xl">
            <ListTodo className="w-5 h-5 sm:w-6 sm:h-6 text-brand-primary" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
              Meeting Agenda
            </h1>
            <p className="text-sm sm:text-base text-gray-600">
              Submit and organize meeting topics and discussions
            </p>
          </div>
        </div>
        <Button
          onClick={() => setIsCreating(true)}
          className="self-start h-10 text-sm"
        >
          <Plus className="w-4 h-4 mr-2" />
          <span className="hidden sm:inline">New Agenda Item</span>
          <span className="sm:hidden">New Item</span>
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <ListTodo className="w-8 h-8 text-brand-primary" />
              <div>
                <p className="text-2xl font-bold">
                  {(agendaItems as AgendaItem[]).length}
                </p>
                <p className="text-sm text-gray-600">Total Items</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-8 h-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{approvedItems}</p>
                <p className="text-sm text-gray-600">Approved</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Clock className="w-8 h-8 text-yellow-500" />
              <div>
                <p className="text-2xl font-bold">{pendingItems}</p>
                <p className="text-sm text-gray-600">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Create New Agenda Item */}
      {isCreating && (
        <Card>
          <CardHeader>
            <CardTitle>New Agenda Item</CardTitle>
            <CardDescription>
              Submit a topic for the upcoming meeting
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Title</label>
                <Input
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  placeholder="Brief title for the agenda item"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  Description
                </label>
                <Textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Detailed description of the agenda item"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  Submitted By
                </label>
                <Input
                  value={formData.submittedBy}
                  onChange={(e) =>
                    setFormData({ ...formData, submittedBy: e.target.value })
                  }
                  placeholder="Your name"
                  required
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Creating...' : 'Create Item'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreating(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Agenda Items */}
      <div className="space-y-4">
        {(agendaItems as AgendaItem[]).map(
          (item: AgendaItem, index: number) => (
            <Card
              key={item.id}
              className={
                item.status === 'approved'
                  ? 'border-green-200 bg-green-50'
                  : item.status === 'rejected'
                    ? 'border-red-200 bg-red-50'
                    : item.status === 'postponed'
                      ? 'border-orange-200 bg-orange-50'
                      : ''
              }
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="flex-shrink-0">
                      {getStatusIcon(item.status)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-medium text-gray-500">
                          #{index + 1}
                        </span>
                        <Badge className={getStatusColor(item.status)}>
                          {item.status.charAt(0).toUpperCase() +
                            item.status.slice(1)}
                        </Badge>
                      </div>
                      <h3 className="font-semibold text-lg text-gray-900 mb-2">
                        {item.title}
                      </h3>
                      {item.description && (
                        <p className="text-gray-600 mb-3">{item.description}</p>
                      )}
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span>Submitted by: {item.submittedBy}</span>
                        <span>•</span>
                        <span>
                          {new Date(item.submittedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col gap-2 ml-4">
                    {item.status === 'pending' && canModifyAgenda && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => handleStatusChange(item, 'approved')}
                          disabled={updateStatusMutation.isPending}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-red-300 text-red-600 hover:bg-red-50"
                          onClick={() => handleStatusChange(item, 'rejected')}
                          disabled={updateStatusMutation.isPending}
                        >
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-orange-300 text-orange-600 hover:bg-orange-50"
                          onClick={() => handleStatusChange(item, 'postponed')}
                          disabled={updateStatusMutation.isPending}
                        >
                          Postpone
                        </Button>
                      </div>
                    )}

                    {item.status !== 'pending' && canModifyAgenda && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleStatusChange(item, 'pending')}
                        disabled={updateStatusMutation.isPending}
                      >
                        Reset to Pending
                      </Button>
                    )}

                    {canModifyAgenda && (
                      <ConfirmationDialog
                        trigger={
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600 hover:bg-red-50"
                            disabled={deleteMutation.isPending}
                            data-testid="button-delete-agenda-item"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        }
                        title="Delete Agenda Item"
                        description={`Are you sure you want to delete the agenda item "${item.title}"? This action cannot be undone.`}
                        confirmText="Delete Item"
                        cancelText="Cancel"
                        onConfirm={() => deleteMutation.mutate(item.id)}
                        variant="destructive"
                      />
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        )}
      </div>

      {(agendaItems as AgendaItem[]).length === 0 && !isCreating && (
        <Card>
          <CardContent className="text-center py-12">
            <ListTodo className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-base font-medium text-gray-900 mb-2">
              No agenda items yet
            </h3>
            <p className="text-gray-600 mb-4">
              Create the first agenda item to get started
            </p>
            <Button onClick={() => setIsCreating(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create First Item
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
