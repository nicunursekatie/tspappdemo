# Backend Refactor Recommendations
## Projects, Meetings, Tasks, and Team Board

**Created**: 2025-11-15
**Status**: Proposal
**Scope**: Backend schema redesign for improved workflow support

---

## Executive Summary

This document proposes a comprehensive backend refactor for the Projects, Meetings, Tasks, and Team Board components to better support The Sandwich Project's meeting-driven workflow. The current schema has structural issues that make it difficult to track the lifecycle of notes → tasks, manage project-meeting relationships, and maintain clear assignment hierarchies.

**Key Improvements:**
- Unified assignment model with clear "owner" vs "support" roles
- Proper meeting ↔ project relationship tracking
- Note → Task conversion lifecycle tracking
- Cleaner separation between project tasks and team board items
- Removal of deprecated Google Sheets sync fields
- Support for agenda item selection and meeting minutes generation

**Impact:**
- Better data integrity and query performance
- Clearer audit trails for tasks and notes
- Simplified frontend logic
- Foundation for automated meeting minutes generation

---

## Current Problems

### 1. Meeting Notes Schema Issues

**Current Schema:**
```typescript
meetingNotes: {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull(),  // ❌ Required
  meetingId: integer('meeting_id'),            // ❌ Optional
  type: text('type').notNull(),                // 'discussion' | 'meeting'
  content: text('content').notNull(),
  status: text('status').notNull().default('active'),
  createdBy: varchar('created_by'),
  createdByName: varchar('created_by_name'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}
```

**Problems:**
- ❌ Every note must have a `projectId`, but meetings can have general notes
- ❌ `meetingId` is optional when it should be primary
- ❌ No tracking of which notes were converted to tasks
- ❌ No way to know original source of content when converted
- ❌ `status: 'active' | 'used' | 'archived'` is unclear - "used" means converted to task?

**Use Case Failures:**
- Can't create meeting-level notes unrelated to a project
- Can't see history: "This task came from note #123 in Meeting ABC"
- When note converts to task, the relationship is lost

---

### 2. No Meeting ↔ Project Relationship Table

**Current Approach:**
```typescript
projects: {
  reviewInNextMeeting: boolean,              // ❌ Which meeting?
  lastDiscussedDate: text,                   // ❌ Just date, no meeting link
  meetingDiscussionPoints: text,             // ❌ Text field, not structured
  meetingDecisionItems: text,                // ❌ Text field, not structured
}
```

**Problems:**
- ❌ Can't query "Which projects were discussed in Meeting #5?"
- ❌ Can't query "Which meetings discussed Project #12?"
- ❌ `reviewInNextMeeting` doesn't specify which meeting
- ❌ No tracking of when a project was added/removed from an agenda
- ❌ Discussion points and decisions are unstructured text

**Use Case Failures:**
- Can't generate meeting minutes from structured data
- Can't show project history across meetings
- Can't filter projects by "discussed in last 3 meetings"

---

### 3. Unclear Task Origin and Lifecycle

**Current Schema:**
```typescript
projectTasks: {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull(),
  title: text('title').notNull(),
  // ... no origin tracking
}
```

**Problems:**
- ❌ Can't tell if task was converted from note, manually created, or imported
- ❌ No link back to source meeting note
- ❌ Can't prevent duplicate task creation from same note
- ❌ Can't show "tasks created in Meeting #5"

**Use Case Failures:**
- User converts note to task twice by accident → duplicate tasks
- Can't audit "where did this task come from?"
- Can't filter tasks by origin meeting

---

### 4. Redundant Assignment Fields

**Current Schema (Projects):**
```typescript
projects: {
  assigneeId: integer('assignee_id'),              // ❌ Legacy single
  assigneeName: text('assignee_name'),             // ❌ Legacy single
  assigneeIds: jsonb('assignee_ids').default('[]'), // ✓ Multi-assignee
  assigneeNames: text('assignee_names'),           // ❌ Comma-separated text
  supportPeopleIds: jsonb('support_people_ids').default('[]'), // ✓ Multi
  supportPeople: text('support_people'),           // ❌ Text field
}
```

