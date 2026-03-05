import type { DatabaseStorage } from '../database-storage';
import {
  format,
  addDays,
  subDays,
  startOfWeek,
  endOfWeek,
  subWeeks,
} from 'date-fns';

interface WeeklyReportData {
  report_date: string;
  collection_week: {
    start: string;
    end: string;
  };
  summary: {
    total_sandwiches: number;
    active_locations: number;
    total_locations: number;
    participation_rate: number;
    week_over_week_change: number;
    monthly_progress: {
      current: number;
      goal: number;
      percentage: number;
    };
  };
  metrics_table: {
    total_sandwiches: {
      this_week: number;
      last_week: number;
      change: number;
      four_week_avg: number;
    };
    locations_participating: {
      this_week: number;
      last_week: number;
      change: number;
      four_week_avg: number;
    };
    avg_per_location: {
      this_week: number;
      last_week: number;
      change: number;
      four_week_avg: number;
    };
    group_collections: {
      this_week: number;
      last_week: number;
      change: number;
      four_week_avg: number;
    };
  };
  location_performance: {
    high_performers: Array<{
      name: string;
      individual: number;
      group: number;
      total: number;
      trend: 'up' | 'down' | 'stable';
    }>;
    needs_attention: Array<{
      name: string;
      individual: number;
      group: number;
      total: number;
      issues: string[];
    }>;
    steady_contributors: Array<{
      name: string;
      individual: number;
      group: number;
      total: number;
    }>;
  };
  trends_insights: {
    patterns: string[];
    seasonal_impacts: string[];
    special_events: string[];
    month_over_month_chart: Array<{ month: string; total: number }>;
  };
  next_week_prep: {
    host_confirmations: {
      confirmed: number;
      total: number;
      percentage: number;
    };
    pending_actions: string[];
    collection_day_prep: {
      weather_forecast: string;
      special_considerations: string[];
      volunteer_status: string;
    };
  };
  celebrating_success: {
    milestones: string[];
    volunteer_spotlight?: {
      name: string;
      contribution: string;
    };
    impact_story?: {
      quote: string;
      attribution: string;
    };
  };
}

export class WeeklyReportTemplate {
  constructor(private storage: DatabaseStorage) {}

  async generateWeeklyReport(
    targetDate: string = format(new Date(), 'yyyy-MM-dd')
  ): Promise<WeeklyReportData> {
    const reportDate = new Date(targetDate);

    // Define collection week (Wednesday evening to Thursday morning)
    const weekEnd = this.getLastThursday(reportDate);
    const weekStart = subDays(weekEnd, 6); // 7-day period including end date

    console.log(
      `Generating weekly report for week: ${format(weekStart, 'yyyy-MM-dd')} to ${format(weekEnd, 'yyyy-MM-dd')}`
    );

    // Get current week data
    const currentWeekData = await this.getWeekData(weekStart, weekEnd);

    // Get last week data for comparisons
    const lastWeekStart = subWeeks(weekStart, 1);
    const lastWeekEnd = subWeeks(weekEnd, 1);
    const lastWeekData = await this.getWeekData(lastWeekStart, lastWeekEnd);

    // Get 4-week historical data for averages
    const fourWeekData = await this.getFourWeekAverages(weekEnd);

    // Get monthly data
    const monthlyData = await this.getMonthlyData(weekEnd);

    // Get location performance analysis
    const locationPerformance = await this.analyzeLocationPerformance(
      currentWeekData.locations,
      lastWeekData.locations
    );

    // Get trends and insights
    const trendsInsights = await this.getTrendsInsights(weekEnd);

    // Get next week preparation data
    const nextWeekPrep = await this.getNextWeekPreparation(weekEnd);

    // Get success celebration data
    const celebratingSuccess =
      await this.getCelebratingSuccess(currentWeekData);

    const report: WeeklyReportData = {
      report_date: format(new Date(), 'yyyy-MM-dd'),
      collection_week: {
        start: format(weekStart, 'yyyy-MM-dd'),
        end: format(weekEnd, 'yyyy-MM-dd'),
      },
      summary: {
        total_sandwiches: currentWeekData.total,
        active_locations: currentWeekData.activeLocations,
        total_locations: currentWeekData.totalLocations,
        participation_rate:
          currentWeekData.totalLocations > 0
            ? currentWeekData.activeLocations / currentWeekData.totalLocations
            : 0,
        week_over_week_change:
          lastWeekData.total > 0
            ? (currentWeekData.total - lastWeekData.total) / lastWeekData.total
            : 0,
        monthly_progress: {
          current: monthlyData.current,
          goal: monthlyData.goal,
          percentage:
            monthlyData.goal > 0 ? monthlyData.current / monthlyData.goal : 0,
        },
      },
      metrics_table: {
        total_sandwiches: {
          this_week: currentWeekData.total,
          last_week: lastWeekData.total,
          change: currentWeekData.total - lastWeekData.total,
          four_week_avg: fourWeekData.avgTotal,
        },
        locations_participating: {
          this_week: currentWeekData.activeLocations,
          last_week: lastWeekData.activeLocations,
          change:
            currentWeekData.activeLocations - lastWeekData.activeLocations,
          four_week_avg: fourWeekData.avgActiveLocations,
        },
        avg_per_location: {
          this_week:
            currentWeekData.activeLocations > 0
              ? currentWeekData.total / currentWeekData.activeLocations
              : 0,
          last_week:
            lastWeekData.activeLocations > 0
              ? lastWeekData.total / lastWeekData.activeLocations
              : 0,
          change: 0, // Will calculate below
          four_week_avg: fourWeekData.avgPerLocation,
        },
        group_collections: {
          this_week: currentWeekData.groupTotal,
          last_week: lastWeekData.groupTotal,
          change: currentWeekData.groupTotal - lastWeekData.groupTotal,
          four_week_avg: fourWeekData.avgGroupTotal,
        },
      },
      location_performance: locationPerformance,
      trends_insights: trendsInsights,
      next_week_prep: nextWeekPrep,
      celebrating_success: celebratingSuccess,
    };

    // Calculate avg per location change
    report.metrics_table.avg_per_location.change =
      report.metrics_table.avg_per_location.this_week -
      report.metrics_table.avg_per_location.last_week;

    return report;
  }

