# UI Patterns and Best Practices

This directory contains documentation for standardized patterns used throughout the Sandwich Project Platform application.

## Overview

These patterns ensure:
- **Consistency** across the application
- **Better UX** through progressive disclosure and clear feedback
- **Data insights** through comprehensive activity tracking
- **Maintainability** through reusable components

## Patterns

### 1. [AI Chat](./ai-chat.md)

Add AI-powered chat assistants to pages for data insights and visualizations.

**Key Components:**
- `FloatingAIChat` - Reusable floating chat component
- `/api/ai-chat` endpoint - Context-aware AI backend

**When to use:**
- Pages with data that users might want to explore
- Dashboards and analytics pages
- Collection logs, event lists, impact reports

**Quick Example:**
```tsx
import { FloatingAIChat } from '@/components/floating-ai-chat';

<FloatingAIChat
  contextType="collections"
  title="Collection Insights"
  subtitle="Ask about your data"
/>
```

📖 [Read full documentation](./ai-chat.md)

---

### 2. [Progressive Disclosure](./progressive-disclosure.md)

Reduce cognitive load by showing only essential information initially, revealing additional details when needed.

**Key Components:**
- `useProgressiveDisclosure` hook
- Single and multi-section state management
- Integration with Collapsible components

**When to use:**
- Complex forms with optional fields
- Forms with beginner and advanced modes
- Settings panels with many options
- Error messages with supplementary help

**Quick Example:**
```tsx
import { useProgressiveDisclosure } from '@/hooks/useProgressiveDisclosure';

const { isOpen, toggle } = useProgressiveDisclosure();

<Button onClick={toggle}>Show Advanced Options</Button>
{isOpen && <AdvancedFields />}
```

📖 [Read full documentation](./progressive-disclosure.md)

---

### 3. [Validation Feedback](./validation-feedback.md)

Provide clear, consistent validation feedback to improve form completion rates.

**Key Components:**
- `ValidationMessage` - Flexible validation display
- `InlineValidationMessage` - Subtle field-level feedback
- `ValidationSummary` - Form-level error summary
- `Field` (FieldValidationWrapper) - All-in-one field component

**When to use:**
- Any form with validation
- Real-time or on-blur validation
- Forms with multiple validation errors
- Accessibility requirements

**Quick Example:**
```tsx
import { Field } from '@/components/ui/field-validation-wrapper';

<Field
  label="Email"
  fieldId="email"
  error={errors.email?.message}
  required
>
  <Input {...register('email')} />
</Field>
```

📖 [Read full documentation](./validation-feedback.md)

---

### 4. [Form Activity Tracking](./form-activity-tracking.md)

Centralized tracking for form interactions to understand user behavior and improve UX.

**Key Hook:**
- `useFormActivityTracking` - Comprehensive form tracking

**What it tracks:**
- Form start/submit/cancel/abandon
- Field interactions (optional)
- Validation errors
- Time spent on form
- Custom form events

**When to use:**
- All forms (basic tracking)
- Complex forms (detailed field tracking)
- Forms with known usability issues
- A/B testing scenarios

**Quick Example:**
```tsx
import { useFormActivityTracking } from '@/hooks/useFormActivityTracking';

const formTracking = useFormActivityTracking({
  formName: 'Create User',
  section: 'User Management',
});

useEffect(() => {
  formTracking.trackFormStart();
}, [formTracking]);

const onSubmit = async (data) => {
  try {
    const result = await saveUser(data);
    formTracking.trackFormSubmit({ recordId: result.id, success: true });
  } catch (error) {
    formTracking.trackFormError(error);
  }
};
```

📖 [Read full documentation](./form-activity-tracking.md)

---

## Complete Form Example

Here's a complete example combining all three patterns:

