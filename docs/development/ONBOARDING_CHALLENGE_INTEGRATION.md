# Onboarding Challenge Integration Guide

## Overview
The onboarding challenge system gamifies feature exploration to encourage users to try underutilized features like chat, important documents, important links, and the team board.

## How It Works

1. **Challenges**: Pre-defined actions users can complete (send chat message, view documents, etc.)
2. **Points**: Each challenge awards points when completed
3. **Leaderboard**: Users compete on a team leaderboard
4. **Progress Tracking**: Visual progress indicator shows completion percentage
5. **Celebrations**: Toast notifications celebrate achievements

## Database Setup

Run this SQL to create the necessary tables:

```sql
CREATE TABLE IF NOT EXISTS onboarding_challenges (
  id SERIAL PRIMARY KEY,
  action_key VARCHAR NOT NULL UNIQUE,
  title VARCHAR NOT NULL,
  description TEXT,
  category VARCHAR NOT NULL,
  points INTEGER NOT NULL DEFAULT 10,
  icon VARCHAR,
  "order" INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS onboarding_progress (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR NOT NULL,
  challenge_id INTEGER NOT NULL,
  completed_at TIMESTAMP NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',
  UNIQUE(user_id, challenge_id)
);
```

## Initialize Default Challenges

Call this endpoint as an admin to populate default challenges:

```bash
POST /api/onboarding/admin/initialize
```

Or call from server:
```javascript
import { onboardingService } from './services/onboarding-service';
await onboardingService.initializeDefaultChallenges();
```

## Integration Examples

### 1. Chat - First Message
Add to your chat component when a user sends their first message:

```typescript
import { useOnboardingTracker } from '@/hooks/useOnboardingTracker';

function ChatComponent() {
  const { track } = useOnboardingTracker();

  const handleSendMessage = async (message: string) => {
    // ... existing send logic

    // Track the challenge
    track('chat_first_message');
  };
}
```

### 2. Important Documents - View
Add when user visits Important Documents page:

```typescript
import { useOnboardingTracker } from '@/hooks/useOnboardingTracker';

function ImportantDocuments() {
  const { track } = useOnboardingTracker();

  useEffect(() => {
    // Track when component mounts
    track('view_important_documents');
  }, []);
}
```

### 3. Important Links - View
Add when user visits Important Links page:

```typescript
import { useOnboardingTracker } from '@/hooks/useOnboardingTracker';

function ImportantLinks() {
  const { track } = useOnboardingTracker();

  useEffect(() => {
    track('view_important_links');
  }, []);
}
```

### 4. Team Board - View
```typescript
function TeamBoard() {
  const { track } = useOnboardingTracker();

  useEffect(() => {
    track('view_team_board');
  }, []);
}
```

### 5. Team Board - Post
```typescript
function TeamBoard() {
  const { track } = useOnboardingTracker();

  const handleCreatePost = async (post: any) => {
    // ... existing create logic

    track('post_team_board');
  };
}
```

### 6. Team Board - Like
```typescript
function TeamBoardPost() {
  const { track } = useOnboardingTracker();

  const handleLike = async (postId: number) => {
    // ... existing like logic

    track('like_team_board_post');
  };
}
```

### 7. Inbox - Send Message
```typescript
function GmailStyleInbox() {
  const { track } = useOnboardingTracker();

  const handleSendMessage = async () => {
    // ... existing send logic

    track('inbox_send_email');
  };
}
```

## Available Challenges

| Action Key | Title | Category | Points |
|------------|-------|----------|--------|
| `chat_first_message` | Send your first chat message | communication | 10 |
| `chat_read_messages` | Read team messages | communication | 5 |
| `inbox_send_email` | Send an inbox message | communication | 10 |
| `view_important_documents` | View Important Documents | documents | 10 |
| `view_important_links` | Explore Important Links | documents | 10 |
| `view_team_board` | Check the Team Board | team | 15 |
| `post_team_board` | Post to Team Board | team | 20 |
| `like_team_board_post` | Like a Team Board post | team | 5 |
| `view_projects` | Explore Projects | projects | 10 |
| `view_meetings` | Check Meeting Notes | projects | 10 |

## API Endpoints

### Get User's Challenges
```
GET /api/onboarding/challenges
```

Returns all challenges with user's completion status.

### Track Challenge Completion
```
POST /api/onboarding/track/:actionKey
```

Body (optional):
```json
{
  "metadata": {
    "any": "additional data"
  }
}
```

### Get User Stats
```
GET /api/onboarding/stats
```

Returns:
```json
{
  "totalPoints": 45,
  "completedChallenges": 5,
  "totalChallenges": 10,
  "completionPercentage": 50
}
```

### Get Leaderboard
```
GET /api/onboarding/leaderboard?limit=10
```

Returns top users by points.

## UI Components

### OnboardingChallengeButton
Already added to the dashboard header. Shows:
- Trophy icon
- Completion count badge
- Pulsing animation if incomplete

### OnboardingChallenge Dialog
Modal showing:
- User's points and progress
- Challenge list grouped by category
- Leaderboard tab
- Progress bar

## Adding New Challenges

1. Add to database via SQL:
```sql
INSERT INTO onboarding_challenges (action_key, title, description, category, points, icon, "order")
VALUES ('new_action', 'New Challenge Title', 'Description here', 'category_name', 15, 'IconName', 11);
```

2. Or add to `initializeDefaultChallenges()` in `/server/services/onboarding-service.ts`

3. Add tracking call to the relevant component

## Testing

1. View the challenge button in dashboard header
2. Click to open the challenge modal
3. Complete actions (send chat, visit pages, etc.)
4. Watch for celebration toasts
5. Check leaderboard for your ranking

## Notes

- Each challenge can only be completed once per user
- Duplicate completions are silently ignored (no error)
- The system automatically tracks and awards points
- Challenges are refetched every 30 seconds to stay updated
