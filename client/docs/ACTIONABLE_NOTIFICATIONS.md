# Actionable Notifications Documentation

## Overview

The actionable notification system allows users to take quick actions directly from the notification center without navigating away. This includes actions like approving/declining event requests, marking tasks complete, and assigning contacts.

## Features

### ✅ Implemented Features

1. **Quick Action Buttons** - Buttons embedded in notification cards for instant actions
2. **Action Types Supported:**
   - **Event Requests**: Approve, Decline, Assign TSP Contact, Mark Toolkit Sent
   - **Tasks**: Mark Complete, Assign, Start
   - **Projects**: Mark Complete, Assign, Start
3. **Loading States** - Visual feedback during action execution
4. **Error Handling** - Toast notifications for success/failure
5. **Confirmation Dialogs** - Automatic confirmation for destructive actions (decline, delete)
6. **Action History Tracking** - All actions logged to `notification_action_history` table
7. **Optimistic Updates** - Immediate UI feedback with automatic query invalidation

## Architecture

### Database Schema

#### `notifications` Table
```typescript
{
  id: serial
  userId: varchar
  type: varchar
  priority: varchar
  title: text
  message: text
  category: varchar
  relatedType: varchar      // 'event_request', 'task', 'project'
  relatedId: integer        // ID of the related entity
  actionText: text          // ✨ Button text (e.g., "Approve", "Mark Complete")
  actionUrl: text           // Optional URL for navigation
  isRead: boolean
  isArchived: boolean
  metadata: jsonb
  createdAt: timestamp
}
```

#### `notification_action_history` Table (NEW)
```typescript
{
  id: serial
  notificationId: integer
  userId: varchar
  actionType: varchar       // 'approve', 'decline', 'mark_complete', etc.
  actionStatus: varchar     // 'pending', 'success', 'failed'
  startedAt: timestamp
  completedAt: timestamp
  errorMessage: text
  relatedType: varchar
  relatedId: integer
  undoneAt: timestamp       // For future undo functionality
  undoneBy: varchar
  metadata: jsonb
}
```

### API Endpoints

#### Execute Action
```
POST /api/notifications/:id/actions/:actionType
```

**Request Body:**
```json
{
  "actionData": {
    // Optional action-specific data
    "tspContactId": "user-123",  // For assign_tsp_contact
    "assigneeId": "user-456"     // For assign actions
  }
}
```

**Response:**
```json
{
  "success": true,
  "result": {
    "success": true,
    "event": { /* updated event object */ },
    "message": "Event request approve successful"
  },
  "notification": { /* updated notification */ },
  "actionHistory": { /* action history record */ }
}
```

#### Get Action History
```
GET /api/notifications/:id/action-history
```

**Response:**
```json
{
  "history": [
    {
      "id": 1,
      "notificationId": 123,
      "actionType": "approve",
      "actionStatus": "success",
      "startedAt": "2025-11-01T10:00:00Z",
      "completedAt": "2025-11-01T10:00:01Z"
    }
  ]
}
```

### Frontend Components

#### `NotificationActionButton`

Reusable action button component with built-in states and error handling.

**Usage:**
```tsx
import { NotificationActionButton } from '@/components/NotificationActionButton';

<NotificationActionButton
  notificationId={notification.id}
  actionType="approve"
  actionText="Approve Event"
  actionUrl="/event-requests/123"
  variant="default"  // or 'destructive', 'outline', 'secondary'
  onSuccess={() => {
    console.log('Action completed!');
  }}
  requireConfirmation={false}
  confirmationMessage="Are you sure?"
/>
```

**Props:**
- `notificationId` - ID of the notification
- `actionType` - Type of action to execute (must match backend handler)
- `actionText` - Button text to display
- `actionUrl` - Optional URL for navigation-only actions
- `variant` - Button style variant
- `actionData` - Optional data to send with action
- `onSuccess` - Callback on successful action
- `requireConfirmation` - Force confirmation dialog
- `confirmationMessage` - Custom confirmation message

#### `NotificationActions`

Helper component for rendering multiple action buttons.

**Usage:**
```tsx
import { NotificationActions } from '@/components/NotificationActionButton';

<NotificationActions
  notificationId={notification.id}
  actions={[
    { type: 'approve', text: 'Approve', variant: 'default' },
    { type: 'decline', text: 'Decline', variant: 'destructive' }
  ]}
  onActionSuccess={() => console.log('Action done!')}
/>
```

## How to Create Actionable Notifications

