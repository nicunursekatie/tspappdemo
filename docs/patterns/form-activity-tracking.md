# Form Activity Tracking Pattern

## Overview

The `useFormActivityTracking` hook provides a centralized, standardized way to track user interactions with forms across the application. This helps understand:

- How users interact with forms
- Where users struggle (validation errors, field interactions)
- Form completion rates vs abandonment
- Time spent on forms
- Which fields are most edited

## The Hook

Location: `client/src/hooks/useFormActivityTracking.ts`

### Basic Setup

```tsx
import { useFormActivityTracking } from '@/hooks/useFormActivityTracking';

function MyForm() {
  const formTracking = useFormActivityTracking({
    formName: 'Create Event Request',
    section: 'Event Requests',
    trackFieldInteractions: true,
    trackValidationErrors: true,
    trackAbandonment: true,
  });

  useEffect(() => {
    formTracking.trackFormStart();
  }, [formTracking]);

  // Use tracking methods throughout your form...
}
```

## Configuration Options

```typescript
interface FormTrackingConfig {
  // Required
  formName: string;           // e.g., 'Create User', 'Edit Event'
  section: string;            // e.g., 'User Management', 'Event Requests'

  // Optional
  feature?: string;           // Defaults to formName
  trackFieldInteractions?: boolean;  // Default: false
  trackValidationErrors?: boolean;   // Default: true
  trackAbandonment?: boolean;        // Default: true
  metadata?: Record<string, any>;    // Additional context
}
```

## Tracking Methods

### 1. trackFormStart()

Call when the form is first rendered/opened.

```tsx
useEffect(() => {
  formTracking.trackFormStart();
}, [formTracking]);
```

**What it tracks**:
- Form name and section
- Timestamp when form was opened
- Any additional metadata

### 2. trackFormSubmit(data?)

Call when form is successfully submitted.

```tsx
const onSubmit = async (data) => {
  try {
    const result = await createUser(data);
    formTracking.trackFormSubmit({
      recordId: result.id,
      success: true
    });
  } catch (error) {
    // handled separately
  }
};
```

**What it tracks**:
- Success/failure status
- Record ID (if provided)
- Time spent on form
- Number of fields interacted with
- Number of validation errors encountered
- Sends to all tracking systems (activity log, user activity, analytics)

### 3. trackFormError(error)

Call when form submission fails.

```tsx
const onSubmit = async (data) => {
  try {
    await createUser(data);
    formTracking.trackFormSubmit({ success: true });
  } catch (error) {
    formTracking.trackFormError(error);
    toast.error('Failed to create user');
  }
};
```

**What it tracks**:
- Error message
- Form context
- Timestamp

### 4. trackFormCancel()

Call when user explicitly cancels the form.

```tsx
const handleCancel = () => {
  formTracking.trackFormCancel();
  onClose();
};
```

**What it tracks**:
- Time spent before cancelling
- Number of fields interacted with
- Timestamp

### 5. trackFieldFocus(fieldName)

Track when user focuses on a field. Only active if `trackFieldInteractions: true`.

```tsx
<Input
  {...register('email')}
  onFocus={() => formTracking.trackFieldFocus('email')}
/>
```

**What it tracks**:
- Field name
- Focus count for that field
- Adds field to "fields interacted" list

### 6. trackFieldBlur(fieldName, value?)

Track when user leaves a field.

```tsx
<Input
  {...register('email')}
  onBlur={(e) => formTracking.trackFieldBlur('email', e.target.value)}
/>
```

**What it tracks**:
- Field name
- Whether field has a value

### 7. trackFieldChange(fieldName, value?)

Track field value changes.

```tsx
<Input
  {...register('email')}
  onChange={(e) => formTracking.trackFieldChange('email', e.target.value)}
/>
```

### 8. trackValidationError(fieldName, error)

Track a single validation error.

```tsx
// Manual validation
if (!email.includes('@')) {
  formTracking.trackValidationError('email', 'Email must contain @');
}
```

