import { useMemo, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { useOnboardingTracker } from '@/hooks/useOnboardingTracker';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertTriangle,
  TrendingUp,
  Target,
  Calendar,
  Users,
  CheckCircle,
  ArrowRight,
  Clock,
  MapPin,
  HelpCircle,
} from 'lucide-react';
import type { SandwichCollection, EventRequest } from '@shared/schema';
import {
  calculateTotalSandwiches,
  parseCollectionDate,
} from '@/lib/analytics-utils';
import { logger } from '@/lib/logger';
import { REGULAR_THURSDAY_CAPACITY, SPECIAL_PLACEMENT_HIGH_THRESHOLD } from '@/lib/sandwich-utils';
import { calculatePlacementTotals } from '@/lib/week-planning-utils';
import { getTotalDriverCount, getSpeakerCount } from '@/lib/assignment-utils';
import LargeEventLogisticsModal from '@/components/modals/large-event-logistics-modal';
import FollowUpEventsModal from '@/components/modals/follow-up-events-modal';
import GrowthOpportunitiesModal from '@/components/modals/growth-opportunities-modal';
import MissingDriversModal from '@/components/modals/missing-drivers-modal';
import MissingSpeakersModal from '@/components/modals/missing-speakers-modal';
import WeekOutlookModal from '@/components/modals/week-outlook-modal';
import NextMonthPlanningModal from '@/components/modals/next-month-planning-modal';

interface ActionItem {
  id: string;
  priority: 'high' | 'medium' | 'low';
  category: 'volunteer-recruitment' | 'scheduling' | 'recognition' | 'planning';
  title: string;
  description: string;
  impact: string;
  action: string;
  data?: any;
}

