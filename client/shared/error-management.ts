// Dynamic Error Management System with Recovery Suggestions
// Provides contextual error messages and actionable recovery steps

export interface ErrorRecoveryAction {
  label: string;
  action: string; // Action type: 'retry', 'redirect', 'refresh', 'contact', 'custom'
  target?: string; // URL for redirect, function name for custom actions
  primary?: boolean; // Mark as primary action
}

export interface DynamicErrorMessage {
  title: string;
  message: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  recoveryActions: ErrorRecoveryAction[];
  technicalDetails?: string;
  userFriendlyExplanation: string;
  preventionTips?: string[];
}

export type ErrorCategory =
  | 'authentication'
  | 'permissions'
  | 'network'
  | 'validation'
  | 'database'
  | 'file_upload'
  | 'form_submission'
  | 'data_loading'
  | 'session'
  | 'external_service'
  | 'unknown';

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface ErrorContext {
  userRole?: string;
  currentPage?: string;
  attemptedAction?: string;
  formData?: Record<string, any>;
  userId?: string;
  sessionValid?: boolean;
}

export class DynamicErrorManager {
  private static errorMappings: Map<
    string,
    (context: ErrorContext) => DynamicErrorMessage
  > = new Map();

  static {
    // Authentication Errors
    this.registerError('AUTH_EXPIRED', (context) => ({
      title: 'Session Expired',
      message: 'Your session has expired for security reasons.',
      category: 'authentication',
      severity: 'medium',
      userFriendlyExplanation:
        'You need to sign in again to continue using the platform.',
      recoveryActions: [
        {
          label: 'Sign In Again',
          action: 'redirect',
          target: '/landing',
          primary: true,
        },
        { label: 'Contact Support', action: 'contact' },
      ],
      preventionTips: [
        'Keep the app open in your browser to maintain your session',
        'Enable "Remember Me" when signing in',
      ],
    }));

    this.registerError('AUTH_INVALID', (context) => ({
      title: 'Invalid Credentials',
      message: 'The email or password you entered is incorrect.',
      category: 'authentication',
      severity: 'medium',
      userFriendlyExplanation:
        'Please double-check your email address and password.',
      recoveryActions: [
        { label: 'Try Again', action: 'retry', primary: true },
        {
          label: 'Reset Password',
          action: 'redirect',
          target: '/reset-password',
        },
        { label: 'Contact Admin', action: 'contact' },
      ],
    }));

    // Permission Errors
    this.registerError('PERMISSION_DENIED', (context) => ({
      title: 'Access Not Allowed',
      message: `Your ${context.userRole || 'current'} role doesn't have permission for this action.`,
      category: 'permissions',
      severity: 'medium',
      userFriendlyExplanation:
        'This feature is restricted to users with higher access levels.',
      recoveryActions: [
        {
          label: 'Go to Dashboard',
          action: 'redirect',
          target: '/dashboard',
          primary: true,
        },
        { label: 'Request Access', action: 'contact' },
        { label: 'View Help Guide', action: 'redirect', target: '/help' },
      ],
      preventionTips: [
        'Check with your team lead about access requirements',
        'Review the user permissions guide in the help section',
      ],
    }));

    // Network Errors
    this.registerError('NETWORK_ERROR', (context) => ({
      title: 'Connection Problem',
      message: 'Unable to connect to the server.',
      category: 'network',
      severity: 'high',
      userFriendlyExplanation:
        'There seems to be a problem with your internet connection or our servers.',
      recoveryActions: [
        { label: 'Try Again', action: 'retry', primary: true },
        { label: 'Refresh Page', action: 'refresh' },
        {
          label: 'Check Network Status',
          action: 'custom',
          target: 'checkNetworkStatus',
        },
      ],
      preventionTips: [
        'Ensure you have a stable internet connection',
        'Try using a different network if problems persist',
      ],
    }));

    // Form Validation Errors
    this.registerError('VALIDATION_ERROR', (context) => ({
      title: 'Form Information Incomplete',
      message: 'Please review and correct the highlighted fields.',
      category: 'validation',
      severity: 'low',
      userFriendlyExplanation:
        'Some required information is missing or incorrectly formatted.',
      recoveryActions: [
        {
          label: 'Review Form',
          action: 'custom',
          target: 'scrollToErrors',
          primary: true,
        },
        {
          label: 'Clear Form & Start Over',
          action: 'custom',
          target: 'resetForm',
        },
        { label: 'Get Help', action: 'redirect', target: '/help' },
      ],
      preventionTips: [
        'Required fields are marked with a red asterisk (*)',
        'Check that dates are in the correct format',
        'Ensure email addresses include @ symbol',
      ],
    }));

    // Database Errors
    this.registerError('DATABASE_ERROR', (context) => ({
      title: 'Data Save Failed',
      message: 'Your information could not be saved right now.',
      category: 'database',
      severity: 'high',
      userFriendlyExplanation:
        'There was a temporary problem saving your data. Your work has not been lost.',
      recoveryActions: [
        { label: 'Save Again', action: 'retry', primary: true },
        { label: 'Save Draft Locally', action: 'custom', target: 'saveLocal' },
        { label: 'Report Issue', action: 'contact' },
      ],
      technicalDetails: 'Database connection or query execution failed',
      preventionTips: [
        'Save your work frequently to avoid data loss',
        'If you see this error repeatedly, try refreshing the page',
      ],
    }));

    // File Upload Errors
    this.registerError('FILE_UPLOAD_ERROR', (context) => ({
      title: 'File Upload Failed',
      message: 'The file could not be uploaded successfully.',
      category: 'file_upload',
      severity: 'medium',
      userFriendlyExplanation:
        'There was a problem uploading your file. This could be due to file size, type, or connection issues.',
      recoveryActions: [
        { label: 'Try Upload Again', action: 'retry', primary: true },
        {
          label: 'Choose Different File',
          action: 'custom',
          target: 'selectNewFile',
        },
        {
          label: 'Check File Requirements',
          action: 'custom',
          target: 'showFileHelp',
        },
      ],
      preventionTips: [
        'Ensure files are smaller than 10MB',
        'Supported formats: PDF, DOC, DOCX, JPG, PNG',
        'Check your internet connection for large files',
      ],
    }));

    // Data Loading Errors
    this.registerError('DATA_LOADING_ERROR', (context) => ({
      title: 'Unable to Load Data',
      message: `Could not load ${context.attemptedAction || 'the requested information'}.`,
      category: 'data_loading',
      severity: 'medium',
      userFriendlyExplanation:
        'The information you requested is temporarily unavailable.',
      recoveryActions: [
        { label: 'Reload Data', action: 'retry', primary: true },
        { label: 'Refresh Page', action: 'refresh' },
        { label: 'Go Back', action: 'custom', target: 'goBack' },
      ],
      preventionTips: [
        'Try refreshing the page if data fails to load',
        'Check if you have permission to view this information',
      ],
    }));

    // External Service Errors
    this.registerError('EXTERNAL_SERVICE_ERROR', (context) => ({
      title: 'External Service Unavailable',
      message: 'A required external service is currently unavailable.',
      category: 'external_service',
      severity: 'high',
      userFriendlyExplanation:
        'We use external services for some features. One of these services is temporarily down.',
      recoveryActions: [
        {
          label: 'Try Again Later',
          action: 'custom',
          target: 'scheduleRetry',
          primary: true,
        },
        {
          label: 'Use Alternative Method',
          action: 'custom',
          target: 'showAlternatives',
        },
        {
          label: 'Check Service Status',
          action: 'custom',
          target: 'checkServiceStatus',
        },
      ],
      preventionTips: [
        'External services are usually restored quickly',
        'Try alternative features while we resolve the issue',
      ],
    }));
  }

