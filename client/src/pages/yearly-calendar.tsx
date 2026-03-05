import React, { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { PageBreadcrumbs } from '@/components/page-breadcrumbs';
import {
  Loader2,
  Plus,
  Calendar,
  CheckCircle2,
  Edit2,
  Trash2,
  Copy,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Upload,
  Filter,
  CalendarDays,
  X,
  Search,
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { MonthlyCalendarGrid } from '@/components/monthly-calendar-grid';
import { PermissionDenied } from '@/components/permission-denied';

interface YearlyCalendarItem {
  id: number;
  month: number; // 1-12
  year: number;
  title: string;
  description: string | null;
  category: string;
  priority: string;
  startDate: string | null; // YYYY-MM-DD for calendar display
  endDate: string | null; // YYYY-MM-DD for calendar display
  createdBy: string;
  createdByName: string;
  assignedTo: string[] | null;
  assignedToNames: string[] | null;
  isRecurring: boolean;
  isCompleted: boolean;
  completedAt: Date | string | null;
  completedBy: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

interface TrackedCalendarItem {
  id: number;
  externalId: string | null;
  category: string;
  title: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  notes: string | null;
  metadata: {
    type?: string;
    districts?: string[];
    academicYear?: string | null;
    originalId?: string;
  };
  createdAt: string;
  updatedAt: string;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const CATEGORY_COLORS: Record<string, string> = {
  preparation: 'bg-blue-100 text-blue-800 border-blue-300',
  'event-rush': 'bg-red-100 text-red-800 border-red-300',
  staffing: 'bg-orange-100 text-orange-800 border-orange-300',
  board: 'bg-purple-100 text-purple-800 border-purple-300',
  seasonal: 'bg-green-100 text-green-800 border-green-300',
  other: 'bg-gray-100 text-gray-800 border-gray-300',
  // Tracked calendar categories
  school_breaks: 'bg-amber-100 text-amber-800 border-amber-300',
  school_markers: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  religious_holidays: 'bg-violet-100 text-violet-800 border-violet-300',
};

const TRACKED_CATEGORY_LABELS: Record<string, string> = {
  school_breaks: 'School Breaks',
  school_markers: 'School Dates',
  religious_holidays: 'Religious Holidays',
};

const PRIORITY_COLORS: Record<string, string> = {
  low: 'text-gray-600',
  medium: 'text-blue-600',
  high: 'text-red-600',
};

// Parse date string safely to avoid timezone boundary issues
// Adding T12:00:00 prevents UTC midnight from shifting the date back a day in local time
function parseDateSafe(dateStr: string): Date {
  // If already has time component, parse directly
  if (dateStr.includes('T')) {
    return new Date(dateStr);
  }
  // Add noon time to avoid UTC midnight timezone shift
  return new Date(`${dateStr}T12:00:00`);
}

// Helper to check if a date range overlaps a month
function dateRangeOverlapsMonth(startDate: string, endDate: string, year: number, month: number): boolean {
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0); // Last day of month
  const rangeStart = parseDateSafe(startDate);
  const rangeEnd = parseDateSafe(endDate);

  // Date range overlaps month if: rangeStart <= monthEnd AND rangeEnd >= monthStart
  return rangeStart <= monthEnd && rangeEnd >= monthStart;
}

// Format date range for display (compact format)
function formatDateRange(startDate: string, endDate: string): string {
  const start = parseDateSafe(startDate);
  const end = parseDateSafe(endDate);
  const month = start.toLocaleDateString('en-US', { month: 'short' });
  
  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    if (start.getDate() === end.getDate()) {
      // Single day
      return `${month} ${start.getDate()}`;
    }
    return `${month} ${start.getDate()}-${end.getDate()}`;
  }
  // Cross-month range
  const startMonth = start.toLocaleDateString('en-US', { month: 'short' });
  const endMonth = end.toLocaleDateString('en-US', { month: 'short' });
  return `${startMonth} ${start.getDate()} - ${endMonth} ${end.getDate()}`;
}

function formatDateRangeWithWeekday(startDate: string, endDate: string): string {
  const start = parseDateSafe(startDate);
  const end = parseDateSafe(endDate);
  const startLabel = start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const endLabel = end.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  if (start.toDateString() === end.toDateString()) {
    return startLabel;
  }
  return `${startLabel} - ${endLabel}`;
}

// Group similar tracked items together (same title, dates within same month or close)
function groupSimilarItems(items: TrackedCalendarItem[]): TrackedCalendarItem[][] {
  const groups: TrackedCalendarItem[][] = [];
  const processed = new Set<number>();
  
  items.forEach(item => {
    if (processed.has(item.id)) return;
    
    const group = [item];
    processed.add(item.id);
    
    // Find similar items (same title, dates within 3 weeks - captures overlapping breaks)
    items.forEach(other => {
      if (processed.has(other.id) || other.id === item.id) return;
      if (other.title !== item.title) return;
      
      const itemStart = parseDateSafe(item.startDate);
      const itemEnd = parseDateSafe(item.endDate);
      const otherStart = parseDateSafe(other.startDate);
      const otherEnd = parseDateSafe(other.endDate);
      
      // Check if dates overlap or are within 3 weeks of each other
      const daysDiff = Math.abs((itemStart.getTime() - otherStart.getTime()) / (1000 * 60 * 60 * 24));
      const overlaps = (itemStart <= otherEnd && itemEnd >= otherStart);
      
      if (overlaps || daysDiff <= 21) {
        group.push(other);
        processed.add(other.id);
      }
    });
    
    // Sort group by start date
    group.sort((a, b) => 
      parseDateSafe(a.startDate).getTime() - parseDateSafe(b.startDate).getTime()
    );
    
    groups.push(group);
  });
  
  return groups;
}

export default function YearlyCalendar() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<YearlyCalendarItem | null>(null);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isImportHolidaysDialogOpen, setIsImportHolidaysDialogOpen] = useState(false);
  const [importJsonText, setImportJsonText] = useState('');
  const [importHolidaysJsonText, setImportHolidaysJsonText] = useState('');
  const [showTrackedItems, setShowTrackedItems] = useState(true);
  const [showReligiousHolidays, setShowReligiousHolidays] = useState(true);
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
  const [expandedMonth, setExpandedMonth] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Form state
  const [formMonth, setFormMonth] = useState<number>(new Date().getMonth() + 1);
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCategory, setFormCategory] = useState<string>('preparation');
  const [formPriority, setFormPriority] = useState<string>('medium');
  const [formStartDate, setFormStartDate] = useState<string>('');
  const [formEndDate, setFormEndDate] = useState<string>('');
  const [formIsRecurring, setFormIsRecurring] = useState(true);
  // Recurrence form state
  const [formRecurrenceType, setFormRecurrenceType] = useState<string>('none');
  const [formDayOfWeek, setFormDayOfWeek] = useState<number>(1); // Monday default
  const [formDayOfMonth, setFormDayOfMonth] = useState<number>(1);
  const [formWeekOfMonth, setFormWeekOfMonth] = useState<number>(1);
  const [formRecurrenceEndDate, setFormRecurrenceEndDate] = useState<string>('');

  // Permission checks - use YEARLY_CALENDAR permissions
  const userPermissions = Array.isArray(user?.permissions) ? user.permissions : [];
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const canView = userPermissions.includes('YEARLY_CALENDAR_VIEW') || isAdmin;
  // canAdd: new granular permission or legacy YEARLY_CALENDAR_EDIT
  const canAdd = userPermissions.includes('YEARLY_CALENDAR_ADD') || userPermissions.includes('YEARLY_CALENDAR_EDIT') || isAdmin;

  // Granular edit permissions
  const canEditOwn = userPermissions.includes('YEARLY_CALENDAR_EDIT_OWN') || userPermissions.includes('YEARLY_CALENDAR_EDIT') || isAdmin;
  const canEditAll = userPermissions.includes('YEARLY_CALENDAR_EDIT_ALL') || isAdmin;

  // Granular delete permissions
  const canDeleteOwn = userPermissions.includes('YEARLY_CALENDAR_DELETE_OWN') || userPermissions.includes('YEARLY_CALENDAR_EDIT') || isAdmin;
  const canDeleteAll = userPermissions.includes('YEARLY_CALENDAR_DELETE_ALL') || isAdmin;

  // Check if user can edit a specific item (own items or has EDIT_ALL permission)
  const canEditItem = (item: YearlyCalendarItem) => {
    if (isAdmin) return true;
    if (canEditAll) return true;
    // Compare as strings to handle both string and number types
    const isOwner = String(item.createdBy) === String(user?.id);
    if (isOwner && canEditOwn) return true;
    return false;
  };

  // Check if user can delete a specific item (own items or has DELETE_ALL permission)
  const canDeleteItem = (item: YearlyCalendarItem) => {
    if (isAdmin) return true;
    if (canDeleteAll) return true;
    // Compare as strings to handle both string and number types
    const isOwner = String(item.createdBy) === String(user?.id);
    if (isOwner && canDeleteOwn) return true;
    return false;
  };

  // Fetch calendar items for selected year
  const { data: items = [], isLoading } = useQuery<YearlyCalendarItem[]>({
    queryKey: ['/api/yearly-calendar', selectedYear],
    queryFn: async () => {
      return await apiRequest('GET', `/api/yearly-calendar?year=${selectedYear}`);
    },
    enabled: canView,
  });

  // Fetch tracked calendar items (school breaks, etc.)
  const { data: trackedItemsResponse, isLoading: isLoadingTracked } = useQuery<{ items: TrackedCalendarItem[] }>({
    queryKey: ['/api/tracked-calendar', selectedYear],
    queryFn: async () => {
      return await apiRequest('GET', `/api/tracked-calendar?year=${selectedYear}`);
    },
    enabled: canView,
  });
  const trackedItems = trackedItemsResponse?.items || [];

  // Deduplicate items - handles both duplicate IDs and duplicate content
  const deduplicatedItems = useMemo(() => {
    const seenIds = new Set<number>();
    const seenContent = new Set<string>();

    return items.filter(item => {
      // First, filter by ID
      if (seenIds.has(item.id)) {
        return false;
      }
      seenIds.add(item.id);

      // Then, filter by content (keep only the first occurrence of matching title+month+year)
      const contentKey = `${item.month}-${item.year}-${item.title.toLowerCase().trim()}`;
      if (seenContent.has(contentKey)) {
        console.warn('Duplicate yearly calendar item detected:', item.title, 'in month', item.month);
        return false;
      }
      seenContent.add(contentKey);

      return true;
    });
  }, [items]);

  // Filter items based on search query
  const filteredYearlyItems = useMemo(() => {
    if (!searchQuery.trim()) return deduplicatedItems;
    const query = searchQuery.toLowerCase();
    return deduplicatedItems.filter(item =>
      item.title.toLowerCase().includes(query) ||
      (item.description && item.description.toLowerCase().includes(query)) ||
      item.category.toLowerCase().includes(query)
    );
  }, [deduplicatedItems, searchQuery]);

  // Filter tracked items based on search query and toggle states
  const filteredTrackedItems = useMemo(() => {
    // First filter by toggle states
    let filtered = trackedItems.filter(item => {
      if (item.category === 'religious_holidays') return showReligiousHolidays;
      // school_breaks and school_markers follow the showTrackedItems toggle
      return showTrackedItems;
    });

    if (!searchQuery.trim()) return filtered;
    const query = searchQuery.toLowerCase();
    return filtered.filter(item => {
      // Search in title
      if (item.title.toLowerCase().includes(query)) return true;
      // Search in notes
      if (item.notes && item.notes.toLowerCase().includes(query)) return true;
      // Search in category
      if (item.category.toLowerCase().includes(query)) return true;
      // Search in districts
      if (item.metadata?.districts) {
        if (item.metadata.districts.some((d: string) => d.toLowerCase().includes(query))) return true;
      }
      // Search for common break types
      const breakTypes = ['spring', 'winter', 'fall', 'summer', 'thanksgiving', 'christmas', 'mlk', 'presidents', 'memorial', 'labor'];
      if (breakTypes.some(bt => bt.includes(query) && item.title.toLowerCase().includes(bt))) return true;
      // Search for religious holiday terms
      const holidayTerms = ['easter', 'passover', 'hanukkah', 'chanukah', 'rosh', 'yom kippur', 'sukkot', 'shavuot', 'purim', 'lent', 'ash wednesday', 'good friday', 'palm sunday', 'christmas', 'jewish', 'christian'];
      if (holidayTerms.some(ht => ht.includes(query) && (item.title.toLowerCase().includes(ht) || (item.metadata as any)?.tradition?.toLowerCase().includes(ht)))) return true;
      return false;
    });
  }, [trackedItems, searchQuery, showTrackedItems, showReligiousHolidays]);

  // Group items by month and sort them (uses filtered items)
  const itemsByMonth = useMemo(() => {
    const grouped: Record<number, YearlyCalendarItem[]> = {};
    for (let i = 1; i <= 12; i++) {
      grouped[i] = [];
    }
    filteredYearlyItems.forEach(item => {
      if (!grouped[item.month]) {
        grouped[item.month] = [];
      }
      grouped[item.month].push(item);
    });
    // Sort items within each month: incomplete first, then by priority (high -> medium -> low), then by creation date
    Object.keys(grouped).forEach(month => {
      const monthNum = parseInt(month);
      grouped[monthNum].sort((a, b) => {
        // Incomplete items first
        if (a.isCompleted !== b.isCompleted) {
          return a.isCompleted ? 1 : -1;
        }
        // Then by priority
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        const priorityDiff = (priorityOrder[b.priority as keyof typeof priorityOrder] || 2) -
                            (priorityOrder[a.priority as keyof typeof priorityOrder] || 2);
        if (priorityDiff !== 0) return priorityDiff;
        // Finally by creation date (newest first)
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    });
    return grouped;
  }, [filteredYearlyItems]);

  // Group tracked items by month using date range overlap (uses filtered items)
  const trackedItemsByMonth = useMemo(() => {
    const grouped: Record<number, Record<string, TrackedCalendarItem[]>> = {};
    for (let i = 1; i <= 12; i++) {
      grouped[i] = {};
    }

    filteredTrackedItems.forEach(item => {
      for (let month = 1; month <= 12; month++) {
        if (dateRangeOverlapsMonth(item.startDate, item.endDate, selectedYear, month)) {
          if (!grouped[month][item.category]) {
            grouped[month][item.category] = [];
          }
          grouped[month][item.category].push(item);
        }
      }
    });

    // Sort items within each category by start date
    Object.keys(grouped).forEach(month => {
      const monthNum = parseInt(month);
      Object.keys(grouped[monthNum]).forEach(category => {
        grouped[monthNum][category].sort((a, b) =>
          new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
        );
      });
    });

    return grouped;
  }, [filteredTrackedItems, selectedYear]);

  // Toggle category collapse
  const toggleCategory = (category: string) => {
    setCollapsedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  // Create item mutation
  const createItemMutation = useMutation({
    mutationFn: async (data: {
      month: number;
      year: number;
      title: string;
      description: string | null;
      category: string;
      priority: string;
      startDate: string | null;
      endDate: string | null;
      isRecurring: boolean;
    }) => {
      return await apiRequest('POST', '/api/yearly-calendar', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/yearly-calendar'] });
      setIsCreateDialogOpen(false);
      setFormTitle('');
      setFormDescription('');
      setFormCategory('preparation');
      setFormPriority('medium');
      setFormStartDate('');
      setFormEndDate('');
      setFormIsRecurring(true);
      toast({
        title: 'Calendar item created',
        description: 'Your calendar item has been added',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to create calendar item',
        variant: 'destructive',
      });
    },
  });

  // Update item mutation
  const updateItemMutation = useMutation({
    mutationFn: async ({ id, ...data }: Partial<YearlyCalendarItem> & { id: number }) => {
      return await apiRequest('PATCH', `/api/yearly-calendar/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/yearly-calendar'] });
      setIsEditDialogOpen(false);
      setEditingItem(null);
      toast({
        title: 'Calendar item updated',
        description: 'Your calendar item has been updated',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to update calendar item',
        variant: 'destructive',
      });
    },
  });

  // Delete item mutation
  const deleteItemMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest('DELETE', `/api/yearly-calendar/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/yearly-calendar'] });
      toast({
        title: 'Calendar item deleted',
        description: 'Your calendar item has been deleted',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to delete calendar item',
        variant: 'destructive',
      });
    },
  });

  // Copy to next year mutation
  const copyToNextYearMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest('POST', `/api/yearly-calendar/${id}/copy-to-next-year`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/yearly-calendar'] });
      toast({
        title: 'Item copied',
        description: 'Calendar item has been copied to next year',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to copy calendar item',
        variant: 'destructive',
      });
    },
  });

  // Import school breaks mutation
  const importSchoolBreaksMutation = useMutation({
    mutationFn: async (data: any[]) => {
      return await apiRequest('POST', '/api/tracked-calendar/import-school-breaks', data);
    },
    onSuccess: (result: { created: number; updated: number; errors: string[] }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/tracked-calendar'] });
      setIsImportDialogOpen(false);
      setImportJsonText('');
      toast({
        title: 'School breaks imported',
        description: `Created: ${result.created}, Updated: ${result.updated}${result.errors.length > 0 ? `, Errors: ${result.errors.length}` : ''}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Import failed',
        description: error?.message || 'Failed to import school breaks',
        variant: 'destructive',
      });
    },
  });

  // Import religious holidays mutation
  const importReligiousHolidaysMutation = useMutation({
    mutationFn: async (data: any[]) => {
      return await apiRequest('POST', '/api/tracked-calendar/import-religious-holidays', data);
    },
    onSuccess: (result: { created: number; updated: number; errors: string[] }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/tracked-calendar'] });
      setIsImportHolidaysDialogOpen(false);
      setImportHolidaysJsonText('');
      toast({
        title: 'Religious holidays imported',
        description: `Created: ${result.created}, Updated: ${result.updated}${result.errors.length > 0 ? `, Errors: ${result.errors.length}` : ''}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Import failed',
        description: error?.message || 'Failed to import religious holidays',
        variant: 'destructive',
      });
    },
  });

  const handleImportReligiousHolidays = () => {
    try {
      const data = JSON.parse(importHolidaysJsonText);
      if (!Array.isArray(data)) {
        toast({
          title: 'Invalid format',
          description: 'JSON must be an array of religious holiday objects',
          variant: 'destructive',
        });
        return;
      }
      importReligiousHolidaysMutation.mutate(data);
    } catch (e) {
      toast({
        title: 'Invalid JSON',
        description: 'Please check your JSON format',
        variant: 'destructive',
      });
    }
  };

  const handleImportSchoolBreaks = () => {
    try {
      const data = JSON.parse(importJsonText);
      if (!Array.isArray(data)) {
        toast({
          title: 'Invalid format',
          description: 'JSON must be an array of school break objects',
          variant: 'destructive',
        });
        return;
      }
      importSchoolBreaksMutation.mutate(data);
    } catch (e) {
      toast({
        title: 'Invalid JSON',
        description: 'Please check your JSON format',
        variant: 'destructive',
      });
    }
  };

  const handleCreate = () => {
    if (!formTitle.trim()) {
      toast({
        title: 'Error',
        description: 'Title is required',
        variant: 'destructive',
      });
      return;
    }

    // Build recurrence pattern based on type
    let recurrencePattern = null;
    if (formRecurrenceType === 'weekly') {
      recurrencePattern = { dayOfWeek: formDayOfWeek };
    } else if (formRecurrenceType === 'monthly') {
      recurrencePattern = { dayOfMonth: formDayOfMonth };
    }

    createItemMutation.mutate({
      month: formMonth,
      year: selectedYear,
      title: formTitle.trim(),
      description: formDescription.trim() || null,
      category: formCategory,
      priority: formPriority,
      startDate: formStartDate || null,
      endDate: formEndDate || formStartDate || null, // If no end date, use start date
      isRecurring: formIsRecurring,
      recurrenceType: formRecurrenceType,
      recurrencePattern,
      recurrenceEndDate: formRecurrenceEndDate || null,
    });
  };

  const handleEdit = (item: YearlyCalendarItem) => {
    setEditingItem(item);
    setFormMonth(item.month);
    setFormTitle(item.title);
    setFormDescription(item.description || '');
    setFormCategory(item.category);
    setFormPriority(item.priority);
    setFormStartDate(item.startDate || '');
    setFormEndDate(item.endDate || '');
    setFormIsRecurring(item.isRecurring);
    // Load recurrence settings
    setFormRecurrenceType((item as any).recurrenceType || 'none');
    const pattern = (item as any).recurrencePattern as { dayOfWeek?: number; dayOfMonth?: number; weekOfMonth?: number } | null;
    setFormDayOfWeek(pattern?.dayOfWeek ?? 1);
    setFormDayOfMonth(pattern?.dayOfMonth ?? 1);
    setFormWeekOfMonth(pattern?.weekOfMonth ?? 1);
    setFormRecurrenceEndDate((item as any).recurrenceEndDate || '');
    setIsEditDialogOpen(true);
  };

  const handleUpdate = () => {
    if (!editingItem || !formTitle.trim()) {
      toast({
        title: 'Error',
        description: 'Title is required',
        variant: 'destructive',
      });
      return;
    }

    // Build recurrence pattern based on type
    let recurrencePattern = null;
    if (formRecurrenceType === 'weekly') {
      recurrencePattern = { dayOfWeek: formDayOfWeek };
    } else if (formRecurrenceType === 'monthly') {
      recurrencePattern = { dayOfMonth: formDayOfMonth };
    }

    updateItemMutation.mutate({
      id: editingItem.id,
      title: formTitle.trim(),
      description: formDescription.trim() || null,
      category: formCategory,
      priority: formPriority,
      startDate: formStartDate || null,
      endDate: formEndDate || formStartDate || null,
      isRecurring: formIsRecurring,
      recurrenceType: formRecurrenceType,
      recurrencePattern,
      recurrenceEndDate: formRecurrenceEndDate || null,
    });
  };

  const handleToggleComplete = (item: YearlyCalendarItem) => {
    updateItemMutation.mutate({
      id: item.id,
      isCompleted: !item.isCompleted,
    });
  };

  if (!canView) {
    return (
      <div className="container mx-auto p-6">
        <PermissionDenied
          action="view the yearly calendar"
          requiredPermission="CALENDAR_VIEW"
          variant="card"
        />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <PageBreadcrumbs segments={[{ label: 'TSP Yearly Calendar' }]} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Calendar className="h-8 w-8 text-[#236383]" />
            TSP Yearly Calendar
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Plan ahead for recurring activities and events throughout the year
          </p>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search calendar..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-8 w-[220px]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedYear(selectedYear - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-lg font-semibold min-w-[80px] text-center">
              {selectedYear}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedYear(selectedYear + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Button
            variant={showTrackedItems ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowTrackedItems(!showTrackedItems)}
            className={showTrackedItems ? 'bg-amber-500 hover:bg-amber-600' : ''}
          >
            <Filter className="h-4 w-4 mr-2" />
            {showTrackedItems ? 'Hide' : 'Show'} School Breaks
          </Button>
          <Button
            variant={showReligiousHolidays ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowReligiousHolidays(!showReligiousHolidays)}
            className={showReligiousHolidays ? 'bg-violet-500 hover:bg-violet-600' : ''}
          >
            <Filter className="h-4 w-4 mr-2" />
            {showReligiousHolidays ? 'Hide' : 'Show'} Religious Holidays
          </Button>
          {canEditAll && (
            <>
              <Button
                variant="outline"
                onClick={() => setIsImportDialogOpen(true)}
              >
                <Upload className="h-4 w-4 mr-2" />
                Import School Breaks
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsImportHolidaysDialogOpen(true)}
              >
                <Upload className="h-4 w-4 mr-2" />
                Import Religious Holidays
              </Button>
            </>
          )}
          {canAdd && (
            <Button
              onClick={() => {
                // Reset form state for new item
                setFormMonth(new Date().getMonth() + 1);
                setFormTitle('');
                setFormDescription('');
                setFormCategory('preparation');
                setFormPriority('medium');
                setFormStartDate('');
                setFormEndDate('');
                setFormIsRecurring(true);
                setFormRecurrenceType('none');
                setFormDayOfWeek(1);
                setFormDayOfMonth(1);
                setFormWeekOfMonth(1);
                setFormRecurrenceEndDate('');
                setIsCreateDialogOpen(true);
              }}
              className="bg-[#236383] hover:bg-[#007E8C]"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Item
            </Button>
          )}
        </div>
      </div>

      {/* Expanded Monthly View */}
      {expandedMonth !== null && (
        <div className="mb-6">
          <MonthlyCalendarGrid
            year={selectedYear}
            month={expandedMonth}
            trackedItems={filteredTrackedItems}
            yearlyItems={filteredYearlyItems}
            onMonthChange={(year, month) => {
              if (year !== selectedYear) {
                setSelectedYear(year);
              }
              setExpandedMonth(month);
            }}
            onClose={() => setExpandedMonth(null)}
          />
        </div>
      )}

      {/* Search Results Indicator */}
      {searchQuery.trim() && (
        <div className="mb-4 flex items-center gap-2">
          <Badge variant="secondary" className="bg-[#e8f4f8] text-[#236383] border-[#236383]/20">
            <Search className="h-3 w-3 mr-1" />
            Searching: "{searchQuery}"
          </Badge>
          <span className="text-sm text-gray-600">
            Found {filteredYearlyItems.length} calendar item{filteredYearlyItems.length !== 1 ? 's' : ''}
            {(showTrackedItems || showReligiousHolidays) && ` and ${filteredTrackedItems.length} tracked item${filteredTrackedItems.length !== 1 ? 's' : ''}`}
          </span>
          <button
            onClick={() => setSearchQuery('')}
            className="text-sm text-[#236383] hover:underline"
          >
            Clear search
          </button>
        </div>
      )}

      {/* Calendar Grid */}
      {isLoading || isLoadingTracked ? (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-[#236383]" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {MONTH_NAMES.map((monthName, index) => {
            const monthNumber = index + 1;
            const monthItems = itemsByMonth[monthNumber] || [];
            const monthTrackedItems = trackedItemsByMonth[monthNumber] || {};
            const trackedCategories = Object.keys(monthTrackedItems);
            const totalTrackedCount = trackedCategories.reduce((sum, cat) => sum + monthTrackedItems[cat].length, 0);
            const isCurrentMonth = new Date().getMonth() + 1 === monthNumber && new Date().getFullYear() === selectedYear;
            const isPastMonth = selectedYear < new Date().getFullYear() ||
              (selectedYear === new Date().getFullYear() && monthNumber < new Date().getMonth() + 1);
            const isExpanded = expandedMonth === monthNumber;

            return (
              <Card
                key={monthNumber}
                className={`transition-all hover:shadow-md flex flex-col ${
                  isCurrentMonth ? 'ring-2 ring-[#236383]' : ''
                } ${isPastMonth ? 'opacity-75' : ''} ${isExpanded ? 'ring-2 ring-amber-400' : ''}`}
              >
                <CardHeader className="pb-3 flex-shrink-0">
                  <CardTitle className="text-lg flex items-center justify-between">
                    <button
                      onClick={() => setExpandedMonth(isExpanded ? null : monthNumber)}
                      className="flex items-center gap-2 hover:text-[#236383] transition-colors text-left"
                      title="Click to expand monthly calendar view"
                    >
                      <span>{monthName}</span>
                      <CalendarDays className="h-4 w-4 text-gray-400 hover:text-[#236383]" />
                    </button>
                    <div className="flex items-center gap-1">
                      {monthItems.length > 0 && (
                        <Badge variant="secondary" className="ml-2">
                          {monthItems.length}
                        </Badge>
                      )}
                      {totalTrackedCount > 0 && (
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300">
                          {totalTrackedCount}
                        </Badge>
                      )}
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 flex-1 overflow-y-auto max-h-[500px] min-h-[100px]">
                  {monthItems.length === 0 && totalTrackedCount === 0 ? (
                    <p className="text-sm text-gray-400 italic text-center py-4">
                      No items planned
                    </p>
                  ) : (
                    <>
                    {/* Tracked Items (School Breaks, etc.) - Collapsible by category */}
                    {trackedCategories.map(category => {
                      const categoryItems = monthTrackedItems[category];
                      const categoryLabel = TRACKED_CATEGORY_LABELS[category] || category;
                      const isCollapsed = collapsedCategories[`${monthNumber}-${category}`];
                      
                      // Group similar items together
                      const groupedItems = groupSimilarItems(categoryItems);
                      
                      // Create summary for collapsed state
                      const summaryText = groupedItems.length === 1 
                        ? `${categoryItems.length} ${categoryItems[0].title.toLowerCase()}`
                        : `${categoryItems.length} items across ${groupedItems.length} periods`;

                      return (
                        <Collapsible
                          key={`tracked-${monthNumber}-${category}`}
                          open={!isCollapsed}
                          onOpenChange={() => toggleCategory(`${monthNumber}-${category}`)}
                        >
                          <CollapsibleTrigger asChild>
                            <div className={`p-2 rounded-lg border cursor-pointer hover:bg-opacity-80 transition-colors ${CATEGORY_COLORS[category] || CATEGORY_COLORS.other}`}>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <span className="font-medium text-sm">{categoryLabel}</span>
                                  <Badge variant="secondary" className="text-xs flex-shrink-0">
                                    {categoryItems.length}
                                  </Badge>
                                  {isCollapsed && (
                                    <span className="text-xs text-gray-600 dark:text-gray-400 truncate ml-1">
                                      {summaryText}
                                    </span>
                                  )}
                                </div>
                                {isCollapsed ? (
                                  <ChevronDown className="h-4 w-4 flex-shrink-0" />
                                ) : (
                                  <ChevronUp className="h-4 w-4 flex-shrink-0" />
                                )}
                              </div>
                            </div>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="space-y-2 mt-1">
                            {groupedItems.map((group, groupIdx) => {
                              // If group has multiple items, show them grouped
                              if (group.length > 1) {
                                const allDistricts = new Set<string>();
                                group.forEach(item => {
                                  if (item.metadata?.districts) {
                                    item.metadata.districts.forEach((d: string) => allDistricts.add(d));
                                  }
                                });
                                const sortedDistricts = Array.from(allDistricts).sort();
                                
                                return (
                                  <div
                                    key={`group-${groupIdx}`}
                                    className={`p-2.5 rounded border-l-4 bg-white dark:bg-gray-900 ${CATEGORY_COLORS[category] || CATEGORY_COLORS.other}`}
                                  >
                                    <div className="mb-2">
                                      <h4 className="text-sm font-semibold mb-1.5">{group[0].title}</h4>
                                      {sortedDistricts.length > 0 && (
                                        <div className="flex flex-wrap gap-1">
                                          {sortedDistricts.map(district => (
                                            <Badge 
                                              key={district} 
                                              variant="outline" 
                                              className="text-xs px-1.5 py-0 bg-white dark:bg-gray-800"
                                            >
                                              {district}
                                            </Badge>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                    <div className="space-y-2">
                                      {group.map(item => {
                                        const itemDistricts = item.metadata?.districts || [];
                                        return (
                                          <div 
                                            key={`tracked-${item.id}`} 
                                            className="flex items-start gap-2 p-1.5 rounded bg-gray-50 dark:bg-gray-800/50"
                                          >
                                            <Badge 
                                              variant="outline" 
                                              className="text-xs font-semibold px-2 py-0.5 bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 flex-shrink-0"
                                            >
                                              {formatDateRange(item.startDate, item.endDate)}
                                            </Badge>
                                            <div className="flex-1 min-w-0">
                                              {itemDistricts.length > 0 && (
                                                <div className="flex flex-wrap gap-1 mb-1">
                                                  {itemDistricts.map(district => (
                                                    <Badge 
                                                      key={district} 
                                                      variant="outline" 
                                                      className="text-xs px-1.5 py-0 bg-white dark:bg-gray-800"
                                                    >
                                                      {district}
                                                    </Badge>
                                                  ))}
                                                </div>
                                              )}
                                              {item.notes && (
                                                <p className="text-xs text-gray-600 dark:text-gray-400 italic">
                                                  {item.notes}
                                                </p>
                                              )}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              }
                              
                              // Single item - show compactly
                              const item = group[0];
                              const districts = item.metadata?.districts || [];
                              const tradition = (item.metadata as any)?.tradition as string | undefined;

                              return (
                                <div
                                  key={`tracked-${item.id}`}
                                  className={`p-2.5 rounded border-l-4 bg-white dark:bg-gray-900 ${CATEGORY_COLORS[category] || CATEGORY_COLORS.other}`}
                                >
                                  <div className="flex items-start gap-2 mb-2">
                                    <Badge
                                      variant="outline"
                                      className="text-xs font-semibold px-2 py-1 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 flex-shrink-0"
                                    >
                                      {formatDateRange(item.startDate, item.endDate)}
                                    </Badge>
                                    <div className="flex-1 min-w-0">
                                      <h4 className="text-sm font-semibold mb-1">{item.title}</h4>
                                      {districts.length > 0 && (
                                        <div className="flex flex-wrap gap-1">
                                          {districts.map(district => (
                                            <Badge
                                              key={district}
                                              variant="outline"
                                              className="text-xs px-1.5 py-0 bg-white dark:bg-gray-800"
                                            >
                                              {district}
                                            </Badge>
                                          ))}
                                        </div>
                                      )}
                                      {tradition && (
                                        <Badge
                                          variant="outline"
                                          className="text-xs px-1.5 py-0 bg-violet-50 text-violet-700 border-violet-300"
                                        >
                                          {tradition}
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                  {item.notes && (
                                    <p className="text-xs text-gray-600 dark:text-gray-400 italic border-t border-gray-200 dark:border-gray-700 pt-1.5 mt-1.5">
                                      {item.notes}
                                    </p>
                                  )}
                                </div>
                              );
                            })}
                          </CollapsibleContent>
                        </Collapsible>
                      );
                    })}

                    {/* Regular Calendar Items */}
                    {monthItems.map((item) => (
                      <div
                        key={item.id}
                        className={`p-3 rounded-lg border ${
                          item.isCompleted ? 'opacity-60 bg-gray-50 dark:bg-gray-800' : 'bg-white dark:bg-gray-900'
                        } ${CATEGORY_COLORS[item.category] || CATEGORY_COLORS.other}`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              {item.isCompleted && (
                                <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                              )}
                              <h4 className={`text-sm font-semibold ${item.isCompleted ? 'line-through' : ''}`}>
                                {item.title}
                              </h4>
                            </div>
                            {item.startDate && (
                              <div className="flex items-center gap-1.5 mb-1.5">
                                <CalendarDays className="h-4 w-4 text-[#236383]" />
                                <span className="text-sm font-semibold text-[#236383]">
                                  {formatDateRangeWithWeekday(item.startDate, item.endDate || item.startDate)}
                                </span>
                              </div>
                            )}
                            {item.description && (
                              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                                {item.description}
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                              <Badge variant="outline" className="text-xs">
                                {item.category}
                              </Badge>
                              <span className={`text-xs font-medium ${PRIORITY_COLORS[item.priority] || PRIORITY_COLORS.medium}`}>
                                {item.priority}
                              </span>
                              {item.isRecurring && (
                                <Badge variant="outline" className="text-xs">
                                  Recurring
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        {(() => {
                          const itemCanEdit = canEditItem(item);
                          const itemCanDelete = canDeleteItem(item);
                          const showActions = itemCanEdit || itemCanDelete;

                          return showActions && (
                            <div className="flex items-center gap-1 mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                              {itemCanEdit && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 px-2 text-xs"
                                    onClick={() => handleToggleComplete(item)}
                                  >
                                    {item.isCompleted ? 'Undo' : 'Complete'}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 px-2 text-xs"
                                    onClick={() => handleEdit(item)}
                                  >
                                    <Edit2 className="h-3 w-3" />
                                  </Button>
                                </>
                              )}
                              {itemCanDelete && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2 text-xs text-red-600 hover:bg-red-50"
                                  onClick={() => {
                                    if (window.confirm('Are you sure you want to delete this item?')) {
                                      deleteItemMutation.mutate(item.id);
                                    }
                                  }}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              )}
                              {itemCanEdit && item.isRecurring && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2 text-xs"
                                  onClick={() => copyToNextYearMutation.mutate(item.id)}
                                  title="Copy to next year"
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    ))}
                    </>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add Calendar Item</DialogTitle>
            <DialogDescription>
              Add a planning item for {MONTH_NAMES[formMonth - 1]} {selectedYear}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="create-month">Month</Label>
              <Select value={String(formMonth)} onValueChange={(v) => setFormMonth(parseInt(v))}>
                <SelectTrigger id="create-month">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTH_NAMES.map((name, index) => (
                    <SelectItem key={index + 1} value={String(index + 1)}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-title">Title *</Label>
              <Input
                id="create-title"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="e.g., Team meeting to review DHL & alloy materials"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-description">Description</Label>
              <Textarea
                id="create-description"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Optional details..."
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="create-category">Category</Label>
                <Select value={formCategory} onValueChange={setFormCategory}>
                  <SelectTrigger id="create-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="preparation">Preparation</SelectItem>
                    <SelectItem value="event-rush">Event Rush Preparation</SelectItem>
                    <SelectItem value="event">Event</SelectItem>
                    <SelectItem value="planning">Planning</SelectItem>
                    <SelectItem value="staffing">Staffing</SelectItem>
                    <SelectItem value="board">Board/Governance</SelectItem>
                    <SelectItem value="seasonal">Seasonal Planning</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-priority">Priority</Label>
                <Select value={formPriority} onValueChange={setFormPriority}>
                  <SelectTrigger id="create-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="create-start-date">Start Date (optional)</Label>
                <Input
                  id="create-start-date"
                  type="date"
                  value={formStartDate}
                  onChange={(e) => setFormStartDate(e.target.value)}
                />
                <p className="text-xs text-gray-500">For calendar grid display</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-end-date">End Date (optional)</Label>
                <Input
                  id="create-end-date"
                  type="date"
                  value={formEndDate}
                  onChange={(e) => setFormEndDate(e.target.value)}
                  min={formStartDate}
                />
                <p className="text-xs text-gray-500">Leave blank for single day</p>
              </div>
            </div>
            {/* Recurrence Options */}
            <div className="space-y-3 border rounded-lg p-3 bg-gray-50">
              <Label className="text-sm font-medium">Recurrence</Label>
              <Select value={formRecurrenceType} onValueChange={setFormRecurrenceType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select recurrence type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No recurrence (one-time)</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>

              {formRecurrenceType === 'weekly' && (
                <div className="space-y-2">
                  <Label className="text-sm">Repeat every</Label>
                  <Select value={String(formDayOfWeek)} onValueChange={(v) => setFormDayOfWeek(parseInt(v))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Sunday</SelectItem>
                      <SelectItem value="1">Monday</SelectItem>
                      <SelectItem value="2">Tuesday</SelectItem>
                      <SelectItem value="3">Wednesday</SelectItem>
                      <SelectItem value="4">Thursday</SelectItem>
                      <SelectItem value="5">Friday</SelectItem>
                      <SelectItem value="6">Saturday</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {formRecurrenceType === 'monthly' && (
                <div className="space-y-2">
                  <Label className="text-sm">Repeat on day</Label>
                  <Select value={String(formDayOfMonth)} onValueChange={(v) => setFormDayOfMonth(parseInt(v))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                        <SelectItem key={day} value={String(day)}>
                          {day}{day === 1 ? 'st' : day === 2 ? 'nd' : day === 3 ? 'rd' : 'th'} of each month
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {formRecurrenceType !== 'none' && (
                <div className="space-y-2">
                  <Label className="text-sm">End date (optional)</Label>
                  <Input
                    type="date"
                    value={formRecurrenceEndDate}
                    onChange={(e) => setFormRecurrenceEndDate(e.target.value)}
                    min={formStartDate || undefined}
                  />
                  <p className="text-xs text-gray-500">Leave blank to recur indefinitely</p>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={createItemMutation.isPending || !formTitle.trim()}
              className="bg-[#236383] hover:bg-[#007E8C]"
            >
              {createItemMutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating...</>
              ) : (
                <>Create</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Calendar Item</DialogTitle>
            <DialogDescription>
              Update calendar item details
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-month">Month</Label>
              <Select value={String(formMonth)} onValueChange={(v) => setFormMonth(parseInt(v))}>
                <SelectTrigger id="edit-month">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTH_NAMES.map((name, index) => (
                    <SelectItem key={index + 1} value={String(index + 1)}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-title">Title *</Label>
              <Input
                id="edit-title"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-category">Category</Label>
                <Select value={formCategory} onValueChange={setFormCategory}>
                  <SelectTrigger id="edit-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="preparation">Preparation</SelectItem>
                    <SelectItem value="event-rush">Event Rush Preparation</SelectItem>
                    <SelectItem value="event">Event</SelectItem>
                    <SelectItem value="planning">Planning</SelectItem>
                    <SelectItem value="staffing">Staffing</SelectItem>
                    <SelectItem value="board">Board/Governance</SelectItem>
                    <SelectItem value="seasonal">Seasonal Planning</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-priority">Priority</Label>
                <Select value={formPriority} onValueChange={setFormPriority}>
                  <SelectTrigger id="edit-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-start-date">Start Date (optional)</Label>
                <Input
                  id="edit-start-date"
                  type="date"
                  value={formStartDate}
                  onChange={(e) => setFormStartDate(e.target.value)}
                />
                <p className="text-xs text-gray-500">For calendar grid display</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-end-date">End Date (optional)</Label>
                <Input
                  id="edit-end-date"
                  type="date"
                  value={formEndDate}
                  onChange={(e) => setFormEndDate(e.target.value)}
                  min={formStartDate}
                />
                <p className="text-xs text-gray-500">Leave blank for single day</p>
              </div>
            </div>
            {/* Recurrence Options */}
            <div className="space-y-3 border rounded-lg p-3 bg-gray-50">
              <Label className="text-sm font-medium">Recurrence</Label>
              <Select value={formRecurrenceType} onValueChange={setFormRecurrenceType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select recurrence type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No recurrence (one-time)</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>

              {formRecurrenceType === 'weekly' && (
                <div className="space-y-2">
                  <Label className="text-sm">Repeat every</Label>
                  <Select value={String(formDayOfWeek)} onValueChange={(v) => setFormDayOfWeek(parseInt(v))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Sunday</SelectItem>
                      <SelectItem value="1">Monday</SelectItem>
                      <SelectItem value="2">Tuesday</SelectItem>
                      <SelectItem value="3">Wednesday</SelectItem>
                      <SelectItem value="4">Thursday</SelectItem>
                      <SelectItem value="5">Friday</SelectItem>
                      <SelectItem value="6">Saturday</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {formRecurrenceType === 'monthly' && (
                <div className="space-y-2">
                  <Label className="text-sm">Repeat on day</Label>
                  <Select value={String(formDayOfMonth)} onValueChange={(v) => setFormDayOfMonth(parseInt(v))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                        <SelectItem key={day} value={String(day)}>
                          {day}{day === 1 ? 'st' : day === 2 ? 'nd' : day === 3 ? 'rd' : 'th'} of each month
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {formRecurrenceType !== 'none' && (
                <div className="space-y-2">
                  <Label className="text-sm">End date (optional)</Label>
                  <Input
                    type="date"
                    value={formRecurrenceEndDate}
                    onChange={(e) => setFormRecurrenceEndDate(e.target.value)}
                    min={formStartDate || undefined}
                  />
                  <p className="text-xs text-gray-500">Leave blank to recur indefinitely</p>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={updateItemMutation.isPending || !formTitle.trim()}
              className="bg-[#236383] hover:bg-[#007E8C]"
            >
              {updateItemMutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Updating...</>
              ) : (
                <>Update</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import School Breaks Dialog */}
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Import School Breaks</DialogTitle>
            <DialogDescription>
              Paste JSON data to import school breaks. Each item should have: id, type, label, startDate, endDate.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="import-json">JSON Data</Label>
              <Textarea
                id="import-json"
                value={importJsonText}
                onChange={(e) => setImportJsonText(e.target.value)}
                placeholder={`[
  {
    "id": "winter-break-2025",
    "type": "school_break",
    "label": "Winter Break",
    "startDate": "2025-12-22",
    "endDate": "2026-01-05",
    "districts": ["All"],
    "academicYear": "2025-2026"
  }
]`}
                rows={12}
                className="font-mono text-sm"
              />
            </div>
            <p className="text-xs text-gray-500">
              Items with matching IDs will be updated. New items will be created.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsImportDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleImportSchoolBreaks}
              disabled={importSchoolBreaksMutation.isPending || !importJsonText.trim()}
              className="bg-amber-500 hover:bg-amber-600"
            >
              {importSchoolBreaksMutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Importing...</>
              ) : (
                <><Upload className="h-4 w-4 mr-2" /> Import</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Religious Holidays Dialog */}
      <Dialog open={isImportHolidaysDialogOpen} onOpenChange={setIsImportHolidaysDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Import Religious Holidays</DialogTitle>
            <DialogDescription>
              Paste JSON data to import religious holidays. Each item should have: id, tradition, type, label, startDate, endDate.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="import-holidays-json">JSON Data</Label>
              <Textarea
                id="import-holidays-json"
                value={importHolidaysJsonText}
                onChange={(e) => setImportHolidaysJsonText(e.target.value)}
                placeholder={`[
  {
    "id": "christian-2026-easter",
    "tradition": "Christian",
    "type": "religious_holiday",
    "label": "Easter Sunday",
    "startDate": "2026-04-05",
    "endDate": "2026-04-05",
    "notes": "Major Christian holiday."
  }
]`}
                rows={12}
                className="font-mono text-sm"
              />
            </div>
            <p className="text-xs text-gray-500">
              Items with matching IDs will be updated. New items will be created.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsImportHolidaysDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleImportReligiousHolidays}
              disabled={importReligiousHolidaysMutation.isPending || !importHolidaysJsonText.trim()}
              className="bg-violet-500 hover:bg-violet-600"
            >
              {importReligiousHolidaysMutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Importing...</>
              ) : (
                <><Upload className="h-4 w-4 mr-2" /> Import</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
