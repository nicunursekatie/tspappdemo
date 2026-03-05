import { Router } from 'express';
import { db } from '../../db';
import { sandwichCollections } from '@shared/schema';
import { sql, isNull } from 'drizzle-orm';

const groupCollectionsRouter = Router();

interface GroupCollection {
  id: number;
  collectionDate: string;
  hostName: string;
  groupName: string;
  department?: string;
  count: number;
  deli?: number;
  turkey?: number;
  ham?: number;
  pbj?: number;
  generic?: number;
}

// GET /api/reports/group-collections
// Query params: startDate, endDate (YYYY-MM-DD format)
groupCollectionsRouter.get('/', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        error: 'startDate and endDate query parameters are required (YYYY-MM-DD format)',
      });
    }

    const start = new Date(String(startDate));
    const end = new Date(String(endDate));

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        error: 'Invalid date format. Use YYYY-MM-DD',
      });
    }

    // Get all collections in the date range
    const collections = await db
      .select()
      .from(sandwichCollections)
      .where(
        sql`${sandwichCollections.collectionDate} >= ${startDate} AND ${sandwichCollections.collectionDate} <= ${endDate} AND ${isNull(sandwichCollections.deletedAt)}`
      )
      .orderBy(sandwichCollections.collectionDate);

    // Extract all group collections from the JSON array
    const groupCollectionsList: GroupCollection[] = [];

    for (const collection of collections) {
      // Check if groupCollections has actual entries (not just an empty array)
      const hasGroupCollections = collection.groupCollections &&
        Array.isArray(collection.groupCollections) &&
        collection.groupCollections.length > 0;

      if (hasGroupCollections) {
        // Process new format (groupCollections JSON array)
        for (const group of collection.groupCollections) {
          if (group && group.name && group.count) {
            groupCollectionsList.push({
              id: collection.id,
              collectionDate: collection.collectionDate,
              hostName: collection.hostName,
              groupName: group.name,
              department: group.department,
              count: group.count || 0,
              deli: group.deli || 0,
              turkey: group.turkey || 0,
              ham: group.ham || 0,
              pbj: group.pbj || 0,
              generic: group.generic || 0,
            });
          }
        }
      } else if (collection.group1Name && collection.group1Count) {
        // Process legacy format (group1/group2 fields)
        // This now correctly handles cases where groupCollections is an empty array
        groupCollectionsList.push({
          id: collection.id,
          collectionDate: collection.collectionDate,
          hostName: collection.hostName,
          groupName: collection.group1Name,
          count: collection.group1Count || 0,
        });

        if (collection.group2Name && collection.group2Count) {
          groupCollectionsList.push({
            id: collection.id,
            collectionDate: collection.collectionDate,
            hostName: collection.hostName,
            groupName: collection.group2Name,
            count: collection.group2Count || 0,
          });
        }
      }
    }

    res.json(groupCollectionsList);
  } catch (error) {
    console.error('[Group Collections Report Error]', error);
    res.status(500).json({
      error: 'Failed to fetch group collections data',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default groupCollectionsRouter;