  static registerError(
    errorCode: string,
    errorGenerator: (context: ErrorContext) => DynamicErrorMessage
  ): void {
    this.errorMappings.set(errorCode, errorGenerator);
  }

  static getErrorMessage(
    error: Error | string,
    context: ErrorContext = {}
  ): DynamicErrorMessage {
    const errorCode =
      typeof error === 'string' ? error : this.extractErrorCode(error);
    const generator = this.errorMappings.get(errorCode);

    if (generator) {
      return generator(context);
    }

    // Fallback for unknown errors
    return this.createGenericError(error, context);
  }

  private static extractErrorCode(error: Error): string {
    // Extract error codes from common error patterns
    if (error.message.includes('401') || error.message.includes('Unauthorized'))
      return 'AUTH_EXPIRED';
    if (error.message.includes('403') || error.message.includes('Forbidden'))
      return 'PERMISSION_DENIED';
    if (error.message.includes('network') || error.message.includes('fetch'))
      return 'NETWORK_ERROR';
    if (
      error.message.includes('validation') ||
      error.message.includes('required')
    )
      return 'VALIDATION_ERROR';
    if (error.message.includes('database') || error.message.includes('query'))
      return 'DATABASE_ERROR';
    if (error.message.includes('file') || error.message.includes('upload'))
      return 'FILE_UPLOAD_ERROR';

    return 'UNKNOWN_ERROR';
  }

  private static createGenericError(
    error: Error | string,
    context: ErrorContext
  ): DynamicErrorMessage {
    const message = typeof error === 'string' ? error : error.message;

    return {
      title: 'Something Went Wrong',
      message: 'An unexpected error occurred.',
      category: 'unknown',
      severity: 'medium',
      userFriendlyExplanation:
        'We encountered an unexpected problem. This has been logged and our team will investigate.',
      recoveryActions: [
        { label: 'Try Again', action: 'retry', primary: true },
        { label: 'Refresh Page', action: 'refresh' },
        { label: 'Go to Dashboard', action: 'redirect', target: '/dashboard' },
        { label: 'Report This Issue', action: 'contact' },
      ],
      technicalDetails: message,
      preventionTips: [
        'If this happens repeatedly, try refreshing your browser',
        'Clearing your browser cache may help resolve persistent issues',
      ],
    };
  }

  static formatErrorForUser(errorMessage: DynamicErrorMessage): string {
    const { title, userFriendlyExplanation, recoveryActions } = errorMessage;
    const primaryAction = recoveryActions.find((action) => action.primary);

    let formatted = `${title}: ${userFriendlyExplanation}`;
    if (primaryAction) {
      formatted += ` Try: ${primaryAction.label}`;
    }

    return formatted;
  }

  static getSeverityColor(severity: ErrorSeverity): string {
    switch (severity) {
      case 'low':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'medium':
        return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'high':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'critical':
        return 'text-red-800 bg-red-100 border-red-300';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  }

  static getCategoryIcon(category: ErrorCategory): string {
    switch (category) {
      case 'authentication':
        return '🔐';
      case 'permissions':
        return '🚫';
      case 'network':
        return '📡';
      case 'validation':
        return '⚠️';
      case 'database':
        return '💾';
      case 'file_upload':
        return '📁';
      case 'form_submission':
        return '📝';
      case 'data_loading':
        return '📊';
      case 'session':
        return '⏱️';
      case 'external_service':
        return '🔌';
      default:
        return '❓';
    }
  }
}
