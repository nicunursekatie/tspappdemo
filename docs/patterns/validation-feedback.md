# Validation Feedback Patterns

## Overview

Consistent validation feedback improves user experience by:
- Providing clear, actionable error messages
- Reducing form abandonment
- Improving accessibility
- Creating a consistent look and feel

## Components

### 1. ValidationMessage

Location: `client/src/components/ui/validation-message.tsx`

A flexible component for displaying validation feedback with different severity levels.

#### Basic Usage

```tsx
import { ValidationMessage } from '@/components/ui/validation-message';

<ValidationMessage
  message="This field is required"
  severity="error"
/>

<ValidationMessage
  message="Password strength: weak"
  severity="warning"
/>

<ValidationMessage
  message="Email is available!"
  severity="success"
/>
```

#### Multiple Messages

```tsx
<ValidationMessage
  message={[
    'Password must be at least 8 characters',
    'Password must contain at least one number',
    'Password must contain at least one special character'
  ]}
  severity="error"
/>
```

#### Customization

```tsx
<ValidationMessage
  message="Invalid input"
  severity="error"
  showIcon={false}
  size="sm"
  animate={false}
  subtle
/>
```

### 2. InlineValidationMessage

A subtle variant for displaying validation next to form fields.

```tsx
import { InlineValidationMessage } from '@/components/ui/validation-message';

<div>
  <Input id="email" />
  <InlineValidationMessage
    message="Please enter a valid email"
    severity="error"
    fieldId="email"
  />
</div>
```

### 3. ValidationSummary

Location: `client/src/components/ui/validation-summary.tsx`

Displays all validation errors at once, typically at the top of a form.

#### With React Hook Form

```tsx
import { useForm } from 'react-hook-form';
import { ValidationSummary, useValidationSummary } from '@/components/ui/validation-summary';

function MyForm() {
  const { register, handleSubmit, formState: { errors }, setFocus } = useForm();

  const validationErrors = useValidationSummary(errors, {
    firstName: 'First Name',
    lastName: 'Last Name',
    email: 'Email Address',
  });

  const handleErrorClick = (field: string) => {
    setFocus(field);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <ValidationSummary
        errors={validationErrors}
        focusable
        onErrorClick={handleErrorClick}
      />
      {/* form fields */}
    </form>
  );
}
```

#### Variants

```tsx
// Compact - simple border and list
<ValidationSummary
  errors={errors}
  variant="compact"
/>

// Inline - minimal styling
<ValidationSummary
  errors={errors}
  variant="inline"
/>

// Default - full Alert component
<ValidationSummary
  errors={errors}
  variant="default"
  dismissible
  onDismiss={() => setShowErrors(false)}
/>
```

#### With Simple Arrays

```tsx
<ValidationSummary
  errors={[
    'Please enter your name',
    'Please enter a valid email',
    'Password is required'
  ]}
/>
```

#### With Object

```tsx
<ValidationSummary
  errors={{
    email: 'Email is required',
    password: 'Password must be at least 8 characters'
  }}
/>
```

### 4. Field (FieldValidationWrapper)

Location: `client/src/components/ui/field-validation-wrapper.tsx`

Combines label, field, validation, and help text into a single component.

#### Basic Usage

```tsx
import { Field } from '@/components/ui/field-validation-wrapper';
import { Input } from '@/components/ui/input';

<Field
  label="Email"
  fieldId="email"
  error={errors.email?.message}
  required
>
  <Input id="email" {...register('email')} />
</Field>
```

#### With Help Text

```tsx
<Field
  label="Password"
  fieldId="password"
  error={errors.password?.message}
  helpText="Must be at least 8 characters"
  required
>
  <Input id="password" type="password" {...register('password')} />
</Field>
```

#### With Success/Warning States

```tsx
<Field
  label="Username"
  fieldId="username"
  success={isAvailable && "Username is available!"}
  warning={isSimilar && "This username is similar to another user"}
  error={errors.username?.message}
>
  <Input id="username" {...register('username')} />
</Field>
```

#### Horizontal Layout

```tsx
<Field
  label="Subscribe to newsletter"
  fieldId="subscribe"
  layout="horizontal"
>
  <Checkbox id="subscribe" {...register('subscribe')} />
</Field>
```

## Complete Form Example

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Field } from '@/components/ui/field-validation-wrapper';
import { ValidationSummary, useValidationSummary } from '@/components/ui/validation-summary';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

const schema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Please enter a valid email'),
  phone: z.string().optional(),
  message: z.string().min(10, 'Message must be at least 10 characters'),
});

type FormData = z.infer<typeof schema>;

function ContactForm() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setFocus,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const validationErrors = useValidationSummary(errors, {
    firstName: 'First Name',
    lastName: 'Last Name',
    email: 'Email',
    message: 'Message',
  });

  const onSubmit = async (data: FormData) => {
    // Handle submission
    console.log(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Show all errors at the top */}
      {validationErrors.length > 0 && (
        <ValidationSummary
          errors={validationErrors}
          focusable
          onErrorClick={(field) => setFocus(field as keyof FormData)}
        />
      )}

      <div className="grid grid-cols-2 gap-4">
        <Field
          label="First Name"
          fieldId="firstName"
          error={errors.firstName?.message}
          required
        >
          <Input
            id="firstName"
            {...register('firstName')}
            aria-invalid={!!errors.firstName}
          />
        </Field>

        <Field
          label="Last Name"
          fieldId="lastName"
          error={errors.lastName?.message}
          required
        >
          <Input
            id="lastName"
            {...register('lastName')}
            aria-invalid={!!errors.lastName}
          />
        </Field>
      </div>

      <Field
        label="Email"
        fieldId="email"
        error={errors.email?.message}
        helpText="We'll never share your email"
        required
      >
        <Input
          id="email"
          type="email"
          {...register('email')}
          aria-invalid={!!errors.email}
        />
      </Field>

      <Field
        label="Phone"
        fieldId="phone"
        helpText="Optional - for follow-up calls"
      >
        <Input
          id="phone"
          {...register('phone')}
        />
      </Field>

      <Field
        label="Message"
        fieldId="message"
        error={errors.message?.message}
        required
      >
        <Textarea
          id="message"
          {...register('message')}
          aria-invalid={!!errors.message}
          rows={5}
        />
      </Field>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Sending...' : 'Send Message'}
      </Button>
    </form>
  );
}
```

## Best Practices

### 1. When to Show Validation

**Real-time validation** (as user types):
- Use sparingly - can be distracting
- Best for: password strength, username availability
- Debounce to avoid excessive validation

```tsx
const [email, setEmail] = useState('');
const [emailError, setEmailError] = useState('');