**Problems:**
- ❌ 6 fields to represent 2 concepts (owners + support)
- ❌ Mix of legacy single-assignee and new multi-assignee
- ❌ Names stored as both JSON and comma-separated text
- ❌ No clear "primary owner" in multi-assignee context
- ❌ Denormalized data (storing names instead of just IDs)

**Use Case Failures:**
- Frontend has to check both old and new fields
- Renaming a user requires updating multiple text fields
- No clear answer to "Who owns this project?"

---

### 5. Google Sheets Sync Cruft

**Current Schema:**
```typescript
projects: {
  googleSheetRowId: text('google_sheet_row_id'),
  lastSyncedAt: timestamp('last_synced_at'),
  syncStatus: text('sync_status').default('unsynced'),
  lastPulledFromSheetAt: timestamp('last_pulled_from_sheet_at'),
  lastPushedToSheetAt: timestamp('last_pushed_to_sheet_at'),
  lastSheetHash: text('last_sheet_hash'),
  lastAppHash: text('last_app_hash'),
  tasksAndOwners: text('tasks_and_owners'),
}
```

**Problems:**
- ❌ 8 fields dedicated to deprecated Google Sheets sync
- ❌ Taking up schema space and mental overhead
- ❌ Confusing for new developers

---

### 6. Team Board Integration Unclear

**Current Schema:**
```typescript
teamBoardItems: {
  id: serial('id').primaryKey(),
  content: text('content').notNull(),
  type: varchar('type').default('note'), // 'task', 'note', 'idea', 'reminder'
  // ... no project relationship
}
```

**Problems:**
- ❌ No way to link team board item to a project
- ❌ No way to promote team board item to project task
- ❌ No way to show team board items on agenda planning tab
- ❌ 'reminder' type unused

**Use Case Failures:**
- Can't pull team board items into meeting agenda
- Can't convert team board task into project task
- Duplicate task tracking systems

---

### 7. No Agenda Selection State

**Missing Functionality:**
- ❌ No way to mark which projects are selected for upcoming meeting
- ❌ No way to mark which notes/tasks should appear in agenda
- ❌ "Tabled" status is handled by project status, not meeting relationship

**Use Case Failures:**
- Can't save "draft agenda" before meeting
- Can't distinguish "tabled for this meeting" vs "tabled permanently"

---

## Proposed Solution

### Core Design Principles

1. **Single Source of Truth**: Each piece of data lives in one place
2. **Clear Relationships**: Many-to-many relationships tracked explicitly
3. **Audit Trail**: Track origin, conversions, and lifecycle
4. **Assignment Hierarchy**: Clear "owner" vs "support" roles
5. **Meeting-Centric**: Support meeting-driven workflow
6. **Future-Proof**: Easy to extend without breaking changes

---

## Proposed Schema Changes

### 1. Refactor `projects` Table

**Changes:**
```typescript
export const projects = pgTable('projects', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description'),
  status: text('status').notNull(), // 'active', 'tabled', 'completed', 'archived'
  priority: text('priority').notNull().default('medium'),
  category: text('category').notNull().default('technology'),

  // SIMPLIFIED ASSIGNMENT MODEL
  ownerId: integer('owner_id'),                    // ✓ Single primary owner
  ownerName: text('owner_name'),                   // ✓ Denormalized for display

  // REMOVE: assigneeId, assigneeName, assigneeIds, assigneeNames
  // REMOVE: supportPeopleIds, supportPeople
  // → Move to project_assignments table (see below)

  // Dates
  dueDate: text('due_date'),
  startDate: text('start_date'),
  completionDate: text('completion_date'),

  // Progress tracking
  progressPercentage: integer('progress_percentage').notNull().default(0),

  // Project details
  notes: text('notes'),
  requirements: text('requirements'),
  deliverables: text('deliverables'),
  resources: text('resources'),
  blockers: text('blockers'),
  tags: jsonb('tags').default('[]'),              // ✓ Proper JSON array

  // Time/budget tracking
  estimatedHours: integer('estimated_hours'),
  actualHours: integer('actual_hours'),
  budget: varchar('budget'),

  // Display
  color: text('color').notNull().default('blue'),

  // Audit
  createdBy: varchar('created_by'),
  createdByName: varchar('created_by_name'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),

  // REMOVE ALL GOOGLE SHEETS FIELDS:
  // googleSheetRowId, lastSyncedAt, syncStatus,
  // lastPulledFromSheetAt, lastPushedToSheetAt,
  // lastSheetHash, lastAppHash, tasksAndOwners

  // REMOVE MEETING-SPECIFIC FIELDS:
  // reviewInNextMeeting, lastDiscussedDate,
  // meetingDiscussionPoints, meetingDecisionItems
  // → Move to meeting_projects junction table
});
```

