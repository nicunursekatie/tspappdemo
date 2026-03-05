import React, { useMemo } from 'react';
import { Calendar, Car, AlertTriangle, Users, CheckCircle2, Clock } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import type { EventRequest } from '@shared/schema';

interface DashboardSummaryCardsProps {
  eventRequests: EventRequest[];
  statusCounts: {
    all: number;
    new: number;
    in_process: number;
    scheduled: number;
    completed: number;
    declined: number;
    postponed: number;
    cancelled: number;
    my_assignments: number;
  };
  isLoading: boolean;
}

interface SummaryCardProps {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  colorClass: string;
  bgClass: string;
  isLoading?: boolean;
}

const SummaryCard: React.FC<SummaryCardProps> = ({
  label,
  value,
  icon,
  colorClass,
  bgClass,
  isLoading = false,
}) => {
  if (isLoading) {
    return (
      <div className={`${bgClass} rounded-lg p-3 sm:p-4`}>
        <div className="flex items-center gap-3">
          <div className={`${colorClass} p-2 rounded-lg bg-white/50`}>
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <Skeleton className="h-6 w-12 mb-1" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${bgClass} rounded-lg p-3 sm:p-4 transition-all hover:shadow-md`}>
      <div className="flex items-center gap-3">
        <div className={`${colorClass} p-2 rounded-lg bg-white/50`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className={`text-xl sm:text-2xl font-bold ${colorClass}`}>
            {value}
          </div>
          <div className="text-xs sm:text-sm text-gray-600 truncate">
            {label}
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Dashboard summary cards showing at-a-glance metrics
 * Displays key counts for scheduled events, driver needs, incomplete events, and volunteer openings
 */
export const DashboardSummaryCards: React.FC<DashboardSummaryCardsProps> = ({
  eventRequests,
  statusCounts,
  isLoading,
}) => {
  // Calculate derived metrics from event requests
  const metrics = useMemo(() => {
    if (isLoading || !eventRequests.length) {
      return {
        scheduledCount: statusCounts.scheduled,
        needsDriversCount: 0,
        incompleteCount: 0,
        volunteerOpenings: 0,
      };
    }

    // Filter to scheduled/in_process/rescheduled events for needs calculations
    // Note: eventRequests should already be filtered to these statuses from parent,
    // but we keep this filter for safety and clarity
    const activeEvents = eventRequests.filter(
      e => e.status === 'scheduled' || e.status === 'in_process' || e.status === 'rescheduled'
    );

    // Events that need drivers (have driversNeeded > assigned drivers)
    let needsDriversCount = 0;
    let volunteerOpenings = 0;

    activeEvents.forEach(event => {
      // Count driver needs
      const driversNeeded = event.driversNeeded || 0;
      const assignedDriverIds = event.assignedDriverIds as string[] | null;
      const driversAssigned = assignedDriverIds?.length || 0;
      if (driversNeeded > driversAssigned) {
        needsDriversCount++;
      }

      // Count volunteer openings (speakers + volunteers + drivers needed but unfilled)
      const speakersNeeded = event.speakersNeeded || 0;
      const assignedSpeakerIds = event.assignedSpeakerIds as string[] | null;
      const speakersAssigned = assignedSpeakerIds?.length || 0;
      const speakersUnfilled = Math.max(0, speakersNeeded - speakersAssigned);

      const volunteersNeeded = event.volunteersNeeded || 0;
      const assignedVolunteerIds = event.assignedVolunteerIds as string[] | null;
      const volunteersAssigned = assignedVolunteerIds?.length || 0;
      const volunteersUnfilled = Math.max(0, volunteersNeeded - volunteersAssigned);

      const driversUnfilled = Math.max(0, driversNeeded - driversAssigned);

      volunteerOpenings += speakersUnfilled + volunteersUnfilled + driversUnfilled;
    });

    // Incomplete events (new + in_process)
    const incompleteCount = statusCounts.new + statusCounts.in_process;

    return {
      scheduledCount: statusCounts.scheduled,
      needsDriversCount,
      incompleteCount,
      volunteerOpenings,
    };
  }, [eventRequests, statusCounts, isLoading]);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {/* Scheduled Events */}
      <SummaryCard
        label="Scheduled Events"
        value={metrics.scheduledCount}
        icon={<Calendar className="w-5 h-5" />}
        colorClass="text-emerald-600"
        bgClass="bg-emerald-50 border border-emerald-100"
        isLoading={isLoading}
      />

      {/* Need Drivers */}
      <SummaryCard
        label="Need Drivers"
        value={metrics.needsDriversCount}
        icon={<Car className="w-5 h-5" />}
        colorClass="text-amber-600"
        bgClass="bg-amber-50 border border-amber-100"
        isLoading={isLoading}
      />

      {/* Incomplete Events */}
      <SummaryCard
        label="Incomplete Events"
        value={metrics.incompleteCount}
        icon={<Clock className="w-5 h-5" />}
        colorClass="text-rose-600"
        bgClass="bg-rose-50 border border-rose-100"
        isLoading={isLoading}
      />

      {/* Volunteer Openings */}
      <SummaryCard
        label="Volunteer Openings"
        value={metrics.volunteerOpenings}
        icon={<Users className="w-5 h-5" />}
        colorClass="text-blue-600"
        bgClass="bg-blue-50 border border-blue-100"
        isLoading={isLoading}
      />
    </div>
  );
};

export default DashboardSummaryCards;
