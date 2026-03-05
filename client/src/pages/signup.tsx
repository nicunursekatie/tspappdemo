import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Users, CheckCircle, Loader2, Phone } from 'lucide-react';
import { Link } from 'wouter';

const signupSchema = z.object({
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
  phone: z.string().min(10, 'Please enter a valid phone number'),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  optInTextAlerts: z.boolean().optional(),
  smsVerified: z.boolean().optional(),
  agreeToTerms: z
    .boolean()
    .refine(
      (val) => val === true,
      'You must agree to the terms and conditions'
    ),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type SignupForm = z.infer<typeof signupSchema>;

export default function SignupPage() {
  const [isSuccess, setIsSuccess] = useState(false);
  const [smsVerificationState, setSmsVerificationState] = useState<'idle' | 'sending' | 'pending' | 'verified'>('idle');
  const [verificationCode, setVerificationCode] = useState('');
  const { toast } = useToast();

  const form = useForm<SignupForm>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      confirmPassword: '',
      phone: '',
      address: '',
      city: '',
      state: '',
      zipCode: '',
      optInTextAlerts: false,
      smsVerified: false,
      agreeToTerms: false,
    },
  });

  const sendVerificationMutation = useMutation({
    mutationFn: async (phone: string) => {
      return await apiRequest('POST', '/api/auth/signup/send-sms-verification', { phone });
    },
    onSuccess: () => {
      setSmsVerificationState('pending');
      toast({
        title: 'Verification Code Sent',
        description: 'Please check your phone and enter the 6-digit code.',
      });
    },
    onError: (error: any) => {
      setSmsVerificationState('idle');
      toast({
        title: 'Failed to Send Code',
        description: error.message || 'Could not send verification code. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const verifyCodeMutation = useMutation({
    mutationFn: async ({ phone, code }: { phone: string; code: string }) => {
      return await apiRequest('POST', '/api/auth/signup/verify-sms-code', { phone, code });
    },
    onSuccess: () => {
      setSmsVerificationState('verified');
      form.setValue('smsVerified', true);
      toast({
        title: 'Phone Verified',
        description: 'Your phone number has been verified successfully!',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Verification Failed',
        description: error.message || 'Invalid code. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const signupMutation = useMutation({
    mutationFn: async (data: SignupForm) => {
      return await apiRequest('POST', '/api/auth/signup', data);
    },
    onSuccess: () => {
      toast({
        title: 'Registration Successful',
        description:
          'Welcome to The Sandwich Project! Please check your email for next steps.',
      });
      setIsSuccess(true);
    },
    onError: (error: any) => {
      toast({
        title: 'Registration Failed',
        description:
          error.message ||
          'There was an error creating your account. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const handleSendVerification = () => {
    const phone = form.getValues('phone');
    if (!phone || phone.length < 10) {
      toast({
        title: 'Phone Number Required',
        description: 'Please enter a valid phone number first.',
        variant: 'destructive',
      });
      return;
    }
    setSmsVerificationState('sending');
    sendVerificationMutation.mutate(phone);
  };

  const handleVerifyCode = () => {
    const phone = form.getValues('phone');
    if (!verificationCode || verificationCode.length < 6) {
      toast({
        title: 'Invalid Code',
        description: 'Please enter the 6-digit verification code.',
        variant: 'destructive',
      });
      return;
    }
    verifyCodeMutation.mutate({ phone, code: verificationCode });
  };

  const onSubmit = (data: SignupForm) => {
    if (data.optInTextAlerts && smsVerificationState !== 'verified') {
      toast({
        title: 'Phone Verification Required',
        description: 'Please verify your phone number to receive text alerts.',
        variant: 'destructive',
      });
      return;
    }
    signupMutation.mutate(data);
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-white/90 backdrop-blur-sm border-0 shadow-2xl">
          <CardContent className="p-8 text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-12 h-12 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">
              Welcome Aboard!
            </h2>
            <p className="text-gray-600 mb-8 leading-relaxed">
              Your registration has been submitted successfully. We'll review
              your application and contact you soon with next steps.
            </p>
            <div className="space-y-3">
              <Button
                asChild
                className="w-full bg-brand-primary hover:bg-brand-primary-dark active:bg-brand-primary-dark text-white font-semibold py-3 rounded-xl transition-all duration-300 transform hover:scale-[1.02] hover:shadow-lg active:scale-[0.98] focus:outline-none focus:ring-4 focus:ring-brand-primary/20"
              >
                <Link href="/">Return to Home</Link>
              </Button>
              <Button
                variant="outline"
                asChild
                className="w-full border-2 border-brand-primary text-brand-primary hover:bg-brand-primary hover:text-white py-3 rounded-xl transition-all duration-300 transform hover:scale-[1.02] hover:shadow-lg active:scale-[0.98] focus:outline-none focus:ring-4 focus:ring-brand-primary/20"
              >
                <Link href="/login">Sign In</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-slate-50 to-green-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl bg-white/90 backdrop-blur-sm border-0 shadow-2xl">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold text-gray-900">
            Join The Sandwich Project
          </CardTitle>
          <CardDescription className="text-lg">
            Help us fight hunger in our community
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center space-x-2 mb-4">
                  <Users className="w-5 h-5 text-brand-primary" />
                  <h3 className="text-xl font-semibold">
                    Personal Information
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Name</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Enter your first name"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last Name</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Enter your last name"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Address</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="your.email@example.com"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="Create a password"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirm Password</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="Confirm your password"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number</FormLabel>
                      <FormControl>
                        <Input placeholder="(555) 123-4567" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="rounded-md border p-4 bg-blue-50 space-y-3">
                  <FormField
                    control={form.control}
                    name="optInTextAlerts"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={(checked) => {
                              field.onChange(checked);
                              if (!checked) {
                                setSmsVerificationState('idle');
                                setVerificationCode('');
                                form.setValue('smsVerified', false);
                              }
                            }}
                            disabled={smsVerificationState === 'verified'}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>
                            Yes, send me text message updates from The Sandwich Project
                          </FormLabel>
                        </div>
                      </FormItem>
                    )}
                  />
                  
                  {form.watch('optInTextAlerts') && smsVerificationState === 'idle' && (
                    <div className="pl-7">
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleSendVerification}
                        disabled={sendVerificationMutation.isPending}
                        className="bg-brand-primary hover:bg-brand-primary-dark"
                      >
                        {sendVerificationMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Sending...
                          </>
                        ) : (
                          <>
                            <Phone className="mr-2 h-4 w-4" />
                            Send Verification Code
                          </>
                        )}
                      </Button>
                      <p className="text-xs text-muted-foreground mt-1">
                        We'll send a code to verify your phone number
                      </p>
                    </div>
                  )}

                  {form.watch('optInTextAlerts') && smsVerificationState === 'pending' && (
                    <div className="pl-7 space-y-2">
                      <div className="flex gap-2">
                        <Input
                          type="text"
                          placeholder="Enter 6-digit code"
                          value={verificationCode}
                          onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          className="w-40"
                          maxLength={6}
                        />
                        <Button
                          type="button"
                          size="sm"
                          onClick={handleVerifyCode}
                          disabled={verifyCodeMutation.isPending || verificationCode.length < 6}
                          className="bg-brand-primary hover:bg-brand-primary-dark"
                        >
                          {verifyCodeMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            'Verify'
                          )}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Check your phone for a 6-digit code
                      </p>
                      <button
                        type="button"
                        onClick={handleSendVerification}
                        className="text-xs text-brand-primary hover:underline"
                        disabled={sendVerificationMutation.isPending}
                      >
                        Resend code
                      </button>
                    </div>
                  )}

                  {form.watch('optInTextAlerts') && smsVerificationState === 'verified' && (
                    <div className="pl-7 flex items-center gap-2 text-green-600">
                      <CheckCircle className="h-4 w-4" />
                      <span className="text-sm font-medium">Phone number verified!</span>
                    </div>
                  )}
                </div>

                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                      <FormControl>
                        <Input placeholder="123 Main Street" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                        <FormControl>
                          <Input placeholder="Your city" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="state"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>State <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                        <FormControl>
                          <Input placeholder="State" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="zipCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>ZIP Code <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                        <FormControl>
                          <Input placeholder="12345" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="bg-gray-50 p-4 rounded-lg mt-6">
                  <h4 className="font-semibold mb-2">
                    The Sandwich Project Terms of Service
                  </h4>
                  <div className="text-sm text-gray-600 space-y-2 max-h-40 overflow-y-auto">
                    <p>By joining The Sandwich Project, you agree to:</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Volunteer in a safe and respectful manner</li>
                      <li>Follow all food safety and handling guidelines</li>
                      <li>Represent the organization professionally</li>
                      <li>Respect the privacy of all community members</li>
                      <li>Report any safety concerns immediately</li>
                    </ul>
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="agreeToTerms"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>
                          I agree to the terms and conditions of The Sandwich
                          Project
                        </FormLabel>
                        <FormMessage />
                      </div>
                    </FormItem>
                  )}
                />

                <div className="bg-brand-primary-lighter p-4 rounded-lg">
                  <p className="text-sm text-brand-primary-dark">
                    <strong>Next Steps:</strong> After submitting your
                    application, our volunteer coordinator will review your
                    information and contact you within 2-3 business days with
                    next steps.
                  </p>
                </div>
              </div>

              <div className="flex justify-end pt-6">
                <Button type="submit" disabled={signupMutation.isPending}>
                  {signupMutation.isPending
                    ? 'Submitting...'
                    : 'Complete Registration'}
                </Button>
              </div>
            </form>
          </Form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Already have an account?{' '}
              <Link href="/login" className="text-brand-primary hover:underline">
                Sign in here
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
