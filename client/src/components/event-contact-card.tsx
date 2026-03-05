import { Phone, Mail, Building, Calendar, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { EventContact } from '@shared/schema';

interface EventContactCardProps {
  contact: EventContact;
  onClick: () => void;
}

export function EventContactCard({ contact, onClick }: EventContactCardProps) {
  const roleColors: Record<string, string> = {
    primary: 'bg-blue-100 text-blue-800 border-blue-200',
    backup: 'bg-purple-100 text-purple-800 border-purple-200',
    tsp: 'bg-green-100 text-green-800 border-green-200',
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return null;
    }
  };

  return (
    <Card
      className="border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all cursor-pointer"
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-slate-900 truncate">
              {contact.fullName || 'Unknown Contact'}
            </h3>
            <div className="flex flex-wrap gap-1 mt-1">
              {contact.contactRoles.map((role) => (
                <Badge
                  key={role}
                  variant="outline"
                  className={`text-xs capitalize ${roleColors[role] || ''}`}
                >
                  {role === 'tsp' ? 'TSP Coordinator' : role}
                </Badge>
              ))}
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-400 flex-shrink-0" />
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Contact info */}
        <div className="space-y-1.5">
          {contact.phone && (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Phone className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">{contact.phone}</span>
            </div>
          )}
          {contact.email && (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Mail className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">{contact.email}</span>
            </div>
          )}
        </div>

        {/* Organizations */}
        {contact.organizations.length > 0 && (
          <div className="flex items-start gap-2 text-sm text-slate-600">
            <Building className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span className="line-clamp-2">
              {contact.organizations.slice(0, 3).join(', ')}
              {contact.organizations.length > 3 && ` +${contact.organizations.length - 3} more`}
            </span>
          </div>
        )}

        {/* Event stats */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <div className="flex items-center gap-1 text-sm">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span className="text-slate-700 font-medium">{contact.totalEvents}</span>
            <span className="text-slate-500">
              {contact.totalEvents === 1 ? 'event' : 'events'}
            </span>
            {contact.completedEvents > 0 && (
              <span className="text-slate-400">
                ({contact.completedEvents} completed)
              </span>
            )}
          </div>

          {/* Status indicator */}
          {contact.hasOnlyIncompleteEvents && (
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs">
              In Progress
            </Badge>
          )}
        </div>

        {/* Last event date */}
        {contact.lastEventDate && (
          <div className="text-xs text-slate-400">
            Last event: {formatDate(contact.lastEventDate)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default EventContactCard;
