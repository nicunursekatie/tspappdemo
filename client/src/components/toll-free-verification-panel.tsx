import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { AlertCircle, CheckCircle, Clock, Phone } from 'lucide-react';

interface VerificationResult {
  success: boolean;
  message: string;
  verificationSid?: string;
  status?: string;
}

export function TollFreeVerificationPanel() {
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [verificationSid, setVerificationSid] = useState('');
  const [result, setResult] = useState<VerificationResult | null>(null);
  const { toast } = useToast();

  const submitVerification = async () => {
    setSubmitting(true);
    try {
      const response = await apiRequest('POST', '/api/users/toll-free-verification/submit');
      setResult(response);
      
      if (response.success) {
        toast({
          title: 'Verification Submitted',
          description: response.message,
        });
        setVerificationSid(response.verificationSid || '');
      } else {
        toast({
          title: 'Submission Failed',
          description: response.message,
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to submit verification';
      setResult({
        success: false,
        message: errorMessage,
      });
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const checkStatus = async () => {
    if (!verificationSid.trim()) {
      toast({
        title: 'Missing SID',
        description: 'Please enter a verification SID to check',
        variant: 'destructive',
      });
      return;
    }

    setChecking(true);
    try {
      const response = await apiRequest('GET', `/api/users/toll-free-verification/status?verificationSid=${verificationSid}`);
      setResult(response);
      
      if (response.success) {
        toast({
          title: 'Status Retrieved',
          description: response.message,
        });
      } else {
        toast({
          title: 'Check Failed',
          description: response.message,
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to check verification status';
      setResult({
        success: false,
        message: errorMessage,
      });
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setChecking(false);
    }
  };

  const getStatusIcon = (status?: string) => {
    switch (status?.toLowerCase()) {
      case 'approved':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'pending':
        return <Clock className="h-5 w-5 text-yellow-500" />;
      case 'rejected':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Phone className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status?.toLowerCase()) {
      case 'approved':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'pending':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'rejected':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Phone className="h-5 w-5" />
          Toll-Free SMS Verification
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Submit and check toll-free verification requests for SMS delivery compliance.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Submit Verification */}
        <div className="space-y-3">
          <h3 className="text-lg font-medium">Submit New Verification</h3>
          <p className="text-sm text-muted-foreground">
            Submit a toll-free verification request for your Twilio phone number (+18449441127).
            This is required for SMS delivery to US/Canadian numbers.
          </p>
          <Button 
            onClick={submitVerification} 
            disabled={submitting}
            className="w-full"
            data-testid="button-submit-verification"
          >
            {submitting ? 'Submitting...' : 'Submit Toll-Free Verification'}
          </Button>
        </div>

        {/* Check Status */}
        <div className="space-y-3 border-t pt-6">
          <h3 className="text-lg font-medium">Check Verification Status</h3>
          <div className="space-y-2">
            <Label htmlFor="verification-sid">Verification SID</Label>
            <Input
              id="verification-sid"
              value={verificationSid}
              onChange={(e) => setVerificationSid(e.target.value)}
              placeholder="VA..."
              className="font-mono text-sm"
              data-testid="input-verification-sid"
            />
          </div>
          <Button 
            onClick={checkStatus} 
            disabled={checking || !verificationSid.trim()}
            variant="outline"
            className="w-full"
            data-testid="button-check-status"
          >
            {checking ? 'Checking...' : 'Check Status'}
          </Button>
        </div>

        {/* Results */}
        {result && (
          <div className="space-y-3 border-t pt-6">
            <h3 className="text-lg font-medium">Result</h3>
            <div className={`p-4 rounded-lg border ${result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <div className="flex items-start gap-3">
                {result.success ? (
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
                )}
                <div className="flex-1 space-y-2">
                  <p className={result.success ? 'text-green-700' : 'text-red-700'}>
                    {result.message}
                  </p>
                  
                  {result.verificationSid && (
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Verification SID:</p>
                      <code className="text-xs bg-white px-2 py-1 rounded border">
                        {result.verificationSid}
                      </code>
                    </div>
                  )}
                  
                  {result.status && (
                    <div className="flex items-center gap-2">
                      {getStatusIcon(result.status)}
                      <span className={`px-2 py-1 text-xs rounded border ${getStatusColor(result.status)}`}>
                        {result.status.toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Information */}
        <div className="bg-brand-primary-lighter border border-brand-primary-border rounded-lg p-4">
          <h4 className="font-medium text-brand-primary-darker mb-2">Important Information</h4>
          <ul className="text-sm text-brand-primary-dark space-y-1">
            <li>• Toll-free verifications typically take 7-15 business days</li>
            <li>• Approved verifications enable SMS delivery to US/Canadian numbers</li>
            <li>• You can only have one verification per toll-free number</li>
            <li>• Status updates: PENDING → IN_REVIEW → APPROVED/REJECTED</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}