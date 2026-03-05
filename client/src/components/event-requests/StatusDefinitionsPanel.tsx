import React, { useState } from 'react';
import { Info, ChevronDown, ChevronUp, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  STATUS_DEFINITIONS,
  VALID_STATUS_TRANSITIONS,
  statusBorderColors,
} from './constants';
import type { EventStatus } from '@shared/event-status-workflow';

const statusOrder: EventStatus[] = [
  'new',
  'in_process',
  'scheduled',
  'rescheduled',
  'completed',
  'declined',
  'postponed',
  'cancelled',
  'non_event',
  'standby',
  'stalled',
];

export const StatusDefinitionsPanel: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 text-gray-600 hover:text-gray-900"
        >
          <Info className="w-4 h-4" />
          Status Definitions
          {isOpen ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-3">
        <div className="bg-white border rounded-lg shadow-sm p-4 space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b">
            <Info className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-sm text-gray-900">
              Event Status Definitions & Workflow
            </h3>
          </div>

          <div className="grid gap-3">
            {statusOrder.map((status) => {
              const def = STATUS_DEFINITIONS[status];
              const transitions = VALID_STATUS_TRANSITIONS[status];
              const borderColor = statusBorderColors[status] || '#6B7280';

              return (
                <div
                  key={status}
                  className="rounded-lg border p-3 text-sm"
                  style={{ borderLeftWidth: '4px', borderLeftColor: borderColor }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <span className="font-semibold text-gray-900">
                        {def.label}
                      </span>
                      <p className="text-gray-600 mt-0.5">{def.definition}</p>
                      <p className="text-gray-500 mt-1 text-xs italic">
                        {def.guidance}
                      </p>
                    </div>
                  </div>
                  {transitions.length > 0 && (
                    <div className="mt-2 flex items-center gap-1 flex-wrap">
                      <span className="text-xs text-gray-400 mr-1">
                        <ArrowRight className="w-3 h-3 inline" /> Can move to:
                      </span>
                      {transitions.map((t) => (
                        <Badge
                          key={t}
                          variant="outline"
                          className="text-xs py-0 px-1.5"
                          style={{
                            borderColor: statusBorderColors[t] || '#6B7280',
                            color: statusBorderColors[t] || '#6B7280',
                          }}
                        >
                          {STATUS_DEFINITIONS[t]?.label || t}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
            <strong>Key rules:</strong>
            <ul className="mt-1 space-y-1 list-disc list-inside">
              <li>
                <strong>Cancelled</strong> is only for events that were already{' '}
                <strong>Scheduled</strong>. If an In Process event doesn't happen,
                use <strong>Declined</strong>.
              </li>
              <li>
                <strong>Postponed</strong> is only for <strong>Scheduled</strong>{' '}
                events that need to change their date.
              </li>
              <li>
                All status changes to Declined, Cancelled, or Postponed require a
                reason to be recorded.
              </li>
            </ul>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};
