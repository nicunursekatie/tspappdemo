/**
 * Machine Learning Engine for Smart Notifications
 * 
 * Provides intelligent notification delivery through:
 * - Relevance scoring based on user behavior
 * - Optimal timing prediction using activity patterns
 * - Channel selection optimization
 * - Engagement prediction and personalization
 */

import { db } from '../../db';
import { 
  notifications, 
  notificationHistory, 
  userNotificationPatterns, 
  notificationPreferences,
  notificationAnalytics,
  userActivityLogs
} from '../../../shared/schema';
import { eq, and, desc, gte, sql, lte, avg, count } from 'drizzle-orm';
import logger from '../../utils/logger';

const mlLogger = logger.child({ service: 'ml-engine' });

export interface RelevanceScoreResult {
  score: number;
  factors: {
    userEngagement: number;
    contentRelevance: number;
    timingOptimality: number;
    channelPreference: number;
    frequencyBalance: number;
  };
  recommendedChannel: 'email' | 'sms' | 'in_app';
  recommendedDelay: number; // seconds to delay delivery for optimal timing
}

export interface UserBehaviorPattern {
  activeHours: number[];
  preferredChannels: Record<string, number>;
  averageResponseTime: number;
  engagementRate: number;
  optimalFrequency: number;
  lastActivity: Date | null;
}

export class MLNotificationEngine {
  
  /**
   * Calculate relevance score for a notification
   */
  async calculateRelevanceScore(
    userId: string,
    notificationType: string,
    content: string,
    metadata: any = {}
  ): Promise<RelevanceScoreResult> {
    try {
      mlLogger.info('Calculating relevance score', { userId, notificationType });

      const [
        userPattern,
        userPrefs,
        recentActivity,
        engagementHistory
      ] = await Promise.all([
        this.getUserBehaviorPattern(userId),
        this.getUserPreferences(userId, notificationType),
        this.getRecentUserActivity(userId),
        this.getEngagementHistory(userId, notificationType)
      ]);

      // Calculate individual factor scores (0-1)
      const userEngagement = this.calculateEngagementScore(engagementHistory);
      const contentRelevance = this.calculateContentRelevance(notificationType, metadata, userPrefs);
      const timingOptimality = this.calculateTimingScore(userPattern);
      const channelPreference = this.calculateChannelScore(userPattern, userPrefs);
      const frequencyBalance = this.calculateFrequencyScore(userId, notificationType);

      // Weighted final score
      const weights = {
        userEngagement: 0.3,
        contentRelevance: 0.25,
        timingOptimality: 0.2,
        channelPreference: 0.15,
        frequencyBalance: 0.1
      };

      const score = 
        userEngagement * weights.userEngagement +
        contentRelevance * weights.contentRelevance +
        timingOptimality * weights.timingOptimality +
        channelPreference * weights.channelPreference +
        frequencyBalance * weights.frequencyBalance;

      const recommendedChannel = this.selectOptimalChannel(userPattern, userPrefs);
      const recommendedDelay = this.calculateOptimalDelay(userPattern, timingOptimality);

      const result: RelevanceScoreResult = {
        score: Math.max(0, Math.min(1, score)),
        factors: {
          userEngagement,
          contentRelevance,
          timingOptimality,
          channelPreference,
          frequencyBalance
        },
        recommendedChannel,
        recommendedDelay
      };

      mlLogger.debug('Relevance score calculated', { userId, score: result.score, factors: result.factors });
      return result;

    } catch (error) {
      mlLogger.error('Error calculating relevance score', { error, userId, notificationType });
      // Return default moderate score on error
      return {
        score: 0.5,
        factors: {
          userEngagement: 0.5,
          contentRelevance: 0.5,
          timingOptimality: 0.5,
          channelPreference: 0.5,
          frequencyBalance: 0.5
        },
        recommendedChannel: 'in_app',
        recommendedDelay: 0
      };
    }
  }

