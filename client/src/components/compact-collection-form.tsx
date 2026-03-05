import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calculator, Plus, HelpCircle, AlertCircle, CheckCircle, Calendar, X } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

// Format a Date as YYYY-MM-DD in local timezone (no timezone math tricks)
function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Calculate the previous Wednesday (or today if it's Wednesday)
function getPreviousWednesday(): string {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = Sunday, 3 = Wednesday

  // Calculate days to go back to Wednesday
  // If today is Wednesday (3), use today
  // Otherwise, go back to the most recent Wednesday
  let daysToSubtract: number;
  if (dayOfWeek === 3) {
    daysToSubtract = 0; // It's Wednesday
  } else if (dayOfWeek > 3) {
    daysToSubtract = dayOfWeek - 3; // Days since last Wednesday
  } else {
    daysToSubtract = dayOfWeek + 4; // Days to go back (Sunday = 4, Monday = 5, Tuesday = 6)
  }

  const previousWednesday = new Date(today);
  previousWednesday.setDate(today.getDate() - daysToSubtract);

  return formatLocalDate(previousWednesday);
}

// Check if a date string is a Wednesday
function isWednesday(dateStr: string): boolean {
  const date = new Date(dateStr + 'T12:00:00'); // Add time to avoid timezone issues
  return date.getDay() === 3;
}

// Format date for display (e.g., "Wed, Nov 27")
function formatDateForDisplay(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00');
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

// LocalStorage key for saving draft data
const DRAFT_STORAGE_KEY = 'tsp-collection-form-draft';

interface DraftFormData {
  date: string;
  location: string;
  groupCollections: Array<{ name: string; count: number; deli?: number; pbj?: number; other?: number }>;
  newGroupName: string;
  newGroupCount: number;
  totalMode: 'simple' | 'detailed';
  simpleTotal: string;
  details: { deli: string; pbj: string; other: string };
  showGroupBreakdown: boolean;
  newGroupDeli: number;
  newGroupPbj: number;
  newGroupOther: number;
  savedAt: number; // timestamp for expiration check
}

interface CompactCollectionFormProps {
  onSuccess?: () => void;
}

// Load saved draft from localStorage
function loadDraftFromStorage(): DraftFormData | null {
  try {
    const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!saved) return null;

    const draft = JSON.parse(saved) as DraftFormData;

    // Check if draft is older than 24 hours - expire it
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;
    if (Date.now() - draft.savedAt > ONE_DAY_MS) {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
      return null;
    }

    return draft;
  } catch {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
    return null;
  }
}

// Check if draft has meaningful data worth saving
function hasMeaningfulData(draft: Partial<DraftFormData>): boolean {
  return !!(
    draft.simpleTotal ||
    (draft.details && (draft.details.deli || draft.details.pbj || draft.details.other)) ||
    (draft.groupCollections && draft.groupCollections.length > 0) ||
    (draft.newGroupName && draft.newGroupName.trim() !== '') ||
    (draft.newGroupCount && draft.newGroupCount > 0)
  );
}

export default function CompactCollectionForm({
  onSuccess,
}: CompactCollectionFormProps) {
  // Load initial state from localStorage if available
  const savedDraft = useRef<DraftFormData | null>(null);
  const [draftRestored, setDraftRestored] = useState(false);

  // Initialize savedDraft on first render only
  if (savedDraft.current === null) {
    savedDraft.current = loadDraftFromStorage();
  }

  // Get today's date in user's local timezone
  const [date, setDate] = useState(() => savedDraft.current?.date || formatLocalDate(new Date()));
  const [location, setLocation] = useState(() => savedDraft.current?.location || '');
  const [groupCollections, setGroupCollections] = useState<
    Array<{ name: string; count: number; deli?: number; pbj?: number; other?: number }>
  >(() => savedDraft.current?.groupCollections || []);
  const [newGroupName, setNewGroupName] = useState(() => savedDraft.current?.newGroupName || '');
  const [newGroupCount, setNewGroupCount] = useState(() => savedDraft.current?.newGroupCount || 0);

  // Dual mode sandwich tracking - ALWAYS VISIBLE
  const [totalMode, setTotalMode] = useState<'simple' | 'detailed'>(() => savedDraft.current?.totalMode || 'simple');
  const [simpleTotal, setSimpleTotal] = useState(() => savedDraft.current?.simpleTotal || '');
  const [details, setDetails] = useState(() => savedDraft.current?.details || {
    deli: '',
    pbj: '',
    other: ''
  });

  // Group breakdown state
  const [showGroupBreakdown, setShowGroupBreakdown] = useState(() => savedDraft.current?.showGroupBreakdown || false);
  const [newGroupDeli, setNewGroupDeli] = useState(() => savedDraft.current?.newGroupDeli || 0);
  const [newGroupPbj, setNewGroupPbj] = useState(() => savedDraft.current?.newGroupPbj || 0);
  const [newGroupOther, setNewGroupOther] = useState(() => savedDraft.current?.newGroupOther || 0);

  // Calculator state for inline calculator popover
  const [activeCalcField, setActiveCalcField] = useState<string | null>(null);
  const [calcDisplay, setCalcDisplay] = useState('');

  // Validation state
  const [groupBreakdownError, setGroupBreakdownError] = useState<string>('');

  // Wednesday date suggestion state
  const [wednesdaySuggestionDismissed, setWednesdaySuggestionDismissed] = useState(false);
  const previousWednesday = getPreviousWednesday();

  const { toast} = useToast();
  const queryClient = useQueryClient();

  const { data: allHosts = [] } = useQuery<any[]>({
    queryKey: ['/api/hosts'],
  });

  // Filter to only show active hosts
  const hosts = allHosts.filter((host: any) => host.status === 'active');

  // Calculate individual total based on active mode
  const getIndividualTotal = () => {
    if (totalMode === 'simple') {
      return parseInt(simpleTotal) || 0;
    } else {
      return Object.values(details).reduce((sum, val) => sum + (parseInt(val) || 0), 0);
    }
  };

  // Check if any detail fields have values
  const hasDetails = Object.values(details).some(v => v && v !== '0');

  // Show Wednesday suggestion when:
  // 1. User is entering individual sandwiches (not just groups)
  // 2. The current date is NOT the previous Wednesday
  // 3. The suggestion hasn't been dismissed
  const showWednesdaySuggestion =
    (simpleTotal !== '' || hasDetails) &&
    date !== previousWednesday &&
    !wednesdaySuggestionDismissed &&
    groupCollections.length === 0; // Only for individual entries without groups

  // Auto-switch to detailed mode if user starts typing in detail fields
  const handleDetailChange = (type: keyof typeof details, value: string) => {
    setDetails(prev => ({ ...prev, [type]: value }));
    if (value && totalMode === 'simple') {
      setTotalMode('detailed');
      setSimpleTotal(''); // Clear simple total when switching
    }
  };

  // Handle simple total change
  const handleSimpleTotalChange = (value: string) => {
    setSimpleTotal(value);
    if (value && totalMode === 'detailed') {
      setTotalMode('simple');
      setDetails({ deli: '', pbj: '', other: '' }); // Clear details
    }
  };

  const submitMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/sandwich-collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to submit');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Collection submitted successfully!' });
      queryClient.invalidateQueries({
        queryKey: ['/api/sandwich-collections'],
      });
      queryClient.invalidateQueries({
        queryKey: ['/api/sandwich-collections/stats'],
      });
      onSuccess?.();
      // Clear saved draft
      clearDraft();
      // Reset form
      setSimpleTotal('');
      setDetails({ deli: '', pbj: '', other: '' });
      setTotalMode('simple');
      setGroupCollections([]);
      setNewGroupName('');
      setNewGroupCount(0);
      setNewGroupDeli(0);
      setNewGroupPbj(0);
      setNewGroupOther(0);
      setShowGroupBreakdown(false);
      setLocation('');
    },
    onError: () => {
      toast({ title: 'Failed to submit collection', variant: 'destructive' });
    },
  });

  const totalSandwiches =
    getIndividualTotal() +
    groupCollections.reduce((sum, group) => sum + group.count, 0);

  // Calculate breakdown sum for groups
  const groupBreakdownSum = newGroupDeli + newGroupPbj + newGroupOther;

  // Validation for group breakdown
  useEffect(() => {
    if (!showGroupBreakdown) {
      setGroupBreakdownError('');
      return;
    }

    const hasAnyValue = newGroupDeli > 0 || newGroupPbj > 0 || newGroupOther > 0;

    if (!hasAnyValue) {
      // Allow empty breakdown (optional)
      setGroupBreakdownError('');
      return;
    }

    // If any value is entered, enforce sum validation
    if (groupBreakdownSum !== newGroupCount) {
      setGroupBreakdownError(`Group type breakdown (${groupBreakdownSum}) must equal group total (${newGroupCount})`);
    } else {
      setGroupBreakdownError('');
    }
  }, [showGroupBreakdown, newGroupDeli, newGroupPbj, newGroupOther, newGroupCount, groupBreakdownSum]);

  // Show toast if draft was restored
  useEffect(() => {
    if (savedDraft.current && hasMeaningfulData(savedDraft.current) && !draftRestored) {
      setDraftRestored(true);
      toast({
        title: 'Draft restored',
        description: 'Your previous unsaved collection data has been restored.',
        duration: 4000,
      });
    }
  }, [draftRestored, toast]);

  // Save to localStorage whenever form data changes
  useEffect(() => {
    const draft: DraftFormData = {
      date,
      location,
      groupCollections,
      newGroupName,
      newGroupCount,
      totalMode,
      simpleTotal,
      details,
      showGroupBreakdown,
      newGroupDeli,
      newGroupPbj,
      newGroupOther,
      savedAt: Date.now(),
    };

    // Only save if there's meaningful data
    if (hasMeaningfulData(draft)) {
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
    }
  }, [
    date,
    location,
    groupCollections,
    newGroupName,
    newGroupCount,
    totalMode,
    simpleTotal,
    details,
    showGroupBreakdown,
    newGroupDeli,
    newGroupPbj,
    newGroupOther,
  ]);

  // Clear localStorage on successful submission
  const clearDraft = useCallback(() => {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
  }, []);

  const addGroup = () => {
    // Prevent adding if there's a validation error
    if (groupBreakdownError) {
      toast({ 
        title: 'Invalid breakdown', 
        description: groupBreakdownError,
        variant: 'destructive' 
      });
      return;
    }

    if (newGroupName && newGroupCount > 0) {
      const newGroup: { name: string; count: number; deli?: number; pbj?: number; other?: number } = {
        name: newGroupName,
        count: Number(newGroupCount),
      };

      // Only include breakdown if provided
      if (showGroupBreakdown && (newGroupDeli > 0 || newGroupPbj > 0 || newGroupOther > 0)) {
        newGroup.deli = newGroupDeli;
        newGroup.pbj = newGroupPbj;
        newGroup.other = newGroupOther;
      }

      setGroupCollections([...groupCollections, newGroup]);
      setNewGroupName('');
      setNewGroupCount(0);
      setNewGroupDeli(0);
      setNewGroupPbj(0);
      setNewGroupOther(0);
      setShowGroupBreakdown(false);
    }
  };

  const handleSubmit = () => {
    if (!location) {
      toast({ title: 'Please select a location', variant: 'destructive' });
      return;
    }

    // Check for pending group entry - auto-add if complete
    let finalGroupCollections = [...groupCollections];

    if (newGroupName.trim() !== '' && newGroupCount > 0) {
      // Check for validation errors in the pending group
      if (groupBreakdownError) {
        toast({
          title: 'Invalid group breakdown',
          description: groupBreakdownError,
          variant: 'destructive',
        });
        return;
      }

      // Auto-add the pending group
      const pendingGroup: { name: string; count: number; deli?: number; pbj?: number; other?: number } = {
        name: newGroupName.trim(),
        count: Number(newGroupCount),
      };

      // Only include breakdown if provided
      if (showGroupBreakdown && (newGroupDeli > 0 || newGroupPbj > 0 || newGroupOther > 0)) {
        pendingGroup.deli = newGroupDeli;
        pendingGroup.pbj = newGroupPbj;
        pendingGroup.other = newGroupOther;
      }

      finalGroupCollections.push(pendingGroup);

      // Show a brief confirmation that we included the pending group
      toast({
        title: 'Group included',
        description: `"${newGroupName}" (${newGroupCount} sandwiches) was automatically added to your submission.`,
        duration: 3000,
      });
    }

    const host = hosts.find((h: any) => h.name === location);
    const submissionData: any = {
      collectionDate: date,
      hostName: location,
      individualSandwiches: getIndividualTotal(),
      submissionMethod: 'standard', // Track that this was submitted via standard form
    };

    // Include individual sandwich type breakdown if provided (detailed mode)
    if (totalMode === 'detailed' && hasDetails) {
      if (details.deli) submissionData.individualDeli = parseInt(details.deli);
      if (details.pbj) submissionData.individualPbj = parseInt(details.pbj);
      if (details.other) submissionData.individualOther = parseInt(details.other);
    }

    // Include ALL groups in the submission (unlimited groups)
    if (finalGroupCollections.length > 0) {
      submissionData.groupCollections = finalGroupCollections;
    }

    submitMutation.mutate(submissionData);
  };

  // Secure math parser to replace eval()
  const safeMathEvaluator = (expression: string): number => {
    // Remove spaces and validate characters
    const cleaned = expression.replace(/\s/g, '');

    // Only allow numbers, operators, and decimal points
    if (!/^[0-9+\-*/.()]*$/.test(cleaned)) {
      throw new Error('Invalid characters');
    }

    // Simple tokenizer
    const tokens: (number | string)[] = [];
    let current = '';

    for (let i = 0; i < cleaned.length; i++) {
      const char = cleaned[i];

      if ('+-*/()'.includes(char)) {
        if (current) {
          const num = parseFloat(current);
          if (isNaN(num)) throw new Error('Invalid number');
          tokens.push(num);
          current = '';
        }
        tokens.push(char);
      } else {
        current += char;
      }
    }

    if (current) {
      const num = parseFloat(current);
      if (isNaN(num)) throw new Error('Invalid number');
      tokens.push(num);
    }

    if (tokens.length === 0) return 0;

    // Evaluate expression with proper order of operations
    const evaluateTokens = (tokens: (number | string)[]): number => {
      // Handle parentheses first
      while (tokens.includes('(')) {
        let openIndex = -1;
        let closeIndex = -1;

        for (let i = 0; i < tokens.length; i++) {
          if (tokens[i] === '(') openIndex = i;
          if (tokens[i] === ')') {
            closeIndex = i;
            break;
          }
        }

        if (openIndex === -1 || closeIndex === -1) {
          throw new Error('Mismatched parentheses');
        }

        const subTokens = tokens.slice(openIndex + 1, closeIndex);
        const result = evaluateTokens(subTokens);
        tokens.splice(openIndex, closeIndex - openIndex + 1, result);
      }

      // Handle multiplication and division
      for (let i = 1; i < tokens.length; i += 2) {
        if (tokens[i] === '*' || tokens[i] === '/') {
          const left = tokens[i - 1] as number;
          const right = tokens[i + 1] as number;
          const operator = tokens[i] as string;

          if (operator === '/' && right === 0) {
            throw new Error('Division by zero');
          }

          const result = operator === '*' ? left * right : left / right;
          tokens.splice(i - 1, 3, result);
          i -= 2;
        }
      }

      // Handle addition and subtraction
      for (let i = 1; i < tokens.length; i += 2) {
        if (tokens[i] === '+' || tokens[i] === '-') {
          const left = tokens[i - 1] as number;
          const right = tokens[i + 1] as number;
          const operator = tokens[i] as string;

          const result = operator === '+' ? left + right : left - right;
          tokens.splice(i - 1, 3, result);
          i -= 2;
        }
      }

      if (tokens.length !== 1 || typeof tokens[0] !== 'number') {
        throw new Error('Invalid expression');
      }

      return tokens[0];
    };

    return evaluateTokens([...tokens]);
  };

  // Calculator functions
  const handleCalcInput = (value: string) => {
    if (value === '=') {
      try {
        const result = safeMathEvaluator(calcDisplay);
        // Round to integer for sandwich counts
        const rounded = Math.round(result);
        setCalcDisplay(rounded.toString());
      } catch {
        setCalcDisplay('Error');
      }
    } else if (value === 'C') {
      setCalcDisplay('');
    } else if (value === '←') {
      setCalcDisplay(calcDisplay.slice(0, -1));
    } else {
      setCalcDisplay(calcDisplay + value);
    }
  };

  // Generic calculator result handler - applies result to the active field
  const useCalcResult = (fieldSetter: (value: any) => void, isString: boolean = true) => {
    if (calcDisplay && !isNaN(Number(calcDisplay))) {
      const value = Math.round(Number(calcDisplay));
      if (isString) {
        fieldSetter(value.toString());
      } else {
        fieldSetter(value);
      }
      setActiveCalcField(null);
      setCalcDisplay('');
    }
  };

  // Open calculator for a specific field
  const openCalculator = (fieldId: string, currentValue: string | number) => {
    setActiveCalcField(fieldId);
    setCalcDisplay(currentValue ? currentValue.toString() : '');
  };

  // Calculator popover component
  const CalculatorPopover = ({
    fieldId,
    onUseResult,
    children
  }: {
    fieldId: string;
    onUseResult: () => void;
    children: React.ReactNode;
  }) => (
    <Popover
      open={activeCalcField === fieldId}
      onOpenChange={(open) => {
        if (!open) {
          setActiveCalcField(null);
          setCalcDisplay('');
        }
      }}
    >
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="start" side="bottom">
        <div className="space-y-2">
          <p className="text-xs text-gray-600">
            Calculate your count (e.g., 150 - 25 = 125)
          </p>

          <input
            type="text"
            value={calcDisplay}
            readOnly
            className="w-full h-9 px-3 border border-gray-200 rounded text-right bg-gray-50 text-sm"
            placeholder="Enter calculation..."
          />

          <div className="grid grid-cols-4 gap-1">
            <button
              type="button"
              className="h-9 border rounded bg-brand-primary text-white text-sm font-semibold hover:bg-brand-primary/90"
              onClick={() => handleCalcInput('C')}
            >
              C
            </button>
            <button
              type="button"
              className="h-9 border rounded bg-brand-primary text-white text-sm font-semibold hover:bg-brand-primary/90"
              onClick={() => handleCalcInput('←')}
            >
              ←
            </button>
            <button
              type="button"
              className="h-9 border rounded bg-white hover:bg-gray-50 text-sm"
              onClick={() => handleCalcInput('/')}
            >
              /
            </button>
            <button
              type="button"
              className="h-9 border rounded bg-white hover:bg-gray-50 text-sm"
              onClick={() => handleCalcInput('*')}
            >
              ×
            </button>

            {['7', '8', '9', '-', '4', '5', '6', '+', '1', '2', '3'].map((btn) => (
              <button
                key={btn}
                type="button"
                className="h-9 border rounded bg-white hover:bg-gray-50 text-sm"
                onClick={() => handleCalcInput(btn)}
              >
                {btn}
              </button>
            ))}
            <button
              type="button"
              className="h-9 border rounded bg-white hover:bg-gray-50 text-sm row-span-2"
              onClick={() => handleCalcInput('=')}
            >
              =
            </button>

            <button
              type="button"
              className="h-9 border rounded bg-white hover:bg-gray-50 text-sm col-span-2"
              onClick={() => handleCalcInput('0')}
            >
              0
            </button>
            <button
              type="button"
              className="h-9 border rounded bg-white hover:bg-gray-50 text-sm"
              onClick={() => handleCalcInput('.')}
            >
              .
            </button>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              className="flex-1 h-9 bg-brand-orange text-white rounded text-sm font-semibold hover:bg-brand-orange/90"
              onClick={onUseResult}
              disabled={!calcDisplay || isNaN(Number(calcDisplay))}
            >
              Use Result
            </button>
            <button
              type="button"
              className="flex-1 h-9 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200"
              onClick={() => {
                setActiveCalcField(null);
                setCalcDisplay('');
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );

  return (
    <TooltipProvider>
      <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-sm">
        {/* Compact header */}
        <div className="bg-gradient-to-r from-brand-primary to-brand-teal text-white text-center py-4 px-4">
          <h1 className="text-xl md:text-lg font-semibold mb-1">
            Submit Collection
          </h1>
          <p className="text-lg md:text-base opacity-90">
            Record a sandwich collection log
          </p>
        </div>

        {/* Compact form sections */}
        <div className="p-3 space-y-3">
          {/* Date and Location - stacked on mobile, side-by-side on larger screens */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-2">
            <div>
              <div className="flex items-center gap-1 mb-1">
                <label className="text-base md:text-sm font-medium text-brand-primary">
                  Date Sandwiches Were Collected
                </label>
                <Tooltip>
                  <TooltipTrigger>
                    <HelpCircle className="h-5 w-5 md:h-4 md:w-4 text-gray-400" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-sm">
                      Enter the date you actually collected the sandwiches, not
                      today's date. We track when you submit the form
                      separately.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <Input
                type="date"
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  // Reset dismissal if user manually changes date
                  setWednesdaySuggestionDismissed(false);
                }}
                className="h-12 md:h-10 text-lg md:text-base"
              />
            </div>
            <div>
              <div className="flex items-center gap-1 mb-1">
                <label className="text-base md:text-sm font-medium text-brand-primary">
                  Location
                </label>
                <Tooltip>
                  <TooltipTrigger>
                    <HelpCircle className="h-5 w-5 md:h-4 md:w-4 text-gray-400" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      Select the location where you collected the sandwiches
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <Select value={location} onValueChange={setLocation}>
                <SelectTrigger className="h-12 md:h-10 text-lg md:text-base">
                  <SelectValue placeholder="Choose location..." />
                </SelectTrigger>
                <SelectContent>
                  {hosts.map((host: any) => (
                    <SelectItem key={host.id} value={host.name}>
                      {host.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Wednesday Date Suggestion Banner */}
          {showWednesdaySuggestion && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-800">
                    Did you collect these sandwiches on {formatDateForDisplay(previousWednesday)}?
                  </p>
                  <p className="text-xs text-blue-700 mt-1">
                    Collections typically happen on Wednesdays. Setting the correct collection date helps keep our records accurate.
                  </p>
                  <div className="flex gap-2 mt-2">
                    <Button
                      type="button"
                      size="sm"
                      className="bg-blue-600 hover:bg-blue-700 text-white h-8 text-xs"
                      onClick={() => {
                        setDate(previousWednesday);
                        setWednesdaySuggestionDismissed(true);
                      }}
                    >
                      <Calendar className="w-3 h-3 mr-1" />
                      Yes, use {formatDateForDisplay(previousWednesday)}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-blue-700 hover:text-blue-800 hover:bg-blue-100 h-8 text-xs"
                      onClick={() => setWednesdaySuggestionDismissed(true)}
                    >
                      No, keep current date
                    </Button>
                  </div>
                </div>
                <button
                  onClick={() => setWednesdaySuggestionDismissed(true)}
                  className="text-blue-400 hover:text-blue-600"
                  aria-label="Dismiss suggestion"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Individual sandwiches - DUAL MODE (always visible) */}
          <div className="bg-gray-50 rounded-lg p-5">
            <div className="flex items-center gap-1 mb-4">
              <h3 className="text-base font-semibold text-brand-primary uppercase tracking-wide">
                Individual Sandwiches
              </h3>
              <Tooltip>
                <TooltipTrigger>
                  <HelpCircle className="h-5 w-5 md:h-4 md:w-4 text-gray-400" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    Please subtract sandwiches made by a group from your total
                    count and report those along with the name of each group in
                    the section below.
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>

            {/* Simple Total Input - Always Visible */}
            <div className={`transition-opacity ${totalMode === 'detailed' ? 'opacity-40 pointer-events-none' : ''}`}>
              <div className="flex items-center justify-center gap-3">
                <div className="relative">
                  <Input
                    type="number"
                    value={simpleTotal}
                    onChange={(e) => handleSimpleTotalChange(e.target.value)}
                    placeholder="0"
                    className={`w-32 h-14 text-2xl font-semibold text-center pr-10 ${totalMode === 'simple' && simpleTotal ? 'border-brand-primary bg-brand-primary/5' : ''}`}
                    disabled={totalMode === 'detailed'}
                  />
                  <CalculatorPopover
                    fieldId="simpleTotal"
                    onUseResult={() => useCalcResult(handleSimpleTotalChange, true)}
                  >
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-brand-primary rounded"
                      onClick={() => openCalculator('simpleTotal', simpleTotal)}
                      disabled={totalMode === 'detailed'}
                    >
                      <Calculator className="h-5 w-5" />
                    </button>
                  </CalculatorPopover>
                </div>
                <span className="text-gray-600 font-medium">total sandwiches</span>
              </div>
            </div>

            {/* OR Divider */}
            <div className="relative text-center my-5">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <span className="relative bg-gray-50 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                or break down by type
              </span>
            </div>

            {/* Detailed Input - Always Visible */}
            <div className={`transition-opacity ${totalMode === 'simple' && !hasDetails ? 'opacity-60' : ''}`}>
              <div className="flex flex-wrap justify-center items-center gap-3">
                {[
                  { key: 'deli' as const, label: 'Deli', color: 'focus:border-green-400' },
                  { key: 'pbj' as const, label: 'PB&J', color: 'focus:border-purple-400' },
                  { key: 'other' as const, label: 'Generic', color: 'focus:border-gray-400' }
                ].map(({ key, label, color }) => (
                  <div key={key} className="flex flex-col items-center">
                    <label className="text-xs text-gray-600 mb-1 font-medium">{label}</label>
                    <div className="relative">
                      <Input
                        type="number"
                        value={details[key]}
                        onChange={(e) => handleDetailChange(key, e.target.value)}
                        placeholder="0"
                        className={`w-24 h-12 text-center pr-8 border rounded-lg ${color} ${totalMode === 'detailed' && details[key] ? 'border-brand-primary bg-brand-primary/5' : ''}`}
                      />
                      <CalculatorPopover
                        fieldId={`detail-${key}`}
                        onUseResult={() => useCalcResult((val: string) => handleDetailChange(key, val), true)}
                      >
                        <button
                          type="button"
                          className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-brand-primary rounded"
                          onClick={() => openCalculator(`detail-${key}`, details[key])}
                        >
                          <Calculator className="h-4 w-4" />
                        </button>
                      </CalculatorPopover>
                    </div>
                  </div>
                ))}
              </div>

              {/* Sum display for detailed mode */}
              {totalMode === 'detailed' && hasDetails && (
                <div className="text-center mt-3">
                  <span className="text-sm font-semibold text-brand-primary">
                    Total: {getIndividualTotal()} sandwiches
                  </span>
                </div>
              )}
            </div>

            {/* Mode indicator */}
            <div className="text-center mt-4">
              <span className="text-xs text-gray-500">
                {totalMode === 'simple'
                  ? hasDetails
                    ? "Start typing in any box above to switch modes"
                    : "Using simple total"
                  : `Using breakdown (${Object.entries(details).filter(([_, v]) => v).length} types)`
                }
              </span>
            </div>
          </div>

          {/* Group collections - redesigned with better flow */}
          <div className="bg-gray-50 rounded p-3">
            <div className="flex items-center gap-1 mb-3">
              <label className="text-base md:text-sm font-medium text-brand-primary">
                Group Collections
              </label>
              <Tooltip>
                <TooltipTrigger>
                  <HelpCircle className="h-5 w-5 md:h-4 md:w-4 text-gray-400" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    If any groups brought sandwiches to your location this week,
                    do not include their # in your individual sandwiches count.
                    Instead log them here, enter the name of each group and the
                    # of sandwiches they brought.
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>

            {/* Add group form - stacked layout */}
            <div className="space-y-2 mb-3">
              <Input
                placeholder="e.g. 'The Weber School'"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                className="h-12 md:h-10 text-lg md:text-base"
              />

              {/* Simple total count input */}
              <div className="relative">
                <Input
                  type="number"
                  placeholder="Enter count (e.g. 25)"
                  value={newGroupCount || ''}
                  onChange={(e) => {
                    const value = parseInt(e.target.value) || 0;
                    setNewGroupCount(value);
                  }}
                  className="h-12 md:h-10 text-lg md:text-base pr-10"
                  disabled={showGroupBreakdown}
                />
                {!showGroupBreakdown && (
                  <CalculatorPopover
                    fieldId="newGroupCount"
                    onUseResult={() => useCalcResult(setNewGroupCount, false)}
                  >
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-brand-primary rounded"
                      onClick={() => openCalculator('newGroupCount', newGroupCount)}
                    >
                      <Calculator className="h-5 w-5" />
                    </button>
                  </CalculatorPopover>
                )}
              </div>

              {/* Toggle for breakdown */}
              <div className="flex items-center gap-2 my-3">
                <Checkbox
                  id="group-breakdown-toggle"
                  checked={showGroupBreakdown}
                  onCheckedChange={(checked) => setShowGroupBreakdown(!!checked)}
                />
                <label
                  htmlFor="group-breakdown-toggle"
                  className="text-sm font-medium text-gray-700 cursor-pointer"
                >
                  Break down by sandwich type
                </label>
              </div>

              {/* Breakdown inputs */}
              <div className={`transition-opacity ${!showGroupBreakdown ? 'opacity-60' : ''}`}>
                {showGroupBreakdown ? (
                // Breakdown inputs when specifying sandwich types
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="text-xs font-medium text-gray-700">Deli</label>
                      <div className="relative">
                        <Input
                          type="number"
                          value={newGroupDeli || ''}
                          onChange={(e) => {
                            const value = parseInt(e.target.value) || 0;
                            setNewGroupDeli(value);
                            // Auto-calculate total
                            setNewGroupCount(value + newGroupPbj + newGroupOther);
                          }}
                          className="h-10 text-base pr-8"
                          placeholder="0"
                        />
                        <CalculatorPopover
                          fieldId="groupDeli"
                          onUseResult={() => useCalcResult((val: number) => {
                            setNewGroupDeli(val);
                            setNewGroupCount(val + newGroupPbj + newGroupOther);
                          }, false)}
                        >
                          <button
                            type="button"
                            className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-brand-primary rounded"
                            onClick={() => openCalculator('groupDeli', newGroupDeli)}
                          >
                            <Calculator className="h-4 w-4" />
                          </button>
                        </CalculatorPopover>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-700">PBJ</label>
                      <div className="relative">
                        <Input
                          type="number"
                          value={newGroupPbj || ''}
                          onChange={(e) => {
                            const value = parseInt(e.target.value) || 0;
                            setNewGroupPbj(value);
                            // Auto-calculate total
                            setNewGroupCount(newGroupDeli + value + newGroupOther);
                          }}
                          className="h-10 text-base pr-8"
                          placeholder="0"
                        />
                        <CalculatorPopover
                          fieldId="groupPbj"
                          onUseResult={() => useCalcResult((val: number) => {
                            setNewGroupPbj(val);
                            setNewGroupCount(newGroupDeli + val + newGroupOther);
                          }, false)}
                        >
                          <button
                            type="button"
                            className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-brand-primary rounded"
                            onClick={() => openCalculator('groupPbj', newGroupPbj)}
                          >
                            <Calculator className="h-4 w-4" />
                          </button>
                        </CalculatorPopover>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-700">Generic</label>
                      <div className="relative">
                        <Input
                          type="number"
                          value={newGroupOther || ''}
                          onChange={(e) => {
                            const value = parseInt(e.target.value) || 0;
                            setNewGroupOther(value);
                            // Auto-calculate total
                            setNewGroupCount(newGroupDeli + newGroupPbj + value);
                          }}
                          className="h-10 text-base pr-8"
                          placeholder="0"
                        />
                        <CalculatorPopover
                          fieldId="groupOther"
                          onUseResult={() => useCalcResult((val: number) => {
                            setNewGroupOther(val);
                            setNewGroupCount(newGroupDeli + newGroupPbj + val);
                          }, false)}
                        >
                          <button
                            type="button"
                            className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-brand-primary rounded"
                            onClick={() => openCalculator('groupOther', newGroupOther)}
                          >
                            <Calculator className="h-4 w-4" />
                          </button>
                        </CalculatorPopover>
                      </div>
                    </div>
                  </div>
                  {(newGroupDeli > 0 || newGroupPbj > 0 || newGroupOther > 0) && (
                    <div className={`text-center text-xs rounded p-2 border-2 ${
                      groupBreakdownError 
                        ? 'bg-red-50 border-red-400 text-red-800' 
                        : 'bg-green-50 border-green-400 text-green-800'
                    }`}>
                      <div className="flex items-center justify-center gap-1">
                        {groupBreakdownError ? (
                          <AlertCircle className="h-3 w-3" />
                        ) : (
                          <CheckCircle className="h-3 w-3" />
                        )}
                        <span className="font-medium">
                          Breakdown Total: <span className="font-bold">{groupBreakdownSum}</span>
                          {newGroupCount > 0 && ` / Expected: ${newGroupCount}`}
                        </span>
                      </div>
                    </div>
                  )}
                  {groupBreakdownError && (
                    <div className="bg-red-50 border border-red-400 rounded-lg p-2">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                        <div className="text-xs text-red-800">
                          <p className="font-medium">{groupBreakdownError}</p>
                          <p className="text-xs mt-1">
                            Please adjust the values so they add up to {newGroupCount}.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </>
                ) : (
                  // Placeholder when not using breakdown - show disabled inputs
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pointer-events-none">
                    <div>
                      <label className="text-xs font-medium text-gray-700">Deli</label>
                      <Input
                        type="number"
                        value=""
                        placeholder="0"
                        disabled
                        className="h-10 text-base"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-700">PBJ</label>
                      <Input
                        type="number"
                        value=""
                        placeholder="0"
                        disabled
                        className="h-10 text-base"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-700">Generic</label>
                      <Input
                        type="number"
                        value=""
                        placeholder="0"
                        disabled
                        className="h-10 text-base"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={addGroup}
                  disabled={!newGroupName || newGroupCount <= 0 || !!groupBreakdownError}
                  className="flex-1 h-12 md:h-10 text-lg md:text-base bg-brand-light-blue hover:bg-brand-primary"
                  data-testid="button-add-group"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add This Group
                </Button>
                {(newGroupName.trim() !== '' || newGroupCount > 0) && (
                  <Button
                    onClick={() => {
                      setNewGroupName('');
                      setNewGroupCount(0);
                      setNewGroupDeli(0);
                      setNewGroupPbj(0);
                      setNewGroupOther(0);
                    }}
                    variant="outline"
                    className="h-12 md:h-10 px-3 md:px-2"
                  >
                    Clear
                  </Button>
                )}
              </div>

              {/* Show warning if there are unsaved entries */}
              {(newGroupName.trim() !== '' || newGroupCount > 0) &&
                (!newGroupName || newGroupCount <= 0) && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-2">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                      <div className="text-sm text-amber-800">
                        <p className="font-medium">
                          Group information incomplete
                        </p>
                        <p className="text-xs mt-1">
                          Please enter both group name and sandwich count before
                          adding.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
            </div>

            {/* Group list - card style with proper hierarchy */}
            {groupCollections.length === 0 ? (
              <p className="text-lg md:text-base text-gray-500 italic text-center py-2">
                No groups added
              </p>
            ) : (
              <div className="space-y-2">
                {groupCollections.map((group, index) => (
                  <div
                    key={index}
                    className="bg-white rounded-lg p-3 border border-gray-200 shadow-sm"
                  >
                    <div className="text-lg md:text-base font-medium text-brand-primary mb-1">
                      {group.name}
                    </div>
                    <div className="text-3xl md:text-2xl font-bold text-gray-800">
                      {group.count}
                    </div>
                    {(group.deli || group.pbj || group.other) && (
                      <div className="text-xs text-gray-600 mt-1">
                        {[
                          group.deli && `Deli: ${group.deli}`,
                          group.pbj && `PBJ: ${group.pbj}`,
                          group.other && `Generic: ${group.other}`
                        ].filter(Boolean).join(' • ')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pending group notice - shows when there's an un-added group that will be auto-included */}
          {newGroupName.trim() !== '' && newGroupCount > 0 && !groupBreakdownError && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium">
                    "{newGroupName}" ({newGroupCount} sandwiches) will be included
                  </p>
                  <p className="text-xs mt-1 text-blue-600">
                    This group will be automatically added when you save. Or click "Add This Group" first if you want to add more groups.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Submit button - compact */}
          <div className="flex items-center gap-2">
            <Button
              onClick={handleSubmit}
              disabled={submitMutation.isPending}
              className="flex-1 h-14 md:h-12 bg-gradient-to-r from-brand-orange to-[#e89b2e] hover:from-[#e89b2e] hover:to-brand-orange text-white font-semibold text-xl md:text-lg"
              data-testid="button-submit-collection"
            >
              {submitMutation.isPending ? 'Saving...' : 'Save My Collection'}
            </Button>
            <Tooltip>
              <TooltipTrigger>
                <HelpCircle className="h-6 w-6 md:h-4 md:w-4 text-gray-400" />
              </TooltipTrigger>
              <TooltipContent>
                <p>
                  Click to save your sandwich count. You can always edit or
                  delete it after saving or add another entry for more
                  sandwiches/more groups.
                </p>
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Total counter moved to bottom */}
          <div className="mt-4 p-3 bg-gray-50 rounded-lg border">
            <div className="flex items-center justify-between">
              <span className="text-lg md:text-base font-medium text-brand-primary">
                Total Sandwiches:
              </span>
              <span className="text-3xl md:text-2xl font-bold text-brand-orange">
                {totalSandwiches}
              </span>
            </div>
          </div>
        </div>

      </div>
    </TooltipProvider>
  );
}
