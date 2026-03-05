import { db } from '../db';
import { featureFlags, users } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { logger } from '../utils/production-safe-logger';

export interface FeatureFlagCheck {
  enabled: boolean;
  reason?: string; // For debugging: why was this enabled/disabled
}

export class FeatureFlagService {
  /**
   * Check if a feature is enabled for a specific user
   * Checks in order: global enabled → user-specific → role-specific → percentage rollout
   */
  async isEnabled(
    flagName: string,
    userId?: string,
    userRole?: string
  ): Promise<boolean> {
    const result = await this.checkFlag(flagName, userId, userRole);
    return result.enabled;
  }

  /**
   * Check feature flag with detailed reason (for debugging)
   */
  async checkFlag(
    flagName: string,
    userId?: string,
    userRole?: string
  ): Promise<FeatureFlagCheck> {
    try {
      // Get the feature flag
      const flag = await db
        .select()
        .from(featureFlags)
        .where(eq(featureFlags.flagName, flagName))
        .limit(1);

      if (flag.length === 0) {
        // Flag doesn't exist - default to disabled
        return { enabled: false, reason: 'Flag not found' };
      }

      const flagData = flag[0];

      // Check if globally disabled
      if (!flagData.enabled) {
        return { enabled: false, reason: 'Globally disabled' };
      }

      // If no user context provided and flag is globally enabled, return true
      if (!userId) {
        return { enabled: true, reason: 'Globally enabled' };
      }

      // Check user-specific enablement
      const enabledForUsers = (flagData.enabledForUsers as string[]) || [];
      if (enabledForUsers.includes(userId)) {
        return { enabled: true, reason: `Enabled for user ${userId}` };
      }

      // Check role-specific enablement
      if (userRole) {
        const enabledForRoles = (flagData.enabledForRoles as string[]) || [];
        if (enabledForRoles.includes(userRole)) {
          return { enabled: true, reason: `Enabled for role ${userRole}` };
        }
      }

      // Check percentage rollout
      const percentage = flagData.enabledPercentage || 0;
      if (percentage > 0) {
        // Use consistent hash of userId to determine if user is in rollout percentage
        const hash = this.hashUserId(userId);
        const isInRollout = (hash % 100) < percentage;
        if (isInRollout) {
          return {
            enabled: true,
            reason: `Enabled by ${percentage}% rollout`,
          };
        }
      }

      // Not enabled for this user
      return { enabled: false, reason: 'Not enabled for this user' };
    } catch (error) {
      logger.error(`Error checking feature flag ${flagName}:`, error);
      // Fail closed - if we can't check, disable the feature
      return { enabled: false, reason: 'Error checking flag' };
    }
  }

  /**
   * Create or update a feature flag
   */
  async setFlag(
    flagName: string,
    options: {
      description?: string;
      enabled?: boolean;
      enabledForUsers?: string[];
      enabledForRoles?: string[];
      enabledPercentage?: number;
      metadata?: Record<string, any>;
      createdBy?: string;
    }
  ): Promise<void> {
    const existing = await db
      .select()
      .from(featureFlags)
      .where(eq(featureFlags.flagName, flagName))
      .limit(1);

    if (existing.length > 0) {
      // Update existing flag
      // Filter out undefined values to avoid nulling out existing data
      const updateData: any = { updatedAt: new Date() };
      if (options.description !== undefined) updateData.description = options.description;
      if (options.enabled !== undefined) updateData.enabled = options.enabled;
      if (options.enabledForUsers !== undefined) updateData.enabledForUsers = options.enabledForUsers;
      if (options.enabledForRoles !== undefined) updateData.enabledForRoles = options.enabledForRoles;
      if (options.enabledPercentage !== undefined) updateData.enabledPercentage = options.enabledPercentage;
      if (options.metadata !== undefined) updateData.metadata = options.metadata;

      await db
        .update(featureFlags)
        .set(updateData)
        .where(eq(featureFlags.flagName, flagName));

      logger.log(`Feature flag updated: ${flagName}`);
    } else {
      // Create new flag
      await db.insert(featureFlags).values({
        flagName,
        description: options.description || '',
        enabled: options.enabled ?? false,
        enabledForUsers: options.enabledForUsers || [],
        enabledForRoles: options.enabledForRoles || [],
        enabledPercentage: options.enabledPercentage || 0,
        metadata: options.metadata || {},
        createdBy: options.createdBy,
      });

      logger.log(`Feature flag created: ${flagName}`);
    }
  }

  /**
   * Enable a flag globally
   */
  async enableFlag(flagName: string): Promise<void> {
    await this.setFlag(flagName, { enabled: true });
  }

  /**
   * Disable a flag globally
   */
  async disableFlag(flagName: string): Promise<void> {
    await this.setFlag(flagName, { enabled: false });
  }