**Key Changes:**
- ✅ Single `ownerId` instead of multiple assignee fields
- ✅ Removed Google Sheets sync fields (8 fields → 0)
- ✅ Removed meeting-specific fields (4 fields → 0)
- ✅ Clean, focused schema

---

### 2. NEW: `project_assignments` Table

**Purpose**: Track all people working on a project with role distinction

```typescript
export const projectAssignments = pgTable('project_assignments', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull(),
  userName: text('user_name').notNull(),        // Denormalized for display
  role: text('role').notNull(),                 // 'owner' | 'support'
  addedAt: timestamp('added_at').notNull().defaultNow(),
  addedBy: varchar('added_by'),                 // Who assigned this person
}, (table) => ({
  uniqueAssignment: unique().on(table.projectId, table.userId),
  projectIdx: index('idx_project_assignments_project').on(table.projectId),
  userIdx: index('idx_project_assignments_user').on(table.userId),
}));
```

**Benefits:**
- ✅ Clear distinction between owner and support roles
- ✅ Can have multiple owners or support people
- ✅ Easy to query "all projects User X is involved in"
- ✅ Audit trail of who was assigned when
- ✅ Normalized - renaming user updates one place

**Example Data:**
```
| projectId | userId | userName | role    |
|-----------|--------|----------|---------|
| 1         | 5      | Katie    | owner   |
| 1         | 7      | Chris    | support |
| 1         | 9      | Scott    | support |
```

---

### 3. NEW: `meeting_projects` Junction Table

**Purpose**: Track which projects are in which meeting agendas

```typescript
export const meetingProjects = pgTable('meeting_projects', {
  id: serial('id').primaryKey(),
  meetingId: integer('meeting_id')
    .notNull()
    .references(() => meetings.id, { onDelete: 'cascade' }),
  projectId: integer('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),

  // Agenda planning fields
  discussionPoints: text('discussion_points'),   // Pre-meeting thoughts
  questionsToAddress: text('questions_to_address'),

  // Meeting outcomes
  discussionSummary: text('discussion_summary'), // What was discussed
  decisionsReached: text('decisions_reached'),   // Decisions made

  // Status
  status: text('status').notNull().default('planned'), // 'planned' | 'discussed' | 'tabled' | 'deferred'
  includeInAgenda: boolean('include_in_agenda').notNull().default(true),

  // Ordering
  agendaOrder: integer('agenda_order'),          // For sorting in agenda
  section: text('section'),                      // 'urgent' | 'old_business' | 'new_business' | 'housekeeping'

  // Audit
  addedAt: timestamp('added_at').notNull().defaultNow(),
  addedBy: varchar('added_by'),
  discussedAt: timestamp('discussed_at'),        // When actually discussed
}, (table) => ({
  uniqueMeetingProject: unique().on(table.meetingId, table.projectId),
  meetingIdx: index('idx_meeting_projects_meeting').on(table.meetingId),
  projectIdx: index('idx_meeting_projects_project').on(table.projectId),
}));
```

**Benefits:**
- ✅ Tracks which projects are in which meetings
- ✅ Stores discussion points per project per meeting
- ✅ Can query "All projects in Meeting #5"
- ✅ Can query "All meetings that discussed Project #12"
- ✅ Supports "tabled for this meeting" vs permanent status
- ✅ Foundation for automated meeting minutes