### 9. trackMultipleValidationErrors(errors)

Track multiple validation errors at once. Great for React Hook Form integration.

```tsx
const { formState: { errors } } = useForm();

useEffect(() => {
  if (Object.keys(errors).length > 0) {
    const errorMessages = Object.entries(errors).reduce((acc, [key, value]) => {
      acc[key] = value?.message || 'Invalid';
      return acc;
    }, {});
    formTracking.trackMultipleValidationErrors(errorMessages);
  }
}, [errors, formTracking]);
```

**What it tracks**:
- All field errors
- Total error count
- Running total of validation errors

### 10. trackFormEvent(action, details, metadata?)

Track any custom form event.

```tsx
formTracking.trackFormEvent(
  'Wizard Step Changed',
  'Moved to step 2',
  { step: 2, totalSteps: 3 }
);

formTracking.trackFormEvent(
  'Calculator Opened',
  'User opened sandwich calculator',
  { currentTotal: 100 }
);
```

### 11. getFormMetrics()

Get current form metrics at any time.

```tsx
const metrics = formTracking.getFormMetrics();

console.log(metrics);
// {
//   formName: 'Create User',
//   startTime: 1234567890,
//   timeSpentSeconds: 45,
//   fieldsInteracted: ['name', 'email', 'role'],
//   fieldFocusCount: { name: 2, email: 3, role: 1 },
//   validationErrors: 2,
//   isSubmitted: false,
//   isAbandoned: false
// }
```

## Complete Examples

### Example 1: Simple Form

```tsx
import { useForm } from 'react-hook-form';
import { useFormActivityTracking } from '@/hooks/useFormActivityTracking';
import { Field } from '@/components/ui/field-validation-wrapper';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

function CreateUserForm({ onClose }) {
  const { register, handleSubmit, formState: { errors } } = useForm();

  const formTracking = useFormActivityTracking({
    formName: 'Create User',
    section: 'User Management',
    trackValidationErrors: true,
  });

  useEffect(() => {
    formTracking.trackFormStart();
  }, [formTracking]);

  // Track validation errors
  useEffect(() => {
    if (Object.keys(errors).length > 0) {
      const errorMessages = Object.entries(errors).reduce((acc, [key, value]) => {
        acc[key] = value?.message || 'Invalid';
        return acc;
      }, {});
      formTracking.trackMultipleValidationErrors(errorMessages);
    }
  }, [errors, formTracking]);

  const onSubmit = async (data) => {
    try {
      const result = await fetch('/api/users', {
        method: 'POST',
        body: JSON.stringify(data),
      }).then(r => r.json());

      formTracking.trackFormSubmit({
        recordId: result.id,
        success: true
      });

      toast.success('User created!');
      onClose();
    } catch (error) {
      formTracking.trackFormError(error);
      toast.error('Failed to create user');
    }
  };

  const handleCancel = () => {
    formTracking.trackFormCancel();
    onClose();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Field label="Name" fieldId="name" error={errors.name?.message} required>
        <Input {...register('name', { required: 'Name is required' })} />
      </Field>

      <Field label="Email" fieldId="email" error={errors.email?.message} required>
        <Input {...register('email', { required: 'Email is required' })} />
      </Field>

      <div className="flex gap-2">
        <Button type="submit">Create User</Button>
        <Button type="button" variant="outline" onClick={handleCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
```

### Example 2: Form with Field Interactions

```tsx
function DetailedForm() {
  const { register, handleSubmit } = useForm();

  const formTracking = useFormActivityTracking({
    formName: 'Detailed Form',
    section: 'Settings',
    trackFieldInteractions: true,  // Enable field tracking
  });

  useEffect(() => {
    formTracking.trackFormStart();
  }, [formTracking]);

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Input
        {...register('username')}
        onFocus={() => formTracking.trackFieldFocus('username')}
        onBlur={(e) => formTracking.trackFieldBlur('username', e.target.value)}
        onChange={(e) => formTracking.trackFieldChange('username', e.target.value)}
      />
    </form>
  );
}
```

