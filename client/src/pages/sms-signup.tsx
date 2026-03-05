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
  Smartphone,
  Shield,
  Clock,
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
  category: 'hosts' | 'events';
}

export default function SMSSignupPage() {
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

  const optOutMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/users/sms-opt-out', { category: 'hosts' }),
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
        description: error.message || 'Failed to unsubscribe.',
        variant: 'destructive',
      });
    },
  });

  const formatPhoneNumber = (value: string) => {
    const digits = value.replace(/\D/g, '');
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
    setPhoneNumber(formatPhoneNumber(e.target.value));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      setShowLoginPrompt(true);
      return;
    }

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
      category: 'hosts',
    });
  };

  const isAlreadyOptedIn = userSMSStatus?.hasOptedIn || hasOptedIn;

  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-50 to-white">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <img 
            src={tspLogo} 
            alt="The Sandwich Project" 
            className="h-20 mx-auto mb-4"
          />
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            SMS Reminder Sign-up
          </h1>
          <p className="text-gray-600 text-lg">
            Get text message reminders for weekly sandwich collection submissions
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card className="text-center p-4">
            <Bell className="h-8 w-8 text-teal-600 mx-auto mb-2" />
            <h3 className="font-semibold">Weekly Reminders</h3>
            <p className="text-sm text-gray-600">
              Get notified when collection data is missing
            </p>
          </Card>
          <Card className="text-center p-4">
            <Clock className="h-8 w-8 text-teal-600 mx-auto mb-2" />
            <h3 className="font-semibold">Quick Links</h3>
            <p className="text-sm text-gray-600">
              Direct links to submit your counts fast
            </p>
          </Card>
          <Card className="text-center p-4">
            <Shield className="h-8 w-8 text-teal-600 mx-auto mb-2" />
            <h3 className="font-semibold">Privacy First</h3>
            <p className="text-sm text-gray-600">
              Your number is never shared
            </p>
          </Card>
        </div>

        <Card className="max-w-xl mx-auto">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="bg-teal-600 p-3 rounded-full">
                <MessageSquare className="h-8 w-8 text-white" />
              </div>
            </div>
            <CardTitle className="text-2xl">Sign Up for SMS Reminders</CardTitle>
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
                    You're signed up for SMS reminders!
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
                  data-testid="button-unsubscribe"
                >
                  {optOutMutation.isPending ? 'Unsubscribing...' : 'Unsubscribe from SMS Reminders'}
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="bg-teal-50 p-4 rounded-lg border border-teal-100">
                  <h3 className="font-medium text-teal-800 mb-2 flex items-center gap-2">
                    <Smartphone className="h-4 w-4" />
                    How SMS Reminders Work
                  </h3>
                  <ul className="text-sm text-teal-700 space-y-1">
                    <li>• Get text reminders when weekly sandwich counts are missing</li>
                    <li>• Includes direct links to the app for easy submission</li>
                    <li>• Only used for sandwich collection reminders</li>
                    <li>• You can unsubscribe at any time by replying STOP</li>
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
                    data-testid="input-phone"
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
                      data-testid="checkbox-consent"
                    />
                    <div>
                      <Label
                        htmlFor="consent"
                        className="text-sm font-medium leading-relaxed cursor-pointer"
                      >
                        I consent to receive SMS text message reminders from The Sandwich Project about weekly collection submissions. I understand:
                      </Label>
                      <ul className="text-xs text-gray-600 mt-2 space-y-1 ml-4">
                        <li>• Messages will only be sent for sandwich collection reminders</li>
                        <li>• I can unsubscribe at any time by replying <strong>STOP</strong></li>
                        <li>• Reply <strong>HELP</strong> for assistance</li>
                        <li>• Message frequency varies (up to 4 msgs/month)</li>
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
                        You need a Sandwich Project volunteer account to receive SMS reminders.
                      </p>
                      <Link href="/login">
                        <Button className="w-full" data-testid="button-login">
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
                  data-testid="button-submit"
                >
                  {optInMutation.isPending ? 'Signing Up...' : 'Sign Up for SMS Reminders'}
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

        <div className="text-center mt-8 text-sm text-gray-500">
          <p>The Sandwich Project is a 501(c)(3) nonprofit organization.</p>
          <p className="mt-1">
            <Link href="/sms-verification-docs" className="text-teal-600 hover:underline">
              View SMS Compliance Documentation
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
