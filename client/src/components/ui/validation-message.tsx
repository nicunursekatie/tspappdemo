import React from 'react';
import { AlertCircle, CheckCircle2, Info, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Validation Message Component
 *
 * A reusable component for displaying validation feedback with consistent styling.
 * Supports different severity levels and icons.
 */

export type ValidationSeverity = 'error' | 'warning' | 'success' | 'info';

export interface ValidationMessageProps {
  /**
   * The message to display
   */
  message?: string | string[];

  /**
   * Severity level of the validation message
   * @default 'error'
   */
  severity?: ValidationSeverity;

  /**
   * Show icon alongside message
   * @default true
   */
  showIcon?: boolean;

  /**
   * Custom icon component to override default
   */
  icon?: React.ReactNode;

  /**
   * Additional CSS classes
   */
  className?: string;

  /**
   * Animate entrance
   * @default true
   */
  animate?: boolean;

  /**
   * Make the message visually subtle (lighter colors)
   * @default false
   */
  subtle?: boolean;

  /**
   * Size variant
   * @default 'default'
   */
  size?: 'sm' | 'default' | 'lg';
}

const severityConfig: Record<
  ValidationSeverity,
  {
    icon: React.ComponentType<{ className?: string }>;
    colorClass: string;
    subtleColorClass: string;
    bgClass: string;
  }
> = {
  error: {
    icon: AlertCircle,
    colorClass: 'text-destructive',
    subtleColorClass: 'text-red-600',
    bgClass: 'bg-destructive/10',
  },
  warning: {
    icon: AlertTriangle,
    colorClass: 'text-yellow-600',
    subtleColorClass: 'text-yellow-500',
    bgClass: 'bg-yellow-50',
  },
  success: {
    icon: CheckCircle2,
    colorClass: 'text-green-600',
    subtleColorClass: 'text-green-500',
    bgClass: 'bg-green-50',
  },
  info: {
    icon: Info,
    colorClass: 'text-blue-600',
    subtleColorClass: 'text-blue-500',
    bgClass: 'bg-blue-50',
  },
};

const sizeConfig = {
  sm: {
    text: 'text-xs',
    icon: 'w-3 h-3',
    padding: 'px-2 py-1',
    gap: 'gap-1',
  },
  default: {
    text: 'text-sm',
    icon: 'w-4 h-4',
    padding: 'px-3 py-2',
    gap: 'gap-2',
  },
  lg: {
    text: 'text-base',
    icon: 'w-5 h-5',
    padding: 'px-4 py-2',
    gap: 'gap-2',
  },
};

export function ValidationMessage({
  message,
  severity = 'error',
  showIcon = true,
  icon: customIcon,
  className,
  animate = true,
  subtle = false,
  size = 'default',
}: ValidationMessageProps) {
  // Don't render if no message
  if (!message || (Array.isArray(message) && message.length === 0)) {
    return null;
  }

  const messages = Array.isArray(message) ? message : [message];
  const config = severityConfig[severity];
  const sizeStyles = sizeConfig[size];
  const Icon = config.icon;

  const colorClass = subtle ? config.subtleColorClass : config.colorClass;

  return (
    <div
      className={cn(
        'flex items-start rounded-md',
        sizeStyles.gap,
        sizeStyles.padding,
        sizeStyles.text,
        colorClass,
        subtle ? '' : config.bgClass,
        animate && 'animate-in fade-in-50 slide-in-from-top-1 duration-200',
        className
      )}
      role="alert"
      aria-live="polite"
    >
      {showIcon && (
        <div className="flex-shrink-0 mt-0.5">
          {customIcon || <Icon className={cn(sizeStyles.icon, colorClass)} />}
        </div>
      )}
      <div className="flex-1">
        {messages.length === 1 ? (
          <p className="font-medium">{messages[0]}</p>
        ) : (
          <ul className="list-disc list-inside space-y-1">
            {messages.map((msg, index) => (
              <li key={index}>{msg}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/**
 * Inline Validation Message
 *
 * A more subtle variant for inline field validation.
 * Displays only the message and icon without background.
 */
export interface InlineValidationMessageProps extends Omit<ValidationMessageProps, 'subtle' | 'size'> {
  /**
   * Field ID for accessibility
   */
  fieldId?: string;
}

export function InlineValidationMessage({
  message,
  severity = 'error',
  showIcon = true,
  icon,
  className,
  animate = true,
  fieldId,
}: InlineValidationMessageProps) {
  if (!message || (Array.isArray(message) && message.length === 0)) {
    return null;
  }

  const messages = Array.isArray(message) ? message : [message];
  const config = severityConfig[severity];
  const Icon = config.icon;

  return (
    <div
      id={fieldId ? `${fieldId}-error` : undefined}
      className={cn(
        'flex items-start gap-1.5 text-sm',
        config.colorClass,
        animate && 'animate-in fade-in-50 slide-in-from-top-1 duration-200',
        className
      )}
      role="alert"
      aria-live="polite"
    >
      {showIcon && (
        <div className="flex-shrink-0 mt-0.5">
          {icon || <Icon className="w-4 h-4" />}
        </div>
      )}
      <div className="flex-1">
        {messages.length === 1 ? (
          <span>{messages[0]}</span>
        ) : (
          <ul className="list-disc list-inside space-y-1">
            {messages.map((msg, index) => (
              <li key={index}>{msg}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/**
 * Field Validation State Indicator
 *
 * Shows only an icon to indicate validation state (for compact UIs)
 */
export interface ValidationStateIndicatorProps {
  severity: ValidationSeverity;
  tooltip?: string;
  className?: string;
}

export function ValidationStateIndicator({
  severity,
  tooltip,
  className,
}: ValidationStateIndicatorProps) {
  const config = severityConfig[severity];
  const Icon = config.icon;

  return (
    <div
      className={cn('flex-shrink-0', className)}
      title={tooltip}
      role="img"
      aria-label={`${severity} indicator`}
    >
      <Icon className={cn('w-4 h-4', config.colorClass)} />
    </div>
  );
}
