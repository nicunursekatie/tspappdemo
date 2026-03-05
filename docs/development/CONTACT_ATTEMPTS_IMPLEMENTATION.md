# Contact Attempts Editable Feature - Implementation Guide

## Overview
This feature allows contact attempts to be edited/deleted by the person who created them. Contact attempts are now stored in a structured format with user attribution.

## Database Migration

### Step 1: Run this SQL in your PostgreSQL database

```sql
ALTER TABLE event_requests
ADD COLUMN IF NOT EXISTS contact_attempts_log JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN event_requests.contact_attempts_log IS 'Structured log of all contact attempts with metadata (attemptNumber, timestamp, method, outcome, notes, createdBy, createdByName) for editing/deleting';
```

The migration file is saved at: `migrations/add_contact_attempts_log.sql`

## What's Been Updated

### 1. Schema (`shared/schema.ts`)
- Added `contactAttemptsLog` field to store structured contact attempt data
- Each entry contains: attemptNumber, timestamp, method, outcome, notes, createdBy, createdByName

### 2. LogContactAttemptDialog (`client/src/components/LogContactAttemptDialog.tsx`)
- Now saves contact attempts in BOTH formats:
  - Legacy `unresponsiveNotes` (plain text) for backward compatibility
  - New `contactAttemptsLog` (structured JSONB) with user attribution
- Captures current user info (ID and name) when logging attempts

### 3. EventMessageThread (`client/src/components/event-message-thread.tsx`)
- Displays structured contact attempts from `contactAttemptsLog`
- Shows legacy contact attempts from `unresponsiveNotes` if no structured data exists
- Displays delete button for contact attempts created by the current user
- Added props: `onDeleteContactAttempt` and `onEditContactAttempt` (edit not fully implemented yet)

## What Still Needs to be Done

### 1. Wire up the delete functionality in parent components

You need to pass the `onDeleteContactAttempt` handler to EventMessageThread in:
- `NewRequestCard.tsx`
- `InProcessCard.tsx`
- `ScheduledCard.tsx`
- `ScheduledCardEnhanced.tsx`
- Any other cards using EventMessageThread

Example implementation:

```typescript
const handleDeleteContactAttempt = async (attemptNumber: number) => {
  if (!request.contactAttemptsLog) return;

  // Filter out the attempt to delete
  const updatedLog = request.contactAttemptsLog.filter(
    attempt => attempt.attemptNumber !== attemptNumber
  );

  // Update the event request
  await fetch(`/api/event-requests/${request.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contactAttemptsLog: updatedLog,
    }),
  });

  // Refresh the data
  refetch();
};

// Pass to EventMessageThread
<EventMessageThread
  ...
  onDeleteContactAttempt={handleDeleteContactAttempt}
/>
```

### 2. Update API endpoints

The API endpoints that handle event request updates need to accept the new `contactAttemptsLog` field. Check:
- `/api/event-requests/:id` PATCH endpoint
- Any other endpoints that update contact attempt data

### 3. Optional: Implement Edit Functionality

Currently only delete is implemented. To add edit:
1. Add a state for editing mode in EventMessageThread
2. Show an inline form when edit button is clicked
3. Call `onEditContactAttempt` with updated data
4. Update the specific attempt in the array on the backend

### 4. Optional: Migrate Existing Data

If you want to convert existing `unresponsiveNotes` to the new structured format, you can run a migration script. However, this is optional since the code handles both formats.

## Testing Checklist

- [ ] Run the database migration
- [ ] Log a new contact attempt - verify it shows in the thread
- [ ] Verify only the creator sees delete button
- [ ] Delete a contact attempt you created
- [ ] Verify other users cannot delete your attempts
- [ ] Test with legacy data (old unresponsiveNotes)
- [ ] Verify backward compatibility

## Notes

- The system maintains backward compatibility with old `unresponsiveNotes` data
- New contact attempts will use the structured format
- Legacy contact attempts will display but cannot be edited/deleted
- User attribution is based on the logged-in user when the attempt is created
