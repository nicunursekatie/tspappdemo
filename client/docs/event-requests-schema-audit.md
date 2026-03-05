# Event Requests Schema Audit Report

**Total columns in `event_requests` table: ~130 columns**

---

## 1. KEEP AS-IS (Actively Used, No Issues)

These columns are actively used throughout the codebase with no redundancy issues.

### Core Identity & Contact
| Column | Type | Purpose |
|--------|------|---------|
| `id` | serial | Primary key |
| `firstName` | varchar | Primary contact first name |
| `lastName` | varchar | Primary contact last name |
| `email` | varchar | Primary contact email |
| `phone` | varchar | Primary contact phone |
| `organizationName` | varchar | Organization name |
| `department` | varchar | Department within org |

### Backup Contact
| Column | Type | Purpose |
|--------|------|---------|
| `backupContactFirstName` | varchar | Secondary contact |
| `backupContactLastName` | varchar | Secondary contact |
| `backupContactEmail` | varchar | Secondary contact |
| `backupContactPhone` | varchar | Secondary contact |
| `backupContactRole` | varchar | Role/title of backup |

### Event Dates & Status
| Column | Type | Purpose |
|--------|------|---------|
| `desiredEventDate` | timestamp | Originally requested date |
| `scheduledEventDate` | timestamp | Actual scheduled date |
| `backupDates` | jsonb | Alternative dates array |
| `status` | varchar | Workflow status |
| `statusChangedAt` | timestamp | Status change tracking |
| `isConfirmed` | boolean | Event confirmation flag |

### Event Details
| Column | Type | Purpose |
|--------|------|---------|
| `eventAddress` | text | Event location |
| `latitude` | varchar | Geocoded lat |
| `longitude` | varchar | Geocoded lng |
| `eventStartTime` | varchar | Start time |
| `eventEndTime` | varchar | End time |
| `message` | text | Additional info from organizer |

### Sandwich Counts
| Column | Type | Purpose |
|--------|------|---------|
| `estimatedSandwichCount` | integer | Primary estimate |
| `estimatedSandwichCountMin` | integer | Range minimum |
| `estimatedSandwichCountMax` | integer | Range maximum |
| `estimatedSandwichRangeType` | varchar | Type for range |
| `actualSandwichCount` | integer | Final count (completed) |
| `sandwichTypes` | jsonb | Type/quantity breakdown |

### Staffing Requirements
| Column | Type | Purpose |
|--------|------|---------|
| `driversNeeded` | integer | Number of drivers needed |
| `speakersNeeded` | integer | Number of speakers needed |
| `volunteersNeeded` | integer | Number of volunteers needed |
| `selfTransport` | boolean | Org transporting themselves |
| `vanDriverNeeded` | boolean | Van driver required |

### Van Driver
| Column | Type | Purpose |
|--------|------|---------|
| `assignedVanDriverId` | text | Van driver user ID |
| `customVanDriverName` | text | Custom van driver name |
| `vanDriverNotes` | text | Van driver notes |
| `isDhlVan` | boolean | DHL providing van |

### TSP Contact (All 3 serve different purposes)
| Column | Type | Purpose |
|--------|------|---------|
| `tspContact` | varchar | User ID of TSP contact |
| `tspContactAssigned` | varchar | Display name (legacy) |
| `customTspContact` | text | Free-text contact (non-user) |
| `tspContactAssignedDate` | timestamp | Assignment date |

### Toolkit Tracking
| Column | Type | Purpose |
|--------|------|---------|
| `toolkitSent` | boolean | Sent flag |
| `toolkitSentDate` | timestamp | When sent |
| `toolkitStatus` | varchar | Status enum |
| `toolkitSentBy` | varchar | Who sent it |

### Contact Tracking
| Column | Type | Purpose |
|--------|------|---------|
| `contactAttempts` | integer | Attempt count |
| `lastContactAttempt` | timestamp | Last attempt time |
| `isUnresponsive` | boolean | Unresponsive flag |
| `contactAttemptsLog` | jsonb | Structured attempt history |
| `unresponsiveNotes` | text | Unresponsive reason |

