# Pre-Event Flags - Integration Example

## Quick Integration into Event Cards

Here's how to add pre-event flags to your existing event cards in just a few lines:

### Before (without flags):
```tsx
<Card className="p-4">
  <div className="flex justify-between">
    <h3>{event.organizationName}</h3>
    <Badge>{event.status}</Badge>
  </div>
  <p>📅 {event.scheduledEventDate}</p>
  <p>🥪 {event.estimatedSandwichCount} sandwiches</p>
</Card>
```

### After (with flags):
```tsx
import { PreEventFlagsBanner } from '@/components/pre-event-flags';

<Card className="p-0 overflow-hidden">
  {/* Add this ONE line at the very top */}
  <PreEventFlagsBanner
    flags={event.preEventFlags || []}
    eventId={event.id}
    eventName={event.organizationName}
    compact={true}
    onUpdate={() => queryClient.invalidateQueries()}
  />

  {/* Rest of your card stays the same */}
  <div className="p-4">
    <div className="flex justify-between">
      <h3>{event.organizationName}</h3>
      <Badge>{event.status}</Badge>
    </div>
    <p>📅 {event.scheduledEventDate}</p>
    <p>🥪 {event.estimatedSandwichCount} sandwiches</p>
  </div>
</Card>
```

### What You Get

**When NO flags exist:**
- Nothing shows (zero impact on your UI)

**When flags exist:**
- Thin colored banner at the top (red/orange/yellow based on priority)
- Shows highest priority flag message
- Shows "+2" badge if there are multiple flags
- Click banner to open full dialog
- Quick "resolve" button

**Visual Result:**
```
┌─────────────────────────────────────┐
│ 🔴 Missing driver assignment  (+1)  │ ← Only shows if flags exist
├─────────────────────────────────────┤
│ Lincoln Elementary        Scheduled │
│ 📅 Dec 15, 2025                    │
│ 🥪 150 sandwiches                  │
└─────────────────────────────────────┘
```

## Adding Flags via UI

Users can add flags by:
1. Clicking the flag banner (if flags exist)
2. Or adding a "Manage Flags" button to your event detail view:

```tsx
import { PreEventFlagsDialog } from '@/components/pre-event-flags';

<Button
  variant="outline"
  size="sm"
  onClick={() => setFlagsDialogOpen(true)}
>
  <Flag className="w-4 h-4 mr-2" />
  Flags {activeFlags.length > 0 && `(${activeFlags.length})`}
</Button>

<PreEventFlagsDialog
  flags={event.preEventFlags || []}
  eventId={event.id}
  eventName={event.organizationName}
  isOpen={flagsDialogOpen}
  onClose={() => setFlagsDialogOpen(false)}
  onUpdate={() => refetch()}
/>
```

## Where to Add This

Recommended locations:
1. ✅ **Event Request cards** - Most important
2. ✅ **Event detail modals** - Use `compact={false}` for full banner
3. ✅ **Driver planning event cards**
4. ✅ **Event calendar views**
5. ✅ **Operations dashboard**
6. ⚠️ **Mobile views** - Use compact mode

## Complete Working Example

```tsx
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PreEventFlagsBanner } from '@/components/pre-event-flags';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export function EventCard({ eventId }: { eventId: number }) {
  const queryClient = useQueryClient();

  // Your existing event query
  const { data: event } = useQuery({
    queryKey: [`/api/event-requests/${eventId}`],
  });

  if (!event) return null;

  return (
    <Card className="overflow-hidden">
      {/* Pre-event flags banner - ONLY ONE LINE TO ADD! */}
      <PreEventFlagsBanner
        flags={event.preEventFlags || []}
        eventId={event.id}
        eventName={event.organizationName}
        compact={true}
        onUpdate={() => queryClient.invalidateQueries()}
      />

      {/* Your existing card content */}
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold">{event.organizationName}</h3>
          <Badge>{event.status}</Badge>
        </div>

        <div className="space-y-1 text-sm text-gray-600">
          <p>📅 {event.scheduledEventDate}</p>
          <p>🥪 {event.estimatedSandwichCount} sandwiches</p>
          <p>🚗 {event.assignedDriverIds?.length || 0}/{event.driversNeeded || 1} drivers</p>
        </div>
      </CardContent>
    </Card>
  );
}
```

## Testing

To test the feature:

1. **Add a test flag via API:**
```bash
curl -X POST http://localhost:5001/api/event-requests/123/flags \
  -H "Content-Type: application/json" \
  -d '{
    "type": "critical",
    "message": "Need to confirm refrigeration availability",
    "createdBy": "test-user",
    "createdByName": "Test User"
  }'
```

2. **Or use the UI:**
   - View an event with the flags banner
   - Click the banner
   - Add a new flag using the dialog

3. **Verify it works:**
   - Red banner should appear at top of card
   - Click banner to see full dialog
   - Mark as resolved to see it disappear
   - Check resolved flags in history

## Performance Notes

- Zero impact when no flags exist (conditional render)
- Flags are stored in JSONB (indexed)
- No extra API calls (flags come with event data)
- Component is lazy-loaded via dialog
