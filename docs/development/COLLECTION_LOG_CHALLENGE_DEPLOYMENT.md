# Collection Log Challenge Deployment Instructions

## Overview
This document describes the changes made to add a new onboarding challenge for submitting collection log entries, and the steps required to deploy these changes to production.

## Changes Made

### 1. Added New Challenge Definition
**File:** `server/services/onboarding-service.ts`

Added a new challenge to the `initializeDefaultChallenges()` method:
```typescript
{
  actionKey: 'submit_collection_log',
  title: 'Submit a Collection Log Entry',
  description: 'Record your impact! Submit a sandwich collection log entry.',
  category: 'projects',
  points: 20,
  icon: 'FileText',
  order: 11,
}
```

### 2. Added Automatic Tracking
**File:** `server/routes/collections/index.ts`

Added automatic tracking when users submit collection logs. When a user creates a new sandwich collection, the system now automatically tracks completion of the `submit_collection_log` challenge.

### 3. Created Migration Script
**File:** `server/scripts/mark-collection-challenge-complete.ts`

Created a script to mark this challenge as completed for users who have already been submitting collection logs before this challenge was added.

**Target Users:**
- Jen Cohen (jenmcohen@gmail.com)
- Kristina McCarthney (kristinamday@yahoo.com)
- Laura Baldwin (lzauderer@yahoo.com)
- Marcy Louza (mdlouza@gmail.com)
- Nancy Miller (atlantamillers@comcast.net)
- Veronica Pennington
- Vicki Tropauer (vickib@aol.com)

## Deployment Steps

### Step 1: Initialize the New Challenge
After deploying the code, an admin must initialize the new challenge in the database:

1. Log in as an admin user
2. Make a POST request to: `/api/onboarding/admin/initialize`
   - Or use the admin interface if available

This will add the new challenge to the `onboarding_challenges` table.

### Step 2: Run Migration Script (Optional but Recommended)
To mark the challenge as completed for users who have already submitted collection logs:

```bash
tsx server/scripts/mark-collection-challenge-complete.ts
```

Or using npm:
```bash
npm run -- tsx server/scripts/mark-collection-challenge-complete.ts
```

**Note:** This step is optional but recommended to give credit to users who have already been actively submitting collection logs.

### Step 3: Verify Deployment
1. Check that the new challenge appears in the challenges list
2. Verify that new collection submissions trigger challenge completion
3. Confirm that the specified users have the challenge marked as completed (if Step 2 was run)

## Testing

### Test New Collection Submission
1. Log in as a user who hasn't completed the challenge
2. Submit a new sandwich collection log entry
3. Verify that the challenge is marked as completed
4. Verify that points are awarded

### Test Migration Script (in development)
Run the script in a development environment first to ensure it correctly identifies and updates the target users:

```bash
tsx server/scripts/mark-collection-challenge-complete.ts
```

Check the output to verify:
- All target users were found
- Challenge completions were recorded
- No errors occurred

## Rollback Plan
If issues arise:

1. Remove challenge from database:
   ```sql
   DELETE FROM onboarding_challenges WHERE action_key = 'submit_collection_log';
   ```

2. Remove tracking code from collections route (revert changes to `server/routes/collections/index.ts`)

3. Challenge progress entries will remain in `onboarding_progress` table but won't affect users if the challenge is deleted

## Notes
- The challenge is worth 20 points
- It falls under the "projects" category
- It uses the "FileText" icon
- The challenge will only be tracked when users have a valid user ID in their session
- If tracking fails, collection submission will still succeed (error is logged but not thrown)