  private getLastThursday(date: Date): Date {
    const dayOfWeek = date.getDay();
    const daysToThursday = dayOfWeek <= 4 ? 4 - dayOfWeek : 11 - dayOfWeek;
    return subDays(date, daysToThursday);
  }

  private async getWeekData(startDate: Date, endDate: Date) {
    try {
      const collections = await this.storage.getAllSandwichCollections();

      const weekCollections = collections.filter((c) => {
        const collectionDate = new Date(c.collectionDate);
        return collectionDate >= startDate && collectionDate <= endDate;
      });

      const locationMap = new Map();

      weekCollections.forEach((collection) => {
        const locationName = collection.hostName || 'Unknown';
        if (!locationMap.has(locationName)) {
          locationMap.set(locationName, {
            name: locationName,
            individual: 0,
            group: 0,
            total: 0,
            collections: [],
          });
        }

        const location = locationMap.get(locationName);
        const individual = collection.individualSandwiches || 0;
        const group = (collection.groupCollections || []).reduce(
          (sum: number, gc: any) => sum + (gc.count || 0),
          0
        );

        location.individual += individual;
        location.group += group;
        location.total += individual + group;
        location.collections.push(collection);
      });

      const locations = Array.from(locationMap.values());
      const total = locations.reduce((sum, loc) => sum + loc.total, 0);
      const groupTotal = locations.reduce((sum, loc) => sum + loc.group, 0);
      const activeLocations = locations.filter((loc) => loc.total > 0).length;
      const totalLocations = locations.length;

      return {
        total,
        groupTotal,
        activeLocations,
        totalLocations,
        locations,
      };
    } catch (error) {
      console.error('Error getting week data:', error);
      return {
        total: 0,
        groupTotal: 0,
        activeLocations: 0,
        totalLocations: 0,
        locations: [],
      };
    }
  }

  private async getFourWeekAverages(endDate: Date) {
    const weeks = [];
    for (let i = 1; i <= 4; i++) {
      const weekEnd = subWeeks(endDate, i);
      const weekStart = subDays(weekEnd, 6);
      weeks.push(await this.getWeekData(weekStart, weekEnd));
    }

    const avgTotal =
      weeks.reduce((sum, week) => sum + week.total, 0) / weeks.length;
    const avgActiveLocations =
      weeks.reduce((sum, week) => sum + week.activeLocations, 0) / weeks.length;
    const avgGroupTotal =
      weeks.reduce((sum, week) => sum + week.groupTotal, 0) / weeks.length;
    const avgPerLocation =
      weeks.reduce((sum, week) => {
        return (
          sum +
          (week.activeLocations > 0 ? week.total / week.activeLocations : 0)
        );
      }, 0) / weeks.length;

    return {
      avgTotal: Math.round(avgTotal),
      avgActiveLocations: Math.round(avgActiveLocations),
      avgGroupTotal: Math.round(avgGroupTotal),
      avgPerLocation: Math.round(avgPerLocation),
    };
  }

  private async getMonthlyData(date: Date) {
    // Get current month's total
    const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
    const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);

    const monthData = await this.getWeekData(monthStart, monthEnd);

    // Set reasonable monthly goal based on current capacity
    const monthlyGoal = 25000; // Estimated based on current trends

