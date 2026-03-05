import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Bell,
  Mail,
  Smartphone,
  MessageSquare,
  CheckCircle,
  AlertTriangle,
  Plus,
  Sparkles,
  Send,
  Calendar,
  ClipboardList,
  Lightbulb,
  Clock,
  Settings,
  Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
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
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
// Removed unused dialog imports
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest, queryClient } from '@/lib/queryClient';

// Types for existing alerts in the system
interface AlertCategory {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  alerts: AlertItem[];
}

interface AlertItem {
  id: string;
  name: string;
  description: string;
  channels: ('email' | 'sms')[];
  configurable: boolean;
  enabled?: boolean;
  requiresSmsOptIn?: boolean;
  smsImplemented?: boolean; // false = SMS support coming soon
}

// Form schemas
const alertRequestSchema = z.object({
  alertDescription: z.string().min(10, 'Please describe the alert you would like in more detail'),
  preferredChannel: z.enum(['email', 'sms', 'both', 'no_preference']),
  frequency: z.enum(['immediate', 'daily', 'weekly', 'custom']),
  additionalNotes: z.string().optional(),
});

type AlertRequestFormData = z.infer<typeof alertRequestSchema>;

const aiAlertSchema = z.object({
  prompt: z.string().min(10, 'Please describe what you want to be notified about'),
});

type AIAlertFormData = z.infer<typeof aiAlertSchema>;

const notificationPreferencesSchema = z.object({
  primaryReminderEnabled: z.boolean(),
  primaryReminderHours: z.number().min(1).max(72),
  primaryReminderType: z.enum(['email', 'sms', 'both']),
  secondaryReminderEnabled: z.boolean(),
  secondaryReminderHours: z.number().min(1).max(72),
  secondaryReminderType: z.enum(['email', 'sms', 'both']),
});

type NotificationPreferencesFormData = z.infer<typeof notificationPreferencesSchema>;

// Define all existing alerts in the system
// smsImplemented: true = SMS delivery fully working, false = coming soon
const ALERT_CATEGORIES: AlertCategory[] = [
  {
    id: 'event-alerts',
    name: 'Event Alerts',
    description: 'Notifications related to sandwich-making events',
    icon: <Calendar className="h-5 w-5 text-brand-primary" />,
    alerts: [
      {
        id: 'volunteer-reminder',
        name: 'Volunteer Event Reminders',
        description: 'Get reminded before events where you\'re scheduled to volunteer, drive, or speak',
        channels: ['email', 'sms'],
        configurable: true,
        requiresSmsOptIn: true,
        smsImplemented: true, // Backend SMS sending implemented
      },
      {
        id: 'tsp-contact-assignment',
        name: 'TSP Contact Assignment',
        description: 'Notification when you\'re assigned as the TSP contact for an event',
        channels: ['email', 'sms'],
        configurable: true,
        requiresSmsOptIn: true,
        smsImplemented: true, // Backend SMS sending implemented
      },
    ],
  },
  {
    id: 'communication-alerts',
    name: 'Communication Alerts',
    description: 'Notifications for messages and mentions',
    icon: <MessageSquare className="h-5 w-5 text-blue-500" />,
    alerts: [
      {
        id: 'chat-mentions',
        name: 'Chat Room Mentions',
        description: 'Get notified when someone @mentions you in a chat room',
        channels: ['email', 'sms'],
        configurable: true,
        requiresSmsOptIn: true,
        smsImplemented: true, // Backend SMS sending implemented
      },
      {
        id: 'team-board-mentions',
        name: 'Team Board Mentions',
        description: 'Get notified when someone mentions you in a team board item or comment',
        channels: ['email', 'sms'],
        configurable: true,
        requiresSmsOptIn: true,
        smsImplemented: true, // Backend SMS sending implemented
      },
    ],
  },
  {
    id: 'task-alerts',
    name: 'Task & Assignment Alerts',
    description: 'Notifications for task assignments and team board activity',
    icon: <ClipboardList className="h-5 w-5 text-amber-500" />,
    alerts: [
      {
        id: 'team-board-assignment',
        name: 'Team Board Assignments',
        description: 'Get notified when you\'re assigned to a task, note, idea, or reminder',
        channels: ['email', 'sms'],
        configurable: true,
        requiresSmsOptIn: true,
        smsImplemented: true, // Backend SMS sending implemented
      },
    ],
  },
  {
    id: 'collection-alerts',
    name: 'Collection Reminders',
    description: 'Weekly sandwich collection tracking reminders',
    icon: <Clock className="h-5 w-5 text-green-500" />,
    alerts: [
      {
        id: 'weekly-collection-reminder',
        name: 'Weekly Collection Reminders',
        description: 'Reminders when weekly sandwich counts are missing for your locations',
        channels: ['email', 'sms'],
        configurable: true,
        requiresSmsOptIn: true,
        smsImplemented: true, // Backend SMS sending implemented
      },
    ],
  },
];