**Example Data:**
```
| meetingId | projectId | discussionPoints           | status    | includeInAgenda |
|-----------|-----------|----------------------------|-----------|-----------------|
| 5         | 1         | "Discuss API architecture" | planned   | true            |
| 5         | 3         | "Review budget concerns"   | planned   | true            |
| 5         | 7         | NULL                       | tabled    | false           |
| 6         | 1         | "Follow up on API"         | discussed | true            |
```

---

### 4. Refactor `meetingNotes` Table

**Changes:**
```typescript
export const meetingNotes = pgTable('meeting_notes', {
  id: serial('id').primaryKey(),

  // RELATIONSHIP CHANGES
  meetingId: integer('meeting_id')              // ✓ Now primary, required
    .notNull()
    .references(() => meetings.id, { onDelete: 'cascade' }),
  projectId: integer('project_id')              // ✓ Now optional
    .references(() => projects.id, { onDelete: 'set null' }),

  // Content
  type: text('type').notNull(),                 // 'discussion' | 'meeting' | 'general'
  content: text('content').notNull(),

  // LIFECYCLE TRACKING
  status: text('status').notNull().default('active'),
  // 'active' - current note
  // 'converted' - converted to task
  // 'archived' - archived without conversion

  convertedToTaskId: integer('converted_to_task_id') // ✓ NEW: Link to task
    .references(() => projectTasks.id, { onDelete: 'set null' }),
  convertedAt: timestamp('converted_at'),       // ✓ NEW: When converted

  // AGENDA SELECTION
  selectedForAgenda: boolean('selected_for_agenda').notNull().default(false),

  // Audit
  createdBy: varchar('created_by'),
  createdByName: varchar('created_by_name'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  meetingIdx: index('idx_meeting_notes_meeting').on(table.meetingId),
  projectIdx: index('idx_meeting_notes_project').on(table.projectId),
  taskIdx: index('idx_meeting_notes_task').on(table.convertedToTaskId),
}));
```

**Benefits:**
- ✅ Meeting is primary, project is optional (supports general meeting notes)
- ✅ Clear lifecycle tracking (active → converted → archived)
- ✅ Link back to created task
- ✅ Can prevent duplicate task creation
- ✅ Can show "notes converted to tasks in this meeting"
- ✅ Supports agenda selection

---

### 5. Refactor `projectTasks` Table

**Changes:**
```typescript
export const projectTasks = pgTable('project_tasks', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),

  title: text('title').notNull(),
  description: text('description'),
  status: text('status').notNull().default('pending'),
  priority: text('priority').notNull().default('medium'),

  // SIMPLIFIED ASSIGNMENT (like projects)
  // REMOVE: assigneeId, assigneeName, assigneeIds, assigneeNames
  // → Use task_assignments table instead

  // Dates
  dueDate: text('due_date'),
  completedAt: timestamp('completed_at'),

  // ORIGIN TRACKING
  originType: text('origin_type').notNull().default('manual'),
  // 'manual' - created directly
  // 'converted_from_note' - converted from meeting note
  // 'team_board' - promoted from team board

  sourceNoteId: integer('source_note_id')       // ✓ NEW: Link to origin note
    .references(() => meetingNotes.id, { onDelete: 'set null' }),
  sourceMeetingId: integer('source_meeting_id') // ✓ NEW: Origin meeting
    .references(() => meetings.id, { onDelete: 'set null' }),
  sourceTeamBoardId: integer('source_team_board_id') // ✓ NEW: Origin team board item
    .references(() => teamBoardItems.id, { onDelete: 'set null' }),

  // Other
  attachments: jsonb('attachments').default('[]'), // ✓ Proper JSON
  order: integer('order').notNull().default(0),

  // AGENDA SELECTION
  selectedForAgenda: boolean('selected_for_agenda').notNull().default(false),

  // Audit
  createdBy: varchar('created_by'),
  createdByName: varchar('created_by_name'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  projectIdx: index('idx_project_tasks_project').on(table.projectId),
  noteIdx: index('idx_project_tasks_note').on(table.sourceNoteId),
  meetingIdx: index('idx_project_tasks_meeting').on(table.sourceMeetingId),
}));
```

