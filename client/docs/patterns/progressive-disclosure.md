# Progressive Disclosure Pattern

## Overview

Progressive disclosure is a design pattern that reduces complexity by showing only essential information initially, revealing additional details when the user needs them. This improves user experience by:

- Reducing cognitive load
- Simplifying complex interfaces
- Preventing information overload
- Improving task completion rates

## The Hook: `useProgressiveDisclosure`

Location: `client/src/hooks/useProgressiveDisclosure.ts`

### Single Disclosure State

For simple show/hide scenarios:

```typescript
import { useProgressiveDisclosure } from '@/hooks/useProgressiveDisclosure';

function MyComponent() {
  const { isOpen, toggle, open, close } = useProgressiveDisclosure();

  return (
    <div>
      <Button onClick={toggle}>
        {isOpen ? 'Hide' : 'Show'} Advanced Options
      </Button>
      {isOpen && (
        <div>
          {/* Advanced content */}
        </div>
      )}
    </div>
  );
}
```

### Multiple Disclosure States

For managing multiple expandable sections:

```typescript
import { useProgressiveDisclosure } from '@/hooks/useProgressiveDisclosure';

function MyForm() {
  const { states, toggle, isOpen, openAll, closeAll } = useProgressiveDisclosure({
    sections: ['personal', 'contact', 'preferences', 'advanced'],
    initialState: {
      personal: true, // Start with personal section open
      contact: true,
      preferences: false,
      advanced: false,
    },
  });

  return (
    <div>
      <Button onClick={openAll}>Expand All</Button>
      <Button onClick={closeAll}>Collapse All</Button>

      <Collapsible open={isOpen('personal')} onOpenChange={() => toggle('personal')}>
        <CollapsibleTrigger>Personal Information</CollapsibleTrigger>
        <CollapsibleContent>
          {/* Personal fields */}
        </CollapsibleContent>
      </Collapsible>

      <Collapsible open={isOpen('advanced')} onOpenChange={() => toggle('advanced')}>
        <CollapsibleTrigger>Advanced Options</CollapsibleTrigger>
        <CollapsibleContent>
          {/* Advanced fields */}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
```

## Common Patterns in This Codebase

### 1. Mode-Based Disclosure

**Use Case**: Show different fields based on operation mode (create vs edit)

**Example**: `client/src/components/user-management/UserFormDialog.tsx:127-154`

```typescript
function UserFormDialog({ mode, user }: Props) {
  return (
    <Dialog>
      {/* Common fields always shown */}
      <Input name="name" />
      <Input name="email" />

      {/* Edit-only fields */}
      {mode === 'edit' && (
        <>
          <Input name="phoneNumber" />
          <Select name="status" />
          <Input name="lastLogin" disabled />
        </>
      )}
    </Dialog>
  );
}
```

