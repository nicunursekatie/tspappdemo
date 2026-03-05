import { useCallback, useEffect, useRef, useState } from 'react';
import { useActivityTracker } from './useActivityTracker';
import { useUserActivityTracking } from './useUserActivityTracking';
import { logger } from '@/lib/logger';

/**
 * Central Form Activity Tracking Hook
 *
 * Consolidates all form-related tracking into a single, easy-to-use hook.
 * Tracks:
 * - Form start/completion
 * - Field interactions
 * - Validation errors
 * - Form abandonment
 * - Time spent on form
 * - Submission success/failure
 */

export interface FormTrackingConfig {
  /**
   * Form name/identifier
   */
  formName: string;

  /**
   * Section of the app (e.g., 'Event Requests', 'User Management')
   */
  section: string;

  /**
   * Feature name (defaults to formName)
   */
  feature?: string;

  /**
   * Track field-level interactions
   * @default false
   */
  trackFieldInteractions?: boolean;

  /**
   * Track validation errors
   * @default true
   */
  trackValidationErrors?: boolean;

  /**
   * Track form abandonment (user left without submitting)
   * @default true
   */
  trackAbandonment?: boolean;

  /**
   * Additional metadata to include with all tracking events
   */
  metadata?: Record<string, any>;
}

export interface FormActivityTracking {
  /**
   * Call when form is first rendered/opened
   */
  trackFormStart: () => void;

  /**
   * Call when form is successfully submitted
   */
  trackFormSubmit: (data?: { recordId?: string | number; success?: boolean }) => void;

  /**
   * Call when form submission fails
   */
  trackFormError: (error: string | Error) => void;

  /**
   * Call when user cancels/closes the form
   */
  trackFormCancel: () => void;

  /**
   * Track field focus (user starts editing a field)
   */
  trackFieldFocus: (fieldName: string) => void;

  /**
   * Track field blur (user finishes editing a field)
   */
  trackFieldBlur: (fieldName: string, value?: any) => void;

  /**
   * Track field change
   */
  trackFieldChange: (fieldName: string, value?: any) => void;

  /**
   * Track validation errors
   */
  trackValidationError: (fieldName: string, error: string) => void;

  /**
   * Track multiple validation errors at once
   */
  trackMultipleValidationErrors: (errors: Record<string, string>) => void;

  /**
   * Track any custom form event
   */
  trackFormEvent: (action: string, details: string, metadata?: Record<string, any>) => void;

  /**
   * Get form metrics (time spent, fields interacted with, etc.)
   */
  getFormMetrics: () => FormMetrics;
}

export interface FormMetrics {
  formName: string;
  startTime: number;
  timeSpentSeconds: number;
  fieldsInteracted: string[];
  fieldFocusCount: Record<string, number>;
  validationErrors: number;
  isSubmitted: boolean;
  isAbandoned: boolean;
}

