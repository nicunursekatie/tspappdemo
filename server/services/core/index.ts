import { QueryOptimizer } from '../../performance/query-optimizer';
import { checkWeeklySubmissions } from '../../weekly-monitoring';

/**
 * Core Service - Health checks and system monitoring
 */
export class CoreService {
  /**
   * Basic health check for deployment monitoring
   */
  static getBasicHealth() {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      dependencies: {
        googleCloudStorage: '@google-cloud/storage',
        database: process.env.DATABASE_URL ? 'connected' : 'not configured',
      },
    };
  }

  /**
   * System health check with performance stats (authenticated)
   */
  static getSystemHealth() {
    const stats = QueryOptimizer.getCacheStats();
    const memoryUsage = process.memoryUsage();

    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      cache: {
        size: stats.size,
        activeKeys: stats.keys.length,
      },
      memory: {
        used: Math.round(memoryUsage.heapUsed / 1024 / 1024) + 'MB',
        total: Math.round(memoryUsage.heapTotal / 1024 / 1024) + 'MB',
      },
      uptime: Math.round(process.uptime()) + 's',
    };
  }

  /**
   * Get weekly monitoring status
   * @param weeksAgo - Number of weeks to go back (0 = current week, 1 = last week, etc.)
   */
  static async getWeeklyMonitoringStatus(weeksAgo: number = 0) {
    const submissionStatus = await checkWeeklySubmissions(weeksAgo);
    return submissionStatus;
  }

  /**
   * Get monitoring statistics
   */
  static async getMonitoringStats() {
    const submissionStatus = await checkWeeklySubmissions();
    const now = new Date();
    const dayOfWeek = now.getDay();

    // Calculate next scheduled check
    let nextCheck = 'Thursday 7:00 PM';
    if (dayOfWeek === 4 && now.getHours() >= 19) {
      nextCheck = 'Friday 8:00 AM';
    } else if (dayOfWeek === 5 && now.getHours() >= 8) {
      nextCheck = 'Next Thursday 7:00 PM';
    }

    // Get current week range (Wednesday to Tuesday) to display proper week period
    const { getCurrentWeekRange } = await import('../../weekly-monitoring');
    const { startDate, endDate } = getCurrentWeekRange();

    // Format week display as "Wed Aug 14 - Tue Aug 20, 2025"
    const weekDisplay = `${startDate.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })} - ${endDate.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })}`;

    return {
      currentWeek: weekDisplay,
      totalExpectedLocations: submissionStatus.length,
      submittedLocations: submissionStatus.filter((s: any) => s.hasSubmitted)
        .length,
      missingLocations: submissionStatus.filter((s: any) => !s.hasSubmitted)
        .length,
      lastCheckTime: now.toLocaleString(),
      nextScheduledCheck: nextCheck,
    };
  }

  /**
   * Get project data status
   */
  static async getProjectDataStatus() {
    const fs = await import('fs/promises');
    const path = await import('path');

    const projectDataDir = path.join(process.cwd(), 'uploads', 'project-data');

    try {
      await fs.access(projectDataDir);
      const files = await fs.readdir(projectDataDir);

      if (files.length > 0) {
        // Get info about the newest file
        const filesWithStats = await Promise.all(
          files.map(async (file) => {
            const filePath = path.join(projectDataDir, file);
            const stats = await fs.stat(filePath);
            return {
              name: file,
              path: filePath,
              modified: stats.mtime,
              size: stats.size,
            };
          })
        );

        // Sort by modification time, newest first
        const sortedFiles = filesWithStats.sort(
          (a, b) => b.modified.getTime() - a.modified.getTime()
        );

        const newestFile = sortedFiles[0];

        return {
          status: 'available',
          totalFiles: files.length,
          newestFile: {
            name: newestFile.name,
            modified: newestFile.modified.toISOString(),
            size: newestFile.size,
          },
          allFiles: sortedFiles.map((f) => ({
            name: f.name,
            modified: f.modified.toISOString(),
            size: f.size,
          })),
        };
      } else {
        return {
          status: 'empty',
          message: 'Project data directory exists but contains no files',
        };
      }
    } catch (error) {
      return {
        status: 'not_found',
        message: 'Project data directory does not exist',
        error: (error as Error).message,
      };
    }
  }
}