### Example 3: Wizard Form

```tsx
function WizardForm() {
  const [step, setStep] = useState(1);
  const { register, handleSubmit } = useForm();

  const formTracking = useFormActivityTracking({
    formName: 'Setup Wizard',
    section: 'Onboarding',
  });

  useEffect(() => {
    formTracking.trackFormStart();
  }, [formTracking]);

  const handleStepChange = (newStep: number) => {
    formTracking.trackFormEvent(
      'Wizard Step Changed',
      `Moved from step ${step} to step ${newStep}`,
      { fromStep: step, toStep: newStep }
    );
    setStep(newStep);
  };

  const onSubmit = async (data) => {
    try {
      await submitWizard(data);
      formTracking.trackFormSubmit({ success: true });
    } catch (error) {
      formTracking.trackFormError(error);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {step === 1 && <Step1 />}
      {step === 2 && <Step2 />}
      {step === 3 && <Step3 />}

      <Button onClick={() => handleStepChange(step + 1)}>Next</Button>
    </form>
  );
}
```

### Example 4: Modal Form

```tsx
import { Dialog } from '@/components/ui/dialog';

function UserFormDialog({ open, onOpenChange, mode, user }) {
  const { register, handleSubmit } = useForm();

  const formTracking = useFormActivityTracking({
    formName: mode === 'create' ? 'Create User' : 'Edit User',
    section: 'User Management',
    metadata: { mode, userId: user?.id },
  });

  // Track start when dialog opens
  useEffect(() => {
    if (open) {
      formTracking.trackFormStart();
    }
  }, [open, formTracking]);

  const handleClose = () => {
    formTracking.trackFormCancel();
    onOpenChange(false);
  };

  const onSubmit = async (data) => {
    try {
      const result = await saveUser(data);
      formTracking.trackFormSubmit({
        recordId: result.id,
        success: true
      });
      onOpenChange(false);
    } catch (error) {
      formTracking.trackFormError(error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <form onSubmit={handleSubmit(onSubmit)}>
        {/* form fields */}
      </form>
    </Dialog>
  );
}
```

## Automatic Abandonment Tracking

The hook automatically tracks form abandonment when:
1. Component unmounts
2. Form hasn't been submitted
3. User spent more than 5 seconds on the form

This happens automatically - no code needed!

```tsx
// Abandonment is tracked automatically on unmount
function MyForm() {
  const formTracking = useFormActivityTracking({
    formName: 'Contact Form',
    section: 'Support',
    trackAbandonment: true,  // default
  });

  useEffect(() => {
    formTracking.trackFormStart();
  }, [formTracking]);

  // If user navigates away without submitting,
  // abandonment is automatically tracked
}
```

## Integration with Existing Tracking

The hook consolidates all three existing tracking systems:

1. **useActivityTracker** - Detailed action tracking → `/api/activity-log`
2. **useUserActivityTracking** - User-specific tracking → `/api/enhanced-user-activity/track`
3. **useEnhancedTracking** - Analytics integration (Google Analytics)

All form events are sent to all three systems automatically.

## Best Practices

### 1. Always Track Form Start

```tsx
useEffect(() => {
  formTracking.trackFormStart();
}, [formTracking]);
```

### 2. Track Both Success and Error

```tsx
const onSubmit = async (data) => {
  try {
    const result = await saveData(data);
    formTracking.trackFormSubmit({ recordId: result.id, success: true });
  } catch (error) {
    formTracking.trackFormError(error);
    // Still show error to user
  }
};
```

### 3. Track Validation Errors with React Hook Form

```tsx
const { formState: { errors } } = useForm();

useEffect(() => {
  if (Object.keys(errors).length > 0) {
    const errorMessages = Object.entries(errors).reduce((acc, [key, value]) => {
      acc[key] = value?.message || 'Invalid';
      return acc;
    }, {});
    formTracking.trackMultipleValidationErrors(errorMessages);
  }
}, [errors, formTracking]);
```

