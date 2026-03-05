import { useState } from 'react';
import { ShieldAlert, Send, CheckCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest } from '@/lib/queryClient';

interface PermissionDeniedProps {
  /** The action they were trying to perform (e.g., "edit events", "delete users") */
  action?: string;
  /** The specific permission that was required */
  requiredPermission?: string;
  /** Custom message to display */
  message?: string;
  /** Whether to show the request access button */
  showRequestAccess?: boolean;
  /** Compact inline mode vs full card mode */
  variant?: 'card' | 'inline' | 'banner';
  /** Optional callback when access is requested */
  onRequestSent?: () => void;
}

export function PermissionDenied({
  action,
  requiredPermission,
  message,
  showRequestAccess = true,
  variant = 'card',
  onRequestSent,
}: PermissionDeniedProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [requestMessage, setRequestMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const defaultMessage = action
    ? `You don't have permission to ${action}.`
    : "You don't have permission to perform this action.";

  const displayMessage = message || defaultMessage;

  const handleRequestAccess = async () => {
    if (!user) return;

    setIsSubmitting(true);
    try {
      await apiRequest('/api/permission-requests', {
        method: 'POST',
        body: JSON.stringify({
          userId: user.id,
          userEmail: user.email,
          userName: user.displayName || user.firstName || user.email,
          requestedAction: action || 'Unknown action',
          requiredPermission: requiredPermission || 'Unknown permission',
          userMessage: requestMessage,
          requestedAt: new Date().toISOString(),
        }),
      });

      setRequestSent(true);
      toast({
        title: 'Request Sent',
        description: 'Your access request has been sent to the administrator.',
      });
      onRequestSent?.();

      // Close dialog after a short delay
      setTimeout(() => {
        setIsDialogOpen(false);
      }, 1500);
    } catch (error) {
      toast({
        title: 'Request Failed',
        description: 'Unable to send your request. Please try again or contact an administrator directly.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const RequestAccessButton = () => (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="mt-2">
          <Send className="w-4 h-4 mr-2" />
          Request Access
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request Permission Access</DialogTitle>
          <DialogDescription>
            Send a request to the administrator to grant you access to this feature.
          </DialogDescription>
        </DialogHeader>

        {requestSent ? (
          <div className="flex flex-col items-center py-6 text-center">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <p className="text-sm text-gray-600">
              Your request has been sent! An administrator will review it shortly.
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-4 py-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-sm text-amber-800">
                  <strong>Action requested:</strong> {action || 'Access to restricted feature'}
                </p>
                {requiredPermission && (
                  <p className="text-xs text-amber-600 mt-1">
                    Permission needed: {requiredPermission}
                  </p>
                )}
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">
                  Additional message (optional)
                </label>
                <Textarea
                  placeholder="Explain why you need this access..."
                  value={requestMessage}
                  onChange={(e) => setRequestMessage(e.target.value)}
                  className="mt-1"
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleRequestAccess}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Sending...' : 'Send Request'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );

  if (variant === 'inline') {
    return (
      <div className="flex items-center gap-2 text-amber-600">
        <ShieldAlert className="w-4 h-4 flex-shrink-0" />
        <span className="text-sm">{displayMessage}</span>
        {showRequestAccess && <RequestAccessButton />}
      </div>
    );
  }

  if (variant === 'banner') {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm text-amber-800 font-medium">Permission Required</p>
          <p className="text-sm text-amber-700 mt-1">{displayMessage}</p>
          {showRequestAccess && (
            <p className="text-xs text-amber-600 mt-2">
              If you believe you should have access to this feature, you can request it below.
            </p>
          )}
          {showRequestAccess && <RequestAccessButton />}
        </div>
      </div>
    );
  }

  // Default card variant
  return (
    <Card className="border-amber-200 bg-amber-50/50">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
            <ShieldAlert className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <CardTitle className="text-base text-amber-900">
              Permission Required
            </CardTitle>
            <CardDescription className="text-amber-700">
              {displayMessage}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      {showRequestAccess && (
        <CardContent className="pt-0">
          <p className="text-sm text-amber-600 mb-3">
            If you believe you should have access to this feature, you can request permission from an administrator.
          </p>
          <RequestAccessButton />
        </CardContent>
      )}
    </Card>
  );
}

/**
 * Wrapper component that conditionally shows content or permission denied message
 */
interface PermissionGateProps {
  /** Whether the user has the required permission */
  hasPermission: boolean;
  /** The action being gated */
  action?: string;
  /** The permission that's required */
  requiredPermission?: string;
  /** Content to show if user has permission */
  children: React.ReactNode;
  /** Fallback content (defaults to PermissionDenied component) */
  fallback?: React.ReactNode;
  /** Variant for the permission denied display */
  variant?: 'card' | 'inline' | 'banner';
  /** Whether to show request access in the fallback */
  showRequestAccess?: boolean;
}

export function PermissionGate({
  hasPermission,
  action,
  requiredPermission,
  children,
  fallback,
  variant = 'banner',
  showRequestAccess = true,
}: PermissionGateProps) {
  if (hasPermission) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  return (
    <PermissionDenied
      action={action}
      requiredPermission={requiredPermission}
      variant={variant}
      showRequestAccess={showRequestAccess}
    />
  );
}
