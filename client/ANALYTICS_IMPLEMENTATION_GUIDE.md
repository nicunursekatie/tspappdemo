# Google Analytics Implementation Guide

## Overview
Your app now has comprehensive Google Analytics tracking set up. This guide shows you how to add tracking to new features and pages.

## What's Already Implemented

### 1. Core Analytics Setup
- ✅ Google Analytics tag installed in `index.html`
- ✅ Analytics utility functions in `client/lib/analytics.ts`
- ✅ Custom `useAnalytics` hook in `client/src/hooks/useAnalytics.ts`

### 2. Already Tracked Pages/Features
- **Logos Page** (`pages/logos.tsx`)
  - Logo downloads
  - Logo preview clicks

- **Weekly Monitoring Dashboard** (`components/weekly-monitoring-dashboard.tsx`)
  - Report exports
  - SMS reminders (bulk and individual)
  - Email reminders

## How to Add Tracking to New Features

### Step 1: Import the Hook
```tsx
import { useAnalytics } from '@/hooks/useAnalytics';
```

### Step 2: Initialize in Component
```tsx
export default function YourComponent() {
  const { trackButtonClick, trackDownload, trackFormSubmit } = useAnalytics();
  // ... rest of component
}
```

### Step 3: Add Tracking to Actions

#### Button Clicks
```tsx
<Button
  onClick={() => {
    trackButtonClick('button_name', 'page_location');
    // ... existing onClick logic
  }}
>
  Click Me
</Button>
```

#### Form Submissions
```tsx
const handleSubmit = async (data) => {
  try {
    await submitForm(data);
    trackFormSubmit('form_name', true);
  } catch (error) {
    trackFormSubmit('form_name', false);
    trackError(error.message, 'form_name');
  }
};
```

#### Downloads
```tsx
const handleDownload = (fileName) => {
  // ... download logic
  trackDownload(fileName, 'pdf');
};
```

#### Navigation
```tsx
const handleNavigate = (path) => {
  navigate(path);
  trackNavigation(path, 'current_page');
};
```

## Available Tracking Methods

### `trackButtonClick(buttonName, location?)`
Track button/link clicks
- **Example**: `trackButtonClick('download_report', 'dashboard')`

### `trackFormSubmit(formName, success)`
Track form submissions (success or failure)
- **Example**: `trackFormSubmit('sandwich_count_entry', true)`

### `trackDownload(fileName, fileType?)`
Track file downloads
- **Example**: `trackDownload('weekly_report.pdf', 'report')`

### `trackDocumentView(documentName, documentType?)`
Track document/page views
- **Example**: `trackDocumentView('food_safety_guidelines', 'pdf')`

### `trackCommunication(type, recipient?)`
Track communication actions (email, sms, chat)
- **Example**: `trackCommunication('email', 'host_location_name')`

### `trackSearch(query, resultsCount?)`
Track search queries
- **Example**: `trackSearch('sandwich count', 15)`

### `trackError(errorMessage, location?)`
Track errors for debugging
- **Example**: `trackError('Failed to load data', 'dashboard')`

### `trackReportGeneration(reportType, format?)`
Track report generation
- **Example**: `trackReportGeneration('weekly_monitoring', 'pdf')`

### `trackDataEntry(dataType, location?)`
Track data entry actions
- **Example**: `trackDataEntry('sandwich_count', 'weekly_form')`

### `trackFeatureUse(featureName, action?)`
Track feature usage
- **Example**: `trackFeatureUse('sms_reminders', 'enable')`

### `trackNavigation(destination, source?)`
Track navigation between pages
- **Example**: `trackNavigation('/meetings', 'dashboard')`

## Priority Pages to Add Tracking

Here are the most impactful pages to add tracking to next:

### High Priority
1. **Dashboard** (`pages/dashboard.tsx`)
   - Track card clicks
   - Track navigation to different sections

2. **Data Entry Forms** (sandwich counts, event requests)
   - Track form submissions
   - Track validation errors

3. **Meetings** (`pages/meetings.tsx`)
   - Track meeting creation
   - Track agenda downloads

4. **Important Documents** (`pages/important-documents.tsx`)
   - Track document views
   - Track downloads

### Medium Priority
5. **Grant Metrics** (`pages/grant-metrics.tsx`)
   - Track report generation
   - Track data exports

6. **Host Communication**
   - Track message sends
   - Track chat usage

7. **Calendar/Availability**
   - Track availability updates
   - Track calendar views

## Example: Adding Tracking to Dashboard

```tsx
// pages/dashboard.tsx
import { useAnalytics } from '@/hooks/useAnalytics';

export default function Dashboard() {
  const { trackButtonClick, trackNavigation } = useAnalytics();
  const navigate = useNavigate();

  const handleNavigateToMeetings = () => {
    trackNavigation('/meetings', 'dashboard_card');
    navigate('/meetings');
  };

  const handleQuickAction = (action: string) => {
    trackButtonClick(action, 'dashboard_quick_actions');
    // ... perform action
  };

  return (
    <div>
      <Card onClick={handleNavigateToMeetings}>
        <CardTitle>Meetings</CardTitle>
      </Card>

      <Button onClick={() => handleQuickAction('add_sandwich_count')}>
        Add Count
      </Button>
    </div>
  );
}
```

## Viewing Analytics Data

1. Log into Google Analytics at [analytics.google.com](https://analytics.google.com)
2. Navigate to your property (G-9M4XDZGN68)
3. View Events:
   - Go to **Reports** → **Engagement** → **Events**
   - You'll see custom events organized by category

## Best Practices

1. **Be Consistent**: Use consistent naming conventions
   - Good: `download_report`, `submit_form`
   - Bad: `Download Report`, `submit-FORM`

2. **Add Context**: Include location/page info
   - Good: `trackButtonClick('export', 'monitoring_dashboard')`
   - Bad: `trackButtonClick('export')`

3. **Track Errors**: Always track form submission failures
   ```tsx
   catch (error) {
     trackFormSubmit('form_name', false);
     trackError(error.message, 'form_location');
   }
   ```

4. **Don't Over-Track**: Track meaningful interactions, not every hover or minor action

5. **Test Tracking**: Use Google Analytics DebugView to verify events fire correctly

## Testing Your Tracking

1. Open Chrome DevTools → Network tab
2. Filter by "google-analytics.com" or "collect"
3. Perform tracked actions
4. Verify events appear in network requests

Or use the GA4 DebugView:
1. Install [Google Analytics Debugger](https://chrome.google.com/webstore/detail/google-analytics-debugger/jnkmfdileelhofjcijamephohjechhna) extension
2. Enable it
3. Perform actions
4. Check console for GA event logs

## Questions?

- Analytics utility: `client/lib/analytics.ts`
- Custom hook: `client/src/hooks/useAnalytics.ts`
- Examples: `client/src/pages/logos.tsx`, `client/src/components/weekly-monitoring-dashboard.tsx`
