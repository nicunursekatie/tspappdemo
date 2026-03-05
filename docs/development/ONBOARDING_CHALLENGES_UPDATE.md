# Onboarding Challenges Update - December 2025

## Summary

Updated the onboarding challenges system to match current app features and branding. Fixed mismatches between challenge definitions and live features, added new challenges for missing features, and updated navigation/tracking.

## Changes Made

### 1. Updated Challenge Definitions ([server/services/onboarding-service.ts](server/services/onboarding-service.ts#L354-L511))

#### Renamed Challenges:
- `view_important_documents` → `view_resources` - "Explore Resources"
- `view_important_links` → `view_quick_tools` - "Check out Quick Tools"
- `view_team_board` → `view_holding_zone` - "Visit TSP Holding Zone"
- `post_team_board` → `post_holding_zone` - "Post to TSP Holding Zone"
- `like_team_board_post` → `like_holding_zone_post` - "Like a post in Holding Zone"

#### New Challenges Added:
- `view_wishlist` - View Amazon Wishlist (10 pts, documentation category)
- `view_my_actions` - Check My Actions Dashboard (15 pts, productivity category)
- `set_availability` - Set Your Availability (15 pts, productivity category)
- `view_event_requests` - View Event Requests (10 pts, operations category)
- `view_expenses` - Explore Expenses & Receipts (10 pts, operations category)

#### Updated Categories:
- `documents` → `documentation`
- `projects` → `strategic`
- Added new categories: `productivity`, `operations`, `strategic`

### 2. Updated Navigation Mapping ([client/src/components/onboarding-challenge.tsx](client/src/components/onboarding-challenge.tsx#L98-L185))

- Updated challenge navigation to use current section names
- Added backward compatibility for legacy action keys
- Updated all navigation instructions to match current UI

### 3. Updated UI Components

#### Icon Map ([client/src/components/onboarding-challenge.tsx](client/src/components/onboarding-challenge.tsx#L76-L92))
- Added new icons: `StickyNote`, `ListTodo`, `Sandwich`, `Receipt`, `Gift`

#### Category Colors ([client/src/components/onboarding-challenge.tsx](client/src/components/onboarding-challenge.tsx#L94-L116))
- Added colors for new categories: productivity, operations, strategic
- Maintained backward compatibility for legacy categories

### 4. Added Onboarding Tracking

Updated pages to track onboarding challenges:

- [client/src/pages/resources.tsx](client/src/pages/resources.tsx) - Tracks `view_resources`
- [client/src/pages/important-links.tsx](client/src/pages/important-links.tsx) - Tracks `view_quick_tools`
- [client/src/pages/wishlist.tsx](client/src/pages/wishlist.tsx) - Tracks `view_wishlist`
- [client/src/pages/ExpensesPage.tsx](client/src/pages/ExpensesPage.tsx) - Tracks `view_expenses`
- [client/src/pages/my-availability.tsx](client/src/pages/my-availability.tsx) - Tracks `set_availability`
- [client/src/components/action-center.tsx](client/src/components/action-center.tsx) - Tracks `view_my_actions`
- [client/src/components/event-requests/index.tsx](client/src/components/event-requests/index.tsx) - Tracks `view_event_requests`

### 5. Created Migration Script

Created [server/scripts/migrate-onboarding-challenges.ts](server/scripts/migrate-onboarding-challenges.ts):

- Updates existing challenge action keys
- Updates category names
- Adds new challenges if they don't exist
- Can be run via admin endpoint: `POST /api/onboarding/admin/migrate`

### 6. Added Admin Migration Endpoint

Added to [server/routes/onboarding.ts](server/routes/onboarding.ts#L114-L129):
- `POST /api/onboarding/admin/migrate` - Runs the migration script (admin only)

## Updated Challenge List

### Communication (3 challenges)
1. Send your first chat message (10 pts)
2. Read team messages (5 pts)
3. Send an inbox message (10 pts)

### Documentation (3 challenges)
4. Explore Resources (10 pts) ⬅️ Updated
5. Check out Quick Tools (10 pts) ⬅️ Updated
6. View Amazon Wishlist (10 pts) ⬅️ New

### Team (3 challenges)
7. Visit TSP Holding Zone (15 pts) ⬅️ Updated
8. Post to TSP Holding Zone (20 pts) ⬅️ Updated
9. Like a post in Holding Zone (5 pts) ⬅️ Updated

### Productivity (2 challenges)
10. Check My Actions Dashboard (15 pts) ⬅️ New
11. Set Your Availability (15 pts) ⬅️ New

### Operations (3 challenges)
12. Submit a Collection Log Entry (25 pts) ⬅️ Updated points
13. View Event Requests (10 pts) ⬅️ New
14. Explore Expenses & Receipts (10 pts) ⬅️ New

### Strategic (2 challenges)
15. Explore Projects (10 pts)
16. Check Meeting Notes (10 pts)

**Total: 16 challenges, 190 points**

## Migration Instructions

### Option 1: Via Admin Panel (Recommended)
1. Log in as admin
2. Use dev tools or API client to make a POST request to `/api/onboarding/admin/migrate`
3. Verify the migration completed successfully

### Option 2: Via Onboarding Admin Page
1. Navigate to the Onboarding Admin page
2. Click "Run Migration" button (if UI is added)
3. Verify the migration completed successfully

### Option 3: Direct Database Update
```sql
-- Update old challenge keys to new ones
UPDATE onboarding_challenges SET
  action_key = 'view_resources',
  title = 'Explore Resources',
  description = 'Check out the Resources page to find important documents, templates, and tools.',
  category = 'documentation'
WHERE action_key = 'view_important_documents';

-- ... (repeat for other updates)
```

## Testing Checklist

- [ ] Run migration script to update existing challenges
- [ ] Verify all challenges appear correctly in the UI
- [ ] Test navigation from challenges to their target pages
- [ ] Verify tracking works for all new challenges
- [ ] Check that legacy action keys still work (backward compatibility)
- [ ] Verify leaderboard updates correctly
- [ ] Test that stats update when challenges are completed

## Backward Compatibility

The following legacy action keys are still supported:
- `view_important_documents` → redirects to Resources
- `view_important_links` → redirects to Quick Tools
- `view_team_board` → redirects to TSP Holding Zone
- `post_team_board` → redirects to TSP Holding Zone
- `like_team_board_post` → redirects to TSP Holding Zone

## Future Enhancements

Consider adding challenges for:
- Driver Planning Dashboard
- Groups Catalog
- TSP Network
- Driver Planning
- Meetings with AI features
- Collections Analytics

## Notes

- All challenge icons use Lucide React icons
- Points have been adjusted to reflect task complexity
- Categories now better reflect the app's information architecture
- Tracking is automatic when users visit pages (non-intrusive)
