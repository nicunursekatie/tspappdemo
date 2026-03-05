# Pre-Event Flags System

## Overview

The Pre-Event Flags system provides a lightweight, eye-catching way to mark critical issues that need attention before an event takes place, without cluttering already-busy event cards.

## Features

### Visual Priority Levels
- **🔴 Critical** - Urgent issues requiring immediate attention (red)
- **🟠 Important** - Issues that should be handled soon (orange)
- **🟡 Attention** - Items for awareness (yellow)

### Compact Display
- Shows as a thin banner at the top of event cards
- Only displays when active (unresolved) flags exist
- Minimal space usage - just one line
- Click to expand and see all flags

### Flag Management
- Add multiple flags per event
- Mark flags as resolved (with tracking)
- View resolved flags for history
- Track who created/resolved each flag and when

## Usage

### Adding Flags to Event Cards

**Example 1: Event Request Cards**
```tsx
import { PreEventFlagsBanner } from '@/components/pre-event-flags';

// In your event card component:
<Card>
  {/* Flags banner at the very top */}
  <PreEventFlagsBanner
    flags={event.preEventFlags || []}
    eventId={event.id}
    eventName={event.organizationName}
    compact={true}
    onUpdate={() => refetch()}
  />

  {/* Rest of your event card */}
  <CardHeader>...</CardHeader>
  <CardContent>...</CardContent>
</Card>
```

**Example 2: Full Detail View**
```tsx
// In detailed event views (not compact):
<PreEventFlagsBanner
  flags={event.preEventFlags || []}
  eventId={event.id}
  eventName={event.organizationName}
  compact={false}  // Shows full banner with more details
  onUpdate={() => refetch()}
/>
```

### API Endpoints

#### Add a Flag
```typescript
POST /api/event-requests/:id/flags
{
  "type": "critical" | "important" | "attention",
  "message": "Need to confirm refrigeration availability",
  "createdBy": "user-id",
  "createdByName": "John Smith",
  "dueDate": "2025-12-15T00:00:00Z" // optional
}
```

#### Resolve a Flag
```typescript
PATCH /api/event-requests/:id/flags/:flagId/resolve
{
  "resolvedBy": "user-id",
  "resolvedByName": "Jane Doe"
}
```

#### Delete a Flag
```typescript
DELETE /api/event-requests/:id/flags/:flagId
```

## Database Schema

### Migration
Run: `migrations/0011_add_pre_event_flags.sql`

### Field Structure
```typescript
preEventFlags: Array<{
  id: string;                    // Unique flag ID
  type: 'critical' | 'important' | 'attention';
  message: string;               // What needs attention
  createdAt: string;             // ISO timestamp
  createdBy: string;             // User ID
  createdByName: string;         // Display name
  resolvedAt: string | null;     // When resolved
  resolvedBy: string | null;     // Who resolved it
  resolvedByName: string | null; // Resolver's name
  dueDate: string | null;        // Optional deadline
}>
```

## Best Practices

### When to Use Flags

**✅ Good Use Cases:**
- Missing critical information (refrigeration, parking, allergies)
- Unconfirmed driver/speaker assignments close to event date
- Special requirements that need vendor confirmation
- Permit/permission issues that need resolution
- Weather-dependent outdoor events
- Large events needing extra planning

**❌ Avoid Using For:**
- General notes or reminders (use existing notes fields)
- Historical information
- Things that don't require pre-event action
- Routine planning items

### Flag Priority Guidelines

**Critical (Red) 🔴**
- Event can't proceed without resolution
- Deadline within 2-3 days
- Examples: No driver assigned, missing venue confirmation, safety concerns

**Important (Orange) 🟠**
- Should be handled 1-2 weeks before event
- Significantly impacts event quality
- Examples: Missing speaker, unconfirmed sandwich count, special dietary needs

**Attention (Yellow) 🟡**
- Good to resolve but not blocking
- FYI items that someone should be aware of
- Examples: VIP attendee, media coverage opportunity, unique venue setup

## Visual Examples

### Compact Banner (on event cards)
```
┌────────────────────────────────────────────┐
│ 🔴 Need to confirm refrigeration  (+2)     │ ← Thin red banner
├────────────────────────────────────────────┤
│ Lincoln Elementary                         │
│ 📅 Dec 15, 2025 at 10:00 AM              │
│ 🥪 ~150 sandwiches                        │
│ 🚗 2/2 drivers                            │
└────────────────────────────────────────────┘
```

### Full Banner (detailed views)
```
┌────────────────────────────────────────────┐
│ 🔴 Critical │ Due: Dec 10                  │
│ Need to confirm refrigeration availability  │
│ Added by Sarah Johnson on Dec 1, 2025      │
│                           ✓ Resolve         │
│ View all 3 flags →                         │
└────────────────────────────────────────────┘
```

## Integration Checklist

- [x] Database migration created
- [x] Schema updated with typed field
- [x] Backend API endpoints implemented
- [x] React component created
- [ ] Add to event request cards
- [ ] Add to event detail views
- [ ] Add to driver planning cards
- [ ] Add to event calendar views
- [ ] Add filter: "Events with active flags"
- [ ] Add to event operations dashboard
- [ ] Email notifications for critical flags (optional)

## Future Enhancements

Potential additions based on usage:
- Auto-flag events based on rules (e.g., 7 days out, no driver assigned)
- Email notifications for critical flags
- Dashboard widget showing all events with active flags
- Flag templates for common issues
- Bulk operations (resolve all flags of a certain type)
- Due date reminders
- Flag statistics and reporting