```tsx
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

// Pattern 1: Progressive Disclosure
import { useProgressiveDisclosure } from '@/hooks/useProgressiveDisclosure';

// Pattern 2: Validation Feedback
import { Field } from '@/components/ui/field-validation-wrapper';
import { ValidationSummary, useValidationSummary } from '@/components/ui/validation-summary';

// Pattern 3: Form Activity Tracking
import { useFormActivityTracking } from '@/hooks/useFormActivityTracking';

// Other imports
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { toast } from '@/hooks/use-toast';

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Please enter a valid email'),
  phone: z.string().optional(),
  company: z.string().optional(),
  role: z.string().optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

function ComprehensiveForm({ onClose }) {
  // React Hook Form setup
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setFocus,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  // Pattern 1: Progressive Disclosure - for optional fields
  const { isOpen: showOptional, toggle: toggleOptional } = useProgressiveDisclosure();

  // Pattern 2: Validation Feedback - convert errors for summary
  const validationErrors = useValidationSummary(errors, {
    name: 'Full Name',
    email: 'Email Address',
    phone: 'Phone Number',
  });

  // Pattern 3: Form Activity Tracking
  const formTracking = useFormActivityTracking({
    formName: 'Create Contact',
    section: 'Contacts',
    trackValidationErrors: true,
  });

  // Track form start
  useEffect(() => {
    formTracking.trackFormStart();
  }, [formTracking]);

  // Track validation errors
  useEffect(() => {
    if (Object.keys(errors).length > 0) {
      const errorMessages = Object.entries(errors).reduce((acc, [key, value]) => {
        acc[key] = value?.message || 'Invalid';
        return acc;
      }, {} as Record<string, string>);
      formTracking.trackMultipleValidationErrors(errorMessages);
    }
  }, [errors, formTracking]);

  // Submit handler
  const onSubmit = async (data: FormData) => {
    try {
      const response = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error('Failed to create contact');

      const result = await response.json();

      formTracking.trackFormSubmit({
        recordId: result.id,
        success: true,
      });

      toast({ title: 'Contact created successfully!' });
      onClose();
    } catch (error) {
      formTracking.trackFormError(error instanceof Error ? error : new Error(String(error)));
      toast({
        title: 'Error',
        description: 'Failed to create contact',
        variant: 'destructive',
      });
    }
  };

  // Cancel handler
  const handleCancel = () => {
    formTracking.trackFormCancel();
    onClose();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Pattern 2: Validation Summary at top */}
      {validationErrors.length > 0 && (
        <ValidationSummary
          errors={validationErrors}
          focusable
          onErrorClick={(field) => setFocus(field as keyof FormData)}
        />
      )}

      {/* Required fields - always visible */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Required Information</h3>

        <Field
          label="Full Name"
          fieldId="name"
          error={errors.name?.message}
          required
        >
          <Input
            id="name"
            {...register('name')}
            aria-invalid={!!errors.name}
          />
        </Field>

        <Field
          label="Email Address"
          fieldId="email"
          error={errors.email?.message}
          helpText="We'll send a confirmation to this email"
          required
        >
          <Input
            id="email"
            type="email"
            {...register('email')}
            aria-invalid={!!errors.email}
          />
        </Field>
      </div>

      {/* Pattern 1: Progressive Disclosure - Optional fields */}
      <div>
        <Collapsible open={showOptional} onOpenChange={toggleOptional}>
          <CollapsibleTrigger asChild>
            <Button type="button" variant="ghost" className="mb-2">
              {showOptional ? 'Hide' : 'Show'} Optional Fields
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4">
            <Field
              label="Phone Number"
              fieldId="phone"
              error={errors.phone?.message}
            >
              <Input
                id="phone"
                {...register('phone')}
              />
            </Field>

            <Field
              label="Company"
              fieldId="company"
              error={errors.company?.message}
            >
              <Input
                id="company"
                {...register('company')}
              />
            </Field>

            <Field
              label="Role"
              fieldId="role"
              error={errors.role?.message}
            >
              <Input
                id="role"
                {...register('role')}
              />
            </Field>

            <Field
              label="Notes"
              fieldId="notes"
              error={errors.notes?.message}
            >
              <Textarea
                id="notes"
                {...register('notes')}
                rows={3}
              />
            </Field>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Form actions */}
      <div className="flex gap-2 justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={handleCancel}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Creating...' : 'Create Contact'}
        </Button>
      </div>
    </form>
  );
}

export default ComprehensiveForm;
```

## Quick Reference

### When to use each pattern:

