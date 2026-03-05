import React from 'react';
import { cn } from '@/lib/utils';
import { InlineValidationMessage, ValidationSeverity } from './validation-message';
import { Label } from './label';

/**
 * Field Validation Wrapper Component
 *
 * A wrapper that combines label, input field, validation message, and help text
 * into a single, consistent component. Reduces boilerplate in forms.
 */

export interface FieldValidationWrapperProps {
  /**
   * Field label
   */
  label?: string;

  /**
   * Field ID (important for accessibility)
   */
  fieldId: string;

  /**
   * The input/field component to render
   */
  children: React.ReactNode;

  /**
   * Validation error message
   */
  error?: string | string[];

  /**
   * Warning message
   */
  warning?: string;

  /**
   * Success message
   */
  success?: string;

  /**
   * Help text to display below the field
   */
  helpText?: string;

  /**
   * Whether the field is required
   */
  required?: boolean;

  /**
   * Whether the field is disabled
   */
  disabled?: boolean;

  /**
   * Additional CSS classes for the wrapper
   */
  className?: string;

  /**
   * Additional CSS classes for the label
   */
  labelClassName?: string;

  /**
   * Layout direction
   * @default 'vertical'
   */
  layout?: 'vertical' | 'horizontal';

  /**
   * Show validation messages inline (below field) vs separate
   * @default true
   */
  inlineValidation?: boolean;
}

export function FieldValidationWrapper({
  label,
  fieldId,
  children,
  error,
  warning,
  success,
  helpText,
  required = false,
  disabled = false,
  className,
  labelClassName,
  layout = 'vertical',
  inlineValidation = true,
}: FieldValidationWrapperProps) {
  // Determine validation state
  const hasError = Boolean(error);
  const hasWarning = Boolean(warning) && !hasError;
  const hasSuccess = Boolean(success) && !hasError && !hasWarning;

  // Determine message to show
  let validationMessage: string | string[] | undefined;
  let validationSeverity: ValidationSeverity | undefined;

  if (hasError) {
    validationMessage = error;
    validationSeverity = 'error';
  } else if (hasWarning) {
    validationMessage = warning;
    validationSeverity = 'warning';
  } else if (hasSuccess) {
    validationMessage = success;
    validationSeverity = 'success';
  }

  const isHorizontal = layout === 'horizontal';

  return (
    <div
      className={cn(
        'space-y-2',
        isHorizontal && 'flex items-start gap-4',
        className
      )}
    >
      {/* Label */}
      {label && (
        <Label
          htmlFor={fieldId}
          className={cn(
            required && 'after:content-["*"] after:ml-1 after:text-destructive',
            disabled && 'opacity-50 cursor-not-allowed',
            isHorizontal && 'min-w-[120px] pt-2',
            labelClassName
          )}
        >
          {label}
        </Label>
      )}

      {/* Field container */}
      <div className={cn('space-y-1.5', isHorizontal && 'flex-1')}>
        {/* Input field */}
        <div className={cn(hasError && 'has-error')}>
          {children}
        </div>

        {/* Validation message */}
        {inlineValidation && validationMessage && validationSeverity && (
          <InlineValidationMessage
            message={validationMessage}
            severity={validationSeverity}
            fieldId={fieldId}
          />
        )}

        {/* Help text */}
        {helpText && !validationMessage && (
          <p
            id={`${fieldId}-help`}
            className={cn(
              'text-sm text-muted-foreground',
              disabled && 'opacity-50'
            )}
          >
            {helpText}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Simplified Field Wrapper for common use case
 *
 * Usage:
 * ```tsx
 * <Field
 *   label="Email"
 *   fieldId="email"
 *   error={errors.email?.message}
 *   required
 * >
 *   <Input id="email" {...register('email')} />
 * </Field>
 * ```
 */
export const Field = FieldValidationWrapper;

/**
 * Example Usage with React Hook Form:
 *
 * ```tsx
 * import { useForm } from 'react-hook-form';
 * import { Field } from '@/components/ui/field-validation-wrapper';
 * import { Input } from '@/components/ui/input';
 * import { Textarea } from '@/components/ui/textarea';
 *
 * function MyForm() {
 *   const { register, formState: { errors } } = useForm();
 *
 *   return (
 *     <form>
 *       <Field
 *         label="Name"
 *         fieldId="name"
 *         error={errors.name?.message}
 *         required
 *       >
 *         <Input
 *           id="name"
 *           {...register('name', { required: 'Name is required' })}
 *         />
 *       </Field>
 *
 *       <Field
 *         label="Email"
 *         fieldId="email"
 *         error={errors.email?.message}
 *         helpText="We'll never share your email"
 *         required
 *       >
 *         <Input
 *           id="email"
 *           type="email"
 *           {...register('email', {
 *             required: 'Email is required',
 *             pattern: {
 *               value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
 *               message: 'Invalid email address'
 *             }
 *           })}
 *         />
 *       </Field>
 *
 *       <Field
 *         label="Bio"
 *         fieldId="bio"
 *         error={errors.bio?.message}
 *         helpText="Tell us about yourself"
 *       >
 *         <Textarea
 *           id="bio"
 *           {...register('bio')}
 *         />
 *       </Field>
 *     </form>
 *   );
 * }
 * ```
 *
 * With success/warning states:
 * ```tsx
 * <Field
 *   label="Username"
 *   fieldId="username"
 *   success={isAvailable && "Username is available!"}
 *   warning={isTaken && "This username is taken"}
 *   error={errors.username?.message}
 * >
 *   <Input id="username" {...register('username')} />
 * </Field>
 * ```
 *
 * Horizontal layout:
 * ```tsx
 * <Field
 *   label="Subscribe"
 *   fieldId="subscribe"
 *   layout="horizontal"
 * >
 *   <Checkbox id="subscribe" {...register('subscribe')} />
 * </Field>
 * ```
 */