export default function ActionCenter() {
  const [, setLocation] = useLocation();
  const { track } = useOnboardingTracker();

  // Track onboarding challenge on component mount
  useEffect(() => {
    track('view_my_actions');
  }, []);

  // State for modals
  const [isLogisticsModalOpen, setIsLogisticsModalOpen] = useState(false);
  const [selectedLargeEvents, setSelectedLargeEvents] = useState<EventRequest[]>([]);

  const [isFollowUpModalOpen, setIsFollowUpModalOpen] = useState(false);
  const [followUpEvents, setFollowUpEvents] = useState<EventRequest[]>([]);
  const [followUpType, setFollowUpType] = useState<'1day' | '1month'>('1day');

  const [isGrowthOpportunitiesModalOpen, setIsGrowthOpportunitiesModalOpen] = useState(false);
  const [growthOpportunities, setGrowthOpportunities] = useState<Array<{ org: string; eventCount: number; avgSize: number }>>([]);

  const [isMissingDriversModalOpen, setIsMissingDriversModalOpen] = useState(false);
  const [missingDriversEvents, setMissingDriversEvents] = useState<EventRequest[]>([]);

  const [isMissingSpeakersModalOpen, setIsMissingSpeakersModalOpen] = useState(false);
  const [missingSpeakersEvents, setMissingSpeakersEvents] = useState<EventRequest[]>([]);

  const [isWeekOutlookModalOpen, setIsWeekOutlookModalOpen] = useState(false);

  const [isNextMonthPlanningModalOpen, setIsNextMonthPlanningModalOpen] = useState(false);

  // Fetch collections data
  const { data: collectionsData } = useQuery<{ collections: SandwichCollection[] }>({
    queryKey: ['/api/sandwich-collections/all'],
    queryFn: async () => {
      const response = await fetch('/api/sandwich-collections?limit=5000');
      if (!response.ok) throw new Error('Failed to fetch collections');
      return response.json();
    },
  });

  // Fetch event requests for forward-looking insights
  const { data: eventRequests } = useQuery<any[]>({
    queryKey: ['/api/event-requests'],
    queryFn: async () => {
      const response = await fetch('/api/event-requests?all=true');
      if (!response.ok) throw new Error('Failed to fetch event requests');
      return response.json();
    },
  });

  const collections = collectionsData?.collections || [];

  // Calculate actionable insights focused on forward-looking event forecasting
  const actionItems = useMemo((): ActionItem[] => {
    if (!collections.length) return [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const dayOfWeek = today.getDay();

    // Current week analysis (Fri-Thu)
    const currentWeekStart = new Date(today);
    const daysFromFriday = (dayOfWeek + 2) % 7; // Days since last Friday
    currentWeekStart.setDate(today.getDate() - daysFromFriday);
    currentWeekStart.setHours(0, 0, 0, 0);

    const currentWeekEnd = new Date(currentWeekStart);
    currentWeekEnd.setDate(currentWeekStart.getDate() + 6);
    currentWeekEnd.setHours(23, 59, 59, 999);

    // Get ALL collections for current week (past AND future dates)
    const currentWeekCollections = collections.filter((c) => {
      const date = parseCollectionDate(c.collectionDate);
      return date >= currentWeekStart && date <= currentWeekEnd;
    });

    const currentWeekTotal = currentWeekCollections.reduce(
      (sum, c) => sum + calculateTotalSandwiches(c),
      0
    );

    // Calculate weekly average (Fri-Thu weeks)
    const weekMap = new Map<string, number>();
    collections.forEach((c) => {
      const date = parseCollectionDate(c.collectionDate);
      const weekStart = new Date(date);
      const collectionDayOfWeek = date.getDay();
      const daysFromFri = (collectionDayOfWeek + 2) % 7; // Days since last Friday
      weekStart.setDate(date.getDate() - daysFromFri);
      const weekKey = weekStart.toISOString().split('T')[0];
      const current = weekMap.get(weekKey) || 0;
      weekMap.set(weekKey, current + calculateTotalSandwiches(c));
    });

    const weeklyTotals = Array.from(weekMap.values());
    const avgWeekly = weeklyTotals.length > 0
      ? weeklyTotals.reduce((a, b) => a + b, 0) / weeklyTotals.length
      : 0;

    // Calculate days elapsed in week (Fri=1, Sat=2, ..., Thu=7)
    const daysElapsedInWeek = daysFromFriday + 1;

    // Get scheduled events for current week (match Forecasts calculation)
    const scheduledThisWeek = (eventRequests || []).filter((event) => {
      if (!event.desiredEventDate) return false;
      if (!['in_process', 'scheduled', 'completed'].includes(event.status)) return false;
      const eventDate = new Date(event.desiredEventDate);
      return eventDate >= currentWeekStart && eventDate <= currentWeekEnd;
    });

    const scheduledWeeklyTotal = scheduledThisWeek.reduce(
      (sum, event) => sum + (event.estimatedSandwichCount || 0),
      0
    );

    // Baseline expectation for individual donations per week (5k sandwiches)
    const baselineIndividualExpectation = 5000;

    // Combined projection: Already collected + Scheduled events + Baseline individual expectation
    // This matches the Forecasts tab calculation for consistency
    const projectedWeekTotal = currentWeekTotal + scheduledWeeklyTotal + baselineIndividualExpectation;

    const actions: ActionItem[] = [];

    // ============================================================
    // CATEGORY 1: FOLLOW-UP & ENGAGEMENT
    // ============================================================

    // DISABLED: Find completed events needing 1-day follow-up
    // const completedEventsNeeding1Day = (eventRequests || []).filter((event) => {
    //   if (event.status !== 'completed') return false;
    //   if (!event.desiredEventDate) return false;
    //   if (event.followUpOneDayCompleted) return false;

    //   const eventDate = new Date(event.desiredEventDate);
    //   const oneDayAgo = new Date(today);
    //   oneDayAgo.setDate(today.getDate() - 1);

    //   // Flag events from yesterday or earlier that need 1-day follow-up
    //   return eventDate <= oneDayAgo;
    // });

    // if (completedEventsNeeding1Day.length > 0) {
    //   const estimatedRetention = Math.round(completedEventsNeeding1Day.length * 0.75); // 75% retention with follow-up
    //   const totalEventSandwiches = completedEventsNeeding1Day.reduce((sum, e) => sum + (e.estimatedSandwichCount || 0), 0);

    //   actions.push({
    //     id: 'followup-1day-needed',
    //     priority: 'high',
    //     category: 'recognition',
    //     title: `${completedEventsNeeding1Day.length} Event${completedEventsNeeding1Day.length !== 1 ? 's' : ''} Need 1-Day Follow-Up`,
    //     description: `Completed events waiting for immediate post-event feedback`,
    //     impact: `Follow-up could retain ${estimatedRetention} of ${completedEventsNeeding1Day.length} hosts (75% retention rate) → potential ${Math.round(totalEventSandwiches * 0.75).toLocaleString()} sandwiches in repeat events`,
    //     action: `Contact ${completedEventsNeeding1Day.slice(0, 3).map(e => e.organizationName).join(', ')}${completedEventsNeeding1Day.length > 3 ? ` and ${completedEventsNeeding1Day.length - 3} more` : ''}`,
    //     data: { events: completedEventsNeeding1Day },
    //   });
    // }

    // DISABLED: Find completed events needing 1-month follow-up (events 30+ days ago)
    // const oneMonthAgo = new Date(today);
    // oneMonthAgo.setDate(today.getDate() - 30);

    // const completedEventsNeeding1Month = (eventRequests || []).filter((event) => {
    //   if (event.status !== 'completed') return false;
    //   if (!event.desiredEventDate) return false;
    //   if (event.followUpOneMonthCompleted) return false;

    //   const eventDate = new Date(event.desiredEventDate);
    //   return eventDate <= oneMonthAgo;
    // });

    // if (completedEventsNeeding1Month.length > 0) {
    //   const potentialRepeatEvents = Math.round(completedEventsNeeding1Month.length * 0.60); // 60% repeat rate with good follow-up
    //   const totalEventSandwiches = completedEventsNeeding1Month.reduce((sum, e) => sum + (e.estimatedSandwichCount || 0), 0);

    //   actions.push({
    //     id: 'followup-1month-needed',
    //     priority: 'medium',
    //     category: 'recognition',
    //     title: `${completedEventsNeeding1Month.length} Event${completedEventsNeeding1Month.length !== 1 ? 's' : ''} Need 1-Month Follow-Up`,
    //     description: `Events from 30+ days ago waiting for long-term feedback`,
    //     impact: `Could secure ${potentialRepeatEvents} repeat events (60% conversion) → estimated ${Math.round(totalEventSandwiches * 0.60).toLocaleString()} sandwiches annually`,
    //     action: `Schedule follow-up calls with ${completedEventsNeeding1Month.slice(0, 3).map(e => e.organizationName).join(', ')}${completedEventsNeeding1Month.length > 3 ? ` and ${completedEventsNeeding1Month.length - 3} more` : ''}`,
    //     data: { events: completedEventsNeeding1Month },
    //   });
    // }

    // REMOVED: Inactive hosts tracking
    // We avoid comparing/contrasting hosts to prevent creating unwanted competition
    // or making volunteers feel judged about their contribution levels

    // ============================================================
    // CATEGORY 2: PLANNING & LOGISTICS
    // ============================================================

    // Find upcoming events (next 14 days) missing driver assignments
    const twoWeeksFromNow = new Date(today);
    twoWeeksFromNow.setDate(today.getDate() + 14);

    const upcomingEventsMissingDrivers = (eventRequests || []).filter((event) => {
      if (!['in_process', 'scheduled'].includes(event.status)) return false;
      if (!event.desiredEventDate) return false;
      if ((event.driversNeeded || 0) === 0) return false; // No drivers needed
      if (event.selfTransport) return false; // Self-transport events don't need TSP drivers

      const eventDate = new Date(event.desiredEventDate);
      if (eventDate < today || eventDate > twoWeeksFromNow) return false;

      // Check if drivers are assigned - include van driver and DHL van in total
      const totalDriversAssigned = getTotalDriverCount(event);
      const driversNeeded = event.driversNeeded || 0;

      return totalDriversAssigned < driversNeeded;
    });

    if (upcomingEventsMissingDrivers.length > 0) {
      const totalDriversNeeded = upcomingEventsMissingDrivers.reduce((sum, e) => {
        const assigned = getTotalDriverCount(e);
        const needed = e.driversNeeded || 0;
        return sum + (needed - assigned);
      }, 0);

      const atRiskSandwiches = upcomingEventsMissingDrivers.reduce((sum, e) => sum + (e.estimatedSandwichCount || 0), 0);

      actions.push({
        id: 'missing-drivers',
        priority: 'high',
        category: 'scheduling',
        title: `${upcomingEventsMissingDrivers.length} Upcoming Event${upcomingEventsMissingDrivers.length !== 1 ? 's' : ''} Need Driver${totalDriversNeeded !== 1 ? 's' : ''}`,
        description: `Events in next 2 weeks need ${totalDriversNeeded} more driver${totalDriversNeeded !== 1 ? 's' : ''}`,
        impact: `HIGH RISK: ${atRiskSandwiches.toLocaleString()} sandwiches at risk of cancellation without drivers`,
        action: `Assign drivers for ${upcomingEventsMissingDrivers.slice(0, 3).map(e => e.organizationName).join(', ')}${upcomingEventsMissingDrivers.length > 3 ? ` and ${upcomingEventsMissingDrivers.length - 3} more` : ''}`,
        data: { events: upcomingEventsMissingDrivers, driversNeeded: totalDriversNeeded },
      });
    }

    // Find upcoming events missing speaker assignments
    const upcomingEventsMissingSpeakers = (eventRequests || []).filter((event) => {
      if (!['in_process', 'scheduled'].includes(event.status)) return false;
      if (!event.desiredEventDate) return false;
      if ((event.speakersNeeded || 0) === 0) return false;

      const eventDate = new Date(event.desiredEventDate);
      if (eventDate < today || eventDate > twoWeeksFromNow) return false;

      const assignedSpeakersCount = getSpeakerCount(event);
      const speakersNeeded = event.speakersNeeded || 0;

      return assignedSpeakersCount < speakersNeeded;
    });

    if (upcomingEventsMissingSpeakers.length > 0) {
      const totalSpeakersNeeded = upcomingEventsMissingSpeakers.reduce((sum, e) => {
        const assigned = getSpeakerCount(e);
        const needed = e.speakersNeeded || 0;
        return sum + (needed - assigned);
      }, 0);

      actions.push({
        id: 'missing-speakers',
        priority: 'medium',
        category: 'scheduling',
        title: `${upcomingEventsMissingSpeakers.length} Upcoming Event${upcomingEventsMissingSpeakers.length !== 1 ? 's' : ''} Need Speaker${totalSpeakersNeeded !== 1 ? 's' : ''}`,
        description: `Events in next 2 weeks need ${totalSpeakersNeeded} more speaker${totalSpeakersNeeded !== 1 ? 's' : ''}`,
        impact: `Speakers help share the mission and recruit future volunteers`,
        action: `Assign speakers for ${upcomingEventsMissingSpeakers.slice(0, 3).map(e => e.organizationName).join(', ')}${upcomingEventsMissingSpeakers.length > 3 ? ` and ${upcomingEventsMissingSpeakers.length - 3} more` : ''}`,
        data: { events: upcomingEventsMissingSpeakers, speakersNeeded: totalSpeakersNeeded },
      });
    }

    // Find large upcoming events (500+ sandwiches) that might need extra support
    const largeUpcomingEvents = (eventRequests || []).filter((event) => {
      if (!['in_process', 'scheduled'].includes(event.status)) return false;
      if (!event.desiredEventDate) return false;
      if ((event.estimatedSandwichCount || 0) < 500) return false;

      const eventDate = new Date(event.desiredEventDate);
      return eventDate >= today && eventDate <= twoWeeksFromNow;
    });

    if (largeUpcomingEvents.length > 0) {
      actions.push({
        id: 'large-events-support',
        priority: 'medium',
        category: 'planning',
        title: `${largeUpcomingEvents.length} Large Event${largeUpcomingEvents.length !== 1 ? 's' : ''} Coming Up`,
        description: `Events with 500+ sandwiches in next 2 weeks may need extra coordination`,
        impact: `Large events require additional volunteers and planning`,
        action: `Review logistics for ${largeUpcomingEvents.map(e => `${e.organizationName} (${e.estimatedSandwichCount})`).join(', ')}`,
        data: { events: largeUpcomingEvents },
      });
    }

    // Calculate average collections by day of week for forecasting
    const dayOfWeekTotals = new Map<number, { total: number; count: number }>();
    collections.forEach((c) => {
      const date = parseCollectionDate(c.collectionDate);
      const dow = date.getDay();
      const current = dayOfWeekTotals.get(dow) || { total: 0, count: 0 };
      dayOfWeekTotals.set(dow, {
        total: current.total + calculateTotalSandwiches(c),
        count: current.count + 1,
      });
    });

    // Look ahead at next 4 weeks and forecast based on scheduled events + expected individual donations
    for (let weekOffset = 0; weekOffset < 4; weekOffset++) {
      const weekStart = new Date(currentWeekStart);
      weekStart.setDate(currentWeekStart.getDate() + (weekOffset * 7));

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      // For current week, only calculate expected donations for remaining days
      const isCurrentWeek = weekOffset === 0;
      const startDay = isCurrentWeek ? today : weekStart;

      // Get scheduled events for this week (include completed for accurate totals)
      const scheduledThisWeek = (eventRequests || []).filter((event) => {
        if (!event.desiredEventDate) return false;
        if (!['in_process', 'scheduled', 'completed'].includes(event.status)) return false;

        const eventDate = new Date(event.desiredEventDate);
        return eventDate >= weekStart && eventDate <= weekEnd;
      });

      const scheduledTotal = scheduledThisWeek.reduce(
        (sum, event) => sum + (event.estimatedSandwichCount || 0),
        0
      );

      // Calculate expected individual donations for the week (or remaining days)
      let expectedIndividualDonations = 0;
      const currentDate = new Date(startDay);
      while (currentDate <= weekEnd) {
        const dow = currentDate.getDay();
        const dayData = dayOfWeekTotals.get(dow);
        if (dayData && dayData.count > 0) {
          expectedIndividualDonations += dayData.total / dayData.count;
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }

      // Total forecast = scheduled events + expected individual donations + already collected (if current week)
      const alreadyCollected = isCurrentWeek ? currentWeekTotal : 0;
      const totalForecast = alreadyCollected + scheduledTotal + Math.round(expectedIndividualDonations);

      // Get historical average for comparison
      const historicalWeeks = Array.from(weekMap.values());
      const avgForWeek = historicalWeeks.length > 0
        ? historicalWeeks.reduce((a, b) => a + b, 0) / historicalWeeks.length
        : avgWeekly;

      // Flag if total forecast is significantly below average
      const gap = avgForWeek - totalForecast;
      const percentBelow = avgForWeek > 0 ? (gap / avgForWeek) * 100 : 0;

      // Debug logging for action center
      if (weekOffset === 0) {
        logger.log('=== ACTION CENTER DEBUG (Current Week) ===');
        logger.log('Total forecast:', totalForecast);
        logger.log('Already collected:', alreadyCollected);
        logger.log('Scheduled events total:', scheduledTotal);
        logger.log('Expected individual donations:', Math.round(expectedIndividualDonations));
        logger.log('Average weekly:', avgForWeek);
        logger.log('Gap:', gap);
        logger.log('Percent below:', percentBelow.toFixed(1) + '%');
        logger.log('Would flag?', gap > 500 && percentBelow > 20);
      }

      // Only show "below average" warnings later in the week (Fri-Tue, days 5,6,0,1,2) OR if it's a future week
      // Early in the week (Wed-Thu, days 3-4), we'll show planned group collections instead
      const isLaterInWeek = dayOfWeek === 5 || dayOfWeek === 6 || dayOfWeek === 0 || dayOfWeek === 1 || dayOfWeek === 2;
      const shouldShowBelowAverageWarning = weekOffset > 0 || isLaterInWeek;

      if (gap > 500 && percentBelow > 20 && shouldShowBelowAverageWarning) {
        const weekLabel = weekOffset === 0 ? 'This Week' :
                         weekOffset === 1 ? 'Next Week' :
                         `Week of ${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

        actions.push({
          id: `low-forecast-week-${weekOffset}`,
          priority: weekOffset === 0 ? 'high' : weekOffset === 1 ? 'high' : 'medium',
          category: 'volunteer-recruitment',
          title: `${weekLabel}: Forecasted Below Average`,
          description: `Forecast ${totalForecast.toLocaleString()} sandwiches vs ${Math.round(avgForWeek).toLocaleString()} average`,
          impact: `Need ${Math.round(gap).toLocaleString()} more sandwiches to reach typical week`,
          action: `Recruit volunteers for collections during ${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
          data: { weekStart, weekEnd, totalForecast, scheduledTotal, expectedIndividualDonations: Math.round(expectedIndividualDonations), avgForWeek, gap, scheduledEventCount: scheduledThisWeek.length },
        });
      }
    }

    // Early in the week (Wed-Thu, days 3-4): Show helpful info about planned group collections
    // Later in the week (Fri-Tue, days 5,6,0,1,2): Show pace warnings if behind
    const alreadyFlaggedThisWeek = actions.some(a => a.id === 'low-forecast-week-0');
    const isEarlyWeek = dayOfWeek === 3 || dayOfWeek === 4; // Wed, Thu

    if (isEarlyWeek && !alreadyFlaggedThisWeek) {
      // Early week: Show planned group collections with focus on placement capacity
      const plannedCollectionsThisWeek = currentWeekCollections.filter((c) => {
        const date = parseCollectionDate(c.collectionDate);
        return date > today;
      });

      // Get scheduled events for this week
      const scheduledThisWeek = (eventRequests || []).filter((event) => {
        if (!event.desiredEventDate) return false;
        if (!['in_process', 'scheduled', 'completed'].includes(event.status)) return false;
        const eventDate = new Date(event.desiredEventDate);
        return eventDate >= currentWeekStart && eventDate <= currentWeekEnd;
      });

      // Break down by day to identify regular distribution (Wednesday) vs special placement
      const { wednesdayTotal, specialPlacementTotal } = calculatePlacementTotals(
        plannedCollectionsThisWeek,
        scheduledThisWeek
      );

      const totalPlanned = wednesdayTotal + specialPlacementTotal;

      // Show this insight if we have meaningful group events planned
      if (totalPlanned > 0) {
        const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dayName = weekdays[dayOfWeek];

        // Determine priority based on placement challenges
        let priority: 'high' | 'medium' | 'low';
        let impact = '';
        let action = '';

        if (wednesdayTotal > REGULAR_THURSDAY_CAPACITY && specialPlacementTotal > 0) {
          priority = 'high';
          impact = `${(wednesdayTotal - REGULAR_THURSDAY_CAPACITY).toLocaleString()} over Thursday capacity + ${specialPlacementTotal.toLocaleString()} needing special placement`;
          action = 'Review placement capacity - High volume alert';
        } else if (wednesdayTotal > REGULAR_THURSDAY_CAPACITY) {
          priority = 'high';
          impact = `${(wednesdayTotal - REGULAR_THURSDAY_CAPACITY).toLocaleString()} sandwiches over regular Thursday distribution capacity`;
          action = 'Plan additional distribution locations or times';
        } else if (specialPlacementTotal > SPECIAL_PLACEMENT_HIGH_THRESHOLD) {
          priority = 'medium';
          impact = `${specialPlacementTotal.toLocaleString()} sandwiches need placement outside regular Thursday distribution`;
          action = 'Coordinate recipient placement for non-Wednesday events';
        } else if (specialPlacementTotal > 0) {
          priority = 'low';
          impact = `${totalPlanned.toLocaleString()} sandwiches from group events (${specialPlacementTotal.toLocaleString()} need special placement)`;
          action = 'View week outlook and plan distribution';
        } else {
          priority = 'low';
          impact = `${wednesdayTotal.toLocaleString()} sandwiches from Wednesday events → Thursday distribution`;
          action = 'View week outlook - all events aligned with regular distribution';
        }

        // Add context about recruitment (guard against division by zero)
        if (avgWeekly > 0) {
          const percentOfWeekly = totalPlanned / avgWeekly;
          if (percentOfWeekly > 0.8) {
            impact += ` (${Math.round(percentOfWeekly * 100)}% of weekly goal)`;
          }
        }

        actions.push({
          id: 'early-week-planning',
          priority,
          category: 'planning',
          title: `Week Outlook (${dayName})`,
          description: `${totalPlanned.toLocaleString()} sandwiches from ${plannedCollectionsThisWeek.length + scheduledThisWeek.length} planned group collections/events`,
          impact,
          action,
          data: {
            currentWeekTotal,
            wednesdayTotal,
            specialPlacementTotal,
            totalPlanned,
            avgWeekly,
            plannedCollectionsCount: plannedCollectionsThisWeek.length,
            scheduledEventCount: scheduledThisWeek.length
          },
        });
      }
    } else if (!isEarlyWeek && !alreadyFlaggedThisWeek) {
      // Later in week (Fri-Tue): Show pace warnings if behind
      const weeklyGap = avgWeekly - projectedWeekTotal;
      const weeklyAbsDiff = Math.abs(weeklyGap);

      // Only flag if more than 300 sandwiches below average (matching Forecasts threshold)
      if (weeklyGap > 300) {
        actions.push({
          id: 'weekly-pace',
          priority: weeklyGap > 1000 ? 'high' : 'medium',
          category: 'volunteer-recruitment',
          title: 'Weekly Collections Below Average Pace',
          description: `Currently tracking ${Math.abs(Math.round((weeklyGap / avgWeekly) * 100))}% below typical weekly collections`,
          impact: `Need ~${Math.round(weeklyGap)} more sandwiches to reach average week`,
          action: 'Recruit volunteers for end-of-week collections',
          data: { currentWeekTotal, projectedWeekTotal, avgWeekly, gap: weeklyGap, scheduledWeeklyTotal, baselineIndividualExpectation },
        });
      }
    }

    // ============================================================
    // CATEGORY 3: GROWTH OPPORTUNITIES
    // ============================================================

    // Compare current month to current year's monthly average (more meaningful than YoY)
    const currentMonthCollections = collections.filter((c) => {
      const date = parseCollectionDate(c.collectionDate);
      return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    });

    const currentMonthTotal = currentMonthCollections.reduce(
      (sum, c) => sum + calculateTotalSandwiches(c),
      0
    );

    // Calculate this year's average monthly total (excluding current month if incomplete)
    const currentYearMonths = new Map<number, number>();
    collections.forEach((c) => {
      const date = parseCollectionDate(c.collectionDate);
      if (date.getFullYear() === currentYear) {
        const month = date.getMonth();
        const current = currentYearMonths.get(month) || 0;
        currentYearMonths.set(month, current + calculateTotalSandwiches(c));
      }
    });

    // Get completed months only (months before current month)
    const completedMonths = Array.from(currentYearMonths.entries())
      .filter(([month]) => month < currentMonth)
      .map(([, total]) => total);

    if (completedMonths.length > 0) {
      const yearToDateMonthlyAvg = completedMonths.reduce((sum, total) => sum + total, 0) / completedMonths.length;
      const gapVsYearAvg = yearToDateMonthlyAvg - currentMonthTotal;
      const percentBelowAvg = (gapVsYearAvg / yearToDateMonthlyAvg) * 100;

      // Only flag if significantly below this year's average (indicates unusual decline)
      if (gapVsYearAvg > 2000 && percentBelowAvg > 20) {
        const monthName = today.toLocaleDateString('en-US', { month: 'long' });
        actions.push({
          id: 'month-below-year-average',
          priority: 'medium',
          category: 'planning',
          title: `${monthName} Below ${currentYear} Average`,
          description: `${Math.round(percentBelowAvg)}% below year-to-date monthly average (${gapVsYearAvg.toLocaleString()} fewer sandwiches)`,
          impact: `Current month tracking below typical ${currentYear} performance`,
          action: `Increase recruitment and event scheduling for remainder of ${monthName}`,
          data: { currentMonthTotal, yearToDateMonthlyAvg, gap: gapVsYearAvg, percentBelowAvg },
        });
      }
    }

    // Find organizations with repeat events that could go larger
    // Look at past 2 years of completed events (not just last year)
    const twoYearsAgo = currentYear - 2;
    const recentCompletedEvents = (eventRequests || []).filter((event) => {
      if (event.status !== 'completed') return false;
      if (!event.desiredEventDate) return false;

      const eventDate = new Date(event.desiredEventDate);
      const eventYear = eventDate.getFullYear();
      return eventYear >= twoYearsAgo && eventYear <= currentYear;
    });

    const orgEventCounts = new Map<string, { count: number; avgSize: number; totalSandwiches: number }>();

    recentCompletedEvents.forEach((event) => {
      if (!event.organizationName) return;
      const sandwichCount = event.actualSandwichCount || event.estimatedSandwichCount || 0;
      const current = orgEventCounts.get(event.organizationName) || { count: 0, avgSize: 0, totalSandwiches: 0 };
      current.count += 1;
      current.totalSandwiches += sandwichCount;
      orgEventCounts.set(event.organizationName, current);
    });

    // Find repeat organizations (3+ events) with small-medium events (< 350 sandwiches avg)
    // These are proven partners who might be ready to scale up
    const growthOpportunityOrgs: Array<{ org: string; eventCount: number; avgSize: number }> = [];

    orgEventCounts.forEach((data, org) => {
      if (data.count >= 3) {
        const avgSize = Math.round(data.totalSandwiches / data.count);
        // Focus on partners doing 50-350 sandwiches on average (proven but could grow)
        if (avgSize >= 50 && avgSize < 350) {
          growthOpportunityOrgs.push({ org, eventCount: data.count, avgSize });
        }
      }
    });

    if (growthOpportunityOrgs.length > 0) {
      growthOpportunityOrgs.sort((a, b) => b.eventCount - a.eventCount);
      const topOrgs = growthOpportunityOrgs.slice(0, 3);

      actions.push({
        id: 'growth-opportunities',
        priority: 'low',
        category: 'planning',
        title: `${growthOpportunityOrgs.length} Partner${growthOpportunityOrgs.length !== 1 ? 's' : ''} Could Scale Up Events`,
        description: `Organizations with multiple small events could potentially host larger ones`,
        impact: `Growing event sizes with proven partners is easier than recruiting new ones`,
        action: `Explore expansion with ${topOrgs.map(o => `${o.org} (${o.eventCount} events, avg ${o.avgSize})`).join(', ')}`,
        data: { organizations: growthOpportunityOrgs },
      });
    }

    // ============================================================
    // CATEGORY 4: PROACTIVE PLANNING
    // ============================================================

    // Always show "Plan Ahead for Next Month" in the second half of the current month
    const dayOfMonth = today.getDate();
    const daysInCurrentMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const isSecondHalfOfMonth = dayOfMonth >= Math.floor(daysInCurrentMonth / 2);

    if (isSecondHalfOfMonth) {
      const nextMonth = new Date(currentYear, currentMonth + 1, 1);
      const nextMonthName = nextMonth.toLocaleDateString('en-US', { month: 'long' });
      const nextMonthYear = nextMonth.getFullYear();

      // Check how many events are already scheduled for next month
      const nextMonthEnd = new Date(nextMonthYear, nextMonth.getMonth() + 1, 0);
      const scheduledNextMonth = (eventRequests || []).filter((event) => {
        if (!['in_process', 'scheduled'].includes(event.status)) return false;
        if (!event.desiredEventDate) return false;
        const eventDate = new Date(event.desiredEventDate);
        return eventDate >= nextMonth && eventDate <= nextMonthEnd;
      });

      const scheduledNextMonthTotal = scheduledNextMonth.reduce(
        (sum, event) => sum + (event.estimatedSandwichCount || 0),
        0
      );

      // Calculate historical average for next month
      const historicalNextMonthTotals: number[] = [];
      const monthMap = new Map<string, number>();

      collections.forEach((c) => {
        const date = parseCollectionDate(c.collectionDate);
        if (date.getMonth() === nextMonth.getMonth()) {
          const yearKey = date.getFullYear().toString();
          const current = monthMap.get(yearKey) || 0;
          monthMap.set(yearKey, current + calculateTotalSandwiches(c));
        }
      });

      monthMap.forEach((total) => historicalNextMonthTotals.push(total));

      const hasHistoricalData = historicalNextMonthTotals.length > 0;
      const historicalAverage = hasHistoricalData
        ? Math.round(historicalNextMonthTotals.reduce((a, b) => a + b, 0) / historicalNextMonthTotals.length)
        : 0;

      const progressPercent = hasHistoricalData && historicalAverage > 0
        ? Math.round((scheduledNextMonthTotal / historicalAverage) * 100)
        : 0;

      // Determine priority based on how prepared we are
      let priority: 'high' | 'medium' | 'low' = 'low';
      if (hasHistoricalData && progressPercent < 25 && dayOfMonth >= 20) {
        priority = 'medium'; // Less than 25% scheduled in last 10 days of month
      }

      actions.push({
        id: 'plan-ahead-next-month',
        priority,
        category: 'planning',
        title: `Plan Ahead for ${nextMonthName}`,
        description: hasHistoricalData
          ? `${scheduledNextMonth.length} events scheduled (${scheduledNextMonthTotal.toLocaleString()} sandwiches) • Historical avg: ${historicalAverage.toLocaleString()}`
          : `${scheduledNextMonth.length} events scheduled for ${nextMonthName} so far`,
        impact: hasHistoricalData
          ? `Currently at ${progressPercent}% of historical ${nextMonthName} average`
          : `Review patterns and opportunities for ${nextMonthName}`,
        action: `Review ${nextMonthName} patterns from previous years`,
        data: {
          nextMonthName,
          nextMonthYear,
          scheduledCount: scheduledNextMonth.length,
          scheduledTotal: scheduledNextMonthTotal,
          historicalAverage,
          progressPercent,
          hasHistoricalData,
        },
      });
    }

    return actions.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }, [collections, eventRequests]);

  const priorityColors = {
    high: 'bg-red-100 text-red-800 border-red-300',
    medium: 'bg-amber-100 text-amber-800 border-amber-300',
    low: 'bg-blue-100 text-blue-800 border-blue-300',
  };

  const categoryIcons = {
    'volunteer-recruitment': Users,
    scheduling: Calendar,
    recognition: CheckCircle,
    planning: Target,
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-3xl font-bold text-brand-primary">Action Center</h2>
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="text-teal-600 hover:text-teal-800 transition-colors">
                  <HelpCircle className="w-5 h-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="font-semibold mb-1">Action Center Help</p>
                <p className="text-sm">Strategic insights and opportunities based on your data. Get actionable recommendations for volunteer recruitment, event scheduling, recognition, and program planning.</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <p className="text-gray-600 mt-2">
            Strategic opportunities for volunteer recruitment and program growth • {actionItems.length} insights
          </p>
        </div>

        {/* Priority Summary or Success Banner - Mutually Exclusive */}
        {actionItems.filter(a => a.priority === 'high').length > 0 ? (
          <Card className="bg-gradient-to-r from-brand-primary to-brand-teal text-white">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <AlertTriangle className="h-12 w-12 flex-shrink-0" />
                <div>
                  <h3 className="text-xl font-bold mb-1">
                    {actionItems.filter(a => a.priority === 'high').length} High-Priority {actionItems.filter(a => a.priority === 'high').length === 1 ? 'Item' : 'Items'} Need Attention This Week
                  </h3>
                  <p className="text-white/90">
                    Focus on: {actionItems.filter(a => a.priority === 'high').slice(0, 3).map(a => a.category.replace(/-/g, ' ')).join(', ')}
                    {actionItems.filter(a => a.priority === 'high').length > 3 && ', and more'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : actionItems.length === 0 ? (
          <Card className="bg-gradient-to-r from-green-500 to-teal-500 text-white">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <CheckCircle className="h-12 w-12 flex-shrink-0" />
                <div>
                  <h3 className="text-xl font-bold mb-1">Great Work! Everything On Track</h3>
                  <p className="text-white/90">
                    ✓ No urgent items • ✓ Events well-staffed • ✓ Follow-ups current • ✓ Collections on pace
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <CheckCircle className="h-12 w-12 flex-shrink-0" />
                <div>
                  <h3 className="text-xl font-bold mb-1">Looking Good! No Urgent Items</h3>
                  <p className="text-white/90">
                    {actionItems.length} medium/low priority {actionItems.length === 1 ? 'item' : 'items'} to address when you have time
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

      {/* Summary Stats - only show when there are action items */}
      {actionItems.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">High Priority</p>
                  <p className="text-2xl font-bold text-red-600">
                    {actionItems.filter((a) => a.priority === 'high').length}
                  </p>
                </div>
                <AlertTriangle className="h-8 w-8 text-red-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Recruitment</p>
                  <p className="text-2xl font-bold text-brand-primary">
                    {actionItems.filter((a) => a.category === 'volunteer-recruitment').length}
                  </p>
                </div>
                <Users className="h-8 w-8 text-brand-primary" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Scheduling</p>
                  <p className="text-2xl font-bold text-brand-teal">
                    {actionItems.filter((a) => a.category === 'scheduling').length}
                  </p>
                </div>
                <Calendar className="h-8 w-8 text-brand-teal" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Recognition</p>
                  <p className="text-2xl font-bold text-green-600">
                    {actionItems.filter((a) => a.category === 'recognition').length}
                  </p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Action Items */}
      <div className="space-y-4">
        {actionItems.map((item) => {
          const Icon = categoryIcons[item.category];
          return (
            <Card
              key={item.id}
              className={`border-l-4 ${
                item.priority === 'high'
                  ? 'border-l-red-500'
                  : item.priority === 'medium'
                  ? 'border-l-amber-500'
                  : 'border-l-blue-500'
              }`}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <Icon className="h-6 w-6 text-gray-600 mt-1" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <CardTitle className="text-xl">{item.title}</CardTitle>
                        <Badge className={priorityColors[item.priority]}>
                          {item.priority.toUpperCase()}
                        </Badge>
                      </div>
                      <CardDescription className="text-base">
                        {item.description}
                      </CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Potential Impact</p>
                    <p className="font-semibold text-brand-primary">{item.impact}</p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Recommended Action</p>
                    <p className="font-semibold text-brand-primary">{item.action}</p>
                  </div>
                </div>

                {/* Weekly Pace Details */}
                {item.id === 'weekly-pace' && item.data && (
                  <div className="border-t pt-4 mt-4">
                    <div className="grid grid-cols-1 xs:grid-cols-3 gap-3 sm:gap-4 text-center">
                      <div>
                        <p className="text-sm text-gray-600">This Week So Far</p>
                        <p className="text-2xl font-bold text-brand-primary">
                          {item.data.currentWeekTotal?.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Projected Total</p>
                        <p className="text-2xl font-bold text-amber-600">
                          {item.data.projectedWeekTotal?.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Weekly Average</p>
                        <p className="text-2xl font-bold text-gray-700">
                          {Math.round(item.data.avgWeekly)?.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-4">
                  <Button
                    className="w-full"
                    size="lg"
                    onClick={() => {
                      // Handle different action item types
                      if (item.id === 'large-events-support' && item.data?.events) {
                        setSelectedLargeEvents(item.data.events);
                        setIsLogisticsModalOpen(true);
                      } else if (item.id === 'followup-1day-needed' && item.data?.events) {
                        setFollowUpEvents(item.data.events);
                        setFollowUpType('1day');
                        setIsFollowUpModalOpen(true);
                      } else if (item.id === 'followup-1month-needed' && item.data?.events) {
                        setFollowUpEvents(item.data.events);
                        setFollowUpType('1month');
                        setIsFollowUpModalOpen(true);
                      } else if (item.id === 'growth-opportunities' && item.data?.organizations) {
                        setGrowthOpportunities(item.data.organizations);
                        setIsGrowthOpportunitiesModalOpen(true);
                      } else if (item.id === 'missing-drivers' && item.data?.events) {
                        // Open missing drivers modal
                        setMissingDriversEvents(item.data.events);
                        setIsMissingDriversModalOpen(true);
                      } else if (item.id === 'missing-speakers' && item.data?.events) {
                        // Open missing speakers modal
                        setMissingSpeakersEvents(item.data.events);
                        setIsMissingSpeakersModalOpen(true);
                      } else if (item.id === 'early-week-planning') {
                        // Open Week Outlook Modal
                        setIsWeekOutlookModalOpen(true);
                      } else if (item.id === 'plan-ahead-next-month') {
                        // Open Next Month Planning Modal
                        setIsNextMonthPlanningModalOpen(true);
                      } else if (item.id.startsWith('low-forecast-week-') || item.id === 'weekly-pace' || item.id === 'month-below-year-average') {
                        // Navigate to event requests to add new events / increase recruitment
                        setLocation('/event-requests');
                      } else if (item.id === 'year-over-year-decline') {
                        // Navigate to analytics dashboard
                        setLocation('/analytics');
                      }
                    }}
                  >
                    {item.action}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {actionItems.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                All Caught Up!
              </h3>
              <p className="text-gray-600">
                Program is running smoothly. Keep up the great work!
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>

    {/* Modals */}
    <LargeEventLogisticsModal
      open={isLogisticsModalOpen}
      onOpenChange={setIsLogisticsModalOpen}
      events={selectedLargeEvents}
    />

    <FollowUpEventsModal
      open={isFollowUpModalOpen}
      onOpenChange={setIsFollowUpModalOpen}
      events={followUpEvents}
      followUpType={followUpType}
    />

    <GrowthOpportunitiesModal
      open={isGrowthOpportunitiesModalOpen}
      onOpenChange={setIsGrowthOpportunitiesModalOpen}
      opportunities={growthOpportunities}
    />

    <MissingDriversModal
      open={isMissingDriversModalOpen}
      onOpenChange={setIsMissingDriversModalOpen}
      events={missingDriversEvents}
    />

    <MissingSpeakersModal
      open={isMissingSpeakersModalOpen}
      onOpenChange={setIsMissingSpeakersModalOpen}
      events={missingSpeakersEvents}
      onAssignSpeakers={(eventId) => {
        // Navigate to event requests - user can find and assign from there
        setLocation('/event-requests');
      }}
    />

    <WeekOutlookModal
      isOpen={isWeekOutlookModalOpen}
      onClose={() => setIsWeekOutlookModalOpen(false)}
    />

    <NextMonthPlanningModal
      isOpen={isNextMonthPlanningModalOpen}
      onClose={() => setIsNextMonthPlanningModalOpen(false)}
    />
    </TooltipProvider>
  );
}
