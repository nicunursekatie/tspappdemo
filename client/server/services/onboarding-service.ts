import { db } from '../db';
import { onboardingChallenges, onboardingProgress } from '@shared/schema';
import { eq, and, sql, desc } from 'drizzle-orm';
import { logger } from '../utils/production-safe-logger';

export interface ChallengeWithProgress {
  id: number;
  actionKey: string;
  title: string;
  description: string | null;
  category: string;
  points: number;
  icon: string | null;
  order: number;
  isCompleted: boolean;
  completedAt: Date | null;
}

export interface UserStats {
  totalPoints: number;
  completedChallenges: number;
  totalChallenges: number;
  completionPercentage: number;
}

export interface LeaderboardEntry {
  userId: string;
  userName: string;
  totalPoints: number;
  completedChallenges: number;
  rank: number;
}

export interface ChallengeCompletion {
  challengeId: number;
  challengeTitle: string;
  points: number;
  completedAt: Date;
  kudosSent: boolean;
}

export interface UserProgress {
  userId: string;
  userName: string;
  email: string;
  role: string;
  totalPoints: number;
  completedChallenges: number;
  completions: ChallengeCompletion[];
}

export class OnboardingService {
  /**
   * Get all challenges with user's progress
   */
  async getChallengesForUser(userId: string): Promise<ChallengeWithProgress[]> {
    const challenges = await db
      .select({
        id: onboardingChallenges.id,
        actionKey: onboardingChallenges.actionKey,
        title: onboardingChallenges.title,
        description: onboardingChallenges.description,
        category: onboardingChallenges.category,
        points: onboardingChallenges.points,
        icon: onboardingChallenges.icon,
        order: onboardingChallenges.order,
        completedAt: onboardingProgress.completedAt,
      })
      .from(onboardingChallenges)
      .leftJoin(
        onboardingProgress,
        and(
          eq(onboardingProgress.challengeId, onboardingChallenges.id),
          eq(onboardingProgress.userId, userId)
        )
      )
      .where(eq(onboardingChallenges.isActive, true))
      .orderBy(onboardingChallenges.order);

    return challenges.map((c) => ({
      ...c,
      isCompleted: !!c.completedAt,
    }));
  }