**When to Use**:
- Different operations require different fields
- Preventing confusion (e.g., can't set "last login" on create)
- Security (hiding sensitive operations in certain modes)

### 2. State-Based Toggle

**Use Case**: Switch between simple and detailed views

**Example**: `client/src/components/compact-collection-form.tsx`

```typescript
function CollectionForm() {
  const [totalMode, setTotalMode] = useState<'simple' | 'detailed'>('simple');
  const [showCalculator, setShowCalculator] = useState(false);

  return (
    <>
      <div className="flex gap-2">
        <Button onClick={() => setTotalMode('simple')}>Simple</Button>
        <Button onClick={() => setTotalMode('detailed')}>Detailed</Button>
      </div>

      {totalMode === 'simple' ? (
        <Input type="number" label="Total Sandwiches" />
      ) : (
        <div>
          <Input type="number" label="Turkey" />
          <Input type="number" label="Ham" />
          <Input type="number" label="Veggie" />
          {/* etc */}
        </div>
      )}

      <Button onClick={() => setShowCalculator(true)}>
        Need Help Calculating?
      </Button>
      {showCalculator && <SandwichCalculator />}
    </>
  );
}
```

**When to Use**:
- Users have different expertise levels (beginners vs advanced)
- Data can be input in multiple ways
- Providing optional helpers/calculators

### 3. Collapsible Sections

**Use Case**: Expandable sections for supplementary information

**Example**: `client/src/components/dynamic-error-message.tsx:201-246`

```typescript
function ErrorDisplay() {
  const { isOpen: showTips, toggle: toggleTips } = useProgressiveDisclosure();
  const { isOpen: showDetails, toggle: toggleDetails } = useProgressiveDisclosure();

  return (
    <div>
      {/* Main error message always visible */}
      <Alert variant="destructive">
        <AlertTitle>Something went wrong</AlertTitle>
        <AlertDescription>{error.message}</AlertDescription>
      </Alert>

      {/* Collapsible help section */}
      <Collapsible open={showTips} onOpenChange={toggleTips}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost">
            <HelpCircle className="w-4 h-4 mr-2" />
            How to Prevent This Issue
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ul>
            <li>Tip 1</li>
            <li>Tip 2</li>
          </ul>
        </CollapsibleContent>
      </Collapsible>

      {/* Collapsible technical details */}
      {isDevelopment && (
        <Collapsible open={showDetails} onOpenChange={toggleDetails}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost">
              <Code className="w-4 h-4 mr-2" />
              Technical Details
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <pre>{JSON.stringify(error, null, 2)}</pre>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
```

**When to Use**:
- Supplementary information (not critical to primary task)
- Help text and tips
- Technical details for debugging
- Long content that would overwhelm the page

### 4. Expandable Groups

**Use Case**: Categorized content in accordion/group style

**Example**: `client/src/components/clean-permissions-editor.tsx`

```typescript
function PermissionsEditor() {
  const { states, toggle, isOpen } = useProgressiveDisclosure({
    sections: ['USERS', 'EVENT_REQUESTS', 'PROJECTS', 'ADMIN'],
    initialState: {
      USERS: true,        // Common groups expanded by default
      EVENT_REQUESTS: true,
      PROJECTS: false,
      ADMIN: false,
    },
  });

  const permissionGroups = {
    USERS: ['view_users', 'create_users', 'edit_users', 'delete_users'],
    EVENT_REQUESTS: ['view_events', 'create_events', 'approve_events'],
    PROJECTS: ['view_projects', 'edit_projects'],
    ADMIN: ['manage_settings', 'view_audit_logs'],
  };

  return (
    <div className="space-y-2">
      {Object.entries(permissionGroups).map(([group, permissions]) => (
        <Collapsible key={group} open={isOpen(group)} onOpenChange={() => toggle(group)}>
          <CollapsibleTrigger className="flex items-center justify-between w-full p-3 hover:bg-gray-50">
            <span className="font-medium">{group}</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${isOpen(group) ? 'rotate-180' : ''}`} />
          </CollapsibleTrigger>
          <CollapsibleContent className="pl-6 pt-2 space-y-2">
            {permissions.map(permission => (
              <Checkbox key={permission} label={permission} />
            ))}
          </CollapsibleContent>
        </Collapsible>
      ))}
    </div>
  );
}
```

**When to Use**:
- Large sets of options grouped by category
- Permission systems
- Settings panels
- Filter interfaces

### 5. Conditional Steps (Wizard Forms)

**Use Case**: Multi-step forms where later steps depend on earlier answers

```typescript
function WizardForm() {
  const [step, setStep] = useState(1);
  const [needsShipping, setNeedsShipping] = useState(false);
  const [needsBilling, setNeedsBilling] = useState(false);

  return (
    <>
      {/* Step 1: Always shown first */}
      {step === 1 && (
        <div>
          <h2>Basic Information</h2>
          <Input name="name" />
          <Checkbox
            checked={needsShipping}
            onChange={(e) => setNeedsShipping(e.target.checked)}
            label="Different shipping address?"
          />
          <Checkbox
            checked={needsBilling}
            onChange={(e) => setNeedsBilling(e.target.checked)}
            label="Different billing address?"
          />
          <Button onClick={() => setStep(2)}>Next</Button>
        </div>
      )}

      {/* Step 2: Only if shipping address needed */}
      {step === 2 && needsShipping && (
        <div>
          <h2>Shipping Address</h2>
          {/* Address fields */}
          <Button onClick={() => setStep(needsBilling ? 3 : 4)}>Next</Button>
        </div>
      )}

      {/* Step 3: Only if billing address needed */}
      {step === 3 && needsBilling && (
        <div>
          <h2>Billing Address</h2>
          {/* Address fields */}
          <Button onClick={() => setStep(4)}>Next</Button>
        </div>
      )}

      {/* Step 4: Confirmation */}
      {step === 4 && (
        <div>
          <h2>Review & Submit</h2>
          {/* Summary */}
        </div>
      )}
    </>
  );
}
```

**When to Use**:
- Complex multi-step processes
- Forms where later steps depend on earlier choices
- Onboarding flows
- Purchase/checkout flows

## Best Practices

### 1. Start Simple

**DO**:
```typescript
// Show essential fields first
<Form>
  <Input name="name" required />
  <Input name="email" required />
  <Button onClick={toggle}>Show Optional Fields</Button>
  {isOpen && (
    <>
      <Input name="phone" />
      <Input name="company" />
    </>
  )}