**Benefits:**
- ✅ Clear origin tracking for audit trail
- ✅ Can query "tasks created in Meeting #5"
- ✅ Can show "this task came from note #123"
- ✅ Supports team board → project task promotion
- ✅ Supports agenda selection

---

### 6. NEW: `task_assignments` Table

**Purpose**: Track all people assigned to a task (parallel to project_assignments)

```typescript
export const taskAssignments = pgTable('task_assignments', {
  id: serial('id').primaryKey(),
  taskId: integer('task_id')
    .notNull()
    .references(() => projectTasks.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull(),
  userName: text('user_name').notNull(),
  role: text('role').notNull().default('assignee'), // 'assignee' | 'reviewer'
  addedAt: timestamp('added_at').notNull().defaultNow(),
  addedBy: varchar('added_by'),
}, (table) => ({
  uniqueAssignment: unique().on(table.taskId, table.userId),
  taskIdx: index('idx_task_assignments_task').on(table.taskId),
  userIdx: index('idx_task_assignments_user').on(table.userId),
}));
```

**Benefits:**
- ✅ Consistent with project_assignments
- ✅ Supports multi-assignee
- ✅ Can add role distinctions if needed
- ✅ Normalized assignment tracking

---

### 7. Refactor `teamBoardItems` Table

**Changes:**
```typescript
export const teamBoardItems = pgTable('team_board_items', {
  id: serial('id').primaryKey(),
  content: text('content').notNull(),

  type: varchar('type').default('task'), // ✓ CHANGED: Remove 'reminder'
  // 'task' | 'note' | 'idea'

  // OPTIONAL PROJECT LINK
  projectId: integer('project_id')       // ✓ NEW: Optional link to project
    .references(() => projects.id, { onDelete: 'set null' }),

  // REMOVE: assignedTo, assignedToNames
  // → Use team_board_assignments table for consistency

  status: varchar('status').notNull().default('open'),

  // LIFECYCLE TRACKING
  promotedToTaskId: integer('promoted_to_task_id') // ✓ NEW: If promoted
    .references(() => projectTasks.id, { onDelete: 'set null' }),
  promotedAt: timestamp('promoted_at'),

  // Audit
  createdBy: varchar('created_by').notNull(),
  createdByName: varchar('created_by_name').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  completedAt: timestamp('completed_at'),
}, (table) => ({
  projectIdx: index('idx_team_board_project').on(table.projectId),
}));
```

**Benefits:**
- ✅ Can link to projects (for context)
- ✅ Track promotion to project task
- ✅ Consistent assignment model
- ✅ Removed unused 'reminder' type

---

### 8. NEW: `team_board_assignments` Table

**Purpose**: Consistent multi-assignee for team board items

```typescript
export const teamBoardAssignments = pgTable('team_board_assignments', {
  id: serial('id').primaryKey(),
  itemId: integer('item_id')
    .notNull()
    .references(() => teamBoardItems.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull(),
  userName: text('user_name').notNull(),
  addedAt: timestamp('added_at').notNull().defaultNow(),
}, (table) => ({
  uniqueAssignment: unique().on(table.itemId, table.userId),
  itemIdx: index('idx_team_board_assignments_item').on(table.itemId),
  userIdx: index('idx_team_board_assignments_user').on(table.userId),
}));
```

---

### 9. Keep `taskCompletions` Table (Multi-Assignee Completion Tracking)

**No Changes Needed** - This table is well-designed:
```typescript
export const taskCompletions = pgTable('task_completions', {
  id: serial('id').primaryKey(),
  taskId: integer('task_id').notNull(),
  userId: text('user_id').notNull(),
  userName: text('user_name').notNull(),
  notes: text('notes'),
  completedAt: timestamp('completed_at').notNull().defaultNow(),
});
```

---

## New Entity Relationship Diagram

