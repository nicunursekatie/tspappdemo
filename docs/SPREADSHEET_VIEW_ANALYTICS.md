# Spreadsheet View Analytics Tracking

This document describes the analytics events tracked for the spreadsheet view feature discovery improvements.

## Overview

To measure the success of making spreadsheet view the default and adding the floating action button, we track several key events throughout the user's interaction with event requests.

---

## Tracked Events

### 1. **Initial Page Load** (`event_requests_initial_view`)

**When:** User first loads the Event Requests page
**Purpose:** Track what tab users land on (should be 'scheduled' for admins/core team/committee members)

**Properties:**
- `initial_tab`: The tab shown on page load (e.g., 'scheduled', 'new', 'in_process')
- `user_role`: User's role (e.g., 'admin', 'core_team', 'committee_member')
- `is_new_default`: Boolean indicating if user landed on the new default 'scheduled' tab
- `timestamp`: ISO timestamp of page load

**Success Metric:** High percentage of target users (admin, core_team, committee_member) landing on 'scheduled' tab

---

### 2. **Scheduled Tab Viewed** (`scheduled_tab_viewed`)

**When:** User views the Scheduled tab (either by landing on it or navigating to it)
**Purpose:** Track spreadsheet view as the default view mode

**Properties:**
- `default_view`: Always 'spreadsheet' (the new default)
- `is_default`: Always `true`
- `timestamp`: ISO timestamp

**Success Metric:** Track frequency of scheduled tab views

---

### 3. **View Mode Changed** (`view_mode_changed`)

**When:** User switches between card view and spreadsheet view within Scheduled tab
**Purpose:** Understand user preferences and whether they switch away from spreadsheet view

**Properties:**
- `from`: Previous view mode ('card' or 'spreadsheet')
- `to`: New view mode ('card' or 'spreadsheet')
- `tab`: Always 'scheduled'
- `timestamp`: ISO timestamp

**Success Metrics:**
- Low rate of switching from 'spreadsheet' to 'card' = users prefer spreadsheet
- High rate of switching from 'card' to 'spreadsheet' = users seek out spreadsheet view

---

### 4. **View Mode Duration** (`view_mode_duration`)

**When:** User switches view modes (tracks time spent in previous mode)
**Purpose:** Measure engagement with each view mode

**Properties:**
- `view_mode`: The view mode being measured ('card' or 'spreadsheet')
- `duration_seconds`: Time spent in that view (in seconds)
- `switched_to`: The view mode user switched to

**Success Metric:** Higher average duration in 'spreadsheet' mode indicates successful adoption

---

### 5. **Floating Button Click** (`spreadsheet_quick_access`)

**When:** User clicks the green floating action button to jump to spreadsheet view
**Purpose:** Measure floating button discovery and usage

**Properties:**
- `feature`: Always 'floating_spreadsheet_button'
- `from_tab`: Tab user was on when clicking button
- `to_tab`: Always 'scheduled'
- `user_role`: User's role
- `timestamp`: ISO timestamp

**Success Metrics:**
- Button clicks from various tabs = good discoverability
- Repeat usage = feature is valuable

---

### 6. **Tab Views** (`tab_{tab_name}_viewed`)

**When:** User navigates to any tab
**Purpose:** Track overall navigation patterns

**Button Clicks Tracked:**
- `tab_new_viewed`
- `tab_in_process_viewed`
- `tab_scheduled_viewed`
- `tab_completed_viewed`
- `tab_declined_viewed`
- `tab_my_assignments_viewed`
- `tab_admin_overview_viewed`

**Success Metric:** Distribution of tab views shows user workflow patterns

---

### 7. **View Toggle Button Clicks**

**When:** User clicks Card View or Spreadsheet View toggle buttons
**Purpose:** Granular tracking of view preference changes

**Button Clicks Tracked:**
- `switch_to_card_view` (context: 'event_requests_scheduled_tab')
- `switch_to_spreadsheet_view` (context: 'event_requests_scheduled_tab')