### Example: Event Request Approval

```typescript
import { db } from './db';
import { notifications } from '../shared/schema';

await db.insert(notifications).values({
  userId: 'user-123',
  type: 'alert',
  priority: 'high',
  title: 'New Event Request',
  message: 'Springfield Elementary has requested an event for Dec 15',
  category: 'events',
  relatedType: 'event_request',
  relatedId: eventId,
  actionText: 'Approve',        // ← Makes the button appear
  actionUrl: `/event-requests/${eventId}`,
  isRead: false,
  isArchived: false,
});
```

### Supported Action Types

| Action Type | Related Type | Effect |
|-------------|--------------|--------|
| `approve` / `accept` | `event_request` | Sets status to "scheduled" |
| `decline` / `reject` | `event_request` | Sets status to "declined" |
| `assign_tsp_contact` | `event_request` | Assigns TSP contact (requires `actionData.tspContactId`) |
| `mark_toolkit_sent` | `event_request` | Marks toolkit as sent |
| `mark_complete` / `complete` | `task` | Sets status to "completed" |
| `assign` | `task` / `project` | Adds assignee (requires `actionData.assigneeId`) |
| `start` | `task` / `project` | Sets status to "in_progress" |

## Testing

### Manual Testing

1. **Run the test script to create sample notifications:**
   ```bash
   npx tsx server/test-actionable-notifications.ts
   ```

2. **Log in to the application**

3. **Click the bell icon** to open notifications

4. **Click action buttons** to test functionality

### Automated Testing

```typescript
// Example test
describe('Notification Actions', () => {
  it('should approve event request', async () => {
    const response = await request(app)
      .post('/api/notifications/123/actions/approve')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });
});
```

## Action Flow Diagram

```
User clicks action button
         ↓
NotificationActionButton component
         ↓
POST /api/notifications/:id/actions/:actionType
         ↓
Create action history record (status: pending)
         ↓
Execute action handler based on relatedType:
  - handleEventRequestAction()
  - handleTaskAction()
  - handleProjectAction()
         ↓
Update related entity (event/task/project)
         ↓
Update action history (status: success/failed)
         ↓
Mark notification as read
         ↓
Invalidate queries to refresh UI
         ↓
Show success toast
```

## Security & Permissions

1. **Authentication Required** - All action endpoints require user authentication
2. **Ownership Validation** - Users can only act on their own notifications
3. **Permission Checks** - Action handlers should validate user permissions (future enhancement)
4. **Audit Trail** - All actions logged to `notification_action_history`

## Future Enhancements

### Planned Features
- [ ] Undo/Redo functionality using `undoneAt` and `undoneBy` fields
- [ ] Bulk actions (execute same action on multiple notifications)
- [ ] Action previews (show what will happen before executing)
- [ ] Real-time Socket.IO updates when actions complete
- [ ] Action shortcuts (keyboard shortcuts for common actions)
- [ ] Smart action suggestions based on context
- [ ] Action templates for admins to create custom actions

### Nice-to-Have
- [ ] Action scheduling (schedule action for later)
- [ ] Conditional actions (if-then workflows)
- [ ] Action macros (combine multiple actions)
- [ ] Action permissions per role
- [ ] Mobile-optimized action sheets
- [ ] Action analytics dashboard

## Troubleshooting

### Action button doesn't appear
- Ensure `actionText` field is set on the notification
- Check that the notification is fetched correctly

### Action fails with 404
- Verify `relatedType` and `relatedId` are set correctly
- Ensure the related entity exists in the database

### Action completes but UI doesn't update
- Check that query invalidation is working
- Verify React Query cache keys match

### Permission errors
- Ensure user is authenticated
- Verify notification belongs to the user
- Check user has permission for the action (future feature)

## Support

For questions or issues:
1. Check the console for error messages
2. Review action history in database: `SELECT * FROM notification_action_history WHERE notification_id = ?`
3. Check server logs for action execution errors
4. Review this documentation

## Related Files

### Backend
- `server/routes/notifications/actions.ts` - Action execution endpoints
- `shared/schema.ts` - Database schema (lines 2812-2856)
- `server/routes/notifications/index.ts` - Routes mounting

### Frontend
- `client/src/components/NotificationActionButton.tsx` - Action button component
- `client/src/components/enhanced-notifications.tsx` - Notification list UI

### Documentation
- `NOTIFICATION_CENTER_ANALYSIS.md` - Comprehensive system analysis
- `server/routes/notifications/README.md` - API documentation