  /**
   * Enable a flag for specific users
   */
  async enableForUsers(flagName: string, userIds: string[]): Promise<void> {
    const existing = await db
      .select()
      .from(featureFlags)
      .where(eq(featureFlags.flagName, flagName))
      .limit(1);

    if (existing.length === 0) {
      throw new Error(`Feature flag ${flagName} not found`);
    }

    const currentUsers = (existing[0].enabledForUsers as string[]) || [];
    const updatedUsers = [...new Set([...currentUsers, ...userIds])];

    await db
      .update(featureFlags)
      .set({
        enabledForUsers: updatedUsers,
        updatedAt: new Date(),
      })
      .where(eq(featureFlags.flagName, flagName));

    logger.log(`Feature flag ${flagName} enabled for ${userIds.length} users`);
  }

  /**
   * Disable a flag for specific users
   */
  async disableForUsers(flagName: string, userIds: string[]): Promise<void> {
    const existing = await db
      .select()
      .from(featureFlags)
      .where(eq(featureFlags.flagName, flagName))
      .limit(1);

    if (existing.length === 0) {
      throw new Error(`Feature flag ${flagName} not found`);
    }

    const currentUsers = (existing[0].enabledForUsers as string[]) || [];
    const updatedUsers = currentUsers.filter((id) => !userIds.includes(id));

    await db
      .update(featureFlags)
      .set({
        enabledForUsers: updatedUsers,
        updatedAt: new Date(),
      })
      .where(eq(featureFlags.flagName, flagName));

    logger.log(
      `Feature flag ${flagName} disabled for ${userIds.length} users`
    );
  }

  /**
   * Enable a flag for specific roles
   */
  async enableForRoles(flagName: string, roles: string[]): Promise<void> {
    const existing = await db
      .select()
      .from(featureFlags)
      .where(eq(featureFlags.flagName, flagName))
      .limit(1);

    if (existing.length === 0) {
      throw new Error(`Feature flag ${flagName} not found`);
    }

    const currentRoles = (existing[0].enabledForRoles as string[]) || [];
    const updatedRoles = [...new Set([...currentRoles, ...roles])];

    await db
      .update(featureFlags)
      .set({
        enabledForRoles: updatedRoles,
        updatedAt: new Date(),
      })
      .where(eq(featureFlags.flagName, flagName));

    logger.log(`Feature flag ${flagName} enabled for roles: ${roles.join(', ')}`);
  }

  /**
   * Set percentage rollout (0-100)
   */
  async setPercentageRollout(
    flagName: string,
    percentage: number
  ): Promise<void> {
    if (percentage < 0 || percentage > 100) {
      throw new Error('Percentage must be between 0 and 100');
    }

    await db
      .update(featureFlags)
      .set({
        enabledPercentage: percentage,
        updatedAt: new Date(),
      })
      .where(eq(featureFlags.flagName, flagName));

    logger.log(`Feature flag ${flagName} set to ${percentage}% rollout`);
  }

  /**
   * Get all feature flags
   */
  async getAllFlags() {
    return await db.select().from(featureFlags);
  }

  /**
   * Get a specific flag details
   */
  async getFlag(flagName: string) {
    const result = await db
      .select()
      .from(featureFlags)
      .where(eq(featureFlags.flagName, flagName))
      .limit(1);

    return result[0] || null;
  }

  /**
   * Initialize default feature flags for the unified activities migration
   */
  async initializeUnifiedActivityFlags(): Promise<void> {
    const defaultFlags = [
      {
        flagName: 'unified-activities-schema',
        description: 'Phase 1: Activities table schema is created',
        enabled: false,
      },
      {
        flagName: 'unified-activities-read',
        description: 'Phase 2: Read operations from activities table',
        enabled: false,
      },
      {
        flagName: 'unified-activities-write',
        description: 'Phase 3: Write operations to activities table',
        enabled: false,
      },
      {
        flagName: 'unified-activities-migration',
        description: 'Phase 4: Historical data migration running',
        enabled: false,
      },
      {
        flagName: 'unified-activities-ui',
        description: 'Phase 5-6: Frontend thread UI components',
        enabled: false,
      },
      {
        flagName: 'unified-activities',
        description: 'Phase 7: Master toggle for complete unified system',
        enabled: false,
      },
    ];

    for (const flag of defaultFlags) {
      const existing = await db
        .select()
        .from(featureFlags)
        .where(eq(featureFlags.flagName, flag.flagName))
        .limit(1);

      if (existing.length === 0) {
        await db.insert(featureFlags).values(flag);
        logger.log(`✅ Feature flag initialized: ${flag.flagName}`);
      }
    }

    logger.log('✅ All unified activity feature flags initialized');
  }

  /**
   * Simple hash function for consistent user bucketing in percentage rollouts
   * Returns a number between 0-99
   */
  private hashUserId(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash) % 100;
  }
}

export const featureFlagService = new FeatureFlagService();
