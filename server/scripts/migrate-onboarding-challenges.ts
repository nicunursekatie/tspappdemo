import { db } from '../db';
import { onboardingChallenges } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { logger } from '../utils/production-safe-logger';

/**
 * Migration script to update onboarding challenge keys and categories
 *
 * This script:
 * 1. Updates outdated challenge action keys to match current app features
 * 2. Updates category names to new taxonomy
 * 3. Adds new challenges for features that were missing
 */

interface ChallengeUpdate {
  oldActionKey: string;
  newActionKey: string;
  newTitle?: string;
  newDescription?: string;
  newCategory?: string;
  newIcon?: string;
}

const challengeUpdates: ChallengeUpdate[] = [
  // Update "Important Documents" to "Resources"
  {
    oldActionKey: 'view_important_documents',
    newActionKey: 'view_resources',
    newTitle: 'Explore Resources',
    newDescription: 'Check out the Resources page to find important documents, templates, and tools.',
    newCategory: 'documentation',
    newIcon: 'FileText',
  },
  // Update "Important Links" to "Quick Tools"
  {
    oldActionKey: 'view_important_links',
    newActionKey: 'view_quick_tools',
    newTitle: 'Check out Quick Tools',
    newDescription: 'Visit Quick Tools to find helpful links and resources for your work.',
    newCategory: 'documentation',
    newIcon: 'Link',
  },
  // Update "Team Board" to "TSP Holding Zone" (view)
  {
    oldActionKey: 'view_team_board',
    newActionKey: 'view_holding_zone',
    newTitle: 'Visit TSP Holding Zone',
    newDescription: 'See what the team is working on! Check out the TSP Holding Zone.',
    newCategory: 'team',
    newIcon: 'StickyNote',
  },
  // Update "Team Board" to "TSP Holding Zone" (post)
  {
    oldActionKey: 'post_team_board',
    newActionKey: 'post_holding_zone',
    newTitle: 'Post to TSP Holding Zone',
    newDescription: 'Share an update! Create a post (task, note, or idea) in the TSP Holding Zone.',
    newCategory: 'team',
    newIcon: 'PlusCircle',
  },
  // Update "Team Board" to "TSP Holding Zone" (like)
  {
    oldActionKey: 'like_team_board_post',
    newActionKey: 'like_holding_zone_post',
    newTitle: 'Like a post in Holding Zone',
    newDescription: 'Show appreciation! Like a post in the TSP Holding Zone.',
    newCategory: 'team',
    newIcon: 'Heart',
  },
];

// Category updates for challenges that keep the same action key
const categoryUpdates: { actionKey: string; newCategory: string }[] = [
  { actionKey: 'submit_collection_log', newCategory: 'operations' },
  { actionKey: 'view_projects', newCategory: 'strategic' },
  { actionKey: 'view_meetings', newCategory: 'strategic' },
];

async function migrateOnboardingChallenges() {
  logger.log('🔄 Starting onboarding challenges migration...');

  try {
    // Step 1: Update existing challenges with new keys and data
    for (const update of challengeUpdates) {
      const existingChallenge = await db
        .select()
        .from(onboardingChallenges)
        .where(eq(onboardingChallenges.actionKey, update.oldActionKey))
        .limit(1);

      if (existingChallenge.length > 0) {
        logger.log(`  Updating challenge: ${update.oldActionKey} -> ${update.newActionKey}`);

        await db
          .update(onboardingChallenges)
          .set({
            actionKey: update.newActionKey,
            ...(update.newTitle && { title: update.newTitle }),
            ...(update.newDescription && { description: update.newDescription }),
            ...(update.newCategory && { category: update.newCategory }),
            ...(update.newIcon && { icon: update.newIcon }),
          })
          .where(eq(onboardingChallenges.actionKey, update.oldActionKey));

        logger.log(`  ✅ Updated: ${update.newActionKey}`);
      } else {
        logger.log(`  ⚠️  Challenge not found: ${update.oldActionKey} (skipping)`);
      }
    }

    // Step 2: Update categories for existing challenges
    for (const update of categoryUpdates) {
      const existingChallenge = await db
        .select()
        .from(onboardingChallenges)
        .where(eq(onboardingChallenges.actionKey, update.actionKey))
        .limit(1);

      if (existingChallenge.length > 0) {
        logger.log(`  Updating category for: ${update.actionKey} -> ${update.newCategory}`);

        await db
          .update(onboardingChallenges)
          .set({ category: update.newCategory })
          .where(eq(onboardingChallenges.actionKey, update.actionKey));

        logger.log(`  ✅ Updated category: ${update.actionKey}`);
      }
    }

    // Step 3: Add new challenges if they don't exist
    const newChallenges = [
      {
        actionKey: 'view_wishlist',
        title: 'View Amazon Wishlist',
        description: 'Check out our Amazon Wishlist to see needed items.',
        category: 'documentation',
        points: 10,
        icon: 'Gift',
        order: 6,
      },
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
        description: "Let the team know when you're available! Update your availability.",
        category: 'productivity',
        points: 15,
        icon: 'Calendar',
        order: 11,
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
    ];

    for (const challenge of newChallenges) {
      const existing = await db
        .select()
        .from(onboardingChallenges)
        .where(eq(onboardingChallenges.actionKey, challenge.actionKey))
        .limit(1);

      if (existing.length === 0) {
        logger.log(`  Adding new challenge: ${challenge.actionKey}`);
        await db.insert(onboardingChallenges).values(challenge);
        logger.log(`  ✅ Added: ${challenge.actionKey}`);
      } else {
        logger.log(`  ⚠️  Challenge already exists: ${challenge.actionKey} (skipping)`);
      }
    }

    logger.log('✅ Onboarding challenges migration completed successfully!');
    logger.log('');
    logger.log('Summary:');
    logger.log(`  - Updated ${challengeUpdates.length} challenge keys`);
    logger.log(`  - Updated ${categoryUpdates.length} challenge categories`);
    logger.log(`  - Added ${newChallenges.length} new challenges`);

  } catch (error) {
    logger.error('❌ Error during migration:', error);
    throw error;
  }
}

// Run the migration if this script is executed directly
if (require.main === module) {
  migrateOnboardingChallenges()
    .then(() => {
      logger.log('Migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Migration script failed:', error);
      process.exit(1);
    });
}

export { migrateOnboardingChallenges };
