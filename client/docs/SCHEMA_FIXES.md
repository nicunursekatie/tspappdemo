# Schema/Type Mismatch Fixes

This document outlines the schema inconsistencies found in the codebase and the recommended fixes.

## Overview

| Issue | Current State | Recommended Fix | Risk Level |
|-------|---------------|-----------------|------------|
| focusArea vs focusAreas | Both exist, `focusAreas` is newer | Migrate to `focusAreas` only | Medium |
| read vs isRead | Different tables use different names | Standardize on `isRead` | High |
| willingToSpeak vs isSpeaker | Drivers vs Volunteers tables | Standardize on `isSpeaker` | Low |
| attachments type mismatch | `text[]` vs `text` (JSON string) | Standardize on `jsonb` | Medium |

---

## 1. focusArea vs focusAreas

### Current State
- **Schema**: Both `focusArea: text` (singular, legacy) and `focusAreas: jsonb` (array, preferred) exist in `recipients` table
- **Location**: `/shared/schema.ts` lines 1022-1023

### Files Affected
- `server/routes/recipients.ts` - Uses both
- `client/src/components/recipients/RecipientCard.tsx` - Uses `focusAreas`
- `client/src/components/recipients/RecipientForm.tsx` - Uses `focusAreas`
- `client/src/hooks/useRecipientForm.ts` - Uses both
- `client/src/components/recipients-management.tsx` - Uses both

### Fix Strategy
1. **Phase 1**: Write migration to copy `focusArea` data into `focusAreas` array where `focusAreas` is empty
2. **Phase 2**: Update all code to use only `focusAreas`
3. **Phase 3**: Remove `focusArea` from schema (can keep column in DB for rollback safety)

### Migration SQL
```sql
-- Copy focusArea to focusAreas where focusAreas is empty
UPDATE recipients
SET focus_areas = jsonb_build_array(focus_area)
WHERE focus_area IS NOT NULL
  AND focus_area != ''
  AND (focus_areas IS NULL OR focus_areas = '[]'::jsonb);
```

---

## 2. read vs isRead

### Current State
- **messages table**: Uses `read: boolean` (line 553)
- **messageRecipients table**: Uses `read: boolean` (line 577)
- **emailMessages table**: Uses `isRead: boolean` (line 660)
- **Frontend**: Expects `isRead` in most components

### Files Affected
- `client/src/components/gmail-style-inbox.tsx` - Expects `isRead`
- `client/src/pages/messaging-inbox.tsx` - Expects `read`
- `client/src/mobile/pages/mobile-inbox.tsx` - Expects `isRead`
- `server/services/messaging-service.ts` - Mixes both

### Fix Strategy
**Option A (Recommended)**: Standardize on `isRead` everywhere
1. Add `isRead` column to `messages` and `messageRecipients` tables
2. Create migration to copy `read` values to `isRead`
3. Update all services to return `isRead`
4. Update frontend to use `isRead` consistently
5. Deprecate `read` column (keep for backward compatibility)

**Option B**: Transform in service layer
- Keep schema as-is
- Transform `read` to `isRead` in service layer when returning data
- Less invasive but adds complexity

### Migration SQL (Option A)
```sql
-- Add isRead column to messages
ALTER TABLE messages ADD COLUMN is_read boolean NOT NULL DEFAULT false;
UPDATE messages SET is_read = read;

-- Add isRead column to message_recipients
ALTER TABLE message_recipients ADD COLUMN is_read boolean NOT NULL DEFAULT false;
UPDATE message_recipients SET is_read = read;
```

### Service Layer Transform (Option B)
```typescript
// In messaging-service.ts
function transformMessage(dbMessage: DbMessage): ApiMessage {
  return {
    ...dbMessage,
    isRead: dbMessage.read,  // Transform for API consistency
  };
}
```

---

## 3. willingToSpeak vs isSpeaker

### Current State
- **drivers table**: `willingToSpeak: boolean` (line 881)
- **volunteers table**: `isSpeaker: boolean` (line 953)

### Semantic Analysis
Both fields mean the same thing: "Can this person speak at events?"

### Fix Strategy
1. Standardize on `isSpeaker` (more common pattern)
2. Add `isSpeaker` to drivers table
3. Migrate data: `isSpeaker = willingToSpeak`
4. Update all code to use `isSpeaker`
5. Deprecate `willingToSpeak`

### Migration SQL
```sql
-- Add isSpeaker to drivers table
ALTER TABLE drivers ADD COLUMN is_speaker boolean NOT NULL DEFAULT false;
UPDATE drivers SET is_speaker = willing_to_speak;
```

---

## 4. attachments Type Mismatch

### Current State
- **emailMessages table**: `attachments: text('attachments').array()` - Array of text strings
- **messages table**: `attachments: text('attachments')` - Single text field (stores JSON string)
- **Service code**: Uses `JSON.stringify(attachments)` creating nested JSON

### Problem
When storing attachments in `messages` table:
```typescript
// Current (problematic)
attachments: attachments ? JSON.stringify(attachments) : null
// Results in: '["path1.pdf","path2.pdf"]' stored as text
// Reading requires: JSON.parse(attachments)
```

When storing in `emailMessages` table:
```typescript
// Current
attachments: ['path1.pdf', 'path2.pdf']  // Array directly
// PostgreSQL stores as: {"path1.pdf","path2.pdf"}
```

### Fix Strategy
Standardize on `jsonb` type for both tables:

```typescript
// Schema change
attachments: jsonb('attachments').$type<Array<{
  name: string;
  url: string;
  type: string;
  size: number;
}>>()
```

### Migration SQL
```sql
-- Convert messages.attachments from text to jsonb
ALTER TABLE messages
  ALTER COLUMN attachments TYPE jsonb
  USING CASE
    WHEN attachments IS NULL THEN NULL
    WHEN attachments = '' THEN NULL
    ELSE attachments::jsonb
  END;

-- Convert email_messages.attachments from text[] to jsonb
ALTER TABLE email_messages
  ALTER COLUMN attachments TYPE jsonb
  USING CASE
    WHEN attachments IS NULL THEN NULL
    ELSE to_jsonb(attachments)
  END;
```

---

## Implementation Order

### Phase 1: Non-Breaking Changes (Safe)
1. Add new columns alongside old ones
2. Update services to write to both columns
3. Update services to read from new columns

### Phase 2: Frontend Updates
1. Update components to use new field names
2. Test thoroughly

### Phase 3: Cleanup (After Verification)
1. Remove old column references from code
2. Keep old columns in DB (marked deprecated)
3. Remove old columns in future major version

---

## Rollback Plan

Each migration should:
1. Keep old columns intact
2. Have a reverse migration ready
3. Be tested in staging first

```sql
-- Example rollback for isRead
UPDATE messages SET read = is_read;
ALTER TABLE messages DROP COLUMN is_read;
```