export function useFormActivityTracking(
  config: FormTrackingConfig
): FormActivityTracking {
  const {
    formName,
    section,
    feature = formName,
    trackFieldInteractions = false,
    trackValidationErrors = true,
    trackAbandonment = true,
    metadata = {},
  } = config;

  // Use existing tracking hooks
  const { trackActivity, trackFormSubmit: trackSubmitBase } = useActivityTracker();
  const { trackFormSubmit: trackSubmitUser } = useUserActivityTracking();

  // Track form state
  const [formState] = useState<FormMetrics>({
    formName,
    startTime: Date.now(),
    timeSpentSeconds: 0,
    fieldsInteracted: [],
    fieldFocusCount: {},
    validationErrors: 0,
    isSubmitted: false,
    isAbandoned: false,
  });

  const formStateRef = useRef(formState);
  const hasTrackedStartRef = useRef(false);

  // Track form start
  const trackFormStart = useCallback(() => {
    if (hasTrackedStartRef.current) return;

    hasTrackedStartRef.current = true;
    formStateRef.current.startTime = Date.now();

    trackActivity({
      action: 'Form Start',
      section,
      feature,
      details: `Started ${formName}`,
      metadata: {
        ...metadata,
        formName,
        timestamp: new Date().toISOString(),
      },
    });

    logger.log(`[Form Tracking] Started: ${formName}`);
  }, [formName, section, feature, metadata, trackActivity]);

  // Track form submission
  const trackFormSubmit = useCallback(
    (data?: { recordId?: string | number; success?: boolean }) => {
      const timeSpent = Math.round((Date.now() - formStateRef.current.startTime) / 1000);
      const success = data?.success ?? true;

      formStateRef.current.isSubmitted = true;
      formStateRef.current.timeSpentSeconds = timeSpent;

      // Track in all systems
      trackSubmitBase(formName, section, feature, success);
      trackSubmitUser(formName, section, data?.recordId);

      // Track detailed metrics
      trackActivity({
        action: success ? 'Form Submit Success' : 'Form Submit Failed',
        section,
        feature,
        details: `${success ? 'Successfully submitted' : 'Failed to submit'} ${formName}${
          data?.recordId ? ` (ID: ${data.recordId})` : ''
        }`,
        metadata: {
          ...metadata,
          formName,
          recordId: data?.recordId,
          timeSpentSeconds: timeSpent,
          fieldsInteracted: formStateRef.current.fieldsInteracted.length,
          validationErrors: formStateRef.current.validationErrors,
          timestamp: new Date().toISOString(),
        },
      });

      logger.log(`[Form Tracking] Submitted: ${formName} (${timeSpent}s)`);
    },
    [formName, section, feature, metadata, trackActivity, trackSubmitBase, trackSubmitUser]
  );

  // Track form error
  const trackFormError = useCallback(
    (error: string | Error) => {
      const errorMessage = error instanceof Error ? error.message : error;

      trackActivity({
        action: 'Form Error',
        section,
        feature,
        details: `Error in ${formName}: ${errorMessage}`,
        metadata: {
          ...metadata,
          formName,
          error: errorMessage,
          timestamp: new Date().toISOString(),
        },
      });

      logger.error(`[Form Tracking] Error in ${formName}:`, error);
    },
    [formName, section, feature, metadata, trackActivity]
  );

  // Track form cancel
  const trackFormCancel = useCallback(() => {
    const timeSpent = Math.round((Date.now() - formStateRef.current.startTime) / 1000);

    trackActivity({
      action: 'Form Cancel',
      section,
      feature,
      details: `Cancelled ${formName}`,
      metadata: {
        ...metadata,
        formName,
        timeSpentSeconds: timeSpent,
        fieldsInteracted: formStateRef.current.fieldsInteracted.length,
        timestamp: new Date().toISOString(),
      },
    });

    logger.log(`[Form Tracking] Cancelled: ${formName} (${timeSpent}s)`);
  }, [formName, section, feature, metadata, trackActivity]);

  // Track field focus
  const trackFieldFocus = useCallback(
    (fieldName: string) => {
      if (!trackFieldInteractions) return;

      // Update metrics
      if (!formStateRef.current.fieldsInteracted.includes(fieldName)) {
        formStateRef.current.fieldsInteracted.push(fieldName);
      }
      formStateRef.current.fieldFocusCount[fieldName] =
        (formStateRef.current.fieldFocusCount[fieldName] || 0) + 1;

      trackActivity({
        action: 'Field Focus',
        section,
        feature,
        details: `Focused on ${fieldName} in ${formName}`,
        metadata: {
          ...metadata,
          formName,
          fieldName,
          focusCount: formStateRef.current.fieldFocusCount[fieldName],
          timestamp: new Date().toISOString(),
        },
      });
    },
    [formName, section, feature, metadata, trackFieldInteractions, trackActivity]
  );

  // Track field blur
  const trackFieldBlur = useCallback(
    (fieldName: string, value?: any) => {
      if (!trackFieldInteractions) return;

      trackActivity({
        action: 'Field Blur',
        section,
        feature,
        details: `Completed ${fieldName} in ${formName}`,
        metadata: {
          ...metadata,
          formName,
          fieldName,
          hasValue: value !== undefined && value !== null && value !== '',
          timestamp: new Date().toISOString(),
        },
      });
    },
    [formName, section, feature, metadata, trackFieldInteractions, trackActivity]
  );

  // Track field change
  const trackFieldChange = useCallback(
    (fieldName: string, value?: any) => {
      if (!trackFieldInteractions) return;

      // Update metrics
      if (!formStateRef.current.fieldsInteracted.includes(fieldName)) {
        formStateRef.current.fieldsInteracted.push(fieldName);
      }

      trackActivity({
        action: 'Field Change',
        section,
        feature,
        details: `Changed ${fieldName} in ${formName}`,
        metadata: {
          ...metadata,
          formName,
          fieldName,
          hasValue: value !== undefined && value !== null && value !== '',
          timestamp: new Date().toISOString(),
        },
      });
    },
    [formName, section, feature, metadata, trackFieldInteractions, trackActivity]
  );

  // Track validation error
  const trackValidationError = useCallback(
    (fieldName: string, error: string) => {
      if (!trackValidationErrors) return;

      formStateRef.current.validationErrors += 1;

      trackActivity({
        action: 'Validation Error',
        section,
        feature,
        details: `Validation error in ${formName}: ${fieldName} - ${error}`,
        metadata: {
          ...metadata,
          formName,
          fieldName,
          error,
          totalValidationErrors: formStateRef.current.validationErrors,
          timestamp: new Date().toISOString(),
        },
      });
    },
    [formName, section, feature, metadata, trackValidationErrors, trackActivity]
  );

  // Track multiple validation errors
  const trackMultipleValidationErrors = useCallback(
    (errors: Record<string, string>) => {
      if (!trackValidationErrors) return;

      const errorCount = Object.keys(errors).length;
      formStateRef.current.validationErrors += errorCount;

      trackActivity({
        action: 'Validation Errors',
        section,
        feature,
        details: `${errorCount} validation errors in ${formName}`,
        metadata: {
          ...metadata,
          formName,
          errors,
          errorCount,
          totalValidationErrors: formStateRef.current.validationErrors,
          timestamp: new Date().toISOString(),
        },
      });
    },
    [formName, section, feature, metadata, trackValidationErrors, trackActivity]
  );

  // Track custom form event
  const trackFormEvent = useCallback(
    (action: string, details: string, eventMetadata?: Record<string, any>) => {
      trackActivity({
        action,
        section,
        feature,
        details: `${formName}: ${details}`,
        metadata: {
          ...metadata,
          ...eventMetadata,
          formName,
          timestamp: new Date().toISOString(),
        },
      });
    },
    [formName, section, feature, metadata, trackActivity]
  );

  // Get form metrics
  const getFormMetrics = useCallback((): FormMetrics => {
    const timeSpent = Math.round((Date.now() - formStateRef.current.startTime) / 1000);

    return {
      ...formStateRef.current,
      timeSpentSeconds: timeSpent,
    };
  }, []);

  // Track abandonment on unmount (if form wasn't submitted)
  useEffect(() => {
    return () => {
      if (
        trackAbandonment &&
        !formStateRef.current.isSubmitted &&
        !formStateRef.current.isAbandoned
      ) {
        const timeSpent = Math.round(
          (Date.now() - formStateRef.current.startTime) / 1000
        );

        // Only track as abandoned if user spent more than 5 seconds
        if (timeSpent > 5) {
          formStateRef.current.isAbandoned = true;

          trackActivity({
            action: 'Form Abandoned',
            section,
            feature,
            details: `Abandoned ${formName} after ${timeSpent} seconds`,
            metadata: {
              ...metadata,
              formName,
              timeSpentSeconds: timeSpent,
              fieldsInteracted: formStateRef.current.fieldsInteracted.length,
              validationErrors: formStateRef.current.validationErrors,
              timestamp: new Date().toISOString(),
            },
          });

          logger.log(`[Form Tracking] Abandoned: ${formName} (${timeSpent}s)`);
        }
      }
    };
  }, [formName, section, feature, metadata, trackAbandonment, trackActivity]);

  return {
    trackFormStart,
    trackFormSubmit,
    trackFormError,
    trackFormCancel,
    trackFieldFocus,
    trackFieldBlur,
    trackFieldChange,
    trackValidationError,
    trackMultipleValidationErrors,
    trackFormEvent,
    getFormMetrics,
  };
}