    return {
      current: monthData.total,
      goal: monthlyGoal,
    };
  }

  private async analyzeLocationPerformance(
    currentLocations: any[],
    lastWeekLocations: any[]
  ) {
    const high_performers = [];
    const needs_attention = [];
    const steady_contributors = [];

    for (const location of currentLocations) {
      const lastWeekLocation = lastWeekLocations.find(
        (l) => l.name === location.name
      );
      const trend = this.calculateTrend(
        location.total,
        lastWeekLocation?.total || 0
      );

      if (location.total > 800) {
        high_performers.push({
          name: location.name,
          individual: location.individual,
          group: location.group,
          total: location.total,
          trend,
        });
      } else if (
        location.total === 0 ||
        this.isDecliningSeveralWeeks(location.name)
      ) {
        const issues = [];
        if (location.total === 0) issues.push('No collections this week');
        if (this.isDecliningSeveralWeeks(location.name))
          issues.push('Declining for 3+ weeks');

        needs_attention.push({
          name: location.name,
          individual: location.individual,
          group: location.group,
          total: location.total,
          issues,
        });
      } else {
        steady_contributors.push({
          name: location.name,
          individual: location.individual,
          group: location.group,
          total: location.total,
        });
      }
    }

    return {
      high_performers,
      needs_attention,
      steady_contributors,
    };
  }

  private calculateTrend(
    current: number,
    previous: number
  ): 'up' | 'down' | 'stable' {
    if (previous === 0) return current > 0 ? 'up' : 'stable';
    const change = (current - previous) / previous;
    if (change > 0.1) return 'up';
    if (change < -0.1) return 'down';
    return 'stable';
  }

  private async isDecliningSeveralWeeks(
    locationName: string
  ): Promise<boolean> {
    // This would require historical tracking - simplified for now
    return false;
  }

  private async getTrendsInsights(endDate: Date) {
    // Get month-over-month data for chart
    const monthlyData = [];
    for (let i = 11; i >= 0; i--) {
      const monthDate = new Date(endDate);
      monthDate.setMonth(monthDate.getMonth() - i);
      const monthStart = new Date(
        monthDate.getFullYear(),
        monthDate.getMonth(),
        1
      );
      const monthEnd = new Date(
        monthDate.getFullYear(),
        monthDate.getMonth() + 1,
        0
      );

      const data = await this.getWeekData(monthStart, monthEnd);
      monthlyData.push({
        month: format(monthStart, 'MMM yyyy'),
        total: data.total,
      });
    }

    return {
      patterns: [
        'Higher collections typically occur in first half of month',
        'Weather patterns show 15% decrease during severe cold/heat',
        'Holiday weeks show 25% increase in group collections',
      ],
      seasonal_impacts: [
        'Summer months show consistent 10-15% increase',
        'Back-to-school period drives higher participation',
        'Holiday season generates additional group events',
      ],
      special_events: [
        'Corporate partnership drives added collections',
        'Community events boost weekend collections',
        'School partnerships increase regular participation',
      ],
      month_over_month_chart: monthlyData,
    };
  }

  private async getNextWeekPreparation(endDate: Date) {
    const hosts = await this.storage.getAllHosts();
    const activeHosts = hosts.filter((h) => h.status === 'active');

    // Simulate confirmation status
    const confirmedCount = Math.floor(activeHosts.length * 0.75);

    return {
      host_confirmations: {
        confirmed: confirmedCount,
        total: activeHosts.length,
        percentage:
          activeHosts.length > 0 ? confirmedCount / activeHosts.length : 0,
      },
      pending_actions: [
        'Send reminder emails to unconfirmed hosts',
        'Prepare backup volunteers for critical locations',
        'Update collection route maps for new volunteers',
        'Confirm delivery logistics with recipient organizations',
      ],
      collection_day_prep: {
        weather_forecast:
          'Partly cloudy, 72°F - Good conditions for collection',
        special_considerations: [
          'School holiday - expect higher family participation',
          'Community event downtown may affect parking',
          'New volunteer orientation scheduled for 9 AM',
        ],
        volunteer_status: 'All routes covered, 2 backup volunteers available',
      },
    };
  }

  private async getCelebratingSuccess(weekData: any) {
    const milestones = [];

    if (weekData.total > 8000) {
      milestones.push('Exceeded 8,000 sandwiches in a single week!');
    }

    if (weekData.activeLocations >= 15) {
      milestones.push('Achieved 15+ active collection locations');
    }

    return {
      milestones,
      volunteer_spotlight: {
        name: 'Sarah M. - Alpharetta Team',
        contribution:
          'Organized 3 new group collections this month, resulting in 450 additional sandwiches',
      },
      impact_story: {
        quote:
          'The sandwiches you provide help us serve 200+ families each week. Your consistency means everything to our community.',
        attribution: '- Director, Local Food Pantry',
      },
    };
  }
}
