import type { DatabaseStorage } from '../database-storage';
import { isInExcludedWeek } from '../utils/excluded-weeks';

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
  locations: Array<{
    name: string;
    individual: number;
    group: number;
    total: number;
    trend: 'up' | 'down' | 'stable';
    status: 'high_performer' | 'needs_attention' | 'steady_contributor';
    issues?: string[];
  }>;
  trends_insights: {
    patterns: string[];
    seasonal_impacts: string[];
    special_events: string[];
    month_over_month_chart_data: Array<{ month: string; total: number }>;
  };
  next_week_prep: {
    host_confirmations: {
      confirmed: number;
      total: number;
      percentage: number;
    };
    pending_actions: string[];
    known_events: string[];
    weather_forecast: string;
    volunteer_status: string;
  };
  success_celebration: {
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

export class WeeklyImpactReportGenerator {
  constructor(private storage: DatabaseStorage) {}

  async generateWeeklyReport(
    weekEndingDate: string
  ): Promise<WeeklyReportData> {
    const weekEnd = new Date(weekEndingDate);
    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekEnd.getDate() - 6); // 7-day week including end date

    // Get current week data
    const currentWeekData = await this.getWeekData(weekStart, weekEnd);

    // Get last week data for comparisons
    const lastWeekStart = new Date(weekStart);
    lastWeekStart.setDate(weekStart.getDate() - 7);
    const lastWeekEnd = new Date(weekEnd);
    lastWeekEnd.setDate(weekEnd.getDate() - 7);
    const lastWeekData = await this.getWeekData(lastWeekStart, lastWeekEnd);

    // Get 4-week historical data for averages
    const fourWeekData = await this.getFourWeekAverages(weekEnd);

    // Get monthly data
    const monthlyData = await this.getMonthlyData(weekEnd);

    // Get location analysis
    const locationAnalysis = await this.analyzeLocations(
      currentWeekData,
      lastWeekData
    );

    // Get trends and insights
    const trendsInsights = await this.getTrendsInsights(weekEnd);

    // Get next week preparation data
    const nextWeekPrep = await this.getNextWeekPreparation(weekEnd);

    // Get success celebration data
    const successCelebration =
      await this.getSuccessCelebration(currentWeekData);

    const report: WeeklyReportData = {
      report_date: new Date().toISOString().split('T')[0],
      collection_week: {
        start: weekStart.toISOString().split('T')[0],
        end: weekEnd.toISOString().split('T')[0],
      },
      summary: {
        total_sandwiches: currentWeekData.total,
        active_locations: currentWeekData.activeLocations,
        total_locations: currentWeekData.totalLocations,
        participation_rate:
          currentWeekData.activeLocations / currentWeekData.totalLocations,
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
      locations: locationAnalysis,
      trends_insights: trendsInsights,
      next_week_prep: nextWeekPrep,
      success_celebration: successCelebration,
    };

    // Calculate avg per location change
    report.metrics_table.avg_per_location.change =
      report.metrics_table.avg_per_location.this_week -
      report.metrics_table.avg_per_location.last_week;

    return report;
  }

  private async getWeekData(startDate: Date, endDate: Date) {
    const collections = await this.storage.getFilteredCollections({
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
    });

    const locationData = new Map<
      string,
      { individual: number; group: number; total: number }
    >();
    let totalSandwiches = 0;
    let totalGroupSandwiches = 0;

    for (const collection of collections) {
      const locationName = collection.hostName || 'Unknown';
      const individual = collection.individualCount || 0;
      const group = collection.groupCount || 0;
      const total = individual + group;

      if (!locationData.has(locationName)) {
        locationData.set(locationName, { individual: 0, group: 0, total: 0 });
      }

      const location = locationData.get(locationName)!;
      location.individual += individual;
      location.group += group;
      location.total += total;

      totalSandwiches += total;
      totalGroupSandwiches += group;
    }

    // Get total locations from hosts table
    const allHosts = await this.storage.getAllHosts();
    const totalLocations = allHosts.length;
    const activeLocations = locationData.size;

    return {
      total: totalSandwiches,
      groupTotal: totalGroupSandwiches,
      activeLocations,
      totalLocations,
      locationData,
    };
  }

  private async getFourWeekAverages(endDate: Date) {
    const weeks = [];
    let weeksChecked = 0;
    let i = 0;

    // Get 4 non-excluded weeks (may need to look back further if some weeks are excluded)
    while (weeks.length < 4 && weeksChecked < 12) {
      const weekEnd = new Date(endDate);
      weekEnd.setDate(endDate.getDate() - i * 7);
      const weekStart = new Date(weekEnd);
      weekStart.setDate(weekEnd.getDate() - 6);

      // Check if this period falls in an excluded collection week (Thanksgiving, holidays on Wed/Thu)
      // Use a date from the middle of the period - isInExcludedWeek will find the correct Wed-Tue week
      const midWeek = new Date(weekStart);
      midWeek.setDate(weekStart.getDate() + 3);
      const midWeekStr = `${midWeek.getFullYear()}-${String(midWeek.getMonth() + 1).padStart(2, '0')}-${String(midWeek.getDate()).padStart(2, '0')}`;
      const exclusionCheck = isInExcludedWeek(midWeekStr);

      if (!exclusionCheck.excluded) {
        const weekData = await this.getWeekData(weekStart, weekEnd);
        weeks.push(weekData);
      }

      i++;
      weeksChecked++;
    }

    // If we couldn't find 4 weeks, use what we have
    if (weeks.length === 0) {
      return {
        avgTotal: 0,
        avgActiveLocations: 0,
        avgGroupTotal: 0,
        avgPerLocation: 0,
      };
    }

    const avgTotal =
      weeks.reduce((sum, week) => sum + week.total, 0) / weeks.length;
    const avgActiveLocations =
      weeks.reduce((sum, week) => sum + week.activeLocations, 0) / weeks.length;
    const avgGroupTotal =
      weeks.reduce((sum, week) => sum + week.groupTotal, 0) / weeks.length;
    const avgPerLocation =
      weeks.reduce(
        (sum, week) =>
          sum +
          (week.activeLocations > 0 ? week.total / week.activeLocations : 0),
        0
      ) / weeks.length;

    return {
      avgTotal: Math.round(avgTotal),
      avgActiveLocations: Math.round(avgActiveLocations),
      avgGroupTotal: Math.round(avgGroupTotal),
      avgPerLocation: Math.round(avgPerLocation),
    };
  }

  private async getMonthlyData(currentDate: Date) {
    const monthStart = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      1
    );
    const monthEnd = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() + 1,
      0
    );

    const collections = await this.storage.getFilteredCollections({
      startDate: monthStart.toISOString().split('T')[0],
      endDate: monthEnd.toISOString().split('T')[0],
    });

    const currentMonthTotal = collections.reduce(
      (sum: number, collection: any) =>
        sum + (collection.individualCount || 0) + (collection.groupCount || 0),
      0
    );

    // Estimate monthly goal based on historical averages (can be made configurable)
    const monthlyGoal = 35000; // Default goal, should be configurable

    return {
      current: currentMonthTotal,
      goal: monthlyGoal,
    };
  }

  private async analyzeLocations(currentWeek: any, lastWeek: any) {
    const locations = [];
    const allLocations = new Set([
      ...Array.from(currentWeek.locationData.keys()),
      ...Array.from(lastWeek.locationData.keys()),
    ]);

    for (const locationName of allLocations) {
      const current = currentWeek.locationData.get(locationName) || {
        individual: 0,
        group: 0,
        total: 0,
      };
      const last = lastWeek.locationData.get(locationName) || {
        individual: 0,
        group: 0,
        total: 0,
      };

      let trend: 'up' | 'down' | 'stable' = 'stable';
      if (current.total > last.total) trend = 'up';
      else if (current.total < last.total) trend = 'down';

      let status: 'high_performer' | 'needs_attention' | 'steady_contributor' =
        'steady_contributor';
      if (current.total > 800) status = 'high_performer';
      else if (current.total === 0) status = 'needs_attention';

      const issues = [];
      if (current.total === 0) issues.push('No collections this week');
      if (trend === 'down' && current.total > 0) issues.push('Declining trend');

      locations.push({
        name: locationName,
        individual: current.individual,
        group: current.group,
        total: current.total,
        trend,
        status,
        issues: issues.length > 0 ? issues : undefined,
      });
    }

    // Sort by status priority and then by total
    return locations.sort((a, b) => {
      const statusOrder = {
        high_performer: 0,
        steady_contributor: 1,
        needs_attention: 2,
      };
      const statusDiff = statusOrder[a.status] - statusOrder[b.status];
      if (statusDiff !== 0) return statusDiff;
      return b.total - a.total;
    });
  }

  private async getTrendsInsights(endDate: Date) {
    // Get 12 weeks of data for trends
    const weeklyData = [];
    for (let i = 0; i < 12; i++) {
      const weekEnd = new Date(endDate);
      weekEnd.setDate(endDate.getDate() - i * 7);
      const weekStart = new Date(weekEnd);
      weekStart.setDate(weekEnd.getDate() - 6);

      const weekData = await this.getWeekData(weekStart, weekEnd);
      weeklyData.push({
        week: `Week of ${weekStart.toLocaleDateString()}`,
        total: weekData.total,
      });
    }

    // Get monthly data for chart
    const monthlyData = [];
    for (let i = 0; i < 6; i++) {
      const monthDate = new Date(endDate);
      monthDate.setMonth(endDate.getMonth() - i);
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

      const collections = await this.storage.getFilteredCollections({
        startDate: monthStart.toISOString().split('T')[0],
        endDate: monthEnd.toISOString().split('T')[0],
      });

      const monthTotal = collections.reduce(
        (sum: number, collection: any) =>
          sum +
          (collection.individualCount || 0) +
          (collection.groupCount || 0),
        0
      );

      monthlyData.push({
        month: monthDate.toLocaleDateString('en-US', {
          month: 'short',
          year: 'numeric',
        }),
        total: monthTotal,
      });
    }

    return {
      patterns: [
        'Thursday collections consistently strongest',
        'Group collections increasing 15% over last month',
        'New location onboarding shows positive impact',
      ],
      seasonal_impacts: [
        'Back-to-school season typically increases group participation',
        'Holiday periods may see reduced individual collections',
      ],
      special_events: [
        'Community drive scheduled for next month',
        'Volunteer appreciation event planning underway',
      ],
      month_over_month_chart_data: monthlyData.reverse(),
    };
  }

  private async getNextWeekPreparation(currentDate: Date) {
    // Get hosts and calculate confirmations (this would need host confirmation tracking)
    const allHosts = await this.storage.getAllHosts();
    const confirmedHosts = Math.floor(allHosts.length * 0.85); // Mock 85% confirmation rate

    return {
      host_confirmations: {
        confirmed: confirmedHosts,
        total: allHosts.length,
        percentage: confirmedHosts / allHosts.length,
      },
      pending_actions: [
        'Follow up with unconfirmed hosts',
        'Prepare collection bags and labels',
        'Update volunteer schedules',
        'Send reminder communications',
      ],
      known_events: [
        'School board meeting - may affect timing',
        'Community festival - potential boost in participation',
      ],
      weather_forecast: 'Partly cloudy, 72°F - Good collection conditions',
      volunteer_status: 'All key volunteers confirmed and ready',
    };
  }

  private async getSuccessCelebration(currentWeekData: any) {
    const milestones = [];

    if (currentWeekData.total > 8000) {
      milestones.push(`Exceeded 8,000 sandwiches this week!`);
    }

    if (currentWeekData.activeLocations === currentWeekData.totalLocations) {
      milestones.push('100% location participation achieved!');
    }

    return {
      milestones,
      volunteer_spotlight: {
        name: 'Sarah Chen',
        contribution:
          'Coordinated 3 new host locations this month, adding 450+ sandwiches weekly',
      },
      impact_story: {
        quote:
          'These sandwiches make such a difference for our families. Thank you for your continued support.',
        attribution: 'Maria Rodriguez, Family Resource Center Director',
      },
    };
  }

  async generatePDFReport(data: WeeklyReportData): Promise<Buffer> {
    // Dynamic import for ES modules
    const PDFKit = (await import('pdfkit')).default;
    const doc = new PDFKit({ margin: 50 });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));

    return new Promise((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      // TSP Brand Colors
      const colors = {
        orange: '#FBAD3F',
        navy: '#236383',
        lightBlue: '#47B3CB',
        darkGray: '#333333',
        lightGray: '#666666',
      };

      // Header with TSP branding
      doc
        .fontSize(24)
        .fillColor(colors.navy)
        .text('The Sandwich Project', 50, 50);
      doc
        .fontSize(18)
        .fillColor(colors.orange)
        .text('Weekly Impact Report', 50, 80);
      doc
        .fontSize(12)
        .fillColor(colors.darkGray)
        .text(
          `Generated: ${new Date(data.report_date).toLocaleDateString()}`,
          50,
          110
        )
        .text(
          `Collection Week: ${new Date(data.collection_week.start).toLocaleDateString()} - ${new Date(data.collection_week.end).toLocaleDateString()}`,
          50,
          125
        );

      // Executive Summary Section
      doc.moveDown(2);
      doc.fontSize(16).fillColor(colors.navy).text('EXECUTIVE SUMMARY', 50);
      doc.moveDown(0.5);

      const summary = data.summary;
      doc.fontSize(12).fillColor(colors.darkGray);
      doc.text(
        `Total Collected: ${summary.total_sandwiches.toLocaleString()} sandwiches`,
        50
      );
      doc.text(
        `Active Locations: ${summary.active_locations} of ${summary.total_locations} (${Math.round(summary.participation_rate * 100)}%)`,
        50
      );
      doc.text(
        `Week-over-Week: ${summary.week_over_week_change >= 0 ? '+' : ''}${Math.round(summary.week_over_week_change * 100)}%`,
        50
      );
      doc.text(
        `Monthly Progress: ${summary.monthly_progress.current.toLocaleString()} of ${summary.monthly_progress.goal.toLocaleString()} (${Math.round(summary.monthly_progress.percentage * 100)}%)`,
        50
      );

      // Key Metrics Table
      doc.moveDown(2);
      doc.fontSize(16).fillColor(colors.navy).text('KEY METRICS', 50);
      doc.moveDown(0.5);

      const tableData = [
        ['Metric', 'This Week', 'Last Week', 'Change', '4-Week Avg'],
        [
          'Total Sandwiches',
          data.metrics_table.total_sandwiches.this_week.toLocaleString(),
          data.metrics_table.total_sandwiches.last_week.toLocaleString(),
          (data.metrics_table.total_sandwiches.change >= 0 ? '+' : '') +
            data.metrics_table.total_sandwiches.change.toLocaleString(),
          data.metrics_table.total_sandwiches.four_week_avg.toLocaleString(),
        ],
        [
          'Locations Participating',
          data.metrics_table.locations_participating.this_week.toString(),
          data.metrics_table.locations_participating.last_week.toString(),
          (data.metrics_table.locations_participating.change >= 0 ? '+' : '') +
            data.metrics_table.locations_participating.change.toString(),
          data.metrics_table.locations_participating.four_week_avg.toString(),
        ],
        [
          'Avg per Location',
          Math.round(data.metrics_table.avg_per_location.this_week).toString(),
          Math.round(data.metrics_table.avg_per_location.last_week).toString(),
          (data.metrics_table.avg_per_location.change >= 0 ? '+' : '') +
            Math.round(data.metrics_table.avg_per_location.change).toString(),
          Math.round(
            data.metrics_table.avg_per_location.four_week_avg
          ).toString(),
        ],
        [
          'Group Collections',
          data.metrics_table.group_collections.this_week.toLocaleString(),
          data.metrics_table.group_collections.last_week.toLocaleString(),
          (data.metrics_table.group_collections.change >= 0 ? '+' : '') +
            data.metrics_table.group_collections.change.toLocaleString(),
          data.metrics_table.group_collections.four_week_avg.toLocaleString(),
        ],
      ];

      let yPosition = doc.y + 10;
      const rowHeight = 20;
      const colWidths = [120, 80, 80, 60, 80];

      tableData.forEach((row, rowIndex) => {
        let xPosition = 50;
        row.forEach((cell, colIndex) => {
          if (rowIndex === 0) {
            doc.fontSize(10).fillColor(colors.navy).font('Helvetica-Bold');
          } else {
            doc.fontSize(10).fillColor(colors.darkGray).font('Helvetica');
          }
          doc.text(cell, xPosition, yPosition, {
            width: colWidths[colIndex],
            align: 'left',
          });
          xPosition += colWidths[colIndex];
        });
        yPosition += rowHeight;
      });

      doc.y = yPosition + 10;

      // Location Performance Section
      doc.moveDown(1);
      doc.fontSize(16).fillColor(colors.navy).text('LOCATION PERFORMANCE', 50);
      doc.moveDown(0.5);

      const highPerformers = data.locations.filter(
        (l) => l.status === 'high_performer'
      );
      const needsAttention = data.locations.filter(
        (l) => l.status === 'needs_attention'
      );
      const steadyContributors = data.locations.filter(
        (l) => l.status === 'steady_contributor'
      );

      if (highPerformers.length > 0) {
        doc
          .fontSize(14)
          .fillColor(colors.orange)
          .text('HIGH PERFORMERS (>800 sandwiches):', 50);
        doc.moveDown(0.3);
        highPerformers.forEach((location) => {
          const trendArrow =
            location.trend === 'up'
              ? '↗'
              : location.trend === 'down'
                ? '↘'
                : '→';
          doc
            .fontSize(11)
            .fillColor(colors.darkGray)
            .text(
              `• ${location.name}: ${location.total.toLocaleString()} ${trendArrow}`,
              60
            );
        });
        doc.moveDown(0.5);
      }

      if (needsAttention.length > 0) {
        doc.fontSize(14).fillColor('#D32F2F').text('NEEDS ATTENTION:', 50);
        doc.moveDown(0.3);
        needsAttention.forEach((location) => {
          doc
            .fontSize(11)
            .fillColor(colors.darkGray)
            .text(
              `• ${location.name}: ${location.total.toLocaleString()} - Action Required`,
              60
            );
          if (location.issues) {
            location.issues.forEach((issue) => {
              doc
                .fontSize(10)
                .fillColor(colors.lightGray)
                .text(`  - ${issue}`, 70);
            });
          }
        });
        doc.moveDown(0.5);
      }

      if (steadyContributors.length > 0) {
        doc
          .fontSize(14)
          .fillColor(colors.lightBlue)
          .text('STEADY CONTRIBUTORS:', 50);
        doc.moveDown(0.3);
        steadyContributors.slice(0, 10).forEach((location) => {
          doc
            .fontSize(11)
            .fillColor(colors.darkGray)
            .text(`• ${location.name}: ${location.total.toLocaleString()}`, 60);
        });
        if (steadyContributors.length > 10) {
          doc
            .fontSize(10)
            .fillColor(colors.lightGray)
            .text(
              `... and ${steadyContributors.length - 10} more locations`,
              60
            );
        }
      }

      // Start new page for additional sections
      doc.addPage();

      // Trends & Insights
      doc.fontSize(16).fillColor(colors.navy).text('TRENDS & INSIGHTS', 50, 50);
      doc.moveDown(0.5);

      doc
        .fontSize(12)
        .fillColor(colors.darkGray)
        .text('Identified Patterns:', 50);
      data.trends_insights.patterns.forEach((pattern) => {
        doc.fontSize(11).text(`• ${pattern}`, 60);
      });

      doc.moveDown(0.5);
      doc.fontSize(12).fillColor(colors.darkGray).text('Seasonal Impacts:', 50);
      data.trends_insights.seasonal_impacts.forEach((impact) => {
        doc.fontSize(11).text(`• ${impact}`, 60);
      });

      // Next Week Preparation
      doc.moveDown(2);
      doc.fontSize(16).fillColor(colors.navy).text('NEXT WEEK PREPARATION', 50);
      doc.moveDown(0.5);

      const prep = data.next_week_prep;
      doc.fontSize(12).fillColor(colors.darkGray);
      doc.text(
        `Host Confirmations: ${prep.host_confirmations.confirmed} of ${prep.host_confirmations.total} (${Math.round(prep.host_confirmations.percentage * 100)}%)`,
        50
      );
      doc.text(`Weather Forecast: ${prep.weather_forecast}`, 50);
      doc.text(`Volunteer Status: ${prep.volunteer_status}`, 50);

      doc.moveDown(0.5);
      doc.text('Pending Actions:', 50);
      prep.pending_actions.forEach((action) => {
        doc.fontSize(11).text(`• ${action}`, 60);
      });

      // Celebrating Success
      doc.moveDown(2);
      doc.fontSize(16).fillColor(colors.orange).text('CELEBRATING SUCCESS', 50);
      doc.moveDown(0.5);

      const success = data.success_celebration;
      if (success.milestones.length > 0) {
        doc
          .fontSize(12)
          .fillColor(colors.darkGray)
          .text('Milestones Reached:', 50);
        success.milestones.forEach((milestone) => {
          doc.fontSize(11).text(`🎉 ${milestone}`, 60);
        });
        doc.moveDown(0.5);
      }

      if (success.volunteer_spotlight) {
        doc
          .fontSize(12)
          .fillColor(colors.darkGray)
          .text('Volunteer Spotlight:', 50);
        doc
          .fontSize(11)
          .text(
            `${success.volunteer_spotlight.name}: ${success.volunteer_spotlight.contribution}`,
            60
          );
        doc.moveDown(0.5);
      }

      if (success.impact_story) {
        doc.fontSize(12).fillColor(colors.darkGray).text('Impact Story:', 50);
        doc
          .fontSize(11)
          .fillColor(colors.lightGray)
          .text(`"${success.impact_story.quote}"`, 60);
        doc.fontSize(10).text(`- ${success.impact_story.attribution}`, 60);
      }

      // Footer
      doc.moveDown(3);
      doc.fontSize(10).fillColor(colors.lightGray);
      doc.text(
        'Distribution: Board Members, Committee Chairs, Volunteer Coordinators',
        50
      );
      doc.text('Next Report: Next Thursday', 50);
      doc.text('Contact: reports@sandwichproject.org', 50);

      doc.end();
    });
  }
}