export default function AlertPreferences() {
  const { toast } = useToast();
  useAuth();
  const [activeTab, setActiveTab] = useState('current-alerts');
  const [isAIDialogOpen] = useState(false);
  const [aiGeneratedAlert, setAiGeneratedAlert] = useState<string | null>(null);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);

  // Check if user has SMS opt-in
  const { data: userSMSStatus, isLoading: smsStatusLoading } = useQuery({
    queryKey: ['/api/users/sms-status'],
    queryFn: () => apiRequest('GET', '/api/users/sms-status'),
  });

  const hasSMSOptIn = userSMSStatus?.hasConfirmedOptIn || false;
  const isPendingConfirmation = userSMSStatus?.isPendingConfirmation || false;

  // Load notification preferences
  const { data: preferences } = useQuery({
    queryKey: ['/api/me/notification-preferences'],
    queryFn: () => apiRequest('GET', '/api/me/notification-preferences'),
  });

  // Validate preferences data with Zod schema before passing to form
  const validatedPreferences = useMemo(() => {
    if (!preferences) return undefined;
    const result = notificationPreferencesSchema.safeParse(preferences);
    return result.success ? result.data : undefined;
  }, [preferences]);

  // Load existing alert requests
  const { data: alertRequests } = useQuery({
    queryKey: ['/api/alert-requests'],
    queryFn: () => apiRequest('GET', '/api/alert-requests'),
  });

  // Alert request form
  const requestForm = useForm<AlertRequestFormData>({
    resolver: zodResolver(alertRequestSchema),
    defaultValues: {
      alertDescription: '',
      preferredChannel: 'no_preference',
      frequency: 'immediate',
      additionalNotes: '',
    },
  });

  // AI alert form
  const aiForm = useForm<AIAlertFormData>({
    resolver: zodResolver(aiAlertSchema),
    defaultValues: {
      prompt: '',
    },
  });

  // Notification preferences form
  const preferencesForm = useForm<NotificationPreferencesFormData>({
    resolver: zodResolver(notificationPreferencesSchema),
    defaultValues: {
      primaryReminderEnabled: true,
      primaryReminderHours: 24,
      primaryReminderType: 'email',
      secondaryReminderEnabled: false,
      secondaryReminderHours: 1,
      secondaryReminderType: 'email',
    },
    values: validatedPreferences,
  });

  // Submit alert request mutation
  const submitRequestMutation = useMutation({
    mutationFn: async (data: AlertRequestFormData) => {
      return await apiRequest('POST', '/api/alert-requests', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/alert-requests'] });
      toast({
        title: 'Alert request submitted!',
        description: 'We\'ll review your request and work on adding this alert.',
      });
      setIsRequestDialogOpen(false);
      requestForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to submit alert request',
        variant: 'destructive',
      });
    },
  });

  // Save preferences mutation
  const savePreferencesMutation = useMutation({
    mutationFn: async (data: NotificationPreferencesFormData) => {
      return await apiRequest('PUT', '/api/me/notification-preferences', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/me/notification-preferences'] });
      toast({
        title: 'Preferences saved',
        description: 'Your notification preferences have been updated.',
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

  // AI alert generation mutation
  const generateAIAlertMutation = useMutation({
    mutationFn: async (data: AIAlertFormData) => {
      return await apiRequest('POST', '/api/ai/generate-alert', data);
    },
    onSuccess: (response: any) => {
      setAiGeneratedAlert(response.generatedAlert || response.suggestion);
      toast({
        title: 'Alert suggestion generated!',
        description: 'Review the AI-generated alert below.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to generate alert suggestion',
        variant: 'destructive',
      });
    },
  });

  // Form handlers
  const onSubmitRequest = (data: AlertRequestFormData) => {
    submitRequestMutation.mutate(data);
  };

  const onSubmitPreferences = (data: NotificationPreferencesFormData) => {
    savePreferencesMutation.mutate(data);
  };

  const onGenerateAIAlert = async (data: AIAlertFormData) => {
    setIsGeneratingAI(true);
    setAiGeneratedAlert(null);
    try {
      await generateAIAlertMutation.mutateAsync(data);
    } finally {
      setIsGeneratingAI(false);
    }
  };

  // Watch form values for SMS warning
  const primaryType = preferencesForm.watch('primaryReminderType');
  const secondaryType = preferencesForm.watch('secondaryReminderType');
  const secondaryEnabled = preferencesForm.watch('secondaryReminderEnabled');

  const showSMSWarning = !hasSMSOptIn && (
    primaryType === 'sms' ||
    primaryType === 'both' ||
    (secondaryEnabled && (secondaryType === 'sms' || secondaryType === 'both'))
  );

  // Generate hour options
  const hourOptions = Array.from({ length: 72 }, (_, i) => i + 1);

  const renderAlertChannelBadges = (channels: ('email' | 'sms')[], requiresSmsOptIn?: boolean, smsImplemented?: boolean) => (
    <div className="flex gap-1 flex-wrap">
      {channels.includes('email') && (
        <Badge variant="secondary" className="text-xs">
          <Mail className="h-3 w-3 mr-1" />
          Email
        </Badge>
      )}
      {channels.includes('sms') && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              {smsImplemented === false ? (
                <Badge variant="outline" className="text-xs opacity-60">
                  <Smartphone className="h-3 w-3 mr-1" />
                  SMS Coming Soon
                </Badge>
              ) : (
                <Badge
                  variant={hasSMSOptIn || !requiresSmsOptIn ? "secondary" : "outline"}
                  className={`text-xs ${!hasSMSOptIn && requiresSmsOptIn ? 'opacity-50' : ''}`}
                >
                  <Smartphone className="h-3 w-3 mr-1" />
                  SMS
                  {!hasSMSOptIn && requiresSmsOptIn && <AlertTriangle className="h-3 w-3 ml-1 text-amber-500" />}
                </Badge>
              )}
            </TooltipTrigger>
            {smsImplemented === false ? (
              <TooltipContent>
                <p>SMS delivery for this alert is coming soon</p>
              </TooltipContent>
            ) : !hasSMSOptIn && requiresSmsOptIn ? (
              <TooltipContent>
                <p>Sign up for SMS notifications to enable this</p>
              </TooltipContent>
            ) : null}
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Bell className="h-5 w-5 text-brand-primary" />
          Alert Preferences
        </h2>
        <p className="text-muted-foreground mt-1">
          Manage how and when you receive notifications from The Sandwich Project
        </p>
      </div>

      {/* SMS Status Banner */}
      {!smsStatusLoading && (
        <Alert className={hasSMSOptIn ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"}>
          {hasSMSOptIn ? (
            <>
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                <div>
                  <strong>SMS notifications active</strong> - You're receiving text alerts at {userSMSStatus?.phoneNumber}
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {userSMSStatus?.hostsOptedIn && (
                    <Badge variant="secondary" className="bg-blue-100 text-blue-800 border-blue-200">
                      <Clock className="h-3 w-3 mr-1" />
                      Collection Reminders
                    </Badge>
                  )}
                  {userSMSStatus?.eventsOptedIn && (
                    <Badge variant="secondary" className="bg-purple-100 text-purple-800 border-purple-200">
                      <Calendar className="h-3 w-3 mr-1" />
                      Event Notifications
                    </Badge>
                  )}
                  {!userSMSStatus?.hostsOptedIn && !userSMSStatus?.eventsOptedIn && (
                    <Badge variant="outline" className="text-amber-600 border-amber-300">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      No campaign selected - go to SMS Setup
                    </Badge>
                  )}
                </div>
              </AlertDescription>
            </>
          ) : isPendingConfirmation ? (
            <>
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800">
                <strong>SMS verification pending</strong> - Please verify your phone number to enable SMS alerts
              </AlertDescription>
            </>
          ) : (
            <>
              <Info className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800">
                <strong>SMS notifications not enabled</strong> - Sign up for SMS in the SMS Setup tab to receive text alerts
              </AlertDescription>
            </>
          )}
        </Alert>
      )}

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4 h-auto">
          <TabsTrigger value="current-alerts" className="py-3 text-xs sm:text-sm">
            <Bell className="h-4 w-4 mr-1 hidden sm:inline" />
            Current Alerts
          </TabsTrigger>
          <TabsTrigger value="sms-setup" className="py-3 text-xs sm:text-sm">
            <Smartphone className="h-4 w-4 mr-1 hidden sm:inline" />
            SMS Setup
          </TabsTrigger>
          <TabsTrigger value="customize" className="py-3 text-xs sm:text-sm">
            <Settings className="h-4 w-4 mr-1 hidden sm:inline" />
            Customize
          </TabsTrigger>
          <TabsTrigger value="request-alert" className="py-3 text-xs sm:text-sm">
            <Plus className="h-4 w-4 mr-1 hidden sm:inline" />
            Request
          </TabsTrigger>
        </TabsList>

        {/* Current Alerts Tab */}
        <TabsContent value="current-alerts" className="mt-6 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Available Alerts</CardTitle>
              <CardDescription>
                These are all the alerts currently available in the platform. Alerts with SMS require opt-in.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="multiple" className="w-full">
                {ALERT_CATEGORIES.map((category) => (
                  <AccordionItem key={category.id} value={category.id}>
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-3">
                        {category.icon}
                        <div className="text-left">
                          <p className="font-medium">{category.name}</p>
                          <p className="text-sm text-muted-foreground font-normal">
                            {category.description}
                          </p>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4 pt-2">
                        {category.alerts.map((alert) => (
                          <div
                            key={alert.id}
                            className="flex items-start justify-between p-4 bg-muted/50 rounded-lg"
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="font-medium text-sm">{alert.name}</p>
                                {alert.configurable && (
                                  <Badge variant="outline" className="text-xs">
                                    Configurable
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground mb-2">
                                {alert.description}
                              </p>
                              {renderAlertChannelBadges(alert.channels, alert.requiresSmsOptIn, alert.smsImplemented)}
                            </div>
                            {alert.configurable && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setActiveTab('customize')}
                                className="ml-2"
                              >
                                <Settings className="h-4 w-4 mr-1" />
                                Configure
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SMS Setup Tab */}
        <TabsContent value="sms-setup" className="mt-6">
          <SMSSetupSection
            userSMSStatus={userSMSStatus}
            isLoading={smsStatusLoading}
          />
        </TabsContent>

        {/* Customize Tab */}
        <TabsContent value="customize" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5 text-brand-primary" />
                Event Reminder Preferences
              </CardTitle>
              <CardDescription>
                Customize when and how you receive reminders for events you're volunteering at
              </CardDescription>
            </CardHeader>
            <CardContent>
              {showSMSWarning && (
                <Alert variant="destructive" className="mb-6">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    You've selected SMS notifications but haven't opted in yet.
                    Go to the SMS Setup tab to enable text alerts.
                  </AlertDescription>
                </Alert>
              )}

              <Form {...preferencesForm}>
                <form onSubmit={preferencesForm.handleSubmit(onSubmitPreferences)} className="space-y-8">
                  {/* Primary Reminder */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">Primary Reminder</h4>
                        <p className="text-sm text-muted-foreground">
                          Main notification before your scheduled events
                        </p>
                      </div>
                      <FormField
                        control={preferencesForm.control}
                        name="primaryReminderEnabled"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <FormField
                        control={preferencesForm.control}
                        name="primaryReminderHours"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Hours Before Event</FormLabel>
                            <Select
                              value={field.value.toString()}
                              onValueChange={(value) => field.onChange(parseInt(value))}
                            >
                              <FormControl>
                                <SelectTrigger>
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
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={preferencesForm.control}
                        name="primaryReminderType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Notification Method</FormLabel>
                            <FormControl>
                              <RadioGroup
                                onValueChange={field.onChange}
                                value={field.value}
                                className="flex flex-col space-y-1"
                              >
                                <FormItem className="flex items-center space-x-3 space-y-0">
                                  <FormControl>
                                    <RadioGroupItem value="email" />
                                  </FormControl>
                                  <FormLabel className="font-normal flex items-center gap-2">
                                    <Mail className="w-4 h-4" />
                                    Email Only
                                  </FormLabel>
                                </FormItem>
                                <FormItem className="flex items-center space-x-3 space-y-0">
                                  <FormControl>
                                    <RadioGroupItem value="sms" />
                                  </FormControl>
                                  <FormLabel className="font-normal flex items-center gap-2">
                                    <Smartphone className="w-4 h-4" />
                                    SMS Only
                                  </FormLabel>
                                </FormItem>
                                <FormItem className="flex items-center space-x-3 space-y-0">
                                  <FormControl>
                                    <RadioGroupItem value="both" />
                                  </FormControl>
                                  <FormLabel className="font-normal flex items-center gap-2">
                                    <Mail className="w-4 h-4" />
                                    <Smartphone className="w-4 h-4" />
                                    Both
                                  </FormLabel>
                                </FormItem>
                              </RadioGroup>
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <Separator />

                  {/* Secondary Reminder */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">Secondary Reminder (Optional)</h4>
                        <p className="text-sm text-muted-foreground">
                          Additional notification at a different time
                        </p>
                      </div>
                      <FormField
                        control={preferencesForm.control}
                        name="secondaryReminderEnabled"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>

                    {secondaryEnabled && (
                      <div className="grid gap-4 md:grid-cols-2">
                        <FormField
                          control={preferencesForm.control}
                          name="secondaryReminderHours"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Hours Before Event</FormLabel>
                              <Select
                                value={field.value.toString()}
                                onValueChange={(value) => field.onChange(parseInt(value))}
                              >
                                <FormControl>
                                  <SelectTrigger>
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
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={preferencesForm.control}
                          name="secondaryReminderType"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Notification Method</FormLabel>
                              <FormControl>
                                <RadioGroup
                                  onValueChange={field.onChange}
                                  value={field.value}
                                  className="flex flex-col space-y-1"
                                >
                                  <FormItem className="flex items-center space-x-3 space-y-0">
                                    <FormControl>
                                      <RadioGroupItem value="email" />
                                    </FormControl>
                                    <FormLabel className="font-normal flex items-center gap-2">
                                      <Mail className="w-4 h-4" />
                                      Email Only
                                    </FormLabel>
                                  </FormItem>
                                  <FormItem className="flex items-center space-x-3 space-y-0">
                                    <FormControl>
                                      <RadioGroupItem value="sms" />
                                    </FormControl>
                                    <FormLabel className="font-normal flex items-center gap-2">
                                      <Smartphone className="w-4 h-4" />
                                      SMS Only
                                    </FormLabel>
                                  </FormItem>
                                  <FormItem className="flex items-center space-x-3 space-y-0">
                                    <FormControl>
                                      <RadioGroupItem value="both" />
                                    </FormControl>
                                    <FormLabel className="font-normal flex items-center gap-2">
                                      <Mail className="w-4 h-4" />
                                      <Smartphone className="w-4 h-4" />
                                      Both
                                    </FormLabel>
                                  </FormItem>
                                </RadioGroup>
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      disabled={savePreferencesMutation.isPending}
                      className="btn-tsp-primary"
                    >
                      {savePreferencesMutation.isPending ? 'Saving...' : 'Save Preferences'}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>

          {/* Other Alert Channel Preferences */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Bell className="h-5 w-5 text-brand-primary" />
                Other Alert Delivery Preferences
              </CardTitle>
              <CardDescription>
                Choose how you want to receive each type of alert (email, SMS, or both)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!userSMSStatus?.hasConfirmedOptIn && (
                <Alert className="mb-6">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    To receive SMS notifications, please{' '}
                    <button 
                      onClick={() => setActiveTab('sms-setup')}
                      className="text-brand-primary underline font-medium"
                    >
                      set up SMS alerts
                    </button>{' '}
                    first.
                  </AlertDescription>
                </Alert>
              )}
              
              <div className="space-y-6">
                {/* TSP Contact Assignment */}
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Calendar className="h-4 w-4 text-purple-500" />
                      <h4 className="font-medium">TSP Contact Assignment</h4>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Notification when you're assigned as the TSP contact for an event
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                      <Mail className="w-3 h-3 mr-1" />
                      Email
                    </Badge>
                    <Badge 
                      variant="outline" 
                      className={userSMSStatus?.hasConfirmedOptIn 
                        ? "text-blue-600 border-blue-200 bg-blue-50" 
                        : "text-gray-400 border-gray-200 bg-gray-50"
                      }
                    >
                      <Smartphone className="w-3 h-3 mr-1" />
                      SMS {!userSMSStatus?.hasConfirmedOptIn && "(Not opted in)"}
                    </Badge>
                  </div>
                </div>

                {/* Chat Mentions */}
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <MessageSquare className="h-4 w-4 text-blue-500" />
                      <h4 className="font-medium">Chat Room Mentions</h4>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Get notified when someone @mentions you in a chat room
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                      <Mail className="w-3 h-3 mr-1" />
                      Email
                    </Badge>
                    <Badge 
                      variant="outline" 
                      className={userSMSStatus?.hasConfirmedOptIn 
                        ? "text-blue-600 border-blue-200 bg-blue-50" 
                        : "text-gray-400 border-gray-200 bg-gray-50"
                      }
                    >
                      <Smartphone className="w-3 h-3 mr-1" />
                      SMS {!userSMSStatus?.hasConfirmedOptIn && "(Not opted in)"}
                    </Badge>
                  </div>
                </div>

                {/* Team Board Mentions */}
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <MessageSquare className="h-4 w-4 text-blue-500" />
                      <h4 className="font-medium">Team Board Mentions</h4>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Get notified when someone mentions you in a team board item or comment
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                      <Mail className="w-3 h-3 mr-1" />
                      Email
                    </Badge>
                    <Badge 
                      variant="outline" 
                      className={userSMSStatus?.hasConfirmedOptIn 
                        ? "text-blue-600 border-blue-200 bg-blue-50" 
                        : "text-gray-400 border-gray-200 bg-gray-50"
                      }
                    >
                      <Smartphone className="w-3 h-3 mr-1" />
                      SMS {!userSMSStatus?.hasConfirmedOptIn && "(Not opted in)"}
                    </Badge>
                  </div>
                </div>

                {/* Team Board Assignment */}
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <ClipboardList className="h-4 w-4 text-amber-500" />
                      <h4 className="font-medium">Team Board Assignments</h4>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Get notified when you're assigned to a task, note, idea, or reminder
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                      <Mail className="w-3 h-3 mr-1" />
                      Email
                    </Badge>
                    <Badge 
                      variant="outline" 
                      className={userSMSStatus?.hasConfirmedOptIn 
                        ? "text-blue-600 border-blue-200 bg-blue-50" 
                        : "text-gray-400 border-gray-200 bg-gray-50"
                      }
                    >
                      <Smartphone className="w-3 h-3 mr-1" />
                      SMS {!userSMSStatus?.hasConfirmedOptIn && "(Not opted in)"}
                    </Badge>
                  </div>
                </div>

                {/* Weekly Collection Reminders */}
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Clock className="h-4 w-4 text-green-500" />
                      <h4 className="font-medium">Weekly Collection Reminders</h4>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Reminders when weekly sandwich counts are missing for your locations
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                      <Mail className="w-3 h-3 mr-1" />
                      Email
                    </Badge>
                    <Badge 
                      variant="outline" 
                      className={userSMSStatus?.hasConfirmedOptIn 
                        ? "text-blue-600 border-blue-200 bg-blue-50" 
                        : "text-gray-400 border-gray-200 bg-gray-50"
                      }
                    >
                      <Smartphone className="w-3 h-3 mr-1" />
                      SMS {!userSMSStatus?.hasConfirmedOptIn && "(Not opted in)"}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  <strong>Note:</strong> These alerts are automatically sent via email. If you've opted in to SMS, 
                  you'll also receive text messages for each alert type. To customize which alerts you receive by SMS only, 
                  email only, or both - this feature is coming in a future update.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Request Alert Tab */}
        <TabsContent value="request-alert" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-amber-500" />
                Request a New Alert
              </CardTitle>
              <CardDescription>
                Don't see an alert you need? Let us know what notifications would help you!
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...requestForm}>
                <form onSubmit={requestForm.handleSubmit(onSubmitRequest)} className="space-y-6">
                  <FormField
                    control={requestForm.control}
                    name="alertDescription"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>What would you like to be alerted about?</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="e.g., I'd like to receive a notification when a new event is scheduled in my area..."
                            rows={4}
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Be as specific as possible about when and why you'd want this notification
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={requestForm.control}
                      name="preferredChannel"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Preferred delivery method</FormLabel>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select method" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="email">Email</SelectItem>
                              <SelectItem value="sms">SMS</SelectItem>
                              <SelectItem value="both">Both Email & SMS</SelectItem>
                              <SelectItem value="no_preference">No Preference</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={requestForm.control}
                      name="frequency"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>How often?</FormLabel>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select frequency" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="immediate">Immediately when it happens</SelectItem>
                              <SelectItem value="daily">Daily digest</SelectItem>
                              <SelectItem value="weekly">Weekly digest</SelectItem>
                              <SelectItem value="custom">Custom timing</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={requestForm.control}
                    name="additionalNotes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Additional notes (optional)</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Any other details that would help us understand your request..."
                            rows={2}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      disabled={submitRequestMutation.isPending}
                      className="btn-tsp-primary"
                    >
                      <Send className="h-4 w-4 mr-2" />
                      {submitRequestMutation.isPending ? 'Submitting...' : 'Submit Request'}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>

          {/* AI Alert Generator */}
          <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-white">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-500" />
                AI Alert Assistant
                <Badge variant="secondary" className="ml-2">Beta</Badge>
              </CardTitle>
              <CardDescription>
                Describe what you want to be notified about and our AI will help design the perfect alert for you
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...aiForm}>
                <form onSubmit={aiForm.handleSubmit(onGenerateAIAlert)} className="space-y-4">
                  <FormField
                    control={aiForm.control}
                    name="prompt"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Describe your ideal alert</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="e.g., Notify me 3 days before any event I'm scheduled for, but only if I haven't confirmed my attendance yet..."
                            rows={3}
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Be specific about triggers, timing, and conditions
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button
                    type="submit"
                    variant="outline"
                    disabled={isGeneratingAI || generateAIAlertMutation.isPending}
                    className="border-purple-300 text-purple-700 hover:bg-purple-50"
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    {isGeneratingAI ? 'Generating...' : 'Generate Alert Suggestion'}
                  </Button>
                </form>
              </Form>

              {aiGeneratedAlert && (
                <div className="mt-4 p-4 bg-white border border-purple-200 rounded-lg">
                  <h4 className="font-medium text-sm text-purple-700 mb-2">AI Suggestion:</h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {aiGeneratedAlert}
                  </p>
                  <div className="mt-4 flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => {
                        requestForm.setValue('alertDescription', aiGeneratedAlert);
                        setAiGeneratedAlert(null);
                        aiForm.reset();
                      }}
                      className="btn-tsp-primary"
                    >
                      Use This Suggestion
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setAiGeneratedAlert(null)}
                    >
                      Dismiss
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Previous Requests */}
          {alertRequests && alertRequests.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Your Previous Requests</CardTitle>
                <CardDescription>
                  Track the status of alerts you've requested
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {alertRequests.map((request: any) => (
                    <div
                      key={request.id}
                      className="p-4 border rounded-lg"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-sm font-medium line-clamp-2">
                            {request.alertDescription}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Submitted {new Date(request.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <Badge
                          variant={
                            request.status === 'implemented' ? 'default' :
                            request.status === 'in_progress' ? 'secondary' :
                            request.status === 'rejected' ? 'destructive' :
                            'outline'
                          }
                        >
                          {request.status === 'pending' ? 'Under Review' :
                           request.status === 'in_progress' ? 'In Progress' :
                           request.status === 'implemented' ? 'Implemented' :
                           request.status === 'rejected' ? 'Not Feasible' :
                           request.status}
                        </Badge>
                      </div>
                      {request.adminNotes && (
                        <p className="text-xs text-muted-foreground mt-2 bg-muted p-2 rounded">
                          <strong>Response:</strong> {request.adminNotes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// SMS Setup Section Component
type CampaignType = 'hosts' | 'events';

function SMSSetupSection({
  userSMSStatus,
  isLoading
}: {
  userSMSStatus: any;
  isLoading: boolean;
}) {
  const { toast } = useToast();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [consent, setConsent] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  
  // Initialize campaign types from user status
  const [campaignTypes, setCampaignTypes] = useState<CampaignType[]>(() => {
    if (userSMSStatus?.campaignTypes && Array.isArray(userSMSStatus.campaignTypes)) {
      return userSMSStatus.campaignTypes;
    }
    if (userSMSStatus?.campaignType) {
      return [userSMSStatus.campaignType];
    }
    return ['hosts'];
  });

  const isAlreadyOptedIn = userSMSStatus?.hasConfirmedOptIn;
  const isPendingConfirmation = userSMSStatus?.isPendingConfirmation;
  
  // Toggle campaign type
  const toggleCampaignType = (type: CampaignType) => {
    setCampaignTypes(prev => {
      if (prev.includes(type)) {
        // Don't allow removing if it's the only one
        if (prev.length === 1) return prev;
        return prev.filter(t => t !== type);
      } else {
        return [...prev, type];
      }
    });
  };

  // Update campaign types mutation
  const updateCampaignsMutation = useMutation({
    mutationFn: (types: CampaignType[]) =>
      apiRequest('PATCH', '/api/users/sms-campaigns', { campaignTypes: types }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users/sms-status'] });
      toast({
        title: 'Preferences updated',
        description: "Your SMS notification preferences have been saved.",
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update preferences.',
        variant: 'destructive',
      });
    },
  });

  // SMS opt-in mutation
  const optInMutation = useMutation({
    mutationFn: (data: { phoneNumber: string; consent: boolean }) =>
      apiRequest('POST', '/api/users/sms-opt-in', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users/sms-status'] });
      toast({
        title: 'Verification SMS Sent!',
        description: "Check your phone for a verification code.",
      });
      setPhoneNumber('');
      setConsent(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to send verification SMS.',
        variant: 'destructive',
      });
    },
  });

  // SMS confirmation mutation
  const confirmSMSMutation = useMutation({
    mutationFn: (code: string) =>
      apiRequest('POST', '/api/users/sms-confirm', { verificationCode: code }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users/sms-status'] });
      toast({
        title: 'SMS Confirmed!',
        description: "You'll now receive SMS alerts.",
      });
      setVerificationCode('');
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Invalid verification code.',
        variant: 'destructive',
      });
    },
  });

  // SMS opt-out mutation
  const optOutMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/users/sms-opt-out'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users/sms-status'] });
      toast({
        title: 'Unsubscribed',
        description: "You've been removed from SMS alerts.",
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

  // Phone number formatting
  const formatPhoneNumber = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 10);
    if (digits.length === 0) return '';
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhoneNumber(formatPhoneNumber(e.target.value));
  };

  const handleSMSSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber.trim() || !consent) return;
    optInMutation.mutate({ phoneNumber: phoneNumber.trim(), consent: true });
  };

  const handleConfirmSMS = (e: React.FormEvent) => {
    e.preventDefault();
    if (!verificationCode.trim()) return;
    confirmSMSMutation.mutate(verificationCode.trim());
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Loading SMS status...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="w-5 h-5" />
          SMS Notifications Setup
        </CardTitle>
        <CardDescription>
          Enable SMS to receive text alerts for event reminders and weekly collection submissions
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {isAlreadyOptedIn ? (
          // Already confirmed
          <div className="space-y-4">
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                <strong>SMS notifications active!</strong>
                {userSMSStatus?.phoneNumber && (
                  <span className="block mt-1">Phone: {userSMSStatus.phoneNumber}</span>
                )}
                {userSMSStatus?.confirmedAt && (
                  <span className="block text-xs text-green-600 mt-1">
                    Confirmed: {new Date(userSMSStatus.confirmedAt).toLocaleDateString()}
                  </span>
                )}
              </AlertDescription>
            </Alert>

            {/* Campaign Type Selection */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">What notifications do you want to receive?</Label>
              <div className="space-y-2">
                <div 
                  className={`flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer ${campaignTypes.includes('hosts') ? 'border-blue-300 bg-blue-50' : ''}`}
                  onClick={() => toggleCampaignType('hosts')}
                >
                  <Checkbox 
                    id="campaign-hosts" 
                    checked={campaignTypes.includes('hosts')}
                    onCheckedChange={() => toggleCampaignType('hosts')}
                  />
                  <Label htmlFor="campaign-hosts" className="flex items-center gap-2 cursor-pointer flex-1">
                    <Clock className="h-4 w-4 text-blue-600" />
                    <div>
                      <p className="font-medium">Collection Reminders</p>
                      <p className="text-xs text-gray-500">Weekly reminders about sandwich collection submissions</p>
                    </div>
                  </Label>
                </div>
                <div 
                  className={`flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer ${campaignTypes.includes('events') ? 'border-purple-300 bg-purple-50' : ''}`}
                  onClick={() => toggleCampaignType('events')}
                >
                  <Checkbox 
                    id="campaign-events" 
                    checked={campaignTypes.includes('events')}
                    onCheckedChange={() => toggleCampaignType('events')}
                  />
                  <Label htmlFor="campaign-events" className="flex items-center gap-2 cursor-pointer flex-1">
                    <Calendar className="h-4 w-4 text-purple-600" />
                    <div>
                      <p className="font-medium">Event Notifications</p>
                      <p className="text-xs text-gray-500">TSP contact assignments, event reminders & updates</p>
                    </div>
                  </Label>
                </div>
              </div>
              {campaignTypes.length === 0 && (
                <p className="text-xs text-red-500">Please select at least one notification type</p>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => updateCampaignsMutation.mutate(campaignTypes)}
                disabled={updateCampaignsMutation.isPending || campaignTypes.length === 0}
                className="flex-1 btn-tsp-primary"
              >
                {updateCampaignsMutation.isPending ? 'Saving...' : 'Save Preferences'}
              </Button>
              <Button
                variant="outline"
                onClick={() => optOutMutation.mutate()}
                disabled={optOutMutation.isPending}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                {optOutMutation.isPending ? 'Unsubscribing...' : 'Unsubscribe'}
              </Button>
            </div>
          </div>
        ) : isPendingConfirmation ? (
          // Pending verification
          <div className="space-y-4">
            <Alert className="border-amber-200 bg-amber-50">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800">
                <strong>Verification Required</strong>
                <br />
                We sent a code to {userSMSStatus?.phoneNumber}. Enter it below or reply "YES" to the text.
              </AlertDescription>
            </Alert>

            <form onSubmit={handleConfirmSMS} className="space-y-4">
              <div>
                <Label htmlFor="verification-code">Verification Code</Label>
                <Input
                  id="verification-code"
                  type="text"
                  placeholder="Enter 6-digit code"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  maxLength={6}
                  className="text-lg text-center tracking-widest mt-2"
                />
              </div>

              <Button
                type="submit"
                className="w-full btn-tsp-primary"
                disabled={confirmSMSMutation.isPending || verificationCode.length !== 6}
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                {confirmSMSMutation.isPending ? 'Confirming...' : 'Confirm SMS'}
              </Button>
            </form>

            <div className="text-center">
              <Button
                variant="link"
                size="sm"
                onClick={() => optOutMutation.mutate()}
                disabled={optOutMutation.isPending}
              >
                {optOutMutation.isPending ? 'Resetting...' : 'Start Over'}
              </Button>
            </div>
          </div>
        ) : (
          // Not opted in - signup form
          <form onSubmit={handleSMSSubmit} className="space-y-6">
            <div className="bg-brand-primary-lighter p-4 rounded-lg">
              <h4 className="font-medium text-brand-primary-darker mb-2 flex items-center gap-2">
                <Smartphone className="h-4 w-4" />
                Why sign up for SMS?
              </h4>
              <ul className="text-sm text-brand-primary-dark space-y-1">
                <li>- Never miss an event you're volunteering at</li>
                <li>- Get reminders for weekly sandwich collection reporting</li>
                <li>- Instant notifications for important updates</li>
              </ul>
            </div>

            <div>
              <Label htmlFor="sms-phone">Phone Number</Label>
              <Input
                id="sms-phone"
                type="tel"
                placeholder="(555) 123-4567"
                value={phoneNumber}
                onChange={handlePhoneChange}
                className="text-lg mt-2"
              />
              <p className="text-sm text-muted-foreground mt-1">US numbers only</p>
            </div>

            <div className="flex items-start gap-3">
              <Checkbox
                id="sms-consent"
                checked={consent}
                onCheckedChange={(checked) => setConsent(checked as boolean)}
                className="mt-1"
              />
              <div>
                <Label htmlFor="sms-consent" className="text-sm cursor-pointer">
                  I consent to receive SMS from The Sandwich Project
                </Label>
                <ul className="text-xs text-muted-foreground mt-2 space-y-1 ml-4">
                  <li>- Messages are for alerts only, not marketing</li>
                  <li>- You can unsubscribe anytime</li>
                  <li>- Standard rates may apply</li>
                </ul>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full btn-tsp-primary"
              disabled={optInMutation.isPending || !consent || !phoneNumber.trim()}
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              {optInMutation.isPending ? 'Sending...' : 'Sign Up for SMS Alerts'}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
