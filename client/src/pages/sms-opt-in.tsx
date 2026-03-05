import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import {
  MessageSquare,
  CheckCircle,
  AlertTriangle,
  Smartphone,
  ArrowLeft,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { Link } from 'wouter';
import { ResponsivePageLayout } from '@/components/layout/responsive-page-layout';

interface SMSOptInData {
  phoneNumber: string;
  consent: boolean;
}

export default function SMSOptInPage() {
  const { toast } = useToast();
  const { user, isLoading: authLoading } = useAuth();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [consent, setConsent] = useState(false);
  const [hasOptedIn, setHasOptedIn] = useState(false);

  // Check if user already has SMS consent
  const { data: userSMSStatus, isLoading: statusLoading } = useQuery({
    queryKey: ['/api/users/sms-status'],
    queryFn: () => apiRequest('GET', '/api/users/sms-status'),
    enabled: !!user?.id,
  });

  // SMS opt-in mutation
  const optInMutation = useMutation({
    mutationFn: (data: SMSOptInData) =>
      apiRequest('POST', '/api/users/sms-opt-in', data),
    onSuccess: () => {
      setHasOptedIn(true);
      toast({
        title: 'Success!',
        description: "You've been signed up for SMS reminders.",
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to sign up for SMS reminders.',
        variant: 'destructive',
      });
    },
  });

  // SMS opt-out mutation
  const optOutMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/users/sms-opt-out'),
    onSuccess: () => {
      toast({
        title: 'Unsubscribed',
        description: "You've been removed from SMS reminders.",
      });
      setHasOptedIn(false);
      setPhoneNumber('');
      setConsent(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description:
          error.message || 'Failed to unsubscribe from SMS reminders.',
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!phoneNumber.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter your phone number.',
        variant: 'destructive',
      });
      return;
    }

    if (!consent) {
      toast({
        title: 'Error',
        description: 'Please check the consent box to proceed.',
        variant: 'destructive',
      });
      return;
    }

    optInMutation.mutate({
      phoneNumber: phoneNumber.trim(),
      consent: true,
    });
  };

  const formatPhoneNumber = (value: string) => {
    // Remove all non-digits
    const digits = value.replace(/\D/g, '');

    // Format as (XXX) XXX-XXXX for US numbers
    if (digits.length >= 10) {
      const match = digits.match(/^(\d{3})(\d{3})(\d{4})/);
      if (match) {
        return `(${match[1]}) ${match[2]}-${match[3]}`;
      }
    } else if (digits.length >= 6) {
      const match = digits.match(/^(\d{3})(\d{3})/);
      if (match) {
        return `(${match[1]}) ${match[2]}`;
      }
    } else if (digits.length >= 3) {
      const match = digits.match(/^(\d{3})/);
      if (match) {
        return `(${match[1]})`;
      }
    }

    return digits;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setPhoneNumber(formatted);
  };

  if (authLoading || statusLoading) {
    return (
      <ResponsivePageLayout title="SMS Sign-up" showBack showNav={false}>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="text-center">
            <div className="animate-spin h-8 w-8 border-b-2 border-brand-primary mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading...</p>
          </div>
        </div>
      </ResponsivePageLayout>
    );
  }

  if (!user) {
    return (
      <ResponsivePageLayout title="Sign In Required" showBack showNav={false}>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <AlertTriangle className="h-10 w-10 sm:h-12 sm:w-12 text-orange-500 mx-auto mb-4" />
              <CardTitle className="text-xl sm:text-2xl">Sign In Required</CardTitle>
            </CardHeader>
            <CardContent className="text-center px-4 sm:px-6">
              <p className="text-gray-600 mb-4 text-sm sm:text-base">
                You need to be signed in to sign up for SMS reminders.
              </p>
              <Link href="/login">
                <Button className="w-full h-11">Sign In</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </ResponsivePageLayout>
    );
  }

  // Check if user already opted in
  const isAlreadyOptedIn = userSMSStatus?.hasOptedIn || hasOptedIn;

  return (
    <ResponsivePageLayout title="SMS Notifications" showBack showNav>
      <div className="min-h-screen bg-gray-50 py-4 sm:py-8">
        <div className="max-w-2xl mx-auto px-4">
          <div className="mb-4 sm:mb-6 hidden sm:block">
            <Link href="/dashboard">
              <Button variant="outline" className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </Button>
            </Link>
          </div>

          <Card>
            <CardHeader className="text-center px-4 sm:px-6">
              <div className="flex justify-center mb-4">
                <div className="bg-brand-primary p-2.5 sm:p-3 rounded-full">
                  <MessageSquare className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
                </div>
              </div>
              <CardTitle className="text-xl sm:text-2xl">SMS Notifications Sign-up</CardTitle>
              <p className="text-gray-600 mt-2 text-sm sm:text-base">
                Get text message notifications for events, tasks, mentions, and collection reminders
              </p>
            </CardHeader>

            <CardContent className="space-y-4 sm:space-y-6 px-4 sm:px-6">
              {isAlreadyOptedIn ? (
                // Already opted in - show status and opt-out option
                <div className="text-center space-y-4">
                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertDescription className="text-sm">
                      You're signed up for SMS notifications!
                      {userSMSStatus?.phoneNumber && (
                        <span className="block mt-1 font-medium">
                          Phone: {userSMSStatus.phoneNumber}
                        </span>
                      )}
                    </AlertDescription>
                  </Alert>

                  <div className="bg-gray-50 p-3 sm:p-4 rounded-lg text-xs sm:text-sm text-gray-600 text-left">
                    <h4 className="font-medium text-gray-900 mb-2 sm:mb-3">
                      Available SMS Alert Types:
                    </h4>
                    <ul className="space-y-1.5 sm:space-y-2">
                      <li className="flex items-start gap-2">
                        <span className="text-green-600 font-bold">✓</span>
                        <span><strong>Event Reminders</strong> - Get reminded before events you're scheduled to volunteer, drive, or speak at</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-green-600 font-bold">✓</span>
                        <span><strong>TSP Contact Assignments</strong> - Notification when you're assigned as the TSP contact for an event</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-green-600 font-bold">✓</span>
                        <span><strong>Chat Mentions</strong> - Get notified when someone @mentions you in a chat room</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-green-600 font-bold">✓</span>
                        <span><strong>Task Assignments</strong> - Notifications when you're assigned to tasks on the team board</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-green-600 font-bold">✓</span>
                        <span><strong>Collection Reminders</strong> - Reminders when weekly sandwich counts are missing</span>
                      </li>
                    </ul>
                    <p className="mt-2 sm:mt-3 text-xs text-gray-500 italic">
                      You can configure your SMS preferences in Alert Preferences.
                    </p>
                  </div>

                  <Button
                    variant="outline"
                    onClick={() => optOutMutation.mutate()}
                    disabled={optOutMutation.isPending}
                    className="w-full h-11"
                    data-testid="button-sms-opt-out"
                  >
                    {optOutMutation.isPending
                      ? 'Unsubscribing...'
                      : 'Unsubscribe from SMS Notifications'}
                  </Button>
                </div>
              ) : (
                // Not opted in - show sign-up form
                <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
                  <div className="bg-brand-primary/10 p-3 sm:p-4 rounded-lg">
                    <h3 className="font-medium text-brand-primary-dark mb-2 flex items-center gap-2 text-sm sm:text-base">
                      <Smartphone className="h-4 w-4" />
                      Available SMS Alert Types
                    </h3>
                    <ul className="text-xs sm:text-sm text-brand-primary space-y-1">
                      <li className="flex items-start gap-2">
                        <span className="text-green-600 font-bold">✓</span>
                        <span><strong>Event Reminders</strong> - Before events you're scheduled for</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-green-600 font-bold">✓</span>
                        <span><strong>TSP Contact Assignments</strong> - When assigned as event contact</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-green-600 font-bold">✓</span>
                        <span><strong>Chat Mentions</strong> - When someone @mentions you</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-green-600 font-bold">✓</span>
                        <span><strong>Task Assignments</strong> - Team board assignments</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-green-600 font-bold">✓</span>
                        <span><strong>Collection Reminders</strong> - Missing sandwich counts</span>
                      </li>
                    </ul>
                    <p className="mt-2 sm:mt-3 text-xs opacity-75">
                      You can configure your SMS preferences after signing up.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number *</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="(555) 123-4567"
                      value={phoneNumber}
                      onChange={handlePhoneChange}
                      required
                      className="text-base sm:text-lg h-11"
                    />
                    <p className="text-xs sm:text-sm text-gray-500">
                      We'll format this automatically. US numbers only.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id="consent"
                        checked={consent}
                        onCheckedChange={(checked) =>
                          setConsent(checked as boolean)
                        }
                        className="mt-0.5 h-5 w-5"
                        data-testid="checkbox-sms-consent"
                      />
                      <div>
                        <Label
                          htmlFor="consent"
                          className="text-sm leading-relaxed cursor-pointer"
                        >
                          I consent to receive SMS text message notifications from The
                          Sandwich Project. I understand:
                        </Label>
                        <ul className="text-xs text-gray-600 mt-2 space-y-1 ml-2 sm:ml-4">
                          <li>
                            • Messages may include event reminders, task assignments, chat mentions, and collection reminders
                          </li>
                          <li>• I can configure which alert types I receive via SMS in my preferences</li>
                          <li>• I can unsubscribe at any time</li>
                          <li>• Standard message and data rates may apply</li>
                          <li>
                            • My phone number will not be shared with third parties
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-brand-primary hover:bg-brand-primary-dark h-11"
                    disabled={
                      optInMutation.isPending || !consent || !phoneNumber.trim()
                    }
                    data-testid="button-sms-opt-in"
                  >
                    {optInMutation.isPending
                      ? 'Signing Up...'
                      : 'Sign Up for SMS Notifications'}
                  </Button>
                </form>
              )}

              <div className="text-center">
                <p className="text-xs sm:text-sm text-gray-500">
                  Questions? Contact us by replying to the announcement email.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </ResponsivePageLayout>
  );
}
