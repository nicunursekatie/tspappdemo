# Contact Attempts Migration Guide

## Overview

This guide explains how to complete the migration from the legacy `unresponsiveNotes` format to the new structured `contactAttemptsLog` format.

## What Changed

### Before (Legacy)
- Contact attempts were stored as plain text in `unresponsiveNotes`
- Format: `"[Nov 7, 2025, 4:21 PM] Attempt #2 - Phone: Successfully contacted - Got response..."`
- No user attribution
- No editing/deleting capability
- Difficult to parse and display

### After (New)
- Contact attempts are stored as structured JSONB in `contactAttemptsLog`
- Each attempt has: `attemptNumber`, `timestamp`, `method`, `outcome`, `notes`, `createdBy`, `createdByName`
- User attribution for editing/deleting
- Consistent display format
- Better searchability and filtering

## Code Changes

### 1. LogContactAttemptDialog
- ✅ **Updated**: Now only writes to `contactAttemptsLog` (no longer writes to `unresponsiveNotes`)
- ✅ **Interface**: `unresponsiveNotes` is now optional in the `onLogContact` callback

### 2. EventMessageThread
- ✅ **Updated**: Improved legacy parsing to display old attempts in the same structured format
- ✅ **Display**: Legacy attempts are parsed and shown as individual cards (not one large text block)
- ✅ **Badge**: Legacy entries show "Legacy Entry" badge

## Migration Steps

### Step 1: Preview Migration (Optional but Recommended)

Before running the migration, preview what will be migrated:

```bash
# GET request to preview endpoint
GET /api/migrate-contact-attempts/preview
```

This will show:
- How many event requests can be migrated
- Which requests already have structured data
- Which requests have legacy data only

**Example Response:**
```json
{
  "preview": [
    {
      "id": 123,
      "organizationName": "Example Organization",
      "hasUnresponsiveNotes": true,
      "hasContactAttemptsLog": false,
      "unresponsiveNotesLength": 150,
      "canMigrate": true
    }
  ],
  "summary": {
    "total": 100,
    "canMigrate": 45,
    "alreadyMigrated": 50,
    "noData": 5
  }
}
```

### Step 2: Run Migration

Run the migration endpoint to convert legacy data:

```bash
# POST request to migration endpoint
POST /api/migrate-contact-attempts/migrate
```

**Requirements:**
- Must be authenticated
- Must have `EVENT_REQUESTS_EDIT` permission

**What it does:**
1. Fetches all event requests
2. Finds requests with `unresponsiveNotes` but no `contactAttemptsLog`
3. Parses legacy format into structured format
4. Updates the `contactAttemptsLog` field
5. Keeps `unresponsiveNotes` for reference (can be cleaned up later)

**Example Response:**
```json
{
  "success": true,
  "message": "Migration completed",
  "stats": {
    "migrated": 45,
    "skipped": 50,
    "errors": 0
  }
}
```

### Step 3: Verify Migration

After migration, verify the results:

1. Check a few event requests in the UI to ensure contact attempts display correctly
2. Verify that legacy attempts are now showing as structured cards
3. Check that new contact attempts are being logged in the new format

### Step 4: Clean Up (Optional)

After verifying the migration, you can optionally clean up legacy data:

```sql
-- WARNING: Only run this after verifying migration is successful!
-- This will clear the legacy unresponsiveNotes field
UPDATE event_requests
SET unresponsive_notes = NULL
WHERE contact_attempts_log IS NOT NULL
  AND jsonb_array_length(contact_attempts_log) > 0
  AND unresponsive_notes IS NOT NULL;
```

**Note:** This is optional and not recommended immediately after migration. Keep legacy data for reference for a period of time.

## Migration Details

### Parsing Logic

The migration script parses legacy format like:
```
[Nov 7, 2025, 4:21 PM] Attempt #2 - Phone: Successfully contacted - Got response Looking at last Saturday in November
```

Into structured format:
```json
{
  "attemptNumber": 2,
  "timestamp": "2025-11-07T16:21:00.000Z",
  "method": "phone",
  "outcome": "successful",
  "notes": "Got response Looking at last Saturday in November",
  "createdBy": "system",
  "createdByName": "Legacy Migration"
}
```

### Method Normalization

Legacy methods are normalized to:
- `phone` (for "Phone", "phone call", etc.)
- `email` (for "Email", "email", etc.)
- `both` (for "Phone & Email", "both", etc.)
- `unknown` (for unrecognized methods)

### Outcome Normalization

Legacy outcomes are normalized to:
- `successful` (for "Successfully contacted", "Got response", etc.)
- `no_answer` (for "No answer", "No response", etc.)
- `left_message` (for "Left voicemail", "Left message", etc.)
- `wrong_number` (for "Wrong number", "Disconnected", etc.)
- `email_bounced` (for "Email bounced", "Email failed", etc.)
- `requested_callback` (for "Requested callback", "Follow-up", etc.)
- `other` (for everything else)

## Backward Compatibility

- ✅ **Display**: Legacy attempts are still displayed (parsed and shown as structured cards)
- ✅ **Reading**: System still reads `unresponsiveNotes` if `contactAttemptsLog` is empty
- ✅ **Writing**: New attempts only write to `contactAttemptsLog` (not `unresponsiveNotes`)
- ✅ **Editing**: Legacy attempts cannot be edited/deleted (only new structured attempts can)

## Testing

After migration, test the following:

1. **View Legacy Attempts**: Check event requests with legacy data to ensure they display correctly
2. **Log New Attempt**: Log a new contact attempt and verify it saves to `contactAttemptsLog`
3. **Edit/Delete**: Try editing/deleting a new contact attempt (should work)
4. **Mixed Data**: Check event requests with both legacy and new attempts (should display both)

## Troubleshooting

### Migration Fails
- Check server logs for error details
- Verify database connection
- Ensure user has proper permissions

### Parsing Issues
- Legacy data with unusual formats may not parse correctly
- Check migration stats for errors
- Manually review failed entries

### Display Issues
- Clear browser cache
- Verify `event-message-thread.tsx` has latest parsing logic
- Check that legacy attempts show "Legacy Entry" badge

## Rollback Plan

If migration causes issues:

1. **Database Backup**: Restore from backup if needed
2. **Code Rollback**: Revert code changes if necessary
3. **Data Integrity**: Legacy `unresponsiveNotes` field is preserved (not deleted)

## Next Steps

1. ✅ Run migration on development/staging first
2. ✅ Verify migration results
3. ✅ Run migration on production
4. ⏳ Monitor for any issues
5. ⏳ Clean up legacy data after verification period (optional)

## Questions?

If you have questions or encounter issues:
1. Check server logs
2. Review migration stats
3. Test with preview endpoint first
4. Contact development team if needed