---

### 8. **Floating Button Tip Dismissal** (`dismiss_floating_tip`)

**When:** User dismisses the floating button tooltip
**Purpose:** Track tooltip interaction

**Success Metric:** Dismissals after clicks = tooltip successfully informed users

---

## Granular Spreadsheet Interaction Tracking

These events track specific interactions within the spreadsheet view to understand power user behaviors.

### 9. **Spreadsheet View Loaded** (`spreadsheet_view_loaded`)

**When:** Spreadsheet view component mounts
**Purpose:** Track spreadsheet view engagement

**Properties:**
- `total_events`: Number of scheduled events shown
- `default_date_range`: Current date filter setting
- `has_custom_column_order`: Boolean indicating custom column ordering
- `timestamp`: ISO timestamp

**Success Metric:** High view counts indicate feature adoption

---

### 10. **Column Sorted** (`spreadsheet_column_sorted`)

**When:** User clicks column header to sort
**Purpose:** Understand which columns users sort by most

**Properties:**
- `field`: Column being sorted (e.g., 'eventDate', 'groupName')
- `direction`: Sort direction ('asc' or 'desc')
- `previous_field`: Previously sorted column
- `previous_direction`: Previous sort direction
- `timestamp`: ISO timestamp

**Button Click:** `sort_by_{field}_{direction}` (context: 'spreadsheet_view')

**Success Metric:** Frequent sorting = users organizing data to their needs

---

### 11. **Search Used** (`spreadsheet_searched`)

**When:** User types in search box (debounced 500ms)
**Purpose:** Track search patterns and relevance

**Properties:**
- `query_length`: Length of search query
- `results_count`: Number of results after filtering
- `timestamp`: ISO timestamp

**Success Metric:** Search usage shows users finding specific events quickly

---

### 12. **Date Filter Changed** (`spreadsheet_date_filter_changed`)

**When:** User changes date range filter
**Purpose:** Understand which timeframes users focus on

**Properties:**
- `filter`: Date range selected ('thisWeek', 'nextWeek', 'next2Weeks', 'nextMonth', 'all')
- `events_shown`: Number of events after filtering
- `timestamp`: ISO timestamp

**Button Click:** `filter_by_{range}` (context: 'spreadsheet_view')

**Success Metric:** Filter usage shows users focusing on specific timeframes

---

### 13. **Inline Edit Started** (`spreadsheet_inline_edit_started`)

**When:** User double-clicks cell to start editing
**Purpose:** Track inline editing adoption

**Properties:**
- `field`: Field being edited
- `event_id`: Event being modified
- `timestamp`: ISO timestamp

**Success Metric:** Frequent inline edits = power users leveraging quick edit feature

---

### 14. **Inline Edit Saved** (`spreadsheet_inline_edit_saved`)

**When:** User saves inline cell edit
**Purpose:** Track successful inline editing completion

**Properties:**
- `field`: Field that was edited
- `event_id`: Event that was modified
- `timestamp`: ISO timestamp

**Button Click:** `save_inline_edit_{field}` (context: 'spreadsheet_view')

**Success Metric:** High save rate (vs cancels) = feature is useful

---

### 15. **Column Reordered** (`spreadsheet_column_reordered`)

**When:** User drags column to new position
**Purpose:** Track column customization

**Properties:**
- `from_index`: Original column position
- `to_index`: New column position
- `column_moved`: Column ID that was moved
- `is_custom_order`: Boolean indicating if user already had custom order
- `timestamp`: ISO timestamp

**Button Click:** `reorder_columns` (context: 'spreadsheet_view')

**Success Metric:** Column reordering shows users personalizing their workflow

---

## Key Questions to Answer

### Question 1: Are users discovering spreadsheet view?

**Check:**
- High `scheduled_tab_viewed` events
- Low `view_mode_changed` from 'spreadsheet' to 'card'
- High `view_mode_duration` for 'spreadsheet'

**Interpretation:** If users land in spreadsheet and stay there, discovery is successful.