const debouncedValidation = useMemo(
  () =>
    debounce((value: string) => {
      if (!value.includes('@')) {
        setEmailError('Email must contain @');
      } else {
        setEmailError('');
      }
    }, 500),
  []
);

<Field
  label="Email"
  fieldId="email"
  error={emailError}
>
  <Input
    id="email"
    value={email}
    onChange={(e) => {
      setEmail(e.target.value);
      debouncedValidation(e.target.value);
    }}
  />
</Field>
```

**On blur** (when field loses focus):
- Good balance between immediate and delayed feedback
- Doesn't interrupt user while typing
- React Hook Form default: `mode: 'onBlur'`

```tsx
const { register } = useForm({
  mode: 'onBlur',
});
```

**On submit**:
- Least intrusive
- Suitable for simple forms
- React Hook Form default: `mode: 'onSubmit'`

```tsx
const { register } = useForm({
  mode: 'onSubmit',
});
```

### 2. Error Message Quality

**DO**:
- Be specific: "Email must contain @" not "Invalid email"
- Be helpful: "Password must be at least 8 characters" not "Invalid password"
- Suggest solutions: "Phone number must be 10 digits (XXX-XXX-XXXX)"

**DON'T**:
- Be vague: "Invalid input"
- Be technical: "Regex validation failed"
- Be condescending: "You entered this wrong"

### 3. Accessibility

Always include:

```tsx
<Field
  label="Email"
  fieldId="email"
  error={errors.email?.message}
>
  <Input
    id="email"
    aria-invalid={!!errors.email}
    aria-describedby={errors.email ? 'email-error' : undefined}
    {...register('email')}
  />
</Field>
```

The `Field` component handles this automatically by setting:
- `htmlFor` on label
- `id` on error message: `{fieldId}-error`
- `aria-describedby` linking (when using with proper setup)

### 4. Visual Design

**Color coding**:
- Error: Red (destructive)
- Warning: Yellow/Amber
- Success: Green
- Info: Blue

**Icons**: Use consistent icons from `lucide-react`:
- Error: `AlertCircle`
- Warning: `AlertTriangle`
- Success: `CheckCircle2`
- Info: `Info`

**Animation**: Use subtle entrance animations:
```tsx
<ValidationMessage
  message="Error occurred"
  animate={true}  // default
/>
```

### 5. Form-Level vs Field-Level Validation

**Form-level validation** (ValidationSummary):
- Use at top of form
- Shows all errors at once
- Good for accessibility (screen readers)
- Better for long forms

**Field-level validation** (InlineValidationMessage):
- Shows error next to field
- More contextual
- Better for short forms
- Can be overwhelming with many errors

**Best practice**: Use both!
```tsx
<form>
  <ValidationSummary errors={validationErrors} focusable />
  {/* ... */}
  <Field error={errors.email?.message}>
    <Input {...register('email')} />
  </Field>
</form>
```

## Migration from Existing Code

### Before (Manual)

```tsx
<div>
  <Label htmlFor="email">Email</Label>
  <Input id="email" {...register('email')} />
  {errors.email && (
    <p className="text-sm text-destructive mt-1">
      {errors.email.message}
    </p>
  )}
</div>
```

### After (With Field)

```tsx
<Field
  label="Email"
  fieldId="email"
  error={errors.email?.message}
>
  <Input id="email" {...register('email')} />
</Field>
```

## Zod Integration

The validation components work seamlessly with Zod schemas:

```tsx
import * as z from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

const schema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

const { register, formState: { errors } } = useForm({
  resolver: zodResolver(schema),
});
```

## Related Files

- `client/src/lib/validation.ts` - Zod schemas
- `client/src/components/ui/form.tsx` - React Hook Form integration
- `client/src/components/dynamic-error-message.tsx` - Error boundary with progressive disclosure

## Testing

```tsx
import { render, screen } from '@testing-library/react';
import { ValidationMessage } from '@/components/ui/validation-message';

describe('ValidationMessage', () => {
  it('should display error message', () => {
    render(<ValidationMessage message="Error occurred" severity="error" />);
    expect(screen.getByText('Error occurred')).toBeInTheDocument();
  });

  it('should not render when no message', () => {
    const { container } = render(<ValidationMessage message="" />);
    expect(container.firstChild).toBeNull();
  });

  it('should display multiple messages as list', () => {
    render(
      <ValidationMessage
        message={['Error 1', 'Error 2']}
        severity="error"
      />
    );
    expect(screen.getByText('Error 1')).toBeInTheDocument();
    expect(screen.getByText('Error 2')).toBeInTheDocument();
  });
});
```