  /**
   * Get comprehensive user behavior pattern
   */
  async getUserBehaviorPattern(userId: string): Promise<UserBehaviorPattern> {
    try {
      // Get existing pattern from database
      const existingPattern = await db
        .select()
        .from(userNotificationPatterns)
        .where(eq(userNotificationPatterns.userId, userId))
        .limit(1);

      if (existingPattern.length > 0) {
        const pattern = existingPattern[0];
        return {
          activeHours: pattern.activeHours as number[] || [],
          preferredChannels: pattern.preferredChannels as Record<string, number> || {},
          averageResponseTime: pattern.averageResponseTime || 3600,
          engagementRate: pattern.engagementRate || 0.5,
          optimalFrequency: pattern.optimalFrequency || 3,
          lastActivity: pattern.lastUpdated
        };
      }

      // Calculate pattern from activity logs and notification history
      const pattern = await this.analyzeUserBehavior(userId);
      
      // Save calculated pattern
      await this.saveUserPattern(userId, pattern);
      
      return pattern;

    } catch (error) {
      mlLogger.error('Error getting user behavior pattern', { error, userId });
      return this.getDefaultBehaviorPattern();
    }
  }

  /**
   * Analyze user behavior from historical data
   */
  private async analyzeUserBehavior(userId: string): Promise<UserBehaviorPattern> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [activityLogs, notificationHistory] = await Promise.all([
      db
        .select()
        .from(userActivityLogs)
        .where(and(
          eq(userActivityLogs.userId, userId),
          gte(userActivityLogs.createdAt, thirtyDaysAgo)
        ))
        .orderBy(desc(userActivityLogs.createdAt))
        .limit(1000),
      
      db
        .select()
        .from(notificationHistory)
        .where(and(
          eq(notificationHistory.userId, userId),
          gte(notificationHistory.deliveredAt, thirtyDaysAgo)
        ))
        .orderBy(desc(notificationHistory.deliveredAt))
        .limit(500)
    ]);

    // Analyze active hours
    const activeHours = this.extractActiveHours(activityLogs);
    
    // Analyze channel preferences
    const preferredChannels = this.extractChannelPreferences(notificationHistory);
    
    // Calculate engagement metrics
    const engagementRate = this.calculateEngagementRate(notificationHistory);
    const averageResponseTime = this.calculateAverageResponseTime(notificationHistory);
    
    // Determine optimal frequency
    const optimalFrequency = this.calculateOptimalFrequency(notificationHistory);