| Pattern | Use Case | Required? |
|---------|----------|-----------|
| **AI Chat** | Pages with data users want to explore | Optional |
| **Progressive Disclosure** | Forms with many optional fields | Optional |
| **Validation Feedback** | Any form with validation | Recommended |
| **Form Activity Tracking** | All forms | Recommended |

### Component/Hook Locations:

| Component/Hook | Location |
|----------------|----------|
| `FloatingAIChat` | `client/src/components/floating-ai-chat.tsx` |
| `useProgressiveDisclosure` | `client/src/hooks/useProgressiveDisclosure.ts` |
| `ValidationMessage` | `client/src/components/ui/validation-message.tsx` |
| `ValidationSummary` | `client/src/components/ui/validation-summary.tsx` |
| `Field` | `client/src/components/ui/field-validation-wrapper.tsx` |
| `useFormActivityTracking` | `client/src/hooks/useFormActivityTracking.ts` |

### Installation Checklist:

To use these patterns in a new form:

- [ ] Import `useFormActivityTracking` and track form start/submit/errors
- [ ] Use `Field` component instead of manual label+input+error
- [ ] Add `ValidationSummary` for forms with multiple fields
- [ ] Consider `useProgressiveDisclosure` for optional/advanced sections
- [ ] Track validation errors with `trackValidationErrors`
- [ ] Ensure proper accessibility (field IDs, aria attributes)

## Migration Path

### Phase 1: Low-hanging fruit
Start using these patterns in new forms and recently modified forms.

### Phase 2: High-traffic forms
Migrate commonly used forms (user creation, event requests, etc.)

### Phase 3: Comprehensive migration
Update all remaining forms over time.

### Migration Checklist:

For each form:
- [ ] Add form activity tracking (trackFormStart, trackFormSubmit, etc.)
- [ ] Replace manual validation display with `Field` components
- [ ] Add `ValidationSummary` if form has 3+ fields
- [ ] Identify progressive disclosure opportunities (optional fields, advanced settings)
- [ ] Test accessibility (keyboard navigation, screen readers)
- [ ] Verify tracking in activity logs

## Testing

### Unit Tests

```tsx
import { renderHook, act } from '@testing-library/react';
import { useProgressiveDisclosure } from '@/hooks/useProgressiveDisclosure';
import { useFormActivityTracking } from '@/hooks/useFormActivityTracking';

describe('Form Patterns', () => {
  it('should toggle disclosure state', () => {
    const { result } = renderHook(() => useProgressiveDisclosure());
    expect(result.current.isOpen).toBe(false);
    act(() => result.current.toggle());
    expect(result.current.isOpen).toBe(true);
  });

  it('should track form submission', () => {
    const { result } = renderHook(() =>
      useFormActivityTracking({
        formName: 'Test Form',
        section: 'Test',
      })
    );

    act(() => result.current.trackFormStart());
    act(() => result.current.trackFormSubmit({ success: true }));

    const metrics = result.current.getFormMetrics();
    expect(metrics.isSubmitted).toBe(true);
  });
});
```

### Integration Tests

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { ValidationSummary } from '@/components/ui/validation-summary';

describe('Validation Feedback', () => {
  it('should display validation errors', () => {
    render(
      <ValidationSummary
        errors={[
          { field: 'email', message: 'Email is required' },
          { field: 'name', message: 'Name is required' },
        ]}
      />
    );

    expect(screen.getByText(/Email is required/)).toBeInTheDocument();
    expect(screen.getByText(/Name is required/)).toBeInTheDocument();
  });
});
```

## Related Documentation

- [React Hook Form](https://react-hook-form.com/) - Form state management
- [Zod](https://zod.dev/) - Schema validation
- [Radix UI](https://www.radix-ui.com/) - Accessible components
- [Shadcn/ui](https://ui.shadcn.com/) - UI component library

## Contributing

When adding new form patterns:

1. Document the pattern in this directory
2. Create reusable components/hooks
3. Add examples and best practices
4. Update this README
5. Add tests
6. Update migration checklist

## Questions?

For questions or suggestions about these patterns, please:
- Open an issue on GitHub
- Discuss in team meetings
- Review existing form implementations in the codebase

---

**Last Updated:** 2025-10-24
