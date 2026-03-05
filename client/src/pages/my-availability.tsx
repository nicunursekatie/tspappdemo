import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useActivityTracker } from '@/hooks/useActivityTracker';
import { useOnboardingTracker } from '@/hooks/useOnboardingTracker';
import {
  format,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  parseISO,
  addWeeks,
  subWeeks,
  startOfDay,
  endOfDay,
} from 'date-fns';
import {
  Calendar,
  Clock,
  Plus,
  Edit,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

import { useAuth } from '@/hooks/useAuth';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { insertAvailabilitySlotSchema } from '@shared/schema';
import type { AvailabilitySlot } from '@shared/schema';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { DateTimePicker } from '@/components/ui/datetime-picker';
import { LoadingState } from '@/components/ui/loading';

const formSchema = insertAvailabilitySlotSchema.extend({
  startAt: z.string().min(1, 'Start date and time is required'),
  endAt: z.string().min(1, 'End date and time is required'),
});

type FormData = z.infer<typeof formSchema>;

export default function MyAvailability() {
  const { user } = useAuth();
  const { trackView, trackCreate, trackUpdate, trackDelete } = useActivityTracker();
  const { track } = useOnboardingTracker();
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<AvailabilitySlot | null>(null);
  const [isAllDay, setIsAllDay] = useState(false);

  useEffect(() => {
    trackView(
      'Availability',
      'Availability',
      'My Availability',
      'User accessed my availability page'
    );
    track('set_availability');
  }, [trackView]);

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 }); // Monday
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 }); // Sunday
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  // Fetch availability slots
  const { data: slots = [], isLoading } = useQuery<AvailabilitySlot[]>({
    queryKey: ['/api/availability', user?.id],
    enabled: !!user?.id,
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: Omit<FormData, 'userId'>) =>
      apiRequest('POST', '/api/availability', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/availability'] });
      setDialogOpen(false);
      form.reset();
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<FormData> }) =>
      apiRequest('PUT', `/api/availability/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/availability'] });
      setDialogOpen(false);
      setEditingSlot(null);
      form.reset();
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest('DELETE', `/api/availability/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/availability'] });
    },
  });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      userId: user?.id || '',
      startAt: '',
      endAt: '',
      status: 'unavailable',
      notes: '',
    },
  });

  const onSubmit = (data: FormData) => {
    let submitData = { ...data };
    
    // If all-day is selected, adjust times to cover the full day(s)
    if (isAllDay) {
      const startDate = new Date(data.startAt);
      const endDate = new Date(data.endAt);
      
      // Set start to beginning of day (00:00:00)
      submitData.startAt = startOfDay(startDate).toISOString();
      
      // Set end to end of day (23:59:59)
      submitData.endAt = endOfDay(endDate).toISOString();
    }
    
    if (editingSlot) {
      updateMutation.mutate({ id: editingSlot.id, data: submitData });
    } else {
      createMutation.mutate(submitData);
    }
  };

  const handleEdit = (slot: AvailabilitySlot) => {
    setEditingSlot(slot);
    
    // Check if this is an all-day slot (starts at 00:00:00 and ends at 23:59:59)
    const start = parseISO(slot.startAt);
    const end = parseISO(slot.endAt);
    const isAllDaySlot = start.getHours() === 0 && start.getMinutes() === 0 && start.getSeconds() === 0 &&
                         end.getHours() === 23 && end.getMinutes() === 59 && end.getSeconds() === 59;
    
    setIsAllDay(isAllDaySlot);
    form.reset({
      userId: slot.userId,
      startAt: slot.startAt,
      endAt: slot.endAt,
      status: slot.status,
      notes: slot.notes || '',
    });
    setDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    if (
      confirm(
        'Are you sure you want to delete this time off/availability entry?'
      )
    ) {
      deleteMutation.mutate(id);
    }
  };

  const handleAddNew = () => {
    setEditingSlot(null);
    setIsAllDay(false);
    form.reset({
      userId: user?.id || '',
      startAt: '',
      endAt: '',
      status: 'unavailable',
      notes: '',
    });
    setDialogOpen(true);
  };

  const getSlotsForDay = (day: Date) => {
    return slots.filter((slot) => {
      const slotStart = parseISO(slot.startAt);
      const slotEnd = parseISO(slot.endAt);
      return isSameDay(slotStart, day) || isSameDay(slotEnd, day);
    });
  };

  if (isLoading) {
    return <LoadingState text="Loading availability..." size="lg" />;
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      {/* Back Button Header */}

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">
          My Scheduled Availability
        </h1>
        <Button onClick={handleAddNew} data-testid="button-add-availability">
          <Plus className="mr-2 h-4 w-4" />
          Mark Unavailability
        </Button>
      </div>

      {/* Weekly Calendar View */}
      <Card className="p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">
            Week of {format(weekStart, 'MMM dd')} -{' '}
            {format(weekEnd, 'MMM dd, yyyy')}
          </h2>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))}
              data-testid="button-previous-week"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentWeek(new Date())}
              data-testid="button-current-week"
            >
              Today
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))}
              data-testid="button-next-week"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-2">
          {weekDays.map((day) => {
            const daySlots = getSlotsForDay(day);
            const isToday = isSameDay(day, new Date());

            return (
              <div
                key={day.toISOString()}
                className={`border rounded-lg p-3 min-h-[120px] ${
                  isToday ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                }`}
                data-testid={`calendar-day-${format(day, 'yyyy-MM-dd')}`}
              >
                <div className="font-semibold text-sm mb-2 text-gray-900">
                  {format(day, 'EEE')}
                  <div className="text-xs text-gray-500">
                    {format(day, 'MMM dd')}
                  </div>
                </div>
                <div className="space-y-1">
                  {daySlots.map((slot) => {
                    const start = parseISO(slot.startAt);
                    const end = parseISO(slot.endAt);
                    const isAllDaySlot = start.getHours() === 0 && start.getMinutes() === 0 && start.getSeconds() === 0 &&
                                         end.getHours() === 23 && end.getMinutes() === 59 && end.getSeconds() === 59;
                    
                    return (
                      <div
                        key={slot.id}
                        className={`text-xs p-1.5 rounded cursor-pointer ${
                          slot.status === 'unavailable'
                            ? 'bg-orange-100 text-orange-800 font-semibold'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                        onClick={() => handleEdit(slot)}
                        data-testid={`slot-${slot.id}`}
                      >
                        {isAllDaySlot ? (
                          <>
                            <Calendar className="inline h-3 w-3 mr-1" />
                            All Day
                          </>
                        ) : (
                          <>
                            <Clock className="inline h-3 w-3 mr-1" />
                            {format(parseISO(slot.startAt), 'h:mm a')}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Availability Slots List */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          All Scheduled Availability
        </h2>

        {slots.length === 0 ? (
          <div className="text-center py-12" data-testid="empty-state">
            <Calendar className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p className="text-gray-500 mb-4">
              No scheduled unavailability recorded yet
            </p>
            <Button onClick={handleAddNew} data-testid="button-add-first">
              <Plus className="mr-2 h-4 w-4" />
              Indicate Days You Are Unavailable
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {slots.map((slot) => {
              const start = parseISO(slot.startAt);
              const end = parseISO(slot.endAt);
              const isAllDaySlot = start.getHours() === 0 && start.getMinutes() === 0 && start.getSeconds() === 0 &&
                                   end.getHours() === 23 && end.getMinutes() === 59 && end.getSeconds() === 59;
              
              return (
                <div
                  key={slot.id}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                  data-testid={`slot-item-${slot.id}`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Badge
                        className={
                          slot.status === 'unavailable'
                            ? 'bg-orange-100 text-orange-800 border-orange-300 font-semibold'
                            : 'bg-gray-100 text-gray-600 border-gray-300'
                        }
                        data-testid={`badge-status-${slot.id}`}
                      >
                        {slot.status === 'unavailable' ? 'Time Off' : 'Available'}
                      </Badge>
                      <span className="text-sm font-medium text-gray-900">
                        {format(parseISO(slot.startAt), 'MMM dd, yyyy')}
                        {!isSameDay(start, end) && (
                          <> - {format(end, 'MMM dd, yyyy')}</>
                        )}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600">
                      {isAllDaySlot ? (
                        <>
                          <Calendar className="inline h-4 w-4 mr-1" />
                          All Day
                          {!isSameDay(start, end) && (
                            <span className="ml-2 text-xs text-gray-500">
                              (Multiple days)
                            </span>
                          )}
                        </>
                      ) : (
                        <>
                          <Clock className="inline h-4 w-4 mr-1" />
                          {format(parseISO(slot.startAt), 'h:mm a')} -{' '}
                          {format(parseISO(slot.endAt), 'h:mm a')}
                          {slot.endAt !== slot.startAt &&
                            !isSameDay(start, end) && (
                              <span className="ml-1">
                                (ends {format(end, 'MMM dd, yyyy')})
                              </span>
                            )}
                        </>
                      )}
                    </div>
                    {slot.notes && (
                      <p
                        className="text-sm text-gray-500 mt-1"
                        data-testid={`notes-${slot.id}`}
                      >
                        {slot.notes}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(slot)}
                      data-testid={`button-edit-${slot.id}`}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(slot.id)}
                      data-testid={`button-delete-${slot.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingSlot ? 'Edit Time Off' : 'Mark Time Off'}
            </DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* All Day Toggle */}
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <label className="text-sm font-medium text-gray-900">All Day</label>
                  <p className="text-xs text-gray-500">Mark entire day(s) as unavailable</p>
                </div>
                <Switch
                  checked={isAllDay}
                  onCheckedChange={setIsAllDay}
                  data-testid="switch-all-day"
                />
              </div>

              {isAllDay ? (
                <>
                  {/* Date Range for All Day */}
                  <FormField
                    control={form.control}
                    name="startAt"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start Date</FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            value={field.value ? format(new Date(field.value), 'yyyy-MM-dd') : ''}
                            onChange={(e) => {
                              if (e.target.value) {
                                field.onChange(new Date(e.target.value + 'T00:00:00').toISOString());
                              }
                            }}
                            data-testid="input-start-date"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="endAt"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>End Date</FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            value={field.value ? format(new Date(field.value), 'yyyy-MM-dd') : ''}
                            onChange={(e) => {
                              if (e.target.value) {
                                field.onChange(new Date(e.target.value + 'T23:59:59').toISOString());
                              }
                            }}
                            data-testid="input-end-date"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              ) : (
                <>
                  {/* Date & Time Pickers for Specific Times */}
                  <FormField
                    control={form.control}
                    name="startAt"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start Date & Time</FormLabel>
                        <FormControl>
                          <DateTimePicker
                            value={field.value}
                            onChange={field.onChange}
                            placeholder="Select start date and time"
                            data-testid="input-start-datetime"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="endAt"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>End Date & Time</FormLabel>
                        <FormControl>
                          <DateTimePicker
                            value={field.value}
                            onChange={field.onChange}
                            placeholder="Select end date and time"
                            data-testid="input-end-datetime"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel>Status</FormLabel>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600">
                          Unavailable
                        </span>
                        <FormControl>
                          <Switch
                            checked={field.value === 'available'}
                            onCheckedChange={(checked) =>
                              field.onChange(
                                checked ? 'available' : 'unavailable'
                              )
                            }
                            data-testid="switch-status"
                          />
                        </FormControl>
                        <span className="text-sm text-gray-600">Available</span>
                      </div>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Add any notes about this unavailability (e.g., vacation, appointment, etc.)"
                        data-testid="input-notes"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setDialogOpen(false);
                    setEditingSlot(null);
                    form.reset();
                  }}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={
                    createMutation.isPending || updateMutation.isPending
                  }
                  data-testid="button-save"
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? 'Saving...'
                    : 'Save'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
