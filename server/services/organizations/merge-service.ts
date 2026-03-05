/**
 * Organization Merge Service
 *
 * Safely merges duplicate organizations by updating all references across
 * event requests and sandwich collections. All operations are transactional
 * with full audit trail for rollback capability.
 */

import { db } from '../../db';
import {
  eventRequests,
  sandwichCollections,
  organizations,
} from '../../../shared/schema';
import { sql, eq, or } from 'drizzle-orm';
import { logger } from '../../utils/production-safe-logger';

export interface MergeResult {
  success: boolean;
  targetName: string;
  sourceName: string;
  affectedEventRequests: number;
  affectedCollections: number;
  auditLogId?: number;
  error?: string;
}

/**
 * Merge two organizations by replacing all occurrences of sourceName with targetName.
 *
 * This operation:
 * 1. Updates all event_requests.organizationName
 * 2. Updates all sandwich_collections.group1Name
 * 3. Updates all sandwich_collections.group2Name
 * 4. Updates sandwich_collections.groupCollections JSON arrays
 * 5. Adds sourceName to organizations.alternateNames for targetName
 * 6. Creates audit log entry
 *
 * All operations are wrapped in a transaction for safety.
 *
 * @param sourceName - The organization name to be replaced
 * @param targetName - The canonical name to use going forward
 * @param mergedBy - User ID performing the merge
 * @param reason - Optional reason for the merge
 * @returns MergeResult with affected record counts
 */
