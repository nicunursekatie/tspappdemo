import { Badge } from '@/components/ui/badge';
import { Phone, Home, Calendar } from 'lucide-react';

type CampaignType = 'hosts' | 'events';

interface SMSBadgeProps {
  smsConsent?: {
    enabled: boolean;
    phoneNumber?: string;
    displayPhone?: string;
    campaignType?: CampaignType;
    campaignTypes?: CampaignType[];
  };
}

export function SMSBadge({ smsConsent }: SMSBadgeProps) {
  if (smsConsent?.enabled) {
    const types: CampaignType[] = smsConsent.campaignTypes && Array.isArray(smsConsent.campaignTypes) 
      ? smsConsent.campaignTypes 
      : smsConsent.campaignType 
        ? [smsConsent.campaignType]
        : ['hosts'];
    
    const hasHosts = types.includes('hosts');
    const hasEvents = types.includes('events');
    
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <Badge
          variant="outline"
          className="bg-green-50 text-green-700 border-green-200"
        >
          <Phone className="h-3 w-3 mr-1" />
          Opted In
        </Badge>
        {hasHosts && (
          <Badge
            variant="outline"
            className="bg-gray-50 border-gray-200 text-blue-600"
          >
            <Home className="h-3 w-3 mr-1" />
            Collection
          </Badge>
        )}
        {hasEvents && (
          <Badge
            variant="outline"
            className="bg-gray-50 border-gray-200 text-purple-600"
          >
            <Calendar className="h-3 w-3 mr-1" />
            Events
          </Badge>
        )}
        <span className="text-xs text-gray-500">
          {smsConsent.displayPhone || smsConsent.phoneNumber}
        </span>
      </div>
    );
  }

  return (
    <Badge variant="outline" className="bg-gray-50 text-gray-600">
      <Phone className="h-3 w-3 mr-1" />
      Not Opted In
    </Badge>
  );
}
