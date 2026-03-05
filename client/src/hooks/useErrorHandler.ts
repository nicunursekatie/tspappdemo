import { useCallback, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  DynamicErrorManager,
  DynamicErrorMessage,
  ErrorContext,
} from '@shared/error-management';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';
import { apiRequest } from '@/lib/queryClient';
import { logger } from '@/lib/logger';

export interface ErrorHandlerOptions {
  showToast?: boolean;
  logError?: boolean;
  context?: ErrorContext;
}

export function useErrorHandler() {
  const [currentError, setCurrentError] = useState<DynamicErrorMessage | null>(
    null
  );
  const { user } = useAuth();
  const { toast } = useToast();

  // Log errors to the server for analytics and monitoring
  const logErrorMutation = useMutation({
    mutationFn: async (errorData: {
      error: string;
      context: ErrorContext;
      userAgent?: string;
      timestamp: string;
    }) => {
      return apiRequest('POST', '/api/error-logs', errorData);
    },
    onError: (error) => {
      // Silent fail for error logging - don't create infinite loops
      logger.warn('Failed to log error to server:', error);
    },
  });

  const handleError = useCallback(
    (error: Error | string, options: ErrorHandlerOptions = {}) => {
      const { showToast = true, logError = true, context = {} } = options;

      // Enhanced context with current user and page information
      const enhancedContext: ErrorContext = {
        userRole: (user as any)?.role,
        currentPage: window.location.pathname,
        userId: (user as any)?.id,
        sessionValid: !!user,
        ...context,
      };

      const errorMessage = DynamicErrorManager.getErrorMessage(
        error,
        enhancedContext
      );
      setCurrentError(errorMessage);

      // Show toast notification for user-friendly errors
      if (showToast && errorMessage.severity !== 'low') {
        const toastVariant =
          errorMessage.severity === 'critical' ? 'destructive' : 'default';

        toast({
          variant: toastVariant,
          title: `${DynamicErrorManager.getCategoryIcon(
            errorMessage.category
          )} ${errorMessage.title}`,
          description: errorMessage.userFriendlyExplanation,
          duration: errorMessage.severity === 'critical' ? 0 : 5000, // Critical errors don't auto-dismiss
        });
      }

      // Log error for monitoring and analytics
      if (logError) {
        logErrorMutation.mutate({
          error: typeof error === 'string' ? error : error.message,
          context: enhancedContext,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString(),
        });
      }

      // Console log for development
      if (import.meta.env.DEV) {
        logger.group('🚨 Dynamic Error Handler');
        logger.log('Error:', error);
        logger.log('Context:', enhancedContext);
        logger.log('Generated Message:', errorMessage);
        logger.groupEnd();
      }
    },
    [user, toast, logErrorMutation]
  );

  const handleFormError = useCallback(
    (error: Error | string, formData?: Record<string, any>) => {
      handleError(error, {
        context: {
          attemptedAction: 'form submission',
          formData,
        },
      });
    },
    [handleError]
  );

  const handleNetworkError = useCallback(
    (error: Error | string) => {
      handleError(error, {
        context: {
          attemptedAction: 'network request',
        },
      });
    },
    [handleError]
  );

  const handlePermissionError = useCallback(
    (action: string) => {
      handleError('PERMISSION_DENIED', {
        context: {
          attemptedAction: action,
        },
      });
    },
    [handleError]
  );

  const clearError = useCallback(() => {
    setCurrentError(null);
  }, []);

  const handleErrorAction = useCallback(
    (action: any) => {
      // Handle common custom actions
      switch (action.target) {
        case 'scrollToErrors':
          const firstError = document.querySelector('[aria-invalid="true"]');
          if (firstError) {
            firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Focus on the error field
            if (firstError instanceof HTMLElement) {
              firstError.focus();
            }
          }
          break;

        case 'resetForm':
          const forms = document.querySelectorAll('form');
          forms.forEach((form) => {
            if (form instanceof HTMLFormElement) {
              form.reset();
            }
          });
          toast({
            title: 'Form Reset',
            description:
              'The form has been cleared and reset to default values.',
          });
          break;

        case 'goBack':
          if (window.history.length > 1) {
            window.history.back();
          } else {
            window.location.href = '/dashboard';
          }
          break;

        case 'saveLocal':
          try {
            const formData: Record<string, string> = {};
            const inputs = document.querySelectorAll('input, textarea, select');

            inputs.forEach((input: any) => {
              if (input.value && (input.name || input.id)) {
                formData[input.name || input.id] = input.value;
              }
            });

            if (Object.keys(formData).length > 0) {
              localStorage.setItem(
                `form_backup_${Date.now()}`,
                JSON.stringify(formData)
              );
              toast({
                title: 'Data Saved',
                description:
                  'Your form data has been saved locally as a backup.',
              });
            } else {
              toast({
                title: 'No Data to Save',
                description: 'No form data was found to back up.',
              });
            }
          } catch (error) {
            toast({
              variant: 'destructive',
              title: 'Save Failed',
              description: 'Could not save your data locally.',
            });
          }
          break;

        case 'checkNetworkStatus':
          fetch('/api/health-check')
            .then((res) => {
              if (res.ok) {
                toast({
                  title: 'Network Status',
                  description: 'Your network connection is working properly.',
                });
              } else {
                throw new Error('Health check failed');
              }
            })
            .catch(() => {
              toast({
                variant: 'destructive',
                title: 'Network Issue',
                description:
                  'Network connection appears to be having problems.',
              });
            });
          break;

        case 'selectNewFile':
          const fileInputs = document.querySelectorAll('input[type="file"]');
          if (fileInputs.length > 0) {
            (fileInputs[0] as HTMLInputElement).click();
          }
          break;

        case 'showFileHelp':
          toast({
            title: 'File Upload Requirements',
            description:
              'Supported formats: PDF, DOC, DOCX, JPG, PNG. Maximum size: 10MB.',
          });
          break;

        case 'showAlternatives':
          toast({
            title: 'Alternative Options',
            description:
              'Try using a different feature or contact support for assistance.',
          });
          break;

        case 'checkServiceStatus':
          // Could integrate with a status page or service monitoring API
          toast({
            title: 'Service Status',
            description:
              'Checking external service status... Please try again in a few minutes.',
          });
          break;

        case 'scheduleRetry':
          setTimeout(() => {
            window.location.reload();
          }, 60000); // Retry after 1 minute

          toast({
            title: 'Retry Scheduled',
            description:
              "We'll automatically retry this operation in 1 minute.",
          });
          break;

        default:
          logger.warn('Unhandled custom error action:', action.target);
          break;
      }
    },
    [toast]
  );

  return {
    currentError,
    handleError,
    handleFormError,
    handleNetworkError,
    handlePermissionError,
    clearError,
    handleErrorAction,
    isLoggingError: logErrorMutation.isPending,
  };
}

// Helper function to wrap async functions with error handling
export function withErrorHandler<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  errorHandler: (error: Error) => void,
  options: ErrorHandlerOptions = {}
) {
  return async (...args: T): Promise<R | null> => {
    try {
      return await fn(...args);
    } catch (error) {
      errorHandler(error as Error);
      return null;
    }
  };
}

// Form validation error helper
export function createFormErrorHandler(
  handleError: (error: Error | string, options?: ErrorHandlerOptions) => void
) {
  return (errors: Record<string, any>, formData?: Record<string, any>) => {
    const errorCount = Object.keys(errors).length;
    const errorMessage =
      errorCount === 1
        ? 'Please correct the highlighted field.'
        : `Please correct the ${errorCount} highlighted fields.`;

    handleError('VALIDATION_ERROR', {
      context: {
        attemptedAction: 'form validation',
        formData,
      },
    });

    // Scroll to the first error
    setTimeout(() => {
      const firstError = document.querySelector('[aria-invalid="true"]');
      if (firstError) {
        firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  };
}