### 4. Don't Over-Track Field Interactions

Only enable `trackFieldInteractions` for:
- Complex forms where you want to understand user behavior
- Forms with known usability issues
- A/B testing scenarios

```tsx
// Simple form - don't track field interactions
const formTracking = useFormActivityTracking({
  formName: 'Quick Create',
  section: 'Dashboard',
  trackFieldInteractions: false,  // Don't track every field
});

// Complex form - track field interactions
const formTracking = useFormActivityTracking({
  formName: 'Complex Event Setup',
  section: 'Event Requests',
  trackFieldInteractions: true,  // Understand user behavior
});
```

### 5. Use Meaningful Form Names

```tsx
// Good
const formTracking = useFormActivityTracking({
  formName: 'Create Event Request',
  section: 'Event Requests',
});

// Bad
const formTracking = useFormActivityTracking({
  formName: 'Form',
  section: 'Page',
});
```

### 6. Include Context in Metadata

```tsx
const formTracking = useFormActivityTracking({
  formName: 'Edit User',
  section: 'User Management',
  metadata: {
    userId: user.id,
    userRole: user.role,
    editedBy: currentUser.id,
  },
});
```

## Debugging

Enable detailed logging:

```tsx
import { logger } from '@/lib/logger';

// In your component
const metrics = formTracking.getFormMetrics();
logger.log('Form metrics:', metrics);
```

Check the browser console for tracking logs:
```
[Form Tracking] Started: Create User
[Form Tracking] Submitted: Create User (45s)
[Form Tracking] Abandoned: Edit Event (12s)
```

## Related Hooks

- `useActivityTracker` - General activity tracking
- `useUserActivityTracking` - User-specific tracking
- `useEnhancedTracking` - Page duration and analytics
- `useForm` (React Hook Form) - Form state management

## Migration Guide

### Before (Manual Tracking)

```tsx
function OldForm() {
  const { trackFormSubmit } = useActivityTracker();

  const onSubmit = async (data) => {
    await saveData(data);
    trackFormSubmit('My Form', 'Section', 'Feature', true);
  };
}
```

### After (Centralized Tracking)

```tsx
function NewForm() {
  const formTracking = useFormActivityTracking({
    formName: 'My Form',
    section: 'Section',
  });

  useEffect(() => {
    formTracking.trackFormStart();
  }, [formTracking]);

  const onSubmit = async (data) => {
    try {
      const result = await saveData(data);
      formTracking.trackFormSubmit({ recordId: result.id, success: true });
    } catch (error) {
      formTracking.trackFormError(error);
    }
  };
}
```

## Analytics Insights

With this tracking, you can answer:

- What's the average time to complete each form?
- Which forms have the highest abandonment rates?
- Where do users encounter validation errors most often?
- Which fields do users interact with most?
- What's the success rate for form submissions?

Query the activity log to get insights:

```sql
-- Average time spent on forms
SELECT
  action,
  AVG((metadata->>'timeSpentSeconds')::int) as avg_time_seconds
FROM activity_log
WHERE action IN ('Form Submit Success', 'Form Abandoned')
GROUP BY action;

-- Forms with most validation errors
SELECT
  metadata->>'formName' as form_name,
  COUNT(*) as error_count
FROM activity_log
WHERE action = 'Validation Errors'
GROUP BY form_name
ORDER BY error_count DESC;

-- Form completion vs abandonment rate
SELECT
  metadata->>'formName' as form_name,
  COUNT(CASE WHEN action = 'Form Submit Success' THEN 1 END) as completed,
  COUNT(CASE WHEN action = 'Form Abandoned' THEN 1 END) as abandoned
FROM activity_log
WHERE action IN ('Form Submit Success', 'Form Abandoned')
GROUP BY form_name;
```