---

### Question 2: Is the floating button being used?

**Check:**
- `spreadsheet_quick_access` event frequency
- Variety of `from_tab` values in `spreadsheet_quick_access`

**Interpretation:** Button clicks from different tabs show users use it as quick navigation.

---

### Question 3: Do users prefer spreadsheet view?

**Check:**
- Average `view_mode_duration` for 'spreadsheet' vs 'card'
- Ratio of `switch_to_spreadsheet_view` to `switch_to_card_view`

**Interpretation:** Longer time in spreadsheet + fewer switches away = strong preference.

---

### Question 4: Has the change improved adoption?

**Before/After Comparison:**

| Metric | Before | After (Target) |
|--------|--------|----------------|
| Steps to reach spreadsheet view | 7 | 0 |
| % Users discovering spreadsheet | Low | >80% |
| Avg time in spreadsheet (seconds) | N/A | >120 |
| Floating button usage | N/A | >50% click at least once |

---

## Viewing Analytics

### Google Analytics (if configured)

1. Navigate to **Events** in Google Analytics
2. Search for event names listed above
3. View event count, parameters, and user segmentation

### Custom Analytics Dashboard

If you have a custom dashboard, query these event names:
- `event_requests_initial_view`
- `scheduled_tab_viewed`
- `view_mode_changed`
- `view_mode_duration`
- `spreadsheet_quick_access`

---

## Sample Queries

### How many users land on scheduled tab by default?

```sql
SELECT
  user_role,
  COUNT(*) as loads,
  SUM(CASE WHEN initial_tab = 'scheduled' THEN 1 ELSE 0 END) as scheduled_loads,
  ROUND(100.0 * SUM(CASE WHEN initial_tab = 'scheduled' THEN 1 ELSE 0 END) / COUNT(*), 2) as percentage
FROM event_requests_initial_view
GROUP BY user_role;
```

### Average time spent in each view mode

```sql
SELECT
  view_mode,
  AVG(duration_seconds) as avg_duration,
  COUNT(*) as view_sessions
FROM view_mode_duration
GROUP BY view_mode;
```

### Floating button usage by role

```sql
SELECT
  user_role,
  COUNT(*) as button_clicks,
  COUNT(DISTINCT user_id) as unique_users
FROM spreadsheet_quick_access
GROUP BY user_role;
```

---

## Success Indicators

✅ **High Adoption:**
- >80% of admins/core team land on 'scheduled' tab
- >75% of time spent in 'spreadsheet' vs 'card' view
- <10% switch from spreadsheet to card
- >50% of users click floating button at least once

⚠️ **Needs Improvement:**
- <50% landing on scheduled tab
- Users immediately switch away from spreadsheet
- No floating button clicks
- Very short time in spreadsheet view

---

## Next Steps Based on Analytics

### If spreadsheet view is highly used:
- ✅ Feature is successful
- Consider removing card view entirely
- Add more spreadsheet-specific features

### If users still switch to card view frequently:
- Interview users to understand why
- Improve spreadsheet view features
- Add toggle for default preference

### If floating button is rarely used:
- Button may not be discoverable enough
- Make it larger or add animation
- Consider moving it or adding more visible prompt

---

## Monitoring Setup

**Recommended:**
- Set up weekly automated reports for key metrics
- Create alerts if scheduled tab views drop below 50%
- Dashboard showing before/after comparison

**Tools:**
- Google Analytics custom dashboard
- Internal admin analytics panel
- Spreadsheet tracking (if exporting data)

---

## Timeline for Evaluation

- **Week 1:** Initial deployment, monitor for errors
- **Week 2-4:** Collect baseline data, track adoption curve
- **Month 2:** Analyze trends, identify patterns
- **Month 3:** Compare against old workflow, validate success

---

## Contact

For questions about analytics implementation or interpretation:
- Review `/client/src/hooks/useAnalytics.ts` for tracking implementation
- Check Google Analytics configuration
- Review activity logs in admin panel
