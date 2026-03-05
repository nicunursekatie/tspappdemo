import EmailStyleMessaging from '@/components/email-style-messaging';
import { useActivityTracker } from '@/hooks/useActivityTracker';
import { useEffect } from 'react';

export default function RealTimeMessages() {
  const { trackView } = useActivityTracker();

  useEffect(() => {
    trackView(
      'Messages',
      'Messages',
      'Real-Time Messages',
      'User accessed real-time messages'
    );
  }, [trackView]);

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Threads (Project-Centered Messaging)</h1>
        <p className="text-sm sm:text-base text-gray-600 mt-1 sm:mt-2">
          Send and receive messages organized by project, event, or task context
        </p>
      </div>

      <EmailStyleMessaging />
    </div>
  );
}
