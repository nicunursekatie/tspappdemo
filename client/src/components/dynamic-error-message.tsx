import React from 'react';
import {
  AlertTriangle,
  RefreshCw,
  ArrowLeft,
  HelpCircle,
  Mail,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import {
  DynamicErrorMessage,
  ErrorRecoveryAction,
  DynamicErrorManager,
} from '@shared/error-management';
import { logger } from '@/lib/logger';

interface DynamicErrorMessageProps {
  error: DynamicErrorMessage;
  onAction?: (action: ErrorRecoveryAction) => void;
  onDismiss?: () => void;
  className?: string;
  compact?: boolean;
}

export function DynamicErrorMessageDisplay({
  error,
  onAction,
  onDismiss,
  className = '',
  compact = false,
}: DynamicErrorMessageProps) {
  const [showDetails, setShowDetails] = React.useState(false);
  const [showPreventionTips, setShowPreventionTips] = React.useState(false);

  const handleAction = (action: ErrorRecoveryAction) => {
    if (onAction) {
      onAction(action);
      return;
    }

    // Default action handlers
    switch (action.action) {
      case 'retry':
        window.location.reload();
        break;
      case 'refresh':
        window.location.reload();
        break;
      case 'redirect':
        if (action.target) {
          window.location.href = action.target;
        }
        break;
      case 'contact':
        // Open email client or contact form
        window.location.href =
          'mailto:support@sandwichproject.org?subject=Error Report';
        break;
      case 'custom':
        // Custom actions should be handled by the parent component
        logger.warn(
          'Custom action needs to be handled by parent component:',
          action.target
        );
        break;
    }
  };

  const getActionIcon = (action: ErrorRecoveryAction) => {
    switch (action.action) {
      case 'retry':
        return <RefreshCw className="w-4 h-4" />;
      case 'refresh':
        return <RefreshCw className="w-4 h-4" />;
      case 'redirect':
        return <ExternalLink className="w-4 h-4" />;
      case 'contact':
        return <Mail className="w-4 h-4" />;
      default:
        return <HelpCircle className="w-4 h-4" />;
    }
  };

  const severityColorClass = DynamicErrorManager.getSeverityColor(
    error.severity
  );
  const categoryIcon = DynamicErrorManager.getCategoryIcon(error.category);

  if (compact) {
    return (
      <Alert className={`${severityColorClass} ${className}`}>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle className="flex items-center gap-2">
          <span>{categoryIcon}</span>
          {error.title}
        </AlertTitle>
        <AlertDescription>
          {error.userFriendlyExplanation}
          {error.recoveryActions.length > 0 && (
            <div className="flex gap-2 mt-2">
              {error.recoveryActions
                .filter((action) => action.primary)
                .slice(0, 1)
                .map((action, index) => (
                  <Button
                    key={index}
                    size="sm"
                    variant="outline"
                    onClick={() => handleAction(action)}
                    className="h-7"
                  >
                    {getActionIcon(action)}
                    {action.label}
                  </Button>
                ))}
            </div>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card
      className={`${className} border-l-4`}
      style={{
        borderLeftColor:
          error.severity === 'critical'
            ? '#dc2626'
            : error.severity === 'high'
              ? '#ea580c'
              : error.severity === 'medium'
                ? '#d97706'
                : '#ca8a04',
      }}
    >
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="text-2xl">{categoryIcon}</div>
            <div>
              <CardTitle className="flex items-center gap-2">
                {error.title}
                <Badge variant="outline" className="text-xs">
                  {error.category.replace('_', ' ')}
                </Badge>
              </CardTitle>
              <CardDescription className="mt-1">
                {error.userFriendlyExplanation}
              </CardDescription>
            </div>
          </div>
          {onDismiss && (
            <Button variant="ghost" size="sm" onClick={onDismiss}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {/* Recovery Actions */}
        {error.recoveryActions.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-medium text-sm">What You Can Do:</h4>
            <div className="flex flex-wrap gap-2">
              {error.recoveryActions.map((action, index) => (
                <Button
                  key={index}
                  variant={action.primary ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleAction(action)}
                  className="flex items-center gap-2"
                >
                  {getActionIcon(action)}
                  {action.label}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Prevention Tips */}
        {error.preventionTips && error.preventionTips.length > 0 && (
          <div className="mt-4">
            <Collapsible
              open={showPreventionTips}
              onOpenChange={setShowPreventionTips}
            >
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="p-0 h-auto font-medium text-sm"
                >
                  <HelpCircle className="w-4 h-4 mr-2" />
                  How to Prevent This Issue
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2">
                <ul className="text-sm text-gray-600 space-y-1 ml-6">
                  {error.preventionTips.map((tip, index) => (
                    <li key={index} className="list-disc">
                      {tip}
                    </li>
                  ))}
                </ul>
              </CollapsibleContent>
            </Collapsible>
          </div>
        )}

        {/* Technical Details */}
        {error.technicalDetails && (
          <div className="mt-4">
            <Collapsible open={showDetails} onOpenChange={setShowDetails}>
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="p-0 h-auto font-medium text-sm text-gray-500"
                >
                  Technical Details
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2">
                <code className="text-xs bg-gray-100 p-2 rounded block overflow-x-auto">
                  {error.technicalDetails}
                </code>
              </CollapsibleContent>
            </Collapsible>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Hook for using dynamic error messages
export function useDynamicError() {
  const [currentError, setCurrentError] =
    React.useState<DynamicErrorMessage | null>(null);

  const showError = React.useCallback(
    (error: Error | string, context: any = {}) => {
      const errorMessage = DynamicErrorManager.getErrorMessage(error, context);
      setCurrentError(errorMessage);
    },
    []
  );

  const clearError = React.useCallback(() => {
    setCurrentError(null);
  }, []);

  const handleErrorAction = React.useCallback((action: ErrorRecoveryAction) => {
    // Handle common custom actions
    switch (action.target) {
      case 'scrollToErrors':
        const firstError = document.querySelector('[aria-invalid="true"]');
        if (firstError) {
          firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        break;
      case 'resetForm':
        const forms = document.querySelectorAll('form');
        forms.forEach((form) => form.reset());
        break;
      case 'goBack':
        window.history.back();
        break;
      case 'saveLocal':
        // Save form data to localStorage
        const formData = new FormData();
        const inputs = document.querySelectorAll('input, textarea, select');
        inputs.forEach((input: any) => {
          if (input.value) {
            localStorage.setItem(
              `backup_${input.name || input.id}`,
              input.value
            );
          }
        });
        alert('Your data has been saved locally as a backup.');
        break;
      case 'checkNetworkStatus':
        // Simple network check
        fetch('/api/health-check')
          .then(() => alert('Network connection is working properly.'))
          .catch(() => alert('Network connection appears to be down.'));
        break;
      default:
        logger.warn('Unhandled custom action:', action.target);
    }
  }, []);

  return {
    currentError,
    showError,
    clearError,
    handleErrorAction,
  };
}

// Error Boundary with Dynamic Error Messages
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class DynamicErrorBoundary extends React.Component<
  React.PropsWithChildren<{
    fallback?: React.ComponentType<{ error: DynamicErrorMessage }>;
  }>,
  ErrorBoundaryState
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError && this.state.error) {
      const errorMessage = DynamicErrorManager.getErrorMessage(
        this.state.error
      );

      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return <FallbackComponent error={errorMessage} />;
      }

      return (
        <div className="p-6 max-w-2xl mx-auto">
          <DynamicErrorMessageDisplay
            error={errorMessage}
            onAction={(action) => {
              if (action.action === 'refresh') {
                window.location.reload();
              }
            }}
          />
        </div>
      );
    }

    return this.props.children;
  }
}