```
┌─────────────┐
│   users     │
└──────┬──────┘
       │
       │ (assignments)
       │
       ├──────────────┐
       │              │
       ▼              ▼
┌─────────────┐  ┌──────────────────┐
│  projects   │  │ project_         │
│             │◄─┤ assignments      │
└──────┬──────┘  └──────────────────┘
       │         (owner/support role)
       │
       │ 1:N
       │
       ├──────────────┬──────────────┬─────────────┐
       │              │              │             │
       ▼              ▼              ▼             ▼
┌─────────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
│ project_    │  │ meeting_ │  │ meeting_ │  │ project_ │
│ tasks       │  │ projects │  │ notes    │  │ comments │
└──────┬──────┘  └────┬─────┘  └────┬─────┘  └──────────┘
       │              │              │
       │              │              │
       │              │              │ (converted)
       │              │              ├──────────────────┐
       │              │              │                  │
       ▼              ▼              ▼                  ▼
┌─────────────┐  ┌──────────┐  ┌──────────┐      back to
│ task_       │  │ meetings │  │(same note │      project_tasks
│ assignments │  └──────────┘  │ or task)  │
└─────────────┘                └───────────┘


┌──────────────┐
│ team_board_  │
│ items        │◄────────────┐
└──────┬───────┘             │
       │                     │ (optional link)
       │                     │
       ├─────────────┬───────┴──────┐
       │             │                │
       ▼             ▼                ▼
┌──────────────┐  ┌──────────┐  ┌──────────┐
│ team_board_  │  │ team_    │  │ projects │
│ comments     │  │ board_   │  └──────────┘
└──────────────┘  │ assign-  │
                  │ ments    │
                  └──────────┘
```

---

## Migration Strategy

### Phase 1: Add New Tables (Non-Breaking)

**Step 1.1**: Create new junction/assignment tables
```sql
-- Migration: 0001_add_project_assignments.sql
CREATE TABLE project_assignments (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL,
  user_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'support')),
  added_at TIMESTAMP NOT NULL DEFAULT NOW(),
  added_by VARCHAR,
  UNIQUE(project_id, user_id)
);
CREATE INDEX idx_project_assignments_project ON project_assignments(project_id);
CREATE INDEX idx_project_assignments_user ON project_assignments(user_id);

-- Similar for task_assignments, team_board_assignments, meeting_projects
```

**Step 1.2**: Migrate existing data
```sql
-- Migrate project owner
INSERT INTO project_assignments (project_id, user_id, user_name, role)
SELECT id, assignee_id, assignee_name, 'owner'
FROM projects
WHERE assignee_id IS NOT NULL;

-- Migrate support people from JSON
-- (This requires a more complex query to parse the JSON arrays)
```

### Phase 2: Add New Columns (Non-Breaking)

**Step 2.1**: Add tracking columns to existing tables
```sql
-- Migration: 0002_add_tracking_columns.sql

-- Add to meeting_notes
ALTER TABLE meeting_notes
  ADD COLUMN converted_to_task_id INTEGER REFERENCES project_tasks(id) ON DELETE SET NULL,
  ADD COLUMN converted_at TIMESTAMP,
  ADD COLUMN selected_for_agenda BOOLEAN NOT NULL DEFAULT false;

-- Add to project_tasks
ALTER TABLE project_tasks
  ADD COLUMN origin_type TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN source_note_id INTEGER REFERENCES meeting_notes(id) ON DELETE SET NULL,
  ADD COLUMN source_meeting_id INTEGER REFERENCES meetings(id) ON DELETE SET NULL,
  ADD COLUMN source_team_board_id INTEGER REFERENCES team_board_items(id) ON DELETE SET NULL,
  ADD COLUMN selected_for_agenda BOOLEAN NOT NULL DEFAULT false;

-- Add to team_board_items
ALTER TABLE team_board_items
  ADD COLUMN project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
  ADD COLUMN promoted_to_task_id INTEGER REFERENCES project_tasks(id) ON DELETE SET NULL,
  ADD COLUMN promoted_at TIMESTAMP;
```

### Phase 3: Update Application Code

**Step 3.1**: Update backend services to use new tables

- Modify `ProjectService` to read/write `project_assignments`
- Modify `TaskService` to read/write `task_assignments`
- Create new `MeetingProjectService` for junction table
- Update all queries to join on new tables

**Step 3.2**: Update frontend components

