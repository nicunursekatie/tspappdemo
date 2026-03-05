import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Calendar,
  CheckCircle,
  Smartphone,
  Shield,
  Users,
  Bell,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { Link } from 'wouter';
import tspLogo from '@assets/LOGOS/TSP_transparent.png';

interface SMSOptInData {
  phoneNumber: string;
  consent: boolean;
  category: string;
}

export default function SMSEventsPage() {
  const { toast } = useToast();
  const { user, isLoading: authLoading } = useAuth();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [consent, setConsent] = useState(false);
  const [hasOptedIn, setHasOptedIn] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);

  const { data: userSMSStatus, isLoading: statusLoading } = useQuery({
    queryKey: ['/api/users/sms-status'],
    queryFn: () => apiRequest('GET', '/api/users/sms-status'),
    enabled: !!user?.id,
  });

  const optInMutation = useMutation({
    mutationFn: (data: SMSOptInData) =>
      apiRequest('POST', '/api/users/sms-opt-in', data),
    onSuccess: () => {
      setHasOptedIn(true);
      toast({
        title: 'Success!',
        description: "You've been signed up for event SMS notifications.",
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to sign up for event notifications.',
        variant: 'destructive',
      });
    },
  });

  const optOutMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/users/sms-opt-out', { category: 'events' }),
    onSuccess: () => {
      toast({
        title: 'Unsubscribed',
        description: "You've been unsubscribed from event SMS notifications.",
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to unsubscribe.',
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      setShowLoginPrompt(true);
      return;
    }

    if (!consent) {
      toast({
        title: 'Consent Required',
        description: 'Please check the consent box to continue.',
        variant: 'destructive',
      });
      return;
    }

    const cleanPhone = phoneNumber.replace(/\D/g, '');
    if (cleanPhone.length !== 10 && cleanPhone.length !== 11) {
      toast({
        title: 'Invalid Phone Number',
        description: 'Please enter a valid US phone number.',
        variant: 'destructive',
      });
      return;
    }

    optInMutation.mutate({
      phoneNumber: cleanPhone,
      consent: true,
      category: 'events',
    });
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '');
    if (value.length <= 11) {
      let formatted = value;
      if (value.length >= 4 && value.length <= 6) {
        formatted = `(${value.slice(0, 3)}) ${value.slice(3)}`;
      } else if (value.length >= 7) {
        formatted = `(${value.slice(0, 3)}) ${value.slice(3, 6)}-${value.slice(6)}`;
      }
      setPhoneNumber(formatted);
    }
  };

  const isAlreadyOptedIn = userSMSStatus?.eventsOptedIn || hasOptedIn;

  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-50 to-white py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center">
          <Link href="/">
            <img
              src={tspLogo}
              alt="The Sandwich Project"
              className="h-20 mx-auto mb-4 cursor-pointer"
            />
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Event SMS Notifications
          </h1>
          <p className="text-gray-600 max-w-md mx-auto">
            Stay connected with real-time updates about your events, volunteer assignments, and coordination messages.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-white border-teal-100">
            <CardContent className="pt-6 text-center">
              <Calendar className="h-8 w-8 text-teal-600 mx-auto mb-2" />
              <h3 className="font-medium text-gray-900">Event Reminders</h3>
              <p className="text-sm text-gray-600 mt-1">
                Get notified before your scheduled events
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white border-teal-100">
            <CardContent className="pt-6 text-center">
              <Users className="h-8 w-8 text-teal-600 mx-auto mb-2" />
              <h3 className="font-medium text-gray-900">Assignment Updates</h3>
              <p className="text-sm text-gray-600 mt-1">
                Know when you're assigned to events
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white border-teal-100">
            <CardContent className="pt-6 text-center">
              <Bell className="h-8 w-8 text-teal-600 mx-auto mb-2" />
              <h3 className="font-medium text-gray-900">Event Changes</h3>
              <p className="text-sm text-gray-600 mt-1">
                Get updates on time or location changes
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="flex items-center justify-center gap-4 text-sm text-gray-500">
          <Shield className="h-4 w-4 text-teal-600" />
          <p>
            Your number is never shared
          </p>
        </div>

        <Card className="max-w-xl mx-auto">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="bg-teal-600 p-3 rounded-full">
                <Calendar className="h-8 w-8 text-white" />
              </div>
            </div>
            <CardTitle className="text-2xl">Sign Up for Event Notifications</CardTitle>
          </CardHeader>

          <CardContent className="space-y-6">
            {authLoading || statusLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin h-8 w-8 border-b-2 border-teal-600 mx-auto"></div>
                <p className="mt-2 text-gray-600">Loading...</p>
              </div>
            ) : isAlreadyOptedIn && user ? (
              <div className="text-center space-y-4">
                <Alert className="bg-green-50 border-green-200">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                    You're signed up for event SMS notifications!
                    {userSMSStatus?.phoneNumber && (
                      <span className="block mt-1 font-medium">
                        Phone: {userSMSStatus.phoneNumber}
                      </span>
                    )}
                  </AlertDescription>
                </Alert>

                <Button
                  variant="outline"
                  onClick={() => optOutMutation.mutate()}
                  disabled={optOutMutation.isPending}
                  className="w-full"
                  data-testid="button-unsubscribe-events"
                >
                  {optOutMutation.isPending ? 'Unsubscribing...' : 'Unsubscribe from Event Notifications'}
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="bg-teal-50 p-4 rounded-lg border border-teal-100">
                  <h3 className="font-medium text-teal-800 mb-2 flex items-center gap-2">
                    <Smartphone className="h-4 w-4" />
                    What You'll Receive
                  </h3>
                  <ul className="text-sm text-teal-700 space-y-1">
                    <li>• Event reminders before your scheduled events</li>
                    <li>• Updates when you're assigned to organize or support events</li>
                    <li>• Notifications about event time or location changes</li>
                    <li>• Coordination messages for events you're involved in</li>
                  </ul>
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
                    className="text-lg"
                    data-testid="input-phone-events"
                  />
                  <p className="text-sm text-gray-500">
                    US numbers only. Standard message and data rates may apply.
                  </p>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg border-2 border-gray-300">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="consent"
                      checked={consent}
                      onCheckedChange={(checked) => setConsent(checked as boolean)}
                      className="mt-1"
                      data-testid="checkbox-consent-events"
                    />
                    <div>
                      <Label
                        htmlFor="consent"
                        className="text-sm font-medium leading-relaxed cursor-pointer"
                      >
                        I agree to receive SMS notifications from The Sandwich Project about event reminders, event updates, and assignment notifications related to events I am organizing or supporting. I understand:
                      </Label>
                      <ul className="text-xs text-gray-600 mt-2 space-y-1 ml-4">
                        <li>• Messages will be sent for event coordination purposes only</li>
                        <li>• I can unsubscribe at any time by replying <strong>STOP</strong></li>
                        <li>• Reply <strong>HELP</strong> for assistance</li>
                        <li>• Message frequency varies based on event activity</li>
                        <li>• Message and data rates may apply</li>
                        <li>• My phone number will not be shared with third parties</li>
                        <li>• Carriers are not liable for delayed or undelivered messages</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {showLoginPrompt && !user && (
                  <Alert className="bg-amber-50 border-amber-200">
                    <AlertDescription className="text-amber-800">
                      <p className="font-medium mb-2">Please sign in to complete your registration</p>
                      <p className="text-sm mb-3">
                        You need a Sandwich Project volunteer account to receive event notifications.
                      </p>
                      <Link href="/login">
                        <Button className="w-full" data-testid="button-login-events">
                          Sign In to Continue
                        </Button>
                      </Link>
                    </AlertDescription>
                  </Alert>
                )}

                <Button
                  type="submit"
                  className="w-full py-6 text-lg"
                  disabled={optInMutation.isPending || !consent || !phoneNumber.trim()}
                  data-testid="button-submit-events"
                >
                  {optInMutation.isPending ? 'Signing Up...' : 'Sign Up for Event Notifications'}
                </Button>

                <p className="text-center text-xs text-gray-500">
                  By signing up, you agree to our{' '}
                  <Link href="/privacy-policy" className="text-teal-600 hover:underline">
                    Privacy Policy
                  </Link>{' '}
                  and{' '}
                  <Link href="/terms-of-service" className="text-teal-600 hover:underline">
                    Terms of Service
                  </Link>
                </p>
              </form>
            )}

            <div className="border-t pt-4 mt-4">
              <p className="text-center text-sm text-gray-600 mb-2">
                <strong>Need Help?</strong>
              </p>
              <p className="text-center text-xs text-gray-500">
                Reply STOP to any message to unsubscribe. Reply HELP for assistance.
                Contact: <a href="mailto:katie@thesandwichproject.org" className="text-teal-600">katie@thesandwichproject.org</a>
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="text-center text-sm text-gray-500 space-y-2">
          <p>
            Looking for weekly collection reminders instead?{' '}
            <Link href="/sms-signup" className="text-teal-600 hover:underline">
              Sign up for Host Reminders
            </Link>
          </p>
          <p>
            Already have an account?{' '}
            <Link href="/login" className="text-teal-600 hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
