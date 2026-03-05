import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { X, MessageSquare, Phone, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest, queryClient } from '@/lib/queryClient';

interface SMSOptInPromptProps {
  onDismiss?: () => void;
}

export default function SMSOptInPrompt({ onDismiss }: SMSOptInPromptProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isVisible, setIsVisible] = useState(true);
  const [isDismissed, setIsDismissed] = useState(false);

  // Check if user already has SMS consent
  const { data: userSMSStatus, isLoading } = useQuery({
    queryKey: ['/api/users/sms-status'],
    queryFn: () => apiRequest('GET', '/api/users/sms-status'),
    enabled: !!user?.id,
  });

  // Check if user has previously dismissed the prompt
  const hasBeenDismissed = () => {
    if (!user?.id) return false;
    const dismissedKey = `sms-prompt-dismissed-${user.id}`;
    return localStorage.getItem(dismissedKey) === 'true';
  };

  // SMS opt-in mutation (quick opt-in without phone number entry)
  const quickOptInMutation = useMutation({
    mutationFn: () => {
      // For quick opt-in, we'll just redirect to the dedicated SMS setup page
      // where they can enter their phone number
      return Promise.resolve();
    },
    onSuccess: () => {
      toast({
        title: 'Redirecting...',
        description: 'Taking you to SMS setup to complete your opt-in.',
      });
      // Navigate to dedicated SMS opt-in page
      window.location.href = '/sms-opt-in';
    },
  });

  const handleDismiss = () => {
    if (!user?.id) return;
    
    // Store dismissal in localStorage
    const dismissedKey = `sms-prompt-dismissed-${user.id}`;
    localStorage.setItem(dismissedKey, 'true');
    
    setIsDismissed(true);
    setIsVisible(false);
    
    if (onDismiss) {
      onDismiss();
    }

    toast({
      title: 'Prompt dismissed',
      description: 'You can enable SMS notifications anytime in your profile settings.',
    });
  };

  const handleOptIn = () => {
    quickOptInMutation.mutate();
  };

  // Don't show if loading, user not logged in, or various conditions met
  if (isLoading || !user || !isVisible || isDismissed) {
    return null;
  }

  // Don't show if user already opted in
  if (userSMSStatus?.hasOptedIn) {
    return null;
  }

  // Don't show if user previously dismissed
  if (hasBeenDismissed()) {
    return null;
  }

  return (
    <Card className="mb-6 border-l-4 border-l-[#1f7b7b] bg-gradient-to-r from-teal-50 to-blue-50 dark:from-teal-950/30 dark:to-blue-950/30" data-testid="card-sms-opt-in-prompt">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1">
            <div className="bg-[#1f7b7b] p-2 rounded-full shrink-0">
              <MessageSquare className="h-4 w-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm sm:text-base">
                    Stay up-to-date with SMS reminders
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                    Get text reminders when weekly sandwich counts are missing. Never miss a submission again!
                  </p>
                  
                  <div className="flex flex-col sm:flex-row gap-2 mt-3">
                    <Button
                      onClick={handleOptIn}
                      size="sm"
                      className="bg-[#1f7b7b] hover:bg-[#165a5a] text-white px-4"
                      disabled={quickOptInMutation.isPending}
                      data-testid="button-sms-prompt-opt-in"
                    >
                      <Phone className="h-3 w-3 mr-2" />
                      {quickOptInMutation.isPending ? 'Setting up...' : 'Set Up SMS Reminders'}
                    </Button>
                    <Button
                      onClick={handleDismiss}
                      variant="outline"
                      size="sm"
                      className="text-gray-600 dark:text-gray-300"
                      data-testid="button-sms-prompt-dismiss"
                    >
                      Maybe Later
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <Button
            onClick={handleDismiss}
            variant="ghost"
            size="sm"
            className="p-1 h-auto text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0"
            data-testid="button-sms-prompt-close"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="mt-3 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <CheckCircle className="h-3 w-3" />
          <span>Only sandwich collection reminders • Unsubscribe anytime • US numbers only</span>
        </div>
      </CardContent>
    </Card>
  );
}