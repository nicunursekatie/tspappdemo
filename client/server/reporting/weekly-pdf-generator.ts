import { format } from 'date-fns';

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
  location_performance: any;
  trends_insights: any;
  next_week_prep: any;
  celebrating_success: any;
}

export class WeeklyPDFGenerator {
  static async generatePDF(data: WeeklyReportData): Promise<Buffer> {
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
        white: '#FFFFFF',
      };

      let yPosition = 50;

      // HEADER WITH TSP BRANDING
      doc
        .fontSize(24)
        .fillColor(colors.navy)
        .text('The Sandwich Project', 50, yPosition);
      doc
        .fontSize(18)
        .fillColor(colors.orange)
        .text('Weekly Impact Report', 50, yPosition + 30);

      // Report period
      const weekStart = format(new Date(data.collection_week.start), 'MMM dd');
      const weekEnd = format(
        new Date(data.collection_week.end),
        'MMM dd, yyyy'
      );
      doc
        .fontSize(12)
        .fillColor(colors.darkGray)
        .text(`Collection Week: ${weekStart} - ${weekEnd}`, 50, yPosition + 60)
        .text(
          `Generated: ${format(new Date(data.report_date), 'MMM dd, yyyy')}`,
          50,
          yPosition + 75
        );

      yPosition += 110;

      // 1. EXECUTIVE SUMMARY SECTION
      doc
        .fontSize(16)
        .fillColor(colors.navy)
        .text('EXECUTIVE SUMMARY', 50, yPosition);
      yPosition += 25;

      // Summary box with background
      doc
        .rect(50, yPosition, 500, 80)
        .fillAndStroke(colors.lightBlue, colors.navy);
      doc.fontSize(14).fillColor(colors.white);

      const summary = data.summary;
      doc.text(
        `Total Collected: ${summary.total_sandwiches.toLocaleString()} sandwiches`,
        60,
        yPosition + 10
      );
      doc.text(
        `Active Locations: ${summary.active_locations} of ${
          summary.total_locations
        } (${Math.round(summary.participation_rate * 100)}%)`,
        60,
        yPosition + 30
      );
      doc.text(
        `Week-over-Week: ${
          summary.week_over_week_change >= 0 ? '+' : ''
        }${Math.round(summary.week_over_week_change * 100)}%`,
        60,
        yPosition + 50
      );
      doc.text(
        `Monthly Progress: ${summary.monthly_progress.current.toLocaleString()} of ${summary.monthly_progress.goal.toLocaleString()} (${Math.round(
          summary.monthly_progress.percentage * 100
        )}%)`,
        300,
        yPosition + 10
      );

      yPosition += 100;

      // 2. KEY METRICS TABLE
      doc
        .fontSize(16)
        .fillColor(colors.navy)
        .text('KEY METRICS', 50, yPosition);
      yPosition += 30;

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
          data.metrics_table.group_collections.this_week.toString(),
          data.metrics_table.group_collections.last_week.toString(),
          (data.metrics_table.group_collections.change >= 0 ? '+' : '') +
            data.metrics_table.group_collections.change.toString(),
          data.metrics_table.group_collections.four_week_avg.toString(),
        ],
      ];

      this.drawTable(doc, tableData, 50, yPosition, 500, colors);
      yPosition += 140;

      // 3. LOCATION PERFORMANCE SECTION
      if (yPosition > 650) {
        doc.addPage();
        yPosition = 50;
      }

      doc
        .fontSize(16)
        .fillColor(colors.navy)
        .text('LOCATION PERFORMANCE', 50, yPosition);
      yPosition += 25;

      // High Performers
      if (data.location_performance.high_performers.length > 0) {
        doc
          .fontSize(14)
          .fillColor(colors.orange)
          .text('HIGH PERFORMERS (>800 sandwiches):', 50, yPosition);
        yPosition += 20;

        data.location_performance.high_performers.forEach((location: any) => {
          const trendSymbol =
            location.trend === 'up'
              ? '↗'
              : location.trend === 'down'
                ? '↘'
                : '→';
          doc
            .fontSize(11)
            .fillColor(colors.darkGray)
            .text(
              `• ${
                location.name
              }: ${location.total.toLocaleString()} ${trendSymbol}`,
              60,
              yPosition
            );
          yPosition += 15;
        });
        yPosition += 10;
      }

      // Needs Attention
      if (data.location_performance.needs_attention.length > 0) {
        doc
          .fontSize(14)
          .fillColor('#CC0000')
          .text('NEEDS ATTENTION:', 50, yPosition);
        yPosition += 20;

        data.location_performance.needs_attention.forEach((location: any) => {
          doc
            .fontSize(11)
            .fillColor(colors.darkGray)
            .text(
              `• ${location.name}: ${location.total} sandwiches`,
              60,
              yPosition
            );
          if (location.issues.length > 0) {
            doc.text(
              `  Issues: ${location.issues.join(', ')}`,
              70,
              yPosition + 12
            );
            yPosition += 12;
          }
          yPosition += 15;
        });
        yPosition += 10;
      }

      // Steady Contributors
      if (data.location_performance.steady_contributors.length > 0) {
        doc
          .fontSize(14)
          .fillColor(colors.lightBlue)
          .text('STEADY CONTRIBUTORS:', 50, yPosition);
        yPosition += 20;

        const contributors =
          data.location_performance.steady_contributors.slice(0, 10); // Limit for space
        contributors.forEach((location: any) => {
          doc
            .fontSize(10)
            .fillColor(colors.darkGray)
            .text(
              `• ${location.name}: ${location.total.toLocaleString()}`,
              60,
              yPosition
            );
          yPosition += 12;
        });

        if (data.location_performance.steady_contributors.length > 10) {
          doc.text(
            `... and ${
              data.location_performance.steady_contributors.length - 10
            } more locations`,
            60,
            yPosition
          );
          yPosition += 12;
        }
      }

      yPosition += 20;

      // 4. NEXT WEEK PREPARATION
      if (yPosition > 600) {
        doc.addPage();
        yPosition = 50;
      }

      doc
        .fontSize(16)
        .fillColor(colors.navy)
        .text('NEXT WEEK PREPARATION', 50, yPosition);
      yPosition += 25;

      // Host Confirmations
      const confirmations = data.next_week_prep.host_confirmations;
      doc
        .fontSize(12)
        .fillColor(colors.darkGray)
        .text(
          `Host Confirmations: ${confirmations.confirmed} of ${
            confirmations.total
          } confirmed (${Math.round(confirmations.percentage * 100)}%)`,
          50,
          yPosition
        );
      yPosition += 20;

      // Pending Actions
      doc
        .fontSize(12)
        .fillColor(colors.orange)
        .text('Before Wednesday:', 50, yPosition);
      yPosition += 15;
      data.next_week_prep.pending_actions
        .slice(0, 4)
        .forEach((action: string) => {
          doc
            .fontSize(10)
            .fillColor(colors.darkGray)
            .text(`• ${action}`, 60, yPosition);
          yPosition += 12;
        });

      yPosition += 15;

      // Collection Day Prep
      doc
        .fontSize(12)
        .fillColor(colors.orange)
        .text('Collection Day Prep:', 50, yPosition);
      yPosition += 15;
      doc
        .fontSize(10)
        .fillColor(colors.darkGray)
        .text(
          `Weather: ${data.next_week_prep.collection_day_prep.weather_forecast}`,
          60,
          yPosition
        )
        .text(
          `Volunteer Status: ${data.next_week_prep.collection_day_prep.volunteer_status}`,
          60,
          yPosition + 12
        );
      yPosition += 35;

      // 5. CELEBRATING SUCCESS
      doc
        .fontSize(16)
        .fillColor(colors.navy)
        .text('CELEBRATING SUCCESS', 50, yPosition);
      yPosition += 25;

      if (data.celebrating_success.milestones.length > 0) {
        doc
          .fontSize(12)
          .fillColor(colors.orange)
          .text('Milestones Reached:', 50, yPosition);
        yPosition += 15;
        data.celebrating_success.milestones.forEach((milestone: string) => {
          doc
            .fontSize(10)
            .fillColor(colors.darkGray)
            .text(`🎉 ${milestone}`, 60, yPosition);
          yPosition += 12;
        });
        yPosition += 10;
      }

      if (data.celebrating_success.volunteer_spotlight) {
        doc
          .fontSize(12)
          .fillColor(colors.orange)
          .text('Volunteer Spotlight:', 50, yPosition);
        yPosition += 15;
        doc
          .fontSize(10)
          .fillColor(colors.darkGray)
          .text(
            `${data.celebrating_success.volunteer_spotlight.name}`,
            60,
            yPosition
          )
          .text(
            `${data.celebrating_success.volunteer_spotlight.contribution}`,
            60,
            yPosition + 12
          );
        yPosition += 25;
      }

      if (data.celebrating_success.impact_story) {
        doc
          .fontSize(12)
          .fillColor(colors.orange)
          .text('Impact Story:', 50, yPosition);
        yPosition += 15;
        doc
          .fontSize(10)
          .fillColor(colors.darkGray)
          .text(
            `"${data.celebrating_success.impact_story.quote}"`,
            60,
            yPosition,
            { width: 450 }
          );
        yPosition += 25;
        doc.text(
          `${data.celebrating_success.impact_story.attribution}`,
          60,
          yPosition
        );
      }

      // Footer
      doc
        .fontSize(8)
        .fillColor(colors.lightGray)
        .text('Generated by The Sandwich Project Management System', 50, 750)
        .text(
          `Next report: ${format(
            new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            'MMM dd, yyyy'
          )}`,
          400,
          750
        );

      doc.end();
    });
  }

  private static drawTable(
    doc: any,
    data: string[][],
    x: number,
    y: number,
    width: number,
    colors: any
  ) {
    const colWidth = width / data[0].length;
    const rowHeight = 20;

    data.forEach((row, rowIndex) => {
      row.forEach((cell, colIndex) => {
        const cellX = x + colIndex * colWidth;
        const cellY = y + rowIndex * rowHeight;

        // Header row
        if (rowIndex === 0) {
          doc
            .rect(cellX, cellY, colWidth, rowHeight)
            .fillAndStroke(colors.navy, colors.navy);
          doc
            .fontSize(9)
            .fillColor(colors.white)
            .text(cell, cellX + 5, cellY + 6, { width: colWidth - 10 });
        } else {
          // Data rows
          doc.rect(cellX, cellY, colWidth, rowHeight).stroke(colors.lightGray);
          doc
            .fontSize(9)
            .fillColor(colors.darkGray)
            .text(cell, cellX + 5, cellY + 6, { width: colWidth - 10 });
        }
      });
    });
  }
}