</Form>
```

**DON'T**:
```typescript
// Don't hide critical information
<Form>
  <Button onClick={toggle}>Show Form</Button>
  {isOpen && (
    <>
      <Input name="name" required />
      <Input name="email" required />
    </>
  )}
</Form>
```

### 2. Provide Clear Affordances

**DO**:
```typescript
<Button variant="ghost" onClick={toggle} className="flex items-center gap-2">
  <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
  {isOpen ? 'Hide' : 'Show'} Advanced Options
</Button>
```

**DON'T**:
```typescript
// Unclear what will happen when clicked
<Button onClick={toggle}>More</Button>
```

### 3. Maintain State Appropriately

```typescript
// Persist user preferences for disclosure state
const { isOpen, toggle } = useProgressiveDisclosure({
  initialState: localStorage.getItem('showAdvanced') === 'true',
  onChange: (state) => {
    localStorage.setItem('showAdvanced', String(state));
  },
});
```

### 4. Accessibility

**Use Collapsible component** (built on Radix UI with proper ARIA):

```typescript
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';

<Collapsible open={isOpen} onOpenChange={toggle}>
  <CollapsibleTrigger asChild>
    <Button>
      <span className="sr-only">
        {isOpen ? 'Collapse' : 'Expand'} advanced options section
      </span>
      Advanced Options
    </Button>
  </CollapsibleTrigger>
  <CollapsibleContent>
    {/* Content */}
  </CollapsibleContent>
</Collapsible>
```

### 5. Performance Considerations

For heavy content, use lazy loading:

```typescript
import { lazy, Suspense } from 'react';

const AdvancedSettings = lazy(() => import('./AdvancedSettings'));

function Settings() {
  const { isOpen, toggle } = useProgressiveDisclosure();

  return (
    <>
      <Button onClick={toggle}>Show Advanced Settings</Button>
      {isOpen && (
        <Suspense fallback={<div>Loading...</div>}>
          <AdvancedSettings />
        </Suspense>
      )}
    </>
  );
}
```

### 6. Consistency

Use the standardized `useProgressiveDisclosure` hook throughout the application:

- Provides consistent API
- Easier to maintain
- Better for testing
- Centralized onChange tracking

## Migration Guide

### Before (Manual State Management)

```typescript
function OldComponent() {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showDebug, setShowDebug] = useState(false);

  return (
    <>
      <Button onClick={() => setShowAdvanced(!showAdvanced)}>Advanced</Button>
      <Button onClick={() => setShowHelp(!showHelp)}>Help</Button>
      <Button onClick={() => setShowDebug(!showDebug)}>Debug</Button>
    </>
  );
}
```

### After (Using Hook)

```typescript
function NewComponent() {
  const { states, toggle, isOpen } = useProgressiveDisclosure({
    sections: ['advanced', 'help', 'debug'],
  });

  return (
    <>
      <Button onClick={() => toggle('advanced')}>Advanced</Button>
      <Button onClick={() => toggle('help')}>Help</Button>
      <Button onClick={() => toggle('debug')}>Debug</Button>
    </>
  );
}
```

## Testing

```typescript
import { renderHook, act } from '@testing-library/react';
import { useProgressiveDisclosure } from '@/hooks/useProgressiveDisclosure';

describe('useProgressiveDisclosure', () => {
  it('should toggle state', () => {
    const { result } = renderHook(() => useProgressiveDisclosure());

    expect(result.current.isOpen).toBe(false);

    act(() => {
      result.current.toggle();
    });

    expect(result.current.isOpen).toBe(true);
  });

  it('should handle multiple sections', () => {
    const { result } = renderHook(() =>
      useProgressiveDisclosure({ sections: ['a', 'b'] })
    );

    expect(result.current.isOpen('a')).toBe(false);

    act(() => {
      result.current.toggle('a');
    });

    expect(result.current.isOpen('a')).toBe(true);
    expect(result.current.isOpen('b')).toBe(false);
  });
});
```

## Related Components

- `client/src/components/ui/collapsible.tsx` - Collapsible wrapper
- `client/src/components/ui/accordion.tsx` - Accordion component (if available)
- `client/src/components/dynamic-error-message.tsx` - Error display with progressive disclosure

## References

- [Nielsen Norman Group: Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/)
- [Radix UI Collapsible](https://www.radix-ui.com/primitives/docs/components/collapsible)
- [ARIA Disclosure Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/)