  /**
   * Track challenge completion
   */
  async trackChallengeCompletion(
    userId: string,
    actionKey: string,
    metadata?: Record<string, any>
  ): Promise<{ success: boolean; points?: number; message?: string }> {
    try {
      // Find the challenge
      const challenge = await db
        .select()
        .from(onboardingChallenges)
        .where(
          and(
            eq(onboardingChallenges.actionKey, actionKey),
            eq(onboardingChallenges.isActive, true)
          )
        )
        .limit(1);

      if (challenge.length === 0) {
        return { success: false, message: 'Challenge not found' };
      }

      const challengeData = challenge[0];

      // Check if already completed
      const existing = await db
        .select()
        .from(onboardingProgress)
        .where(
          and(
            eq(onboardingProgress.userId, userId),
            eq(onboardingProgress.challengeId, challengeData.id)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        return {
          success: false,
          message: 'Challenge already completed',
        };
      }

      // Record completion
      await db.insert(onboardingProgress).values({
        userId,
        challengeId: challengeData.id,
        metadata: metadata || {},
      });

      return {
        success: true,
        points: challengeData.points,
        message: `Completed: ${challengeData.title}`,
      };
    } catch (error) {
      logger.error('Error tracking challenge completion:', error);
      return {
        success: false,
        message: 'Failed to track challenge completion',
      };
    }
  }

  /**
   * Get user stats
   */
  async getUserStats(userId: string): Promise<UserStats> {
    const [completed, total] = await Promise.all([
      db
        .select({
          count: sql<number>`count(*)::int`,
          points: sql<number>`coalesce(sum(${onboardingChallenges.points}), 0)::int`,
        })
        .from(onboardingProgress)
        .innerJoin(
          onboardingChallenges,
          eq(onboardingProgress.challengeId, onboardingChallenges.id)
        )
        .where(eq(onboardingProgress.userId, userId)),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(onboardingChallenges)
        .where(eq(onboardingChallenges.isActive, true)),
    ]);

    const completedCount = completed[0]?.count || 0;
    const totalCount = total[0]?.count || 0;
    const totalPoints = completed[0]?.points || 0;

    return {
      totalPoints,
      completedChallenges: completedCount,
      totalChallenges: totalCount,
      completionPercentage:
        totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0,
    };
  }

  /**
   * Get leaderboard - includes all active users, even those with 0 points
   */
  async getLeaderboard(limit: number = 50): Promise<LeaderboardEntry[]> {
    const { users } = await import('@shared/schema');

    // First get all active users
    const allUsers = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(users)
      .where(eq(users.isActive, true));

    // Then get progress for each user
    const userProgress = await db
      .select({
        userId: onboardingProgress.userId,
        totalPoints: sql<number>`sum(${onboardingChallenges.points})::int`,
        completedChallenges: sql<number>`count(${onboardingProgress.id})::int`,
      })
      .from(onboardingProgress)
      .innerJoin(
        onboardingChallenges,
        eq(onboardingProgress.challengeId, onboardingChallenges.id)
      )
      .groupBy(onboardingProgress.userId);

    // Create a map of user progress
    const progressMap = new Map(
      userProgress.map((p) => [
        p.userId,
        {
          totalPoints: p.totalPoints,
          completedChallenges: p.completedChallenges,
        },
      ])
    );

    // Combine users with their progress (0 if none)
    const leaderboardData = allUsers.map((user) => {
      const progress = progressMap.get(user.id) || {
        totalPoints: 0,
        completedChallenges: 0,
      };
      return {
        userId: user.id,
        userName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'User',
        totalPoints: progress.totalPoints,
        completedChallenges: progress.completedChallenges,
      };
    });

    // Sort by points (desc) then by name
    leaderboardData.sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) {
        return b.totalPoints - a.totalPoints;
      }
      return a.userName.localeCompare(b.userName);
    });

    // Apply limit and add rank
    return leaderboardData.slice(0, limit).map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));
  }

  /**
   * Get all users with their onboarding challenge completion status (Admin only)
   */
  async getAllUsersProgress(): Promise<UserProgress[]> {
    const { users, kudosTracking } = await import('@shared/schema');

    // Get all active users
    const allUsers = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        role: users.role,
      })
      .from(users)
      .where(eq(users.isActive, true));

    // Get all progress records with challenge details
    const progressRecords = await db
      .select({
        userId: onboardingProgress.userId,
        challengeId: onboardingChallenges.id,
        challengeTitle: onboardingChallenges.title,
        points: onboardingChallenges.points,
        completedAt: onboardingProgress.completedAt,
      })
      .from(onboardingProgress)
      .innerJoin(
        onboardingChallenges,
        eq(onboardingProgress.challengeId, onboardingChallenges.id)
      )
      .where(eq(onboardingChallenges.isActive, true));

    // Get all kudos records for onboarding challenges
    const kudosRecords = await db
      .select({
        recipientId: kudosTracking.recipientId,
        contextId: kudosTracking.contextId,
      })
      .from(kudosTracking)
      .where(eq(kudosTracking.contextType, 'onboarding_challenge'));

    // Create a set for quick kudos lookup (recipientId:challengeId)
    const kudosSet = new Set(
      kudosRecords.map((k) => `${k.recipientId}:${k.contextId}`)
    );

    // Group progress by userId
    const progressByUser = new Map<string, any[]>();
    for (const record of progressRecords) {
      if (!progressByUser.has(record.userId)) {
        progressByUser.set(record.userId, []);
      }
      progressByUser.get(record.userId)!.push(record);
    }

    // Build the result for each user
    const result: UserProgress[] = allUsers.map((user) => {
      const userProgressRecords = progressByUser.get(user.id) || [];
      
      const completions: ChallengeCompletion[] = userProgressRecords.map((record) => ({
        challengeId: record.challengeId,
        challengeTitle: record.challengeTitle,
        points: record.points,
        completedAt: record.completedAt,
        kudosSent: kudosSet.has(`${user.id}:${record.challengeId}`),
      }));

      const totalPoints = userProgressRecords.reduce((sum, r) => sum + r.points, 0);

      return {
        userId: user.id,
        userName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'User',
        email: user.email || '',
        role: user.role || 'volunteer',
        totalPoints,
        completedChallenges: completions.length,
        completions,
      };
    });

    // Sort by totalPoints descending, then by userName
    result.sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) {
        return b.totalPoints - a.totalPoints;
      }
      return a.userName.localeCompare(b.userName);
    });

    return result;
  }

  /**
   * Initialize default challenges
   */
  async initializeDefaultChallenges(): Promise<void> {
    const defaultChallenges = [
      // Communication challenges
      {
        actionKey: 'chat_first_message',
        title: 'Send your first chat message',
        description: 'Join the conversation! Send a message in the team chat.',
        category: 'communication',
        points: 10,
        icon: 'MessageCircle',
        order: 1,
      },
      {
        actionKey: 'chat_read_messages',
        title: 'Read team messages',
        description: 'Stay informed! Check out messages in the team chat.',
        category: 'communication',
        points: 5,
        icon: 'Eye',
        order: 2,
      },
      {
        actionKey: 'inbox_send_email',
        title: 'Send an inbox message',
        description: 'Reach out to a team member through the inbox.',
        category: 'communication',
        points: 10,
        icon: 'Mail',
        order: 3,
      },

      // Resources & Documentation challenges
      {
        actionKey: 'view_resources',
        title: 'Explore Resources',
        description: 'Check out the Resources page to find important documents, templates, and tools.',
        category: 'documentation',
        points: 10,
        icon: 'FileText',
        order: 4,
      },
      {
        actionKey: 'view_quick_tools',
        title: 'Check out Quick Tools',
        description: 'Visit Quick Tools to find helpful links and resources for your work.',
        category: 'documentation',
        points: 10,
        icon: 'Link',
        order: 5,
      },
      {
        actionKey: 'view_wishlist',
        title: 'View Amazon Wishlist',
        description: 'Check out our Amazon Wishlist to see needed items.',
        category: 'documentation',
        points: 10,
        icon: 'Gift',
        order: 6,
      },

      // Team collaboration challenges
      {
        actionKey: 'view_holding_zone',
        title: 'Visit TSP Holding Zone',
        description: 'See what the team is working on! Check out the TSP Holding Zone.',
        category: 'team',
        points: 15,
        icon: 'StickyNote',
        order: 7,
      },
      {
        actionKey: 'post_holding_zone',
        title: 'Post to TSP Holding Zone',
        description: 'Share an update! Create a post (task, note, or idea) in the TSP Holding Zone.',
        category: 'team',
        points: 20,
        icon: 'PlusCircle',
        order: 8,
      },
      {
        actionKey: 'like_holding_zone_post',
        title: 'Like a post in Holding Zone',
        description: 'Show appreciation! Like a post in the TSP Holding Zone.',
        category: 'team',
        points: 5,
        icon: 'Heart',
        order: 9,
      },

      // Personal productivity challenges
      {
        actionKey: 'view_my_actions',
        title: 'Check My Actions Dashboard',
        description: 'Stay on top of your assignments! Visit My Actions to see your tasks.',
        category: 'productivity',
        points: 15,
        icon: 'ListTodo',
        order: 10,
      },
      {
        actionKey: 'set_availability',
        title: 'Set Your Availability',
        description: 'Let the team know when you\'re available! Update your availability.',
        category: 'productivity',
        points: 15,
        icon: 'Calendar',
        order: 11,
      },

      // Operations & Impact challenges
      {
        actionKey: 'submit_collection_log',
        title: 'Submit a Collection Log Entry',
        description: 'Record your impact! Submit a sandwich collection log entry.',
        category: 'operations',
        points: 25,
        icon: 'Sandwich',
        order: 12,
      },
      {
        actionKey: 'view_event_requests',
        title: 'View Event Requests',
        description: 'See upcoming events! Check the Event Requests page.',
        category: 'operations',
        points: 10,
        icon: 'Calendar',
        order: 13,
      },
      {
        actionKey: 'view_expenses',
        title: 'Explore Expenses & Receipts',
        description: 'Learn how to track expenses! Visit the Expenses & Receipts page.',
        category: 'operations',
        points: 10,
        icon: 'Receipt',
        order: 14,
      },

      // Strategic planning challenges
      {
        actionKey: 'view_projects',
        title: 'Explore Projects',
        description: 'See what projects are in the works! Visit the Projects page.',
        category: 'strategic',
        points: 10,
        icon: 'Briefcase',
        order: 15,
      },
      {
        actionKey: 'view_meetings',
        title: 'Check Meeting Notes',
        description: 'Stay in the loop! Review the Meetings page to see notes and agendas.',
        category: 'strategic',
        points: 10,
        icon: 'Calendar',
        order: 16,
      },
    ];

    // Insert challenges if they don't exist
    for (const challenge of defaultChallenges) {
      const existing = await db
        .select()
        .from(onboardingChallenges)
        .where(eq(onboardingChallenges.actionKey, challenge.actionKey))
        .limit(1);

      if (existing.length === 0) {
        await db.insert(onboardingChallenges).values(challenge);
      }
    }

    logger.log('✅ Default onboarding challenges initialized');
  }
}

export const onboardingService = new OnboardingService();