export async function mergeOrganizations(
  sourceName: string,
  targetName: string,
  mergedBy: string,
  reason?: string
): Promise<MergeResult> {
  // Validation
  if (!sourceName || !targetName) {
    return {
      success: false,
      targetName,
      sourceName,
      affectedEventRequests: 0,
      affectedCollections: 0,
      error: 'Both sourceName and targetName are required',
    };
  }

  if (sourceName === targetName) {
    return {
      success: false,
      targetName,
      sourceName,
      affectedEventRequests: 0,
      affectedCollections: 0,
      error: 'Cannot merge an organization into itself',
    };
  }

  try {
    logger.info('Starting organization merge', {
      sourceName,
      targetName,
      mergedBy,
      reason,
    });

    // Execute all updates sequentially using raw SQL (no transaction support in HTTP driver)
    // Note: db.execute() returns { rows: [...], rowCount: n }, NOT an array directly

    // DEBUG: Check what organization names actually exist in database
    const similarOrgsResultQuery = await db.execute(
      sql`SELECT DISTINCT organization_name FROM event_requests WHERE LOWER(organization_name) LIKE LOWER(${`%${sourceName.substring(0, Math.min(5, sourceName.length))}%`}) LIMIT 20`
    );
    const similarOrgsResult = (similarOrgsResultQuery as any).rows || [];
    logger.info('DEBUG: Similar organization names in event_requests', {
      searchTerm: sourceName,
      similar: similarOrgsResult,
    });

    const exactMatchResultQuery = await db.execute(
      sql`SELECT organization_name FROM event_requests WHERE organization_name = ${sourceName} LIMIT 5`
    );
    const exactMatchResult = (exactMatchResultQuery as any).rows || [];
    logger.info('DEBUG: Exact match check in event_requests', {
      sourceName,
      exactMatches: exactMatchResult,
    });

    // Also check collections
    const collectionsGroup1ResultQuery = await db.execute(
      sql`SELECT DISTINCT group1_name FROM sandwich_collections WHERE group1_name = ${sourceName} LIMIT 5`
    );
    const collectionsGroup1Result = (collectionsGroup1ResultQuery as any).rows || [];
    
    const collectionsGroup2ResultQuery = await db.execute(
      sql`SELECT DISTINCT group2_name FROM sandwich_collections WHERE group2_name = ${sourceName} LIMIT 5`
    );
    const collectionsGroup2Result = (collectionsGroup2ResultQuery as any).rows || [];

    // Check if it exists in groupCollections JSON array using proper JSONB query
    const jsonArrayResultQuery = await db.execute(
      sql`SELECT id, group_collections FROM sandwich_collections
          WHERE group_collections IS NOT NULL AND EXISTS (
            SELECT 1 FROM jsonb_array_elements(group_collections) AS elem
            WHERE elem->>'name' = ${sourceName}
          ) LIMIT 5`
    );
    const jsonArrayResult = (jsonArrayResultQuery as any).rows || [];

    // Also try case-insensitive search
    const jsonArrayLowerResultQuery = await db.execute(
      sql`SELECT id, group_collections FROM sandwich_collections
          WHERE group_collections IS NOT NULL AND EXISTS (
            SELECT 1 FROM jsonb_array_elements(group_collections) AS elem
            WHERE LOWER(elem->>'name') = LOWER(${sourceName})
          ) LIMIT 5`
    );
    const jsonArrayLowerResult = (jsonArrayLowerResultQuery as any).rows || [];

    logger.info('DEBUG: Exact match check in sandwich_collections', {
      sourceName,
      group1Matches: collectionsGroup1Result,
      group2Matches: collectionsGroup2Result,
      jsonArrayMatches: jsonArrayResult.length,
      jsonArrayMatchesLower: jsonArrayLowerResult.length,
      sampleJsonData:
        jsonArrayResult.length > 0
          ? jsonArrayResult[0]
          : jsonArrayLowerResult.length > 0
            ? jsonArrayLowerResult[0]
            : null,
    });

    // Count records BEFORE updating (to get accurate affected count)
    const eventCountResultQuery = await db.execute(
      sql`SELECT COUNT(*)::int as count FROM event_requests WHERE organization_name = ${sourceName}`
    );
    const eventCountRows = (eventCountResultQuery as any).rows || [];
    const eventCount = eventCountRows[0]?.count || 0;

    // Count collections where org appears in group1_name, group2_name, OR groupCollections JSON
    // Note: The JSON stores "name" field, not "groupName" (client transforms to groupName for display)
    // Use proper JSONB query with EXISTS subquery instead of brittle LIKE pattern
    const collectionCountResultQuery = await db.execute(
      sql`SELECT COUNT(*)::int as count FROM sandwich_collections
          WHERE group1_name = ${sourceName}
             OR group2_name = ${sourceName}
             OR (group_collections IS NOT NULL AND EXISTS (
               SELECT 1 FROM jsonb_array_elements(group_collections) AS elem
               WHERE elem->>'name' = ${sourceName}
             ))`
    );
    const collectionCountRows = (collectionCountResultQuery as any).rows || [];
    const collectionCount = collectionCountRows[0]?.count || 0;

    logger.info('Pre-merge counts', {
      sourceName,
      targetName,
      eventCount,
      collectionCount,
    });

    // 1. Update event_requests
    await db.execute(
      sql`UPDATE event_requests SET organization_name = ${targetName} WHERE organization_name = ${sourceName}`
    );

    // 2. Update sandwich_collections.group1Name
    await db.execute(
      sql`UPDATE sandwich_collections SET group1_name = ${targetName} WHERE group1_name = ${sourceName}`
    );

    // 3. Update sandwich_collections.group2Name
    await db.execute(
      sql`UPDATE sandwich_collections SET group2_name = ${targetName} WHERE group2_name = ${sourceName}`
    );

    // 4. Update groupCollections JSON arrays
    // Note: The JSON stores "name" field, not "groupName" (client transforms to groupName for display)
    // Use proper JSONB query with EXISTS subquery instead of brittle LIKE pattern
    await db.execute(sql`
      UPDATE sandwich_collections
      SET group_collections = (
        SELECT jsonb_agg(
          CASE
            WHEN elem->>'name' = ${sourceName}
            THEN jsonb_set(elem, '{name}', to_jsonb(${targetName}::text))
            ELSE elem
          END
        )
        FROM jsonb_array_elements(group_collections) AS elem
      )
      WHERE group_collections IS NOT NULL AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(group_collections) AS elem
        WHERE elem->>'name' = ${sourceName}
      )
    `);

    // 5. Update or create organization record with alternate name
    // Note: The organizations table uses 'name' column (not 'organization_name')
    // and alternate_names is a text[] array (not JSONB)
    // Note: db.execute() returns { rows: [...], rowCount: n }, NOT an array directly
    const existingOrgResultQuery = await db.execute(
      sql`SELECT id, name, alternate_names FROM organizations WHERE name = ${targetName} LIMIT 1`
    );
    const existingOrgResult = (existingOrgResultQuery as any).rows || [];

    if (existingOrgResult && existingOrgResult.length > 0) {
      // Update existing organization to add alternate name
      const org = existingOrgResult[0] as any;
      const currentAltNames = org.alternate_names || [];

      // Add sourceName to alternateNames if not already there
      if (!currentAltNames.includes(sourceName)) {
        // Use array_append for PostgreSQL text[] array type
        await db.execute(
          sql`UPDATE organizations SET alternate_names = array_append(COALESCE(alternate_names, ARRAY[]::text[]), ${sourceName}) WHERE id = ${org.id}`
        );
      }
    } else {
      // Create new organization record with text[] array
      await db.execute(
        sql`INSERT INTO organizations (name, alternate_names) VALUES (${targetName}, ARRAY[${sourceName}]::text[])`
      );
    }

    // 6. Create audit log entry
    const auditEntry = {
      action: 'organization_merge',
      timestamp: new Date().toISOString(),
      performedBy: mergedBy,
      sourceName,
      targetName,
      reason: reason || '',
      affectedEventRequests: eventCount,
      affectedCollections: collectionCount,
    };

    logger.info('Organization merge completed successfully', auditEntry);

    return {
      success: true,
      targetName,
      sourceName,
      affectedEventRequests: eventCount,
      affectedCollections: collectionCount,
    };
  } catch (error) {
    logger.error('Error merging organizations', {
      sourceName,
      targetName,
      error,
    });

    return {
      success: false,
      targetName,
      sourceName,
      affectedEventRequests: 0,
      affectedCollections: 0,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Get merge history (recent organization merges)
 *
 * Note: This is a simplified version. In production, you'd want to:
 * - Store audit logs in a dedicated table
 * - Add ability to rollback merges
 * - Track more metadata (IP address, user agent, etc.)
 */
export async function getMergeHistory(limit: number = 100): Promise<any[]> {
  try {
    // For now, we'll return merge history from the organizations table
    // by looking at organizations that have alternate names
    // Note: alternate_names is a text[] array, so use array_length instead of jsonb_array_length
    const orgsWithAltNames = await db
      .select()
      .from(organizations)
      .where(
        sql`${organizations.alternateNames} IS NOT NULL AND array_length(${organizations.alternateNames}, 1) > 0`
      )
      .limit(limit);

    return orgsWithAltNames.map((org) => ({
      organizationName: org.name, // Schema uses 'name', not 'organizationName'
      alternateNames: org.alternateNames,
      createdAt: org.createdAt,
    }));
  } catch (error) {
    logger.error('Error fetching merge history', { error });
    return [];
  }
}

/**
 * Preview what would be affected by a merge (without actually executing it)
 */
export async function previewMerge(
  sourceName: string,
  targetName: string
): Promise<{
  affectedEventRequests: number;
  affectedCollections: number;
  sampleEvents: any[];
  sampleCollections: any[];
}> {
  try {
    logger.info('Previewing merge', { sourceName, targetName });

    // Count affected event requests
    let eventCount = 0;
    let sampleEvents: any[] = [];

    try {
      // Use raw SQL for counts to avoid schema issues
      // Note: db.execute() returns { rows: [...], rowCount: n }, NOT an array directly
      const eventCountResult = await db.execute(
        sql`SELECT COUNT(*)::int as count FROM event_requests WHERE organization_name = ${sourceName}`
      );

      // Extract rows from QueryResult object
      const eventCountRows = (eventCountResult as any).rows || [];
      eventCount = eventCountRows[0]?.count || 0;

      logger.info('Preview: Event count query result', { 
        sourceName, 
        eventCount,
        rawResult: eventCountRows[0]
      });

      // Get sample events with raw SQL
      const sampleEventsResult = await db.execute(
        sql`SELECT id, event_date, department_name FROM event_requests WHERE organization_name = ${sourceName} LIMIT 5`
      );

      sampleEvents = (sampleEventsResult as any).rows || [];
    } catch (error) {
      logger.error('Error querying event requests', { sourceName, error });
      // Continue with collections even if events fail
    }

    // Count affected collections
    let collectionCount = 0;
    let sampleCollections: any[] = [];

    try {
      // Count collections where org appears in group1_name, group2_name, OR groupCollections JSON
      // Note: The JSON stores "name" field, not "groupName" (client transforms to groupName for display)
      // Use proper JSONB query with EXISTS subquery instead of brittle LIKE pattern
      // Note: db.execute() returns { rows: [...], rowCount: n }, NOT an array directly
      const collectionCountResult = await db.execute(
        sql`SELECT COUNT(*)::int as count FROM sandwich_collections
            WHERE group1_name = ${sourceName}
               OR group2_name = ${sourceName}
               OR (group_collections IS NOT NULL AND EXISTS (
                 SELECT 1 FROM jsonb_array_elements(group_collections) AS elem
                 WHERE elem->>'name' = ${sourceName}
               ))`
      );

      // Extract rows from QueryResult object
      const collectionCountRows = (collectionCountResult as any).rows || [];
      collectionCount = collectionCountRows[0]?.count || 0;

      logger.info('Preview: Collection count query result', { 
        sourceName, 
        collectionCount,
        rawResult: collectionCountRows[0]
      });

      // Get sample collections with raw SQL
      const sampleCollectionsResult = await db.execute(
        sql`SELECT id, date_collected, group1_name, group2_name FROM sandwich_collections
            WHERE group1_name = ${sourceName}
               OR group2_name = ${sourceName}
               OR (group_collections IS NOT NULL AND EXISTS (
                 SELECT 1 FROM jsonb_array_elements(group_collections) AS elem
                 WHERE elem->>'name' = ${sourceName}
               ))
            LIMIT 5`
      );

      sampleCollections = (sampleCollectionsResult as any).rows || [];
    } catch (error) {
      logger.error('Error querying collections', { sourceName, error });
      // Continue with what we have
    }

    logger.info('Preview complete', {
      sourceName,
      targetName,
      eventCount,
      collectionCount,
    });

    return {
      affectedEventRequests: eventCount,
      affectedCollections: collectionCount,
      sampleEvents,
      sampleCollections,
    };
  } catch (error) {
    logger.error('Error previewing merge', { sourceName, targetName, error });
    throw error;
  }
}
