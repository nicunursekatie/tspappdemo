import OpenAI from 'openai';
import { db } from '../../db';
import { organizations } from '../../../shared/schema';
import { eq, isNull, or, sql } from 'drizzle-orm';
import { logger } from '../../utils/production-safe-logger';
import { parseJsonStrict } from '../../utils/safe-json';

let openai: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
    throw new Error('AI_INTEGRATIONS_OPENAI_API_KEY environment variable is required');
  }

  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });
  }

  return openai;
}

export interface OrganizationCategorizationResult {
  category: string;
  schoolClassification?: string;
  isReligious: boolean;
  confidence: number;
  reasoning: string;
}

const religiousPatterns: RegExp[] = [
  /\bchurch\b/i,
  /\bchapel\b/i,
  /\bsynagogue\b/i,
  /\bmosque\b/i,
  /\btemple\b/i,
  /\bparish\b/i,
  /\bministry\b/i,
  /\bfellowship\b/i,
  /\bcongregation\b/i,
  /\bfaith\b/i,
  /\bbible\b/i,
  /\bchristian\b/i,
  /\bcatholic\b/i,
  /\bjewish\b/i,
  /\bislamic\b/i,
  /\bst\.?\s+[A-Z]/i,
  /\bsaint\s+[A-Z]/i,
  /\bholy\b/i,
  /\bgospel\b/i,
];

function checkReligiousAffiliation(name: string): boolean {
  return religiousPatterns.some(pattern => pattern.test(name));
}

function patternCategorize(name: string): OrganizationCategorizationResult | null {
  const nameLower = name.toLowerCase();
  const isReligious = checkReligiousAffiliation(name);

  if (/\b(elementary|middle|high)\s*school\b/i.test(name) ||
      /\bacademy\b/i.test(name) ||
      /\bpreschool\b/i.test(name) ||
      /\bkindergarten\b/i.test(name)) {
    
    let schoolClassification: string | undefined;
    if (/\bprivate\b/i.test(name) || /\bmontessori\b/i.test(name) || /\bparochial\b/i.test(name) || isReligious) {
      schoolClassification = 'private';
    } else if (/\bcharter\b/i.test(name)) {
      schoolClassification = 'charter';
    } else {
      schoolClassification = 'public';
    }
    
    return { category: 'school', schoolClassification, isReligious, confidence: 0.9, reasoning: 'Pattern match: school keywords' };
  }

  if (/\buniversity\b/i.test(name) || /\bcollege\b/i.test(name)) {
    return { category: 'school', schoolClassification: undefined, isReligious, confidence: 0.9, reasoning: 'Pattern match: university/college' };
  }

  if (/\bchurch\b/i.test(name) || /\bsynagogue\b/i.test(name) || /\bmosque\b/i.test(name) ||
      /\btemple\b/i.test(name) || /\bministry\b/i.test(name) || /\bcongregation\b/i.test(name)) {
    return { category: 'church_faith', isReligious: true, confidence: 0.95, reasoning: 'Pattern match: religious organization' };
  }

  if (/\brotary\b/i.test(name) || /\bkiwanis\b/i.test(name) || /\blions\s*club\b/i.test(name) ||
      /\bscouts?\b/i.test(name) || /\b4-?h\b/i.test(name) || /\bjunior\s*league\b/i.test(name)) {
    return { category: 'club', isReligious, confidence: 0.9, reasoning: 'Pattern match: service club/youth group' };
  }

  if (/\bhoa\b/i.test(name) || /\bhomeowners?\s*(association)?\b/i.test(name) ||
      /\bneighborhood\b/i.test(name) || /\bcommunity\s*(association|group|center)\b/i.test(name)) {
    return { category: 'neighborhood', isReligious, confidence: 0.85, reasoning: 'Pattern match: neighborhood/community group' };
  }

  if (/\b(inc|llc|corp|corporation|company|co\.)[\.\s]*$/i.test(name) ||
      /\benterprise/i.test(name) || /\bgroup\s*$/i.test(name)) {
    return { category: 'large_corp', isReligious, confidence: 0.8, reasoning: 'Pattern match: corporate entity' };
  }

  return null;
}

async function categorizeWithAI(organizationName: string): Promise<OrganizationCategorizationResult | null> {
  try {
    const client = getOpenAIClient();
    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an organization categorization expert. Categorize organizations into these categories:
- school (with optional schoolClassification: public, private, or charter)
- church_faith (religious organizations, churches, temples, mosques)
- club (service clubs, scouts, youth groups, fraternal organizations)
- neighborhood (HOAs, community groups, civic associations)
- large_corp (large corporations, enterprises)
- small_medium_corp (small/medium businesses, local shops)
- nonprofit (charitable organizations, foundations)
- government (government agencies, municipal departments)
- hospital (hospitals, medical centers, healthcare systems)
- other (doesn't fit above categories)

Also determine if the organization has religious affiliation (isReligious: true/false).

Return JSON in this exact format:
{"category": "school", "schoolClassification": "private", "isReligious": true, "confidence": 0.9, "reasoning": "Brief explanation"}`,
        },
        {
          role: 'user',
          content: `Categorize this organization: "${organizationName}"`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 200,
    });

    const response = completion.choices[0]?.message?.content?.trim();
    if (!response) return null;

    const result = parseJsonStrict<OrganizationCategorizationResult>(response);
    return {
      category: result.category || 'other',
      schoolClassification: result.schoolClassification,
      isReligious: result.isReligious || false,
      confidence: result.confidence || 0.7,
      reasoning: result.reasoning || 'AI categorization',
    };
  } catch (error) {
    logger.error('AI organization categorization failed', { organizationName, error });
    return null;
  }
}

export interface CategorizationProgress {
  total: number;
  processed: number;
  patternMatched: number;
  aiCategorized: number;
  skipped: number;
  errors: number;
}

export async function categorizeUncategorizedOrganizations(
  onProgress?: (progress: CategorizationProgress) => void
): Promise<CategorizationProgress> {
  const progress: CategorizationProgress = {
    total: 0,
    processed: 0,
    patternMatched: 0,
    aiCategorized: 0,
    skipped: 0,
    errors: 0,
  };

  try {
    const uncategorizedOrgs = await db
      .select()
      .from(organizations)
      .where(or(
        isNull(organizations.category),
        eq(organizations.category, ''),
        eq(organizations.category, 'other')
      ));

    progress.total = uncategorizedOrgs.length;
    logger.info(`Starting organization categorization: ${progress.total} organizations to process`);

    for (const org of uncategorizedOrgs) {
      try {
        const patternResult = patternCategorize(org.name);

        if (patternResult) {
          await db
            .update(organizations)
            .set({
              category: patternResult.category,
              schoolClassification: patternResult.schoolClassification,
              isReligious: patternResult.isReligious,
              updatedAt: new Date(),
            })
            .where(eq(organizations.id, org.id));

          progress.patternMatched++;
          logger.info(`[PATTERN] "${org.name}" → ${patternResult.category}`);
        } else {
          const aiResult = await categorizeWithAI(org.name);

          if (aiResult && aiResult.category !== 'other') {
            await db
              .update(organizations)
              .set({
                category: aiResult.category,
                schoolClassification: aiResult.schoolClassification,
                isReligious: aiResult.isReligious,
                updatedAt: new Date(),
              })
              .where(eq(organizations.id, org.id));

            progress.aiCategorized++;
            logger.info(`[AI] "${org.name}" → ${aiResult.category} (${aiResult.reasoning})`);
          } else {
            progress.skipped++;
            logger.info(`[SKIP] "${org.name}" - could not determine category`);
          }

          await new Promise(resolve => setTimeout(resolve, 100));
        }

        progress.processed++;
        if (onProgress) {
          onProgress(progress);
        }
      } catch (error) {
        progress.errors++;
        progress.processed++;
        logger.error(`Failed to categorize organization ${org.id}`, { error });
      }
    }

    logger.info('Organization categorization complete', progress);
    return progress;
  } catch (error) {
    logger.error('Organization categorization failed', { error });
    throw error;
  }
}

export async function categorizeOrganization(
  organizationId: number
): Promise<OrganizationCategorizationResult | null> {
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, organizationId));

  if (!org) {
    return null;
  }

  const patternResult = patternCategorize(org.name);
  if (patternResult) {
    await db
      .update(organizations)
      .set({
        category: patternResult.category,
        schoolClassification: patternResult.schoolClassification,
        isReligious: patternResult.isReligious,
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, organizationId));
    return patternResult;
  }

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
      .where(eq(organizations.id, organizationId));
    return aiResult;
  }

  return null;
}

/**
 * Categorize event requests that have 'other' or null/empty organizationCategory.
 * This looks at the event_requests table, not organizations table.
 */
export async function categorizeUncategorizedEventRequests(
  onProgress?: (progress: CategorizationProgress) => void
): Promise<CategorizationProgress> {
  const progress: CategorizationProgress = {
    total: 0,
    processed: 0,
    patternMatched: 0,
    aiCategorized: 0,
    skipped: 0,
    errors: 0,
  };

  try {
    // Import eventRequests schema
    const { eventRequests } = await import('../../../shared/schema');

    // Find event requests with uncategorized organizations
    const uncategorizedEvents = await db
      .select()
      .from(eventRequests)
      .where(or(
        isNull(eventRequests.organizationCategory),
        eq(eventRequests.organizationCategory, ''),
        eq(eventRequests.organizationCategory, 'other')
      ));

    progress.total = uncategorizedEvents.length;
    logger.info(`Starting event request categorization: ${progress.total} events to process`);

    for (const event of uncategorizedEvents) {
      try {
        const orgName = event.organizationName;
        if (!orgName) {
          progress.skipped++;
          progress.processed++;
          continue;
        }

        const patternResult = patternCategorize(orgName);

        if (patternResult) {
          await db
            .update(eventRequests)
            .set({
              organizationCategory: patternResult.category,
              updatedAt: new Date(),
            })
            .where(eq(eventRequests.id, event.id));

          progress.patternMatched++;
          logger.info(`[PATTERN] Event ${event.id} "${orgName}" → ${patternResult.category}`);
        } else {
          const aiResult = await categorizeWithAI(orgName);

          if (aiResult && aiResult.category !== 'other') {
            await db
              .update(eventRequests)
              .set({
                organizationCategory: aiResult.category,
                updatedAt: new Date(),
              })
              .where(eq(eventRequests.id, event.id));

            progress.aiCategorized++;
            logger.info(`[AI] Event ${event.id} "${orgName}" → ${aiResult.category} (${aiResult.reasoning})`);
          } else {
            progress.skipped++;
            logger.info(`[SKIP] Event ${event.id} "${orgName}" - could not determine category`);
          }

          // Rate limit AI calls
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        progress.processed++;
        if (onProgress) {
          onProgress(progress);
        }
      } catch (error) {
        progress.errors++;
        progress.processed++;
        logger.error(`Failed to categorize event ${event.id}`, { error });
      }
    }

    logger.info('Event request categorization complete', progress);
    return progress;
  } catch (error) {
    logger.error('Event request categorization failed', { error });
    throw error;
  }
}
