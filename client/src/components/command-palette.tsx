import { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation } from 'wouter';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  Search,
  LayoutDashboard,
  Calendar,
  Users,
  Car,
  Building2,
  Heart,
  Truck,
  ClipboardList,
  BarChart3,
  Settings,
  MessageCircle,
  Trophy,
  FileText,
  Package,
  MapPin,
  HelpCircle,
  ArrowRight,
} from 'lucide-react';
import { NAV_ITEMS } from '@/nav.config';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Quick navigation shortcuts - press the key after opening command palette
// Routes must match App.tsx - most pages are dashboard sections accessed via /dashboard?section=X
const QUICK_NAV_SHORTCUTS: Record<string, { label: string; href: string; icon: React.ElementType }> = {
  d: { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  e: { label: 'Event Requests', href: '/event-requests', icon: Calendar },
  v: { label: 'Volunteers', href: '/dashboard?section=volunteers', icon: Users },
  r: { label: 'Drivers', href: '/dashboard?section=drivers', icon: Car },
  h: { label: 'Hosts', href: '/dashboard?section=hosts', icon: Building2 },
  p: { label: 'Recipients', href: '/dashboard?section=recipients', icon: Heart },
  t: { label: 'Driver Planning', href: '/driver-planning', icon: Truck },
  m: { label: 'Meetings', href: '/meetings', icon: ClipboardList },
  a: { label: 'Analytics', href: '/dashboard?section=analytics', icon: BarChart3 },
  s: { label: 'Settings', href: '/dashboard?section=admin', icon: Settings },
  c: { label: 'Team Chat', href: '/dashboard?section=chat', icon: MessageCircle },
  k: { label: 'Kudos', href: '/dashboard?section=kudos', icon: Trophy },
  o: { label: 'Cooler Tracking', href: '/cooler-tracking', icon: Package },
  l: { label: 'Event Map', href: '/event-map', icon: MapPin },
};

// Navigation items organized by category
// Routes must match App.tsx - most pages are dashboard sections accessed via /dashboard?section=X
const NAV_CATEGORIES = [
  {
    label: 'Quick Access',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, shortcut: 'D' },
      { label: 'Event Requests', href: '/event-requests', icon: Calendar, shortcut: 'E' },
      { label: 'Driver Planning', href: '/driver-planning', icon: Truck, shortcut: 'T' },
      { label: 'Meetings', href: '/meetings', icon: ClipboardList, shortcut: 'M' },
    ],
  },
  {
    label: 'Directory',
    items: [
      { label: 'Volunteers', href: '/dashboard?section=volunteers', icon: Users, shortcut: 'V' },
      { label: 'Drivers', href: '/dashboard?section=drivers', icon: Car, shortcut: 'R' },
      { label: 'Hosts', href: '/dashboard?section=hosts', icon: Building2, shortcut: 'H' },
      { label: 'Recipients', href: '/dashboard?section=recipients', icon: Heart, shortcut: 'P' },
    ],
  },
  {
    label: 'Communication',
    items: [
      { label: 'Team Chat', href: '/dashboard?section=chat', icon: MessageCircle, shortcut: 'C' },
      { label: 'Kudos', href: '/dashboard?section=kudos', icon: Trophy, shortcut: 'K' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { label: 'Cooler Tracking', href: '/cooler-tracking', icon: Package, shortcut: 'O' },
      { label: 'Event Map', href: '/event-map', icon: MapPin, shortcut: 'L' },
      { label: 'Analytics', href: '/dashboard?section=analytics', icon: BarChart3, shortcut: 'A' },
    ],
  },
  {
    label: 'Admin',
    items: [
      { label: 'Settings', href: '/dashboard?section=admin', icon: Settings, shortcut: 'S' },
      { label: 'Help', href: '/dashboard?section=help', icon: HelpCircle },
    ],
  },
];

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState('');

  // Filter items based on search
  const filteredCategories = useMemo(() => {
    if (!search) return NAV_CATEGORIES;

    const lowerSearch = search.toLowerCase();
    return NAV_CATEGORIES.map((category) => ({
      ...category,
      items: category.items.filter(
        (item) =>
          item.label.toLowerCase().includes(lowerSearch) ||
          item.href.toLowerCase().includes(lowerSearch)
      ),
    })).filter((category) => category.items.length > 0);
  }, [search]);

  // Handle navigation
  const navigateTo = useCallback(
    (href: string) => {
      onOpenChange(false);
      setSearch('');
      setLocation(href);
    },
    [onOpenChange, setLocation]
  );

  // Handle keyboard shortcuts when palette is open
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // If search is empty and user presses a shortcut key, navigate directly
      if (search === '' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const shortcut = QUICK_NAV_SHORTCUTS[e.key.toLowerCase()];
        if (shortcut) {
          e.preventDefault();
          navigateTo(shortcut.href);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, search, navigateTo]);

  // Reset search when closing
  useEffect(() => {
    if (!open) {
      setSearch('');
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 shadow-lg max-w-[550px] z-[10020]">
        <Command className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground">
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <Input
              placeholder="Type to search or press a shortcut key..."
              className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <CommandList className="max-h-[400px] overflow-y-auto">
            <CommandEmpty>No results found.</CommandEmpty>

            {/* Show shortcut hints when search is empty */}
            {search === '' && (
              <div className="px-3 py-2 text-xs text-muted-foreground bg-muted/30">
                <span className="font-medium">Quick shortcuts:</span>{' '}
                <span className="inline-flex gap-1 flex-wrap">
                  {Object.entries(QUICK_NAV_SHORTCUTS).slice(0, 6).map(([key, { label }]) => (
                    <span key={key} className="inline-flex items-center">
                      <kbd className="px-1.5 py-0.5 text-[10px] font-semibold bg-muted rounded border">{key.toUpperCase()}</kbd>
                      <span className="ml-0.5 mr-2">{label}</span>
                    </span>
                  ))}
                </span>
              </div>
            )}

            {filteredCategories.map((category, idx) => (
              <div key={category.label}>
                {idx > 0 && <CommandSeparator />}
                <CommandGroup heading={category.label}>
                  {category.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <CommandItem
                        key={item.href}
                        value={item.label}
                        onSelect={() => navigateTo(item.href)}
                        className="cursor-pointer"
                      >
                        <Icon className="mr-2 h-4 w-4" />
                        <span>{item.label}</span>
                        {item.shortcut && (
                          <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                            {item.shortcut}
                          </kbd>
                        )}
                        <ArrowRight className="ml-2 h-3 w-3 opacity-50" />
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </div>
            ))}
          </CommandList>
          <div className="flex items-center justify-between border-t px-3 py-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <kbd className="px-1.5 py-0.5 text-[10px] font-semibold bg-muted rounded border">↑↓</kbd>
              <span>Navigate</span>
              <kbd className="px-1.5 py-0.5 text-[10px] font-semibold bg-muted rounded border ml-2">↵</kbd>
              <span>Select</span>
              <kbd className="px-1.5 py-0.5 text-[10px] font-semibold bg-muted rounded border ml-2">Esc</kbd>
              <span>Close</span>
            </div>
            <div>
              <kbd className="px-1.5 py-0.5 text-[10px] font-semibold bg-muted rounded border">⌘K</kbd>
              <span className="ml-1">to open</span>
            </div>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

// Global keyboard shortcut hook
export function useCommandPalette() {
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K or Ctrl+K to open command palette
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }

      // Cmd+/ or Ctrl+/ for quick search in event requests (focus search)
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        // Navigate to event requests and trigger search focus
        setLocation('/event-requests');
        // Dispatch custom event to focus search
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('focus-event-search'));
        }, 100);
      }

      // Escape to close
      if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, setLocation]);

  return { open, setOpen };
}

export default CommandPalette;
