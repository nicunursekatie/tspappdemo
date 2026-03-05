import { db } from '../db';
import { organizations } from '../../shared/schema';
import { eq, isNull, or } from 'drizzle-orm';
import OpenAI from 'openai';

/**
 * Auto-categorize organizations using pattern matching + AI fallback
 * Run this with: npx tsx server/scripts/auto-categorize-organizations-with-ai.ts
 *
 * Requires OPENAI_API_KEY environment variable
 */

// Simple console logger for scripts (avoids Winston initialization issues)
const logger = {
  info: (...args: any[]) => console.log(...args),
  error: (...args: any[]) => console.error(...args),
};

// Import the pattern-based categorization logic from the main script
import { categorizeOrganization as patternCategorize } from './auto-categorize-organizations';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function categorizeWithAI(
  organizationName: string
): Promise<{
  category: string;
  schoolClassification?: string;
  isReligious: boolean;
} | null> {
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an organization categorization expert. Categorize organizations into these categories:
- school (with optional schoolClassification: public, private, or charter)
- church_faith (religious organizations)
- club (service clubs, scouts, youth groups)
- neighborhood (HOAs, community groups)
- large_corp (corporations, large businesses)
- small_medium_corp (small/medium businesses)
- other (doesn't fit above categories)

Also determine if the organization has religious affiliation (isReligious: true/false).

Respond ONLY with valid JSON in this exact format:
{"category": "school", "schoolClassification": "private", "isReligious": true}

Do not include any explanation or additional text.`,
        },
        {
          role: 'user',
          content: `Categorize this organization: "${organizationName}"`,
        },
      ],
      temperature: 0.1,
      max_tokens: 100,
    });

    const response = completion.choices[0]?.message?.content?.trim();
    if (!response) return null;

    const result = JSON.parse(response);
    return {
      category: result.category,
      schoolClassification: result.schoolClassification || undefined,
      isReligious: result.isReligious || false,
    };
  } catch (error) {
    logger.error(`AI categorization failed for "${organizationName}"`, error);
    return null;
  }
}

async function autoCategorizeOrganizations() {
  try {
    logger.info('Starting auto-categorization with AI fallback...');

    if (!process.env.OPENAI_API_KEY) {
      logger.error('OPENAI_API_KEY environment variable not set');
      process.exit(1);
    }

    // Get all organizations without a category
    const uncategorizedOrgs = await db
      .select()
      .from(organizations)
      .where(or(isNull(organizations.category), eq(organizations.category, '')));

    logger.info(
      `Found ${uncategorizedOrgs.length} organizations without a category`
    );

    let patternCount = 0;
    let aiCount = 0;
    let skippedCount = 0;

    for (const org of uncategorizedOrgs) {
      // First try pattern matching
      const patternResult = await patternCategorize(org.name);

      if (patternResult) {
        // Pattern match succeeded
        await db
          .update(organizations)
          .set({
            category: patternResult.category,
            schoolClassification: patternResult.schoolClassification,
            isReligious: patternResult.isReligious,
            updatedAt: new Date(),
          })
          .where(eq(organizations.id, org.id));

        logger.info(
          `✅ [PATTERN] "${org.name}" → "${patternResult.category}"${
            patternResult.schoolClassification
              ? ` (${patternResult.schoolClassification})`
              : ''
          }${patternResult.isReligious ? ' [RELIGIOUS]' : ''}`
        );
        patternCount++;
      } else {
        // Pattern matching failed, try AI
        logger.info(`🤖 [AI] Analyzing "${org.name}"...`);
        const aiResult = await categorizeWithAI(org.name);

        if (aiResult) {
          await db
            .update(organizations)
            .set({
              category: aiResult.category,
              schoolClassification: aiResult.schoolClassification,
              isReligious: aiResult.isReligious,
              updatedAt: new Date(),
            })
            .where(eq(organizations.id, org.id));

          logger.info(
            `✅ [AI] "${org.name}" → "${aiResult.category}"${
              aiResult.schoolClassification
                ? ` (${aiResult.schoolClassification})`
                : ''
            }${aiResult.isReligious ? ' [RELIGIOUS]' : ''}`
          );
          aiCount++;
        } else {
          logger.info(
            `⏭️  Skipped "${org.name}" - no match from patterns or AI`
          );
          skippedCount++;
        }
      }
    }

    logger.info('\n📊 Summary:');
    logger.info(`   Total organizations: ${uncategorizedOrgs.length}`);
    logger.info(`   ✅ Categorized by patterns: ${patternCount}`);
    logger.info(`   🤖 Categorized by AI: ${aiCount}`);
    logger.info(`   ⏭️  Skipped: ${skippedCount}`);
    logger.info(
      `   💰 Estimated cost: $${((aiCount * 0.0001).toFixed(4))} (at ~$0.0001/call)`
    );
    logger.info('\n✨ Auto-categorization complete!');

    process.exit(0);
  } catch (error) {
    logger.error('❌ Failed to auto-categorize organizations', error);
    process.exit(1);
  }
}

autoCategorizeOrganizations();