    return {
      activeHours,
      preferredChannels,
      averageResponseTime,
      engagementRate,
      optimalFrequency,
      lastActivity: activityLogs[0]?.createdAt || null
    };
  }

  /**
   * Extract active hours from user activity
   */
  private extractActiveHours(activityLogs: any[]): number[] {
    const hourCounts: Record<number, number> = {};
    
    activityLogs.forEach(log => {
      const hour = new Date(log.createdAt).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });

    // Find hours with above-average activity
    const avgActivity = Object.values(hourCounts).reduce((a, b) => a + b, 0) / 24;
    
    return Object.entries(hourCounts)
      .filter(([_, count]) => count > avgActivity * 0.7)
      .map(([hour, _]) => parseInt(hour))
      .sort((a, b) => a - b);
  }

  /**
   * Extract channel preferences from notification history
   */
  private extractChannelPreferences(history: any[]): Record<string, number> {
    const channelStats: Record<string, { sent: number; engaged: number }> = {};

    history.forEach(notif => {
      const channel = notif.channel || 'in_app';
      if (!channelStats[channel]) {
        channelStats[channel] = { sent: 0, engaged: 0 };
      }
      channelStats[channel].sent++;
      if (notif.openedAt || notif.clickedAt) {
        channelStats[channel].engaged++;
      }
    });

    // Calculate engagement rates per channel
    const preferences: Record<string, number> = {};
    Object.entries(channelStats).forEach(([channel, stats]) => {
      preferences[channel] = stats.sent > 0 ? stats.engaged / stats.sent : 0.5;
    });

    return preferences;
  }

  /**
   * Calculate overall engagement rate
   */
  private calculateEngagementRate(history: any[]): number {
    if (history.length === 0) return 0.5;
    
    const engaged = history.filter(h => h.openedAt || h.clickedAt).length;
    return engaged / history.length;
  }

  /**
   * Calculate average response time
   */
  private calculateAverageResponseTime(history: any[]): number {
    const responseTimes = history
      .filter(h => h.openedAt && h.deliveredAt)
      .map(h => {
        const delivered = new Date(h.deliveredAt).getTime();
        const opened = new Date(h.openedAt).getTime();
        return opened - delivered;
      });

    if (responseTimes.length === 0) return 3600000; // 1 hour default

    return responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length / 1000; // Convert to seconds
  }

  /**
   * Calculate optimal notification frequency
   */
  private calculateOptimalFrequency(history: any[]): number {
    // Group notifications by day and calculate engagement vs frequency
    const dailyStats: Record<string, { count: number; engaged: number }> = {};
    
    history.forEach(notif => {
      const day = new Date(notif.deliveredAt).toDateString();
      if (!dailyStats[day]) {
        dailyStats[day] = { count: 0, engaged: 0 };
      }
      dailyStats[day].count++;
      if (notif.openedAt || notif.clickedAt) {
        dailyStats[day].engaged++;
      }
    });

    // Find frequency that maximizes engagement rate
    const frequencyEngagement: Record<number, number[]> = {};
    Object.values(dailyStats).forEach(({ count, engaged }) => {
      const engagementRate = count > 0 ? engaged / count : 0;
      if (!frequencyEngagement[count]) {
        frequencyEngagement[count] = [];
      }
      frequencyEngagement[count].push(engagementRate);
    });

    let bestFrequency = 3;
    let bestRate = 0;

    Object.entries(frequencyEngagement).forEach(([freq, rates]) => {
      const avgRate = rates.reduce((a, b) => a + b, 0) / rates.length;
      if (avgRate > bestRate) {
        bestRate = avgRate;
        bestFrequency = parseInt(freq);
      }
    });

    return Math.max(1, Math.min(10, bestFrequency)); // Cap between 1-10 per day
  }

  /**
   * Save user behavior pattern to database
   */
  private async saveUserPattern(userId: string, pattern: UserBehaviorPattern): Promise<void> {
    try {
      await db
        .insert(userNotificationPatterns)
        .values({
          userId,
          activeHours: pattern.activeHours,
          preferredChannels: pattern.preferredChannels,
          averageResponseTime: pattern.averageResponseTime,
          engagementRate: pattern.engagementRate,
          optimalFrequency: pattern.optimalFrequency,
          lastUpdated: new Date()
        })
        .onConflictDoUpdate({
          target: userNotificationPatterns.userId,
          set: {
            activeHours: pattern.activeHours,
            preferredChannels: pattern.preferredChannels,
            averageResponseTime: pattern.averageResponseTime,
            engagementRate: pattern.engagementRate,
            optimalFrequency: pattern.optimalFrequency,
            lastUpdated: new Date()
          }
        });
    } catch (error) {
      mlLogger.error('Error saving user pattern', { error, userId });
    }
  }

  /**
   * Get user preferences for notification type
   */
  private async getUserPreferences(userId: string, notificationType: string): Promise<any> {
    try {
      const prefs = await db
        .select()
        .from(notificationPreferences)
        .where(and(
          eq(notificationPreferences.userId, userId),
          eq(notificationPreferences.type, notificationType)
        ))
        .limit(1);

      return prefs[0] || this.getDefaultPreferences();
    } catch (error) {
      mlLogger.error('Error getting user preferences', { error, userId, notificationType });
      return this.getDefaultPreferences();
    }
  }

  /**
   * Get recent user activity
   */
  private async getRecentUserActivity(userId: string): Promise<any[]> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    try {
      return await db
        .select()
        .from(userActivityLogs)
        .where(and(
          eq(userActivityLogs.userId, userId),
          gte(userActivityLogs.createdAt, oneDayAgo)
        ))
        .orderBy(desc(userActivityLogs.createdAt))
        .limit(100);
    } catch (error) {
      mlLogger.error('Error getting recent activity', { error, userId });
      return [];
    }
  }

  /**
   * Get engagement history for notification type
   */
  private async getEngagementHistory(userId: string, notificationType: string): Promise<any[]> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    try {
      return await db
        .select()
        .from(notificationHistory)
        .where(and(
          eq(notificationHistory.userId, userId),
          eq(notificationHistory.notificationType, notificationType),
          gte(notificationHistory.deliveredAt, sevenDaysAgo)
        ))
        .orderBy(desc(notificationHistory.deliveredAt))
        .limit(50);
    } catch (error) {
      mlLogger.error('Error getting engagement history', { error, userId, notificationType });
      return [];
    }
  }

  /**
   * Calculate individual scoring factors
   */
  private calculateEngagementScore(history: any[]): number {
    if (history.length === 0) return 0.5;
    
    const engagementRate = history.filter(h => h.openedAt || h.clickedAt).length / history.length;
    return Math.max(0, Math.min(1, engagementRate));
  }

  private calculateContentRelevance(notificationType: string, metadata: any, userPrefs: any): number {
    // Simple content relevance based on type and preferences
    const typeImportance = {
      urgent: 0.9,
      task_assignment: 0.8,
      project_update: 0.7,
      announcement: 0.6,
      reminder: 0.5,
      social: 0.4
    };

    const baseScore = typeImportance[notificationType as keyof typeof typeImportance] || 0.5;
    
    // Adjust based on user preferences
    const userTypePreference = userPrefs?.typePreferences?.[notificationType] || 0.5;
    
    return (baseScore + userTypePreference) / 2;
  }

  private calculateTimingScore(userPattern: UserBehaviorPattern): number {
    const currentHour = new Date().getHours();
    
    if (userPattern.activeHours.includes(currentHour)) {
      return 0.9;
    }
    
    // Check if within 2 hours of active time
    const nearActiveHour = userPattern.activeHours.some(hour => 
      Math.abs(hour - currentHour) <= 2 || 
      Math.abs(hour - currentHour) >= 22 // Handle day boundary
    );
    
    return nearActiveHour ? 0.6 : 0.3;
  }

  private calculateChannelScore(userPattern: UserBehaviorPattern, userPrefs: any): number {
    const channels = Object.keys(userPattern.preferredChannels);
    if (channels.length === 0) return 0.5;
    
    // Average of channel engagement rates
    const avgEngagement = Object.values(userPattern.preferredChannels).reduce((a, b) => (a as number) + (b as number), 0) / channels.length;
    return Math.max(0, Math.min(1, avgEngagement));
  }

  private async calculateFrequencyScore(userId: string, notificationType: string): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    try {
      // Count notifications sent today
      const todayCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(notificationHistory)
        .where(and(
          eq(notificationHistory.userId, userId),
          eq(notificationHistory.notificationType, notificationType),
          gte(notificationHistory.deliveredAt, today)
        ));

      const count = todayCount[0]?.count || 0;
      const userPattern = await this.getUserBehaviorPattern(userId);
      
      // Score decreases as we approach optimal frequency
      const ratio = count / userPattern.optimalFrequency;
      
      if (ratio < 0.5) return 1.0;
      if (ratio < 0.8) return 0.8;
      if (ratio < 1.0) return 0.6;
      if (ratio < 1.5) return 0.3;
      return 0.1;
      
    } catch (error) {
      mlLogger.error('Error calculating frequency score', { error, userId, notificationType });
      return 0.5;
    }
  }

  /**
   * Select optimal delivery channel
   */
  private selectOptimalChannel(userPattern: UserBehaviorPattern, userPrefs: any): 'email' | 'sms' | 'in_app' {
    const channels = userPattern.preferredChannels;
    
    if (Object.keys(channels).length === 0) {
      return 'in_app'; // Default fallback
    }
    
    // Find channel with highest engagement rate
    let bestChannel = 'in_app';
    let bestRate = 0;
    
    Object.entries(channels).forEach(([channel, rate]) => {
      if (rate > bestRate) {
        bestRate = rate;
        bestChannel = channel as 'email' | 'sms' | 'in_app';
      }
    });
    
    return bestChannel;
  }

  /**
   * Calculate optimal delivery delay
   */
  private calculateOptimalDelay(userPattern: UserBehaviorPattern, timingScore: number): number {
    if (timingScore > 0.8) {
      return 0; // Send immediately
    }
    
    const currentHour = new Date().getHours();
    const nextActiveHour = userPattern.activeHours.find(hour => hour > currentHour) || 
                           userPattern.activeHours[0] || 9; // Default to 9 AM
    
    const hoursToWait = nextActiveHour > currentHour ? 
      nextActiveHour - currentHour : 
      (24 - currentHour) + nextActiveHour;
    
    return Math.min(hoursToWait * 3600, 12 * 3600); // Max 12 hour delay
  }

  /**
   * Update user behavior pattern after notification interaction
   */
  async updateUserBehaviorFromInteraction(
    userId: string,
    notificationId: number,
    interactionType: 'opened' | 'clicked' | 'dismissed' | 'ignored',
    channel: string,
    responseTime?: number
  ): Promise<void> {
    try {
      mlLogger.info('Updating user behavior from interaction', { 
        userId, 
        notificationId, 
        interactionType, 
        channel 
      });

      // Get current pattern
      const pattern = await this.getUserBehaviorPattern(userId);
      
      // Update channel preferences based on interaction
      if (!pattern.preferredChannels[channel]) {
        pattern.preferredChannels[channel] = 0.5;
      }
      
      // Adjust channel preference based on interaction type
      const adjustments = {
        opened: 0.1,
        clicked: 0.2,
        dismissed: -0.1,
        ignored: -0.05
      };
      
      pattern.preferredChannels[channel] = Math.max(0, Math.min(1, 
        pattern.preferredChannels[channel] + adjustments[interactionType]
      ));
      
      // Update engagement rate
      const engagementBoost = ['opened', 'clicked'].includes(interactionType) ? 0.05 : -0.02;
      pattern.engagementRate = Math.max(0, Math.min(1, pattern.engagementRate + engagementBoost));
      
      // Update average response time if provided
      if (responseTime && ['opened', 'clicked'].includes(interactionType)) {
        pattern.averageResponseTime = (pattern.averageResponseTime * 0.8) + (responseTime * 0.2);
      }
      
      // Save updated pattern
      await this.saveUserPattern(userId, pattern);
      
    } catch (error) {
      mlLogger.error('Error updating user behavior from interaction', { 
        error, 
        userId, 
        notificationId, 
        interactionType 
      });
    }
  }

  /**
   * Default behavior pattern for new users
   */
  private getDefaultBehaviorPattern(): UserBehaviorPattern {
    return {
      activeHours: [9, 10, 11, 14, 15, 16, 17, 18], // Standard business hours
      preferredChannels: { in_app: 0.7, email: 0.5, sms: 0.3 },
      averageResponseTime: 3600, // 1 hour
      engagementRate: 0.5,
      optimalFrequency: 3,
      lastActivity: null
    };
  }

  /**
   * Default preferences for new users
   */
  private getDefaultPreferences(): any {
    return {
      enabledChannels: ['in_app', 'email'],
      quietHours: { start: 22, end: 8 },
      frequency: 'normal',
      typePreferences: {}
    };
  }
}

// Export singleton instance
export const mlEngine = new MLNotificationEngine();