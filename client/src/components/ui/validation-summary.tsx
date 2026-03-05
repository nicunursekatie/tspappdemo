import React from 'react';
import { AlertCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';
import { Alert, AlertDescription, AlertTitle } from './alert';
import { ScrollArea } from './scroll-area';

/**
 * Validation Summary Component
 *
 * Displays a summary of all validation errors in a form, typically at the top.
 * Useful for:
 * - Multi-field validation errors
 * - Form-level validation summary
 * - Accessibility (screen readers can announce all errors at once)
 */

export interface ValidationError {
  /**
   * Field name or identifier
   */
  field?: string;

  /**
   * Error message
   */
  message: string;

  /**
   * Optional field label for display
   */
  label?: string;
}

export interface ValidationSummaryProps {
  /**
   * List of validation errors
   */
  errors: ValidationError[] | string[] | Record<string, string>;

  /**
   * Title for the summary
   * @default 'Please fix the following errors:'
   */
  title?: string;

  /**
   * Show close button
   * @default false
   */
  dismissible?: boolean;

  /**
   * Callback when dismissed
   */
  onDismiss?: () => void;

  /**
   * Make error items clickable to focus the field
   * @default false
   */
  focusable?: boolean;

  /**
   * Callback when error is clicked (for focusing field)
   */
  onErrorClick?: (field: string) => void;

  /**
   * Maximum height before scrolling
   * @default '300px'
   */
  maxHeight?: string;

  /**
   * Additional CSS classes
   */
  className?: string;

  /**
   * Variant style
   * @default 'default'
   */
  variant?: 'default' | 'compact' | 'inline';
}

/**
 * Normalize errors to ValidationError array
 */
function normalizeErrors(
  errors: ValidationError[] | string[] | Record<string, string>
): ValidationError[] {
  // Already in correct format
  if (Array.isArray(errors) && errors.length > 0 && typeof errors[0] === 'object' && errors[0] !== null) {
    return errors as ValidationError[];
  }

  // Array of strings
  if (Array.isArray(errors)) {
    return (errors as string[]).map((message) => ({ message }));
  }

  // Object/Record format (field -> message)
  return Object.entries(errors).map(([field, message]) => ({
    field,
    message,
  }));
}

export function ValidationSummary({
  errors,
  title = 'Please fix the following errors:',
  dismissible = false,
  onDismiss,
  focusable = false,
  onErrorClick,
  maxHeight = '300px',
  className,
  variant = 'default',
}: ValidationSummaryProps) {
  const normalizedErrors = normalizeErrors(errors);

  // Don't render if no errors
  if (normalizedErrors.length === 0) {
    return null;
  }

  // Compact variant - simple list
  if (variant === 'compact') {
    return (
      <div
        className={cn(
          'rounded-md border border-destructive/50 bg-destructive/10 p-3',
          'text-sm text-destructive',
          className
        )}
        role="alert"
        aria-live="assertive"
      >
        <div className="flex items-start gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <ul className="flex-1 space-y-1">
            {normalizedErrors.map((error, index) => (
              <li key={index}>
                {error.label || error.field ? (
                  <>
                    <span className="font-medium">
                      {error.label || error.field}:
                    </span>{' '}
                    {error.message}
                  </>
                ) : (
                  error.message
                )}
              </li>
            ))}
          </ul>
          {dismissible && onDismiss && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDismiss}
              className="flex-shrink-0 h-auto p-0 hover:bg-transparent"
            >
              <X className="w-4 h-4" />
              <span className="sr-only">Dismiss</span>
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Inline variant - minimal styling
  if (variant === 'inline') {
    return (
      <div
        className={cn('text-sm text-destructive space-y-1', className)}
        role="alert"
        aria-live="assertive"
      >
        {normalizedErrors.map((error, index) => (
          <div key={index} className="flex items-start gap-1.5">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>
              {error.label || error.field ? (
                <>
                  <span className="font-medium">
                    {error.label || error.field}:
                  </span>{' '}
                  {error.message}
                </>
              ) : (
                error.message
              )}
            </span>
          </div>
        ))}
      </div>
    );
  }

  // Default variant - full Alert component
  return (
    <Alert variant="destructive" className={cn('relative', className)}>
      {dismissible && onDismiss && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onDismiss}
          className="absolute right-2 top-2 h-auto p-1 hover:bg-destructive/20"
        >
          <X className="w-4 h-4" />
          <span className="sr-only">Dismiss</span>
        </Button>
      )}

      <AlertCircle className="h-4 w-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        <ScrollArea
          className="mt-2"
          style={{ maxHeight }}
        >
          <ul className="space-y-2">
            {normalizedErrors.map((error, index) => {
              const canFocus = focusable && error.field && onErrorClick;

              return (
                <li key={index} className="flex items-start gap-2">
                  <span className="text-destructive mt-1.5">•</span>
                  {canFocus ? (
                    <button
                      type="button"
                      onClick={() => onErrorClick(error.field!)}
                      className="text-left hover:underline focus:outline-none focus:underline"
                    >
                      {error.label || error.field ? (
                        <>
                          <span className="font-medium">
                            {error.label || error.field}:
                          </span>{' '}
                          {error.message}
                        </>
                      ) : (
                        error.message
                      )}
                    </button>
                  ) : (
                    <span>
                      {error.label || error.field ? (
                        <>
                          <span className="font-medium">
                            {error.label || error.field}:
                          </span>{' '}
                          {error.message}
                        </>
                      ) : (
                        error.message
                      )}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </ScrollArea>
      </AlertDescription>
    </Alert>
  );
}

/**
 * Hook for collecting form errors from React Hook Form
 */
export function useValidationSummary(
  errors: Record<string, any>,
  fieldLabels?: Record<string, string>
): ValidationError[] {
  return React.useMemo(() => {
    const validationErrors: ValidationError[] = [];

    Object.entries(errors).forEach(([field, error]) => {
      if (error?.message) {
        validationErrors.push({
          field,
          message: error.message,
          label: fieldLabels?.[field],
        });
      }
    });

    return validationErrors;
  }, [errors, fieldLabels]);
}

/**
 * Example Usage:
 *
 * ```tsx
 * import { useForm } from 'react-hook-form';
 * import { ValidationSummary, useValidationSummary } from '@/components/ui/validation-summary';
 *
 * function MyForm() {
 *   const { register, handleSubmit, formState: { errors }, setFocus } = useForm();
 *
 *   // Convert RHF errors to ValidationError format
 *   const validationErrors = useValidationSummary(errors, {
 *     email: 'Email Address',
 *     password: 'Password',
 *     confirmPassword: 'Confirm Password',
 *   });
 *
 *   const onErrorClick = (field: string) => {
 *     setFocus(field);
 *   };
 *
 *   return (
 *     <form onSubmit={handleSubmit(onSubmit)}>
 *       <ValidationSummary
 *         errors={validationErrors}
 *         focusable
 *         onErrorClick={onErrorClick}
 *       />
 *
 *       <input {...register('email')} />
 *       <input {...register('password')} />
 *       <input {...register('confirmPassword')} />
 *
 *       <button type="submit">Submit</button>
 *     </form>
 *   );
 * }
 * ```
 *
 * With simple string array:
 * ```tsx
 * <ValidationSummary
 *   errors={['Email is required', 'Password must be at least 8 characters']}
 *   variant="compact"
 * />
 * ```
 *
 * With object:
 * ```tsx
 * <ValidationSummary
 *   errors={{
 *     email: 'Email is required',
 *     password: 'Password must be at least 8 characters'
 *   }}
 * />
 * ```
 */