- Update assignment selectors to use new role-based model
- Update meeting dashboard to use `meeting_projects` junction
- Add origin tracking to task displays
- Update note conversion flow to populate new fields

**Step 3.3**: Dual-write period (write to both old and new fields)

During transition:
- Write to both old `assigneeIds` and new `project_assignments`
- Ensures rollback safety
- Run for 1-2 weeks to validate

### Phase 4: Remove Old Columns (Breaking)

**Step 4.1**: Drop deprecated columns
```sql
-- Migration: 0003_remove_old_assignment_fields.sql

ALTER TABLE projects
  DROP COLUMN assignee_id,
  DROP COLUMN assignee_name,
  DROP COLUMN assignee_ids,
  DROP COLUMN assignee_names,
  DROP COLUMN support_people_ids,
  DROP COLUMN support_people,
  DROP COLUMN google_sheet_row_id,
  DROP COLUMN last_synced_at,
  DROP COLUMN sync_status,
  DROP COLUMN last_pulled_from_sheet_at,
  DROP COLUMN last_pushed_to_sheet_at,
  DROP COLUMN last_sheet_hash,
  DROP COLUMN last_app_hash,
  DROP COLUMN tasks_and_owners,
  DROP COLUMN review_in_next_meeting,
  DROP COLUMN last_discussed_date,
  DROP COLUMN meeting_discussion_points,
  DROP COLUMN meeting_decision_items;

-- Similar for project_tasks, team_board_items
```

**Step 4.2**: Clean up legacy code

- Remove old field references from services
- Remove dual-write logic
- Update TypeScript types

---

## API Changes Required

### New Endpoints

```typescript
// Meeting ↔ Project relationship
POST   /api/meetings/:meetingId/projects/:projectId
  → Add project to meeting agenda
  Body: { discussionPoints, questionsToAddress, section, agendaOrder }

PATCH  /api/meetings/:meetingId/projects/:projectId
  → Update discussion points, status, summary

DELETE /api/meetings/:meetingId/projects/:projectId
  → Remove project from meeting

GET    /api/meetings/:meetingId/projects
  → Get all projects in meeting (with discussion points, order, etc.)

GET    /api/projects/:projectId/meetings
  → Get all meetings that discussed this project

// Project assignments
GET    /api/projects/:projectId/assignments
  → Get all people assigned (owners + support)

POST   /api/projects/:projectId/assignments
  Body: { userId, userName, role: 'owner' | 'support' }

DELETE /api/projects/:projectId/assignments/:userId
  → Remove assignment

// Task assignments (parallel to project assignments)
GET    /api/tasks/:taskId/assignments
POST   /api/tasks/:taskId/assignments
DELETE /api/tasks/:taskId/assignments/:userId

// Note → Task conversion (updated)
POST   /api/meeting-notes/:noteId/convert-to-task
  → Creates task, updates note.convertedToTaskId, note.status = 'converted'
  Returns: { task, updatedNote }

// Team board promotion
POST   /api/team-board/:itemId/promote-to-project-task
  Body: { projectId }
  → Creates project task, updates item.promotedToTaskId
```

### Modified Endpoints

```typescript
// Projects - now includes assignments in response
GET    /api/projects/:id
Response: {
  ...projectFields,
  assignments: [
    { userId, userName, role: 'owner' },
    { userId, userName, role: 'support' },
  ],
  currentMeetings: [ /* meetings this project is in */ ]
}

// Tasks - now includes origin tracking
GET    /api/tasks/:id
Response: {
  ...taskFields,
  assignments: [ /* assigned users */ ],
  origin: {
    type: 'converted_from_note',
    sourceNote: { id, content, meetingId },
    sourceMeeting: { id, title, date }
  }
}

// Meeting notes - now includes conversion status
GET    /api/meetings/:meetingId/notes
Response: [
  {
    ...noteFields,
    convertedToTask: { id, title } | null,
    convertedAt: timestamp | null
  }
]
```

---

## Implementation Phases

### Phase 1: Foundation (Week 1-2)
- [ ] Create migration files for new tables
- [ ] Run migrations on development database
- [ ] Create TypeScript types for new schemas
- [ ] Write unit tests for new table structures

