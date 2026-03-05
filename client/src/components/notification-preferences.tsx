import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Bell, Clock, Mail, Smartphone, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';

const notificationPreferencesSchema = z.object({
  primaryReminderEnabled: z.boolean(),
  primaryReminderHours: z.number().min(1).max(72),
  primaryReminderType: z.enum(['email', 'sms', 'both']),
  secondaryReminderEnabled: z.boolean(),
  secondaryReminderHours: z.number().min(1).max(72),
  secondaryReminderType: z.enum(['email', 'sms', 'both']),
});

type NotificationPreferencesFormData = z.infer<typeof notificationPreferencesSchema>;

export default function NotificationPreferences() {
  const { toast } = useToast();

  // Check if user has SMS opt-in
  const { data: userSMSStatus } = useQuery({
    queryKey: ['/api/users/sms-status'],
    queryFn: () => apiRequest('GET', '/api/users/sms-status'),
  });

  const hasSMSOptIn = userSMSStatus?.hasConfirmedOptIn || false;

  // Load current preferences
  const { data: preferences, isLoading } = useQuery({
    queryKey: ['/api/me/notification-preferences'],
    queryFn: () => apiRequest('GET', '/api/me/notification-preferences'),
  });

  const form = useForm<NotificationPreferencesFormData>({
    resolver: zodResolver(notificationPreferencesSchema),
    defaultValues: {
      primaryReminderEnabled: true,
      primaryReminderHours: 24,
      primaryReminderType: 'email',
      secondaryReminderEnabled: false,
      secondaryReminderHours: 1,
      secondaryReminderType: 'email',
    },
    values: preferences as NotificationPreferencesFormData | undefined,
  });

  // Save preferences mutation
  const saveMutation = useMutation({
    mutationFn: async (data: NotificationPreferencesFormData) => {
      return await apiRequest('PUT', '/api/me/notification-preferences', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/me/notification-preferences'] });
      toast({
        title: 'Preferences saved',
        description: 'Your notification preferences have been updated successfully.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save preferences',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: NotificationPreferencesFormData) => {
    saveMutation.mutate(data);
  };

  // Watch form values to show SMS warning
  const primaryType = form.watch('primaryReminderType');
  const secondaryType = form.watch('secondaryReminderType');
  const secondaryEnabled = form.watch('secondaryReminderEnabled');
  
  const showSMSWarning = !hasSMSOptIn && (
    primaryType === 'sms' || 
    primaryType === 'both' || 
    (secondaryEnabled && (secondaryType === 'sms' || secondaryType === 'both'))
  );

  // Generate hour options (1-72)
  const hourOptions = Array.from({ length: 72 }, (_, i) => i + 1);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">
            Loading notification preferences...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="w-5 h-5" />
          Event Reminder Preferences
        </CardTitle>
        <CardDescription>
          Customize when and how you receive reminders for events you're assigned to as a volunteer or TSP contact
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Default Settings Banner */}
        <Alert className="mb-6 border-brand-primary-light bg-brand-primary-lighter dark:bg-blue-950/30">
          <CheckCircle2 className="h-4 w-4 text-brand-primary" />
          <AlertDescription>
            <strong className="text-brand-primary-darker dark:text-brand-primary-light">Already configured!</strong>
            <p className="mt-1">
              {hasSMSOptIn 
                ? "When you signed up for SMS, we automatically set you to receive reminders 72 hours before events via text message. You can customize these settings below if you'd like different timing or notification methods."
                : "Your account is already set to receive email reminders 24 hours before events. Sign up for SMS notifications above to get text reminders, or customize your email preferences below."}
            </p>
          </AlertDescription>
        </Alert>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            {/* SMS Warning */}
            {showSMSWarning && (
              <Alert variant="warning">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  You've selected SMS notifications but haven't opted into SMS yet. 
                  Please enable SMS notifications in the SMS Notifications section above to receive text reminders.
                </AlertDescription>
              </Alert>
            )}

            {/* Primary Reminder Section */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Primary Reminder</h3>
                  <p className="text-sm text-muted-foreground">
                    Main notification sent before your scheduled events
                  </p>
                </div>
                <FormField
                  control={form.control}
                  name="primaryReminderEnabled"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-primary-reminder"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="primaryReminderHours"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Hours Before Event</FormLabel>
                      <Select
                        value={field.value.toString()}
                        onValueChange={(value) => field.onChange(parseInt(value))}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-primary-hours">
                            <SelectValue placeholder="Select hours" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="max-h-60">
                          {hourOptions.map((hours) => (
                            <SelectItem key={hours} value={hours.toString()}>
                              {hours} {hours === 1 ? 'hour' : 'hours'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        <Clock className="w-3 h-3 inline mr-1" />
                        When to send the first reminder
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="primaryReminderType"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormLabel>Notification Method</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          value={field.value}
                          className="flex flex-col space-y-1"
                        >
                          <FormItem className="flex items-center space-x-3 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="email" data-testid="radio-primary-email" />
                            </FormControl>
                            <FormLabel className="font-normal flex items-center gap-2">
                              <Mail className="w-4 h-4" />
                              Email Only
                            </FormLabel>
                          </FormItem>
                          <FormItem className="flex items-center space-x-3 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="sms" data-testid="radio-primary-sms" />
                            </FormControl>
                            <FormLabel className="font-normal flex items-center gap-2">
                              <Smartphone className="w-4 h-4" />
                              SMS Only
                            </FormLabel>
                          </FormItem>
                          <FormItem className="flex items-center space-x-3 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="both" data-testid="radio-primary-both" />
                            </FormControl>
                            <FormLabel className="font-normal flex items-center gap-2">
                              <Mail className="w-4 h-4" />
                              <Smartphone className="w-4 h-4" />
                              Both Email & SMS
                            </FormLabel>
                          </FormItem>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <Separator />

            {/* Secondary Reminder Section */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Secondary Reminder (Optional)</h3>
                  <p className="text-sm text-muted-foreground">
                    Additional notification for important events
                  </p>
                </div>
                <FormField
                  control={form.control}
                  name="secondaryReminderEnabled"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-secondary-reminder"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              {secondaryEnabled && (
                <div className="grid gap-6 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="secondaryReminderHours"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Hours Before Event</FormLabel>
                        <Select
                          value={field.value.toString()}
                          onValueChange={(value) => field.onChange(parseInt(value))}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-secondary-hours">
                              <SelectValue placeholder="Select hours" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="max-h-60">
                            {hourOptions.map((hours) => (
                              <SelectItem key={hours} value={hours.toString()}>
                                {hours} {hours === 1 ? 'hour' : 'hours'}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          <Clock className="w-3 h-3 inline mr-1" />
                          When to send the second reminder
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="secondaryReminderType"
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <FormLabel>Notification Method</FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            value={field.value}
                            className="flex flex-col space-y-1"
                          >
                            <FormItem className="flex items-center space-x-3 space-y-0">
                              <FormControl>
                                <RadioGroupItem value="email" data-testid="radio-secondary-email" />
                              </FormControl>
                              <FormLabel className="font-normal flex items-center gap-2">
                                <Mail className="w-4 h-4" />
                                Email Only
                              </FormLabel>
                            </FormItem>
                            <FormItem className="flex items-center space-x-3 space-y-0">
                              <FormControl>
                                <RadioGroupItem value="sms" data-testid="radio-secondary-sms" />
                              </FormControl>
                              <FormLabel className="font-normal flex items-center gap-2">
                                <Smartphone className="w-4 h-4" />
                                SMS Only
                              </FormLabel>
                            </FormItem>
                            <FormItem className="flex items-center space-x-3 space-y-0">
                              <FormControl>
                                <RadioGroupItem value="both" data-testid="radio-secondary-both" />
                              </FormControl>
                              <FormLabel className="font-normal flex items-center gap-2">
                                <Mail className="w-4 h-4" />
                                <Smartphone className="w-4 h-4" />
                                Both Email & SMS
                              </FormLabel>
                            </FormItem>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}
            </div>

            {/* Info Alert */}
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                These preferences apply to all events where you're assigned as a volunteer, driver, speaker, or TSP contact.
                Reminders are sent automatically based on the scheduled event date.
              </AlertDescription>
            </Alert>

            {/* Save Button */}
            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={saveMutation.isPending}
                className="btn-tsp-primary"
                data-testid="button-save-preferences"
              >
                {saveMutation.isPending ? 'Saving...' : 'Save Preferences'}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