/**
 * Example Usage:
 *
 * ```tsx
 * import { useForm } from 'react-hook-form';
 * import { useFormActivityTracking } from '@/hooks/useFormActivityTracking';
 *
 * function UserForm({ mode, onClose }) {
 *   const { register, handleSubmit, formState: { errors } } = useForm();
 *
 *   const formTracking = useFormActivityTracking({
 *     formName: mode === 'create' ? 'Create User' : 'Edit User',
 *     section: 'User Management',
 *     trackFieldInteractions: true,
 *     trackValidationErrors: true,
 *   });
 *
 *   // Track form start on mount
 *   useEffect(() => {
 *     formTracking.trackFormStart();
 *   }, [formTracking]);
 *
 *   // Track validation errors when they change
 *   useEffect(() => {
 *     if (Object.keys(errors).length > 0) {
 *       const errorMessages = Object.entries(errors).reduce((acc, [key, value]) => {
 *         acc[key] = value?.message || 'Invalid';
 *         return acc;
 *       }, {} as Record<string, string>);
 *       formTracking.trackMultipleValidationErrors(errorMessages);
 *     }
 *   }, [errors, formTracking]);
 *
 *   const onSubmit = async (data) => {
 *     try {
 *       const result = await createUser(data);
 *       formTracking.trackFormSubmit({ recordId: result.id, success: true });
 *       onClose();
 *     } catch (error) {
 *       formTracking.trackFormError(error);
 *     }
 *   };
 *
 *   const handleCancel = () => {
 *     formTracking.trackFormCancel();
 *     onClose();
 *   };
 *
 *   return (
 *     <form onSubmit={handleSubmit(onSubmit)}>
 *       <Input
 *         {...register('name')}
 *         onFocus={() => formTracking.trackFieldFocus('name')}
 *         onBlur={(e) => formTracking.trackFieldBlur('name', e.target.value)}
 *       />
 *       <Button type="submit">Save</Button>
 *       <Button onClick={handleCancel}>Cancel</Button>
 *     </form>
 *   );
 * }
 * ```
 *
 * Simplified usage (auto-track form start):
 * ```tsx
 * function QuickForm() {
 *   const formTracking = useFormActivityTracking({
 *     formName: 'Quick Create',
 *     section: 'Dashboard',
 *   });
 *
 *   // Track start automatically
 *   useEffect(() => {
 *     formTracking.trackFormStart();
 *   }, [formTracking]);
 *
 *   const handleSubmit = () => {
 *     formTracking.trackFormSubmit({ success: true });
 *   };
 *
 *   return (
 *     <form onSubmit={handleSubmit}>
 *       {/* form fields *\/}
 *     </form>
 *   );
 * }
 * ```
 */