### Phase 2: Backend Services (Week 3-4)
- [ ] Create `ProjectAssignmentService`
- [ ] Create `TaskAssignmentService`
- [ ] Create `MeetingProjectService`
- [ ] Update `ProjectService` to use new assignments
- [ ] Update `TaskService` with origin tracking
- [ ] Update `MeetingNoteService` with conversion tracking
- [ ] Implement dual-write logic (old + new fields)

### Phase 3: API Layer (Week 5)
- [ ] Add new API endpoints
- [ ] Update existing endpoints
- [ ] Update API documentation
- [ ] Write integration tests

### Phase 4: Frontend Updates (Week 6-7)
- [ ] Update assignment selectors (owner vs support)
- [ ] Update meeting dashboard to show projects properly
- [ ] Update note → task conversion UI
- [ ] Add origin badges to tasks
- [ ] Update agenda planning tab with new selection logic
- [ ] Add team board → project task promotion flow

### Phase 5: Data Migration (Week 8)
- [ ] Write data migration scripts (old → new tables)
- [ ] Test migration on staging database
- [ ] Run migration on production
- [ ] Verify data integrity

### Phase 6: Cleanup (Week 9)
- [ ] Remove dual-write logic
- [ ] Drop old columns
- [ ] Remove deprecated code
- [ ] Update documentation

---

## Risks & Considerations

### Data Migration Risks

**Risk**: Existing projects with complex assignment data might not migrate cleanly
- **Mitigation**: Write comprehensive migration script with validation
- **Fallback**: Keep old columns for 2 weeks, allow manual fixes

**Risk**: Breaking changes could disrupt workflow during migration
- **Mitigation**: Dual-write period ensures rollback capability
- **Fallback**: Feature flags to toggle between old/new systems

### Performance Considerations

**Concern**: More junction tables = more JOINs
- **Analysis**: New indexes will keep queries fast
- **Testing**: Benchmark queries with realistic data volumes
- **Optimization**: Can denormalize commonly-accessed fields if needed

**Concern**: Additional tables increase storage
- **Analysis**: Assignment tables are small (avg 2-3 rows per project/task)
- **Impact**: Minimal storage increase (~5-10%)

### User Experience Impact

**Concern**: UI changes might confuse existing users
- **Mitigation**: Phase rollout with training documentation
- **Communication**: Announce changes ahead of time
- **Support**: Monitor for user feedback during transition

---

## Benefits Summary

### For Backend Development
✅ **Cleaner Schema**: Removed 20+ redundant fields
✅ **Better Relationships**: Clear many-to-many tracking
✅ **Audit Trails**: Origin tracking for tasks and notes
✅ **Normalized Data**: Consistent assignment model
✅ **Easier Queries**: Junction tables simplify complex queries

### For Frontend Development
✅ **Simpler Logic**: No checking multiple assignment fields
✅ **Richer UX**: Can show task origin, meeting history
✅ **Better Performance**: Optimized indexes for common queries
✅ **Feature Enablement**: Foundation for meeting minutes generation

### For Users
✅ **Clearer Ownership**: Distinct owner vs support roles
✅ **Better Context**: See where tasks came from
✅ **Meeting Integration**: Projects properly linked to meetings
✅ **Workflow Support**: Matches actual meeting-driven process

---

## Next Steps

1. **Review this document** with Christine and team
2. **Prioritize phases** based on immediate needs
3. **Create detailed tickets** for Phase 1 work
4. **Set up development branch** for refactor work
5. **Schedule migration window** for production deployment

---

## Questions for Discussion

1. **Owner vs Support**: Is the single "owner" + multiple "support" model correct, or do you need multiple owners?
2. **Team Board Integration**: Should team board items always be promotable to project tasks, or keep them separate?
3. **Meeting Minutes**: Do you want automated meeting minutes generation as part of this refactor?
4. **Timeline**: Is 9-week phased approach acceptable, or need faster/slower?
5. **Rollback Plan**: Comfort level with dual-write period length?

---

**Document Version**: 1.0
**Last Updated**: 2025-11-15
**Authors**: Claude (based on requirements from Katie)