### Follow-up (Completed Events)
| Column | Type | Purpose |
|--------|------|---------|
| `followUpOneDayCompleted` | boolean | 1-day follow-up done |
| `followUpOneDayDate` | timestamp | When done |
| `followUpOneMonthCompleted` | boolean | 1-month follow-up done |
| `followUpOneMonthDate` | timestamp | When done |
| `followUpNotes` | text | Follow-up notes |

### Notes Fields
| Column | Type | Purpose |
|--------|------|---------|
| `planningNotes` | text | Planning notes |
| `schedulingNotes` | text | Scheduling notes |
| `distributionNotes` | text | Distribution notes |
| `duplicateNotes` | text | Duplicate check notes |

### Special Flags
| Column | Type | Purpose |
|--------|------|---------|
| `isMlkDayEvent` | boolean | MLK Day designation |
| `addedToOfficialSheet` | boolean | Sheet sync flag |
| `organizationExists` | boolean | Duplicate detection |

### Sync & Audit
| Column | Type | Purpose |
|--------|------|---------|
| `externalId` | varchar | Google Sheets ID (unique) |
| `lastSyncedAt` | timestamp | Last sync time |
| `createdAt` | timestamp | Creation time |
| `updatedAt` | timestamp | Update time |
| `createdBy` | varchar | Creator user ID |
| `deletedAt` | timestamp | Soft delete |
| `deletedBy` | varchar | Who deleted |
| `version` | integer | Optimistic locking |

---

## 2. CONSOLIDATE (Duplicates That Need Merging)

### A. Driver Assignments: `assignedDriverIds` vs `driverDetails`

| Column | Type | Usage | Data |
|--------|------|-------|------|
| `assignedDriverIds` | text[] | Legacy array | User IDs only |
| `driverDetails` | jsonb | **PRIMARY** - heavily used | Rich object with IDs + names + metadata |

**Recommendation:** Migrate to `driverDetails` only. Code already primarily uses `driverDetails` (extracting keys for counts). `assignedDriverIds` appears to be legacy.

**Data risk:** Both may have data - need migration script.

---

### B. Speaker Assignments: `assignedSpeakerIds` vs `speakerDetails`

| Column | Type | Usage | Data |
|--------|------|-------|------|
| `assignedSpeakerIds` | text[] | Minimal usage | User IDs only |
| `speakerDetails` | jsonb | **PRIMARY** - heavily used | Rich object with IDs + names |

**Recommendation:** Same as drivers - consolidate to `speakerDetails`.

---

### C. Additional TSP Contacts: `additionalTspContacts` vs `additionalContact1`/`additionalContact2`

| Column | Type | Usage |
|--------|------|-------|
| `additionalTspContacts` | text | Legacy JSON string |
| `additionalContact1` | varchar | **PREFERRED** - structured |
| `additionalContact2` | varchar | **PREFERRED** - structured |

**Recommendation:** Migrate `additionalTspContacts` data to `additionalContact1`/`additionalContact2`, then deprecate the JSON field.

---

### D. Attendance Breakdown: Old vs New Format

**OLD (Legacy):**
| Column | Type |
|--------|------|
| `adultCount` | integer |
| `childrenCount` | integer |

**NEW (Preferred):**
| Column | Type |
|--------|------|
| `attendanceAdults` | integer |
| `attendanceTeens` | integer |
| `attendanceKids` | integer |

**Current code:** Uses fallback logic: `event.attendanceAdults || event.adultCount || 0`

**Recommendation:** Migrate old data to new columns, then remove old columns.

---

### E. Pickup Time Fields (Complex)

| Column | Type | Purpose | Usage |
|--------|------|---------|-------|
| `pickupTime` | varchar | Time only (e.g., "2:30 PM") | Active |
| `pickupDateTime` | varchar | Full datetime | **PRIMARY** |
| `driverPickupTime` | varchar | Driver-specific time | Active |
| `pickupTimeWindow` | text | Time range | Minimal |

**Current state:** Code has sync logic between these. `pickupDateTime` is the authoritative field.

