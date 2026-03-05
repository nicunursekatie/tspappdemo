import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import {
  AlertCircle,
  CheckCircle,
  MessageSquare,
  RefreshCw,
  Send,
  Wifi,
  WifiOff,
  Phone
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface SMSConfig {
  isConfigured: boolean;
  missingItems: string[];
  twilioInitialized: boolean;
  twilioStatus: 'not_configured' | 'connected' | 'error';
  twilioError: string | null;
  twilioPhone: string | null;
  environment: {
    hasAccountSid: boolean;
    hasAuthToken: boolean;
    hasPhoneNumber: boolean;
  };
}

interface TestResult {
  success: boolean;
  message: string;
  messageSid?: string;
}

export function SMSTestPanel() {
  const [config, setConfig] = useState<SMSConfig | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [sending, setSending] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [lastTestTime, setLastTestTime] = useState<string | null>(null);
  const { toast } = useToast();

  // Load SMS configuration status
  const loadConfig = async () => {
    setLoadingConfig(true);
    try {
      const response = await apiRequest('GET', '/api/sms-testing/sms/config');
      setConfig(response);
    } catch (error: any) {
      console.error('Failed to load SMS config:', error);
      setConfig(null);
      toast({
        title: 'Error',
        description: 'Failed to load SMS configuration status',
        variant: 'destructive',
      });
    } finally {
      setLoadingConfig(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  // Format phone number as user types
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 0 && !value.startsWith('1')) {
      value = '1' + value;
    }
    if (value.length > 11) {
      value = value.slice(0, 11);
    }
    // Format as +1 (XXX) XXX-XXXX
    if (value.length >= 1) {
      let formatted = '+' + value.slice(0, 1);
      if (value.length >= 2) {
        formatted += ' (' + value.slice(1, 4);
      }
      if (value.length >= 5) {
        formatted += ') ' + value.slice(4, 7);
      }
      if (value.length >= 8) {
        formatted += '-' + value.slice(7, 11);
      }
      setPhoneNumber(formatted);
    } else {
      setPhoneNumber('');
    }
  };

  // Send test SMS
  const sendTestSMS = async () => {
    // Extract just the digits
    const digits = phoneNumber.replace(/\D/g, '');
    if (digits.length !== 11) {
      toast({
        title: 'Invalid Phone Number',
        description: 'Please enter a valid 10-digit US phone number',
        variant: 'destructive',
      });
      return;
    }

    setSending(true);
    setTestResult(null);

    try {
      const response = await apiRequest('POST', '/api/sms-testing/sms/test', {
        phoneNumber: '+' + digits,
      });

      setTestResult(response);
      setLastTestTime(new Date().toLocaleString());

      if (response.success) {
        toast({
          title: 'Test SMS Sent!',
          description: 'Check your phone for the test message',
        });
      } else {
        toast({
          title: 'SMS Failed',
          description: response.message,
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to send test SMS';
      setTestResult({
        success: false,
        message: errorMessage,
      });
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  const getStatusBadge = () => {
    if (!config) return null;

    if (config.twilioStatus === 'connected') {
      return (
        <Badge className="bg-green-100 text-green-800 border-green-200">
          <Wifi className="w-3 h-3 mr-1" />
          Connected
        </Badge>
      );
    } else if (config.twilioStatus === 'error') {
      return (
        <Badge variant="destructive">
          <WifiOff className="w-3 h-3 mr-1" />
          Error
        </Badge>
      );
    } else {
      return (
        <Badge variant="secondary">
          <WifiOff className="w-3 h-3 mr-1" />
          Not Configured
        </Badge>
      );
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            SMS Test Panel
          </CardTitle>
          {getStatusBadge()}
        </div>
        <p className="text-sm text-muted-foreground">
          Send a test SMS to verify the messaging system is working correctly.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Configuration Status */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">Twilio Configuration</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={loadConfig}
              disabled={loadingConfig}
            >
              <RefreshCw className={`h-4 w-4 ${loadingConfig ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          {loadingConfig ? (
            <div className="text-sm text-muted-foreground">Loading configuration...</div>
          ) : config ? (
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2">
                {config.environment.hasAccountSid ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-red-500" />
                )}
                <span>Account SID</span>
              </div>
              <div className="flex items-center gap-2">
                {config.environment.hasAuthToken ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-red-500" />
                )}
                <span>Auth Token</span>
              </div>
              <div className="flex items-center gap-2">
                {config.environment.hasPhoneNumber ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-red-500" />
                )}
                <span>Phone Number</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="font-mono">{config.twilioPhone || 'Not set'}</span>
              </div>
            </div>
          ) : (
            <div className="text-sm text-red-600">Failed to load configuration</div>
          )}

          {config?.twilioError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <strong>Error:</strong> {config.twilioError}
            </div>
          )}
        </div>

        {/* Send Test SMS */}
        <div className="space-y-3 border-t pt-6">
          <h3 className="text-lg font-medium">Send Test Message</h3>
          <p className="text-sm text-muted-foreground">
            Enter your phone number to receive a test SMS message.
          </p>

          <div className="space-y-2">
            <Label htmlFor="test-phone">Your Phone Number</Label>
            <Input
              id="test-phone"
              type="tel"
              value={phoneNumber}
              onChange={handlePhoneChange}
              placeholder="+1 (555) 123-4567"
              className="font-mono"
              data-testid="input-test-phone"
            />
            <p className="text-xs text-muted-foreground">
              US phone numbers only. Format: +1 (XXX) XXX-XXXX
            </p>
          </div>

          <Button
            onClick={sendTestSMS}
            disabled={sending || !config?.isConfigured || phoneNumber.replace(/\D/g, '').length !== 11}
            className="w-full"
            data-testid="button-send-test-sms"
          >
            {sending ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send Test SMS
              </>
            )}
          </Button>
        </div>

        {/* Test Result */}
        {testResult && (
          <div className="space-y-3 border-t pt-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">Test Result</h3>
              {lastTestTime && (
                <span className="text-xs text-muted-foreground">
                  Tested: {lastTestTime}
                </span>
              )}
            </div>
            <div className={`p-4 rounded-lg border ${testResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <div className="flex items-start gap-3">
                {testResult.success ? (
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
                )}
                <div className="flex-1 space-y-2">
                  <p className={testResult.success ? 'text-green-700' : 'text-red-700'}>
                    {testResult.message}
                  </p>

                  {testResult.messageSid && (
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-green-800">Message SID:</p>
                      <code className="text-xs bg-white px-2 py-1 rounded border block overflow-x-auto">
                        {testResult.messageSid}
                      </code>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tips */}
        <div className="bg-brand-primary-lighter border border-brand-primary-border rounded-lg p-4">
          <h4 className="font-medium text-brand-primary-darker mb-2">Testing Tips</h4>
          <ul className="text-sm text-brand-primary-dark space-y-1">
            <li>• Run this test periodically to ensure SMS delivery is working</li>
            <li>• If tests fail, check your Twilio account balance and status</li>
            <li>• Messages may take a few seconds to arrive</li>
            <li>• Keep the Message SID for troubleshooting if needed</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