**Recommendation:** Keep for now - the sync logic is intentional. Long-term, could consolidate to just `pickupDateTime`.

---

## 3. CANDIDATE FOR DELETION (Unused or Empty)

### A. Completely Unused (No Code References Found)

| Column | Type | Notes |
|--------|------|-------|
| `autoCategories` | jsonb | AI categorization - planned but never implemented |
| `categorizedAt` | timestamp | AI categorization - never implemented |
| `categorizedBy` | varchar | AI categorization - never implemented |
| `followUpMethod` | varchar | Superseded by `communicationMethod` |
| `updatedEmail` | varchar | No references found |
| `contactedAt` | timestamp | No references found |
| `contactCompletionNotes` | text | No references found |
| `completedByUserId` | varchar | No references found |
| `pastDateNotificationSentAt` | timestamp | No references found in client |
| `assignedDriverSpeakers` | text[] | Concept of driver+speaker combo - not implemented |
| `markedUnresponsiveAt` | timestamp | Tracking field - minimal use |
| `markedUnresponsiveBy` | varchar | Tracking field - minimal use |
| `unresponsiveReason` | text | Superseded by `unresponsiveNotes` |
| `nextFollowUpDate` | timestamp | No active references |

### B. Likely Empty or Rarely Populated

| Column | Type | Notes |
|--------|------|-------|
| `organizationCategory` | varchar | Rarely set on events (exists on organizations table) |
| `schoolClassification` | varchar | Only set when category='school' |
| `partnerOrganizations` | jsonb | Rarely used |
| `mlkDayMarkedAt` | timestamp | Only populated for MLK events |
| `mlkDayMarkedBy` | varchar | Only populated for MLK events |
| `googleSheetRowId` | text | Used for projects, not event_requests |
| `actualSandwichTypes` | jsonb | Only for completed events |
| `sandwichDistributions` | jsonb | Rarely used distribution tracking |
| `distributionRecordedDate` | timestamp | Rarely used |
| `distributionRecordedBy` | varchar | Rarely used |
| `attendanceRecordedDate` | timestamp | Only for completed events |
| `attendanceRecordedBy` | varchar | Only for completed events |
| `attendanceNotes` | text | Rarely used |
| `actualSandwichCountRecordedDate` | timestamp | Only for completed events |
| `actualSandwichCountRecordedBy` | varchar | Only for completed events |
| `socialMediaPostRequestedDate` | timestamp | Rarely used |
| `socialMediaPostCompletedDate` | timestamp | Rarely used |
| `socialMediaPostNotes` | text | Rarely used |
| `duplicateCheckDate` | timestamp | Rarely populated |
| `postponementNotes` | text | Only for postponed events |
| `deliveryParkingAccess` | text | UI exists but rarely filled |
| `deliveryTimeWindow` | text | UI exists but rarely filled |

### C. Schema Mismatch - Code References Non-Existent Column

| Column | Referenced In Code | Actual Status |
|--------|-------------------|---------------|
| `volunteerDetails` | server/routes/event-requests.ts | **NOT IN DATABASE SCHEMA** |
| `hasHostedBefore` | NewRequestCard.tsx | **NOT IN DATABASE SCHEMA** (only `previouslyHosted` exists) |

---

## Summary Counts

| Category | Count |
|----------|-------|
| Keep as-is | ~80 columns |
| Consolidate | ~12 columns (6 pairs) |
| Candidate for deletion | ~30+ columns |
| Schema mismatch | 2 columns |

---

## Recommended Actions

### Immediate (Low Risk)
1. Add `volunteerDetails` jsonb column to match code expectations OR fix code to use `assignedVolunteerIds`
2. Verify `hasHostedBefore` vs `previouslyHosted` - one is a computed value from the other?

### Short-term
1. Create migration to consolidate `adultCount`/`childrenCount` → `attendanceAdults`/`attendanceKids`
2. Migrate `additionalTspContacts` JSON → `additionalContact1`/`additionalContact2`

### Long-term
1. Evaluate removal of unused AI categorization columns
2. Consider consolidating driver/speaker assignment fields
3. Audit actual data in "rarely populated" columns before removal
