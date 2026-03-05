import { Router } from 'express';
import {
  calculateAllOrganizationEngagement,
  calculateOrganizationEngagement,
  getGroupInsightsSummary,
  saveEngagementScores,
  OrganizationEngagement,
  GroupInsightsSummary,
  getOrganizationEventHistory,
} from '../services/group-engagement';
import { logger } from '../utils/production-safe-logger';
import { storage } from '../storage-wrapper';

interface GroupEngagementDependencies {
  isAuthenticated: any;
}

export function createGroupEngagementRoutes(deps: GroupEngagementDependencies) {
  const router = Router();

  /**
   * GET /api/group-engagement/insights
   * Get summary insights for the entire groups catalog
   */
  router.get('/insights', deps.isAuthenticated, async (req, res) => {
    try {
      logger.info('Fetching group engagement insights summary');
      const summary = await getGroupInsightsSummary();
      res.json(summary);
    } catch (error) {
      logger.error('Error fetching group engagement insights:', error);
      res.status(500).json({ message: 'Failed to fetch group engagement insights' });
    }
  });

  /**
   * GET /api/group-engagement/scores
   * Get engagement scores for all organizations
   */
  router.get('/scores', deps.isAuthenticated, async (req, res) => {
    try {
      const {
        sortBy = 'overall',
        sortOrder = 'asc',
        engagementLevel,
        outreachPriority,
        category,
        limit,
        offset = 0
      } = req.query;

      logger.info('Fetching all organization engagement scores', {
        sortBy, sortOrder, engagementLevel, outreachPriority, category
      });

      let engagements = await calculateAllOrganizationEngagement();

      // Apply filters
      if (engagementLevel) {
        const levels = (engagementLevel as string).split(',');
        engagements = engagements.filter(eng => levels.includes(eng.engagementLevel));
      }

      if (outreachPriority) {
        const priorities = (outreachPriority as string).split(',');
        engagements = engagements.filter(eng => priorities.includes(eng.outreachPriority));
      }

      if (category) {
        const categories = (category as string).split(',');
        engagements = engagements.filter(eng =>
          categories.includes(eng.category || 'uncategorized')
        );
      }

      // Apply sorting
      const validSortFields = ['overall', 'frequency', 'recency', 'volume', 'completion', 'consistency', 'lastEvent', 'totalSandwiches', 'name'];
      const sortField = validSortFields.includes(sortBy as string) ? sortBy : 'overall';
      const ascending = sortOrder === 'asc';

      engagements.sort((a, b) => {
        let aVal: any;
        let bVal: any;

        switch (sortField) {
          case 'overall':
            aVal = a.scores.overall;
            bVal = b.scores.overall;
            break;
          case 'frequency':
            aVal = a.scores.frequency;
            bVal = b.scores.frequency;
            break;
          case 'recency':
            aVal = a.scores.recency;
            bVal = b.scores.recency;
            break;
          case 'volume':
            aVal = a.scores.volume;
            bVal = b.scores.volume;
            break;
          case 'completion':
            aVal = a.scores.completion;
            bVal = b.scores.completion;
            break;
          case 'consistency':
            aVal = a.scores.consistency;
            bVal = b.scores.consistency;
            break;
          case 'lastEvent':
            aVal = a.metrics.lastEventDate?.getTime() || 0;
            bVal = b.metrics.lastEventDate?.getTime() || 0;
            break;
          case 'totalSandwiches':
            aVal = a.metrics.totalSandwiches;
            bVal = b.metrics.totalSandwiches;
            break;
          case 'name':
            aVal = a.organizationName.toLowerCase();
            bVal = b.organizationName.toLowerCase();
            break;
          default:
            aVal = a.scores.overall;
            bVal = b.scores.overall;
        }

        if (typeof aVal === 'string') {
          return ascending ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        }
        return ascending ? aVal - bVal : bVal - aVal;
      });

      // Get total before pagination
      const total = engagements.length;

      // Apply pagination
      const offsetNum = parseInt(offset as string) || 0;
      if (limit) {
        const limitNum = parseInt(limit as string);
        engagements = engagements.slice(offsetNum, offsetNum + limitNum);
      } else if (offsetNum > 0) {
        engagements = engagements.slice(offsetNum);
      }

      res.json({
        total,
        offset: offsetNum,
        count: engagements.length,
        organizations: engagements
      });
    } catch (error) {
      logger.error('Error fetching organization engagement scores:', error);
      res.status(500).json({ message: 'Failed to fetch organization engagement scores' });
    }
  });

  /**
   * GET /api/group-engagement/organization/:canonicalName
   * Get engagement details for a specific organization
   */
  router.get('/organization/:canonicalName', deps.isAuthenticated, async (req, res) => {
    try {
      const { canonicalName } = req.params;

      if (!canonicalName) {
        return res.status(400).json({ message: 'Organization canonical name is required' });
      }

      logger.info('Fetching engagement for organization', { canonicalName });

      const engagement = await calculateOrganizationEngagement(
        decodeURIComponent(canonicalName)
      );

      res.json(engagement);
    } catch (error) {
      logger.error('Error fetching organization engagement:', error);
      res.status(500).json({ message: 'Failed to fetch organization engagement' });
    }
  });

  /**
   * GET /api/group-engagement/needs-attention
   * Get organizations that need outreach (urgent or high priority)
   */
  router.get('/needs-attention', deps.isAuthenticated, async (req, res) => {
    try {
      const { limit = '20' } = req.query;

      logger.info('Fetching organizations needing attention');

      let engagements = await calculateAllOrganizationEngagement();

      // Filter to urgent and high priority
      engagements = engagements.filter(
        eng => eng.outreachPriority === 'urgent' || eng.outreachPriority === 'high'
      );

      // Sort by priority (urgent first) then by score (lowest first)
      engagements.sort((a, b) => {
        if (a.outreachPriority === 'urgent' && b.outreachPriority !== 'urgent') return -1;
        if (b.outreachPriority === 'urgent' && a.outreachPriority !== 'urgent') return 1;
        return a.scores.overall - b.scores.overall;
      });

      // Apply limit
      const limitNum = parseInt(limit as string);
      if (limitNum > 0) {
        engagements = engagements.slice(0, limitNum);
      }

      res.json({
        total: engagements.length,
        organizations: engagements
      });
    } catch (error) {
      logger.error('Error fetching organizations needing attention:', error);
      res.status(500).json({ message: 'Failed to fetch organizations needing attention' });
    }
  });

  /**
   * GET /api/group-engagement/dormant
   * Get dormant organizations (for re-engagement campaigns)
   */
  router.get('/dormant', deps.isAuthenticated, async (req, res) => {
    try {
      const { limit = '20', minSandwiches = '0' } = req.query;

      logger.info('Fetching dormant organizations');

      let engagements = await calculateAllOrganizationEngagement();

      // Filter to dormant organizations
      engagements = engagements.filter(eng => eng.engagementLevel === 'dormant');

      // Optional filter by minimum sandwich count (to prioritize high-value dormant orgs)
      const minSandwichCount = parseInt(minSandwiches as string);
      if (minSandwichCount > 0) {
        engagements = engagements.filter(eng => eng.metrics.totalSandwiches >= minSandwichCount);
      }

      // Sort by total sandwiches (highest first - most valuable to re-engage)
      engagements.sort((a, b) => b.metrics.totalSandwiches - a.metrics.totalSandwiches);

      // Apply limit
      const limitNum = parseInt(limit as string);
      if (limitNum > 0) {
        engagements = engagements.slice(0, limitNum);
      }

      res.json({
        total: engagements.length,
        organizations: engagements
      });
    } catch (error) {
      logger.error('Error fetching dormant organizations:', error);
      res.status(500).json({ message: 'Failed to fetch dormant organizations' });
    }
  });

  /**
   * GET /api/group-engagement/top-performers
   * Get highly engaged organizations (for recognition/ambassador programs)
   */
  router.get('/top-performers', deps.isAuthenticated, async (req, res) => {
    try {
      const { limit = '20' } = req.query;

      logger.info('Fetching top performing organizations');

      let engagements = await calculateAllOrganizationEngagement();

      // Filter to active organizations
      engagements = engagements.filter(
        eng => eng.engagementLevel === 'active'
      );

      // Sort by overall score (highest first)
      engagements.sort((a, b) => b.scores.overall - a.scores.overall);

      // Apply limit
      const limitNum = parseInt(limit as string);
      if (limitNum > 0) {
        engagements = engagements.slice(0, limitNum);
      }

      res.json({
        total: engagements.length,
        organizations: engagements
      });
    } catch (error) {
      logger.error('Error fetching top performing organizations:', error);
      res.status(500).json({ message: 'Failed to fetch top performing organizations' });
    }
  });

  /**
   * GET /api/group-engagement/new-opportunities
   * Get new organizations with completed events (for nurturing)
   */
  router.get('/new-opportunities', deps.isAuthenticated, async (req, res) => {
    try {
      const { limit = '20' } = req.query;

      logger.info('Fetching new opportunity organizations');

      let engagements = await calculateAllOrganizationEngagement();

      // Filter to new organizations with completed events
      engagements = engagements.filter(
        eng => eng.engagementLevel === 'new' && eng.metrics.completedEvents > 0
      );

      // Sort by overall score (highest first - most promising)
      engagements.sort((a, b) => b.scores.overall - a.scores.overall);

      // Apply limit
      const limitNum = parseInt(limit as string);
      if (limitNum > 0) {
        engagements = engagements.slice(0, limitNum);
      }

      res.json({
        total: engagements.length,
        organizations: engagements
      });
    } catch (error) {
      logger.error('Error fetching new opportunity organizations:', error);
      res.status(500).json({ message: 'Failed to fetch new opportunity organizations' });
    }
  });

  /**
   * GET /api/group-engagement/by-category
   * Get engagement statistics grouped by organization category
   */
  router.get('/by-category', deps.isAuthenticated, async (req, res) => {
    try {
      logger.info('Fetching engagement by category');

      const engagements = await calculateAllOrganizationEngagement();

      // Group by category
      const categoryStats: Record<string, {
        count: number;
        avgScore: number;
        totalSandwiches: number;
        totalEvents: number;
        engagementLevels: Record<string, number>;
        organizations: OrganizationEngagement[];
      }> = {};

      engagements.forEach(eng => {
        const category = eng.category || 'uncategorized';

        if (!categoryStats[category]) {
          categoryStats[category] = {
            count: 0,
            avgScore: 0,
            totalSandwiches: 0,
            totalEvents: 0,
            engagementLevels: {
              active: 0,
              at_risk: 0,
              dormant: 0,
              new: 0
            },
            organizations: []
          };
        }

        categoryStats[category].count++;
        categoryStats[category].avgScore += eng.scores.overall;
        categoryStats[category].totalSandwiches += eng.metrics.totalSandwiches;
        categoryStats[category].totalEvents += eng.metrics.totalEvents;
        categoryStats[category].engagementLevels[eng.engagementLevel]++;
        categoryStats[category].organizations.push(eng);
      });

      // Calculate averages and sort organizations within each category
      Object.values(categoryStats).forEach(stats => {
        stats.avgScore = Math.round((stats.avgScore / stats.count) * 100) / 100;
        stats.organizations.sort((a, b) => b.scores.overall - a.scores.overall);
        // Limit to top 5 per category
        stats.organizations = stats.organizations.slice(0, 5);
      });

      res.json(categoryStats);
    } catch (error) {
      logger.error('Error fetching engagement by category:', error);
      res.status(500).json({ message: 'Failed to fetch engagement by category' });
    }
  });

  /**
   * GET /api/group-engagement/program-candidates/:program
   * Get organizations suitable for a specific program
   */
  router.get('/program-candidates/:program', deps.isAuthenticated, async (req, res) => {
    try {
      const { program } = req.params;
      const { limit = '20', minScore = '50' } = req.query;

      logger.info('Fetching program candidates', { program });

      const engagements = await calculateAllOrganizationEngagement();

      // Filter organizations suitable for this program
      const minScoreNum = parseInt(minScore as string);
      const candidates = engagements
        .map(eng => {
          const suitability = eng.programSuitability.find(
            p => p.program.toLowerCase().includes(program.toLowerCase())
          );
          return { ...eng, programScore: suitability?.score || 0, programReason: suitability?.reason || '' };
        })
        .filter(eng => eng.programScore >= minScoreNum)
        .sort((a, b) => b.programScore - a.programScore);

      // Apply limit
      const limitNum = parseInt(limit as string);
      const limited = limitNum > 0 ? candidates.slice(0, limitNum) : candidates;

      res.json({
        program: decodeURIComponent(program),
        total: candidates.length,
        organizations: limited
      });
    } catch (error) {
      logger.error('Error fetching program candidates:', error);
      res.status(500).json({ message: 'Failed to fetch program candidates' });
    }
  });

  /**
   * POST /api/group-engagement/refresh
   * Recalculate and save all engagement scores
   */
  router.post('/refresh', deps.isAuthenticated, async (req, res) => {
    try {
      logger.info('Refreshing all engagement scores');

      const engagements = await calculateAllOrganizationEngagement();

      // Try to save to database (will fail gracefully if table doesn't exist yet)
      try {
        await saveEngagementScores(engagements);
        res.json({
          message: 'Engagement scores refreshed and saved',
          count: engagements.length
        });
      } catch (saveError) {
        logger.warn('Failed to save engagement scores to database', { error: saveError });
        res.json({
          message: 'Engagement scores calculated (database save skipped)',
          count: engagements.length
        });
      }
    } catch (error) {
      logger.error('Error refreshing engagement scores:', error);
      res.status(500).json({ message: 'Failed to refresh engagement scores' });
    }
  });

  /**
   * GET /api/group-engagement/export
   * Export engagement scores as CSV
   */
  router.get('/export', deps.isAuthenticated, async (req, res) => {
    try {
      logger.info('Exporting engagement scores');

      const engagements = await calculateAllOrganizationEngagement();

      // Build CSV
      const headers = [
        'Organization Name',
        'Category',
        'Overall Score',
        'Engagement Level',
        'Outreach Priority',
        'Total Events',
        'Completed Events',
        'Total Sandwiches',
        'Days Since Last Event',
        'Frequency Score',
        'Recency Score',
        'Volume Score',
        'Completion Score',
        'Consistency Score',
        'Engagement Trend',
        'Last Event Date',
        'Top Recommendation'
      ];

      const rows = engagements.map(eng => [
        `"${eng.organizationName.replace(/"/g, '""')}"`,
        eng.category || 'uncategorized',
        eng.scores.overall,
        eng.engagementLevel,
        eng.outreachPriority,
        eng.metrics.totalEvents,
        eng.metrics.completedEvents,
        eng.metrics.totalSandwiches,
        eng.metrics.daysSinceLastEvent ?? 'N/A',
        eng.scores.frequency,
        eng.scores.recency,
        eng.scores.volume,
        eng.scores.completion,
        eng.scores.consistency,
        eng.engagementTrend,
        eng.metrics.lastEventDate?.toISOString().split('T')[0] || 'N/A',
        `"${(eng.recommendedActions[0]?.action || 'None').replace(/"/g, '""')}"`
      ]);

      const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=group-engagement-scores.csv');
      res.send(csv);
    } catch (error) {
      logger.error('Error exporting engagement scores:', error);
      res.status(500).json({ message: 'Failed to export engagement scores' });
    }
  });

  // ==================== Ambassador Candidate Routes ====================

  /**
   * GET /api/group-engagement/ambassadors
   * Get all ambassador candidates
   */
  router.get('/ambassadors', deps.isAuthenticated, async (req, res) => {
    try {
      const { status } = req.query;
      let candidates;
      if (status && typeof status === 'string') {
        candidates = await storage.getAmbassadorCandidatesByStatus(status);
      } else {
        candidates = await storage.getAllAmbassadorCandidates();
      }
      res.json(candidates);
    } catch (error) {
      logger.error('Error fetching ambassador candidates:', error);
      res.status(500).json({ message: 'Failed to fetch ambassador candidates' });
    }
  });

  /**
   * GET /api/group-engagement/ambassadors/follow-up-due
   * Get ambassador candidates with follow-up due
   */
  router.get('/ambassadors/follow-up-due', deps.isAuthenticated, async (req, res) => {
    try {
      const candidates = await storage.getAmbassadorCandidatesWithFollowUpDue();
      res.json(candidates);
    } catch (error) {
      logger.error('Error fetching ambassador candidates with follow-up due:', error);
      res.status(500).json({ message: 'Failed to fetch ambassador candidates' });
    }
  });

  /**
   * GET /api/group-engagement/ambassadors/:id
   * Get a specific ambassador candidate
   */
  router.get('/ambassadors/:id', deps.isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const candidate = await storage.getAmbassadorCandidate(id);
      if (!candidate) {
        return res.status(404).json({ message: 'Ambassador candidate not found' });
      }
      res.json(candidate);
    } catch (error) {
      logger.error('Error fetching ambassador candidate:', error);
      res.status(500).json({ message: 'Failed to fetch ambassador candidate' });
    }
  });

  /**
   * POST /api/group-engagement/ambassadors
   * Add an organization as an ambassador candidate
   */
  router.post('/ambassadors', deps.isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).user;
      const {
        organizationName,
        canonicalName,
        category,
        addedReason,
        priority,
        notes,
        contactInfo,
        engagementScoreAtAdd,
        totalEventsAtAdd,
        totalSandwichesAtAdd,
      } = req.body;

      if (!organizationName || !canonicalName) {
        return res.status(400).json({ message: 'Organization name and canonical name are required' });
      }

      // Check if already exists
      const existing = await storage.getAmbassadorCandidateByCanonicalName(canonicalName);
      if (existing) {
        return res.status(409).json({
          message: 'This organization is already an ambassador candidate',
          candidate: existing
        });
      }

      const candidate = await storage.createAmbassadorCandidate({
        organizationName,
        canonicalName,
        category,
        addedBy: user?.id ? parseInt(user.id) : null,
        addedReason,
        priority: priority || 'normal',
        notes,
        contactInfo,
        engagementScoreAtAdd,
        totalEventsAtAdd,
        totalSandwichesAtAdd,
        status: 'identified',
      });

      logger.info(`Ambassador candidate added: ${organizationName} by user ${user?.email}`);
      res.status(201).json(candidate);
    } catch (error) {
      logger.error('Error creating ambassador candidate:', error);
      res.status(500).json({ message: 'Failed to create ambassador candidate' });
    }
  });

  /**
   * PATCH /api/group-engagement/ambassadors/:id
   * Update an ambassador candidate
   */
  router.patch('/ambassadors/:id', deps.isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const user = (req as any).user;
      const updates = req.body;

      // Handle status changes
      if (updates.status === 'confirmed' && !updates.confirmedAt) {
        updates.confirmedAt = new Date();
      }
      if (updates.status === 'declined' && !updates.declinedAt) {
        updates.declinedAt = new Date();
      }

      // Track contact attempts
      if (updates.recordContact) {
        delete updates.recordContact;
        updates.lastContactedAt = new Date();
        updates.lastContactedBy = user?.id ? parseInt(user.id) : null;
      }

      const candidate = await storage.updateAmbassadorCandidate(id, updates);
      if (!candidate) {
        return res.status(404).json({ message: 'Ambassador candidate not found' });
      }

      logger.info(`Ambassador candidate updated: ${candidate.organizationName} (ID: ${id})`);
      res.json(candidate);
    } catch (error) {
      logger.error('Error updating ambassador candidate:', error);
      res.status(500).json({ message: 'Failed to update ambassador candidate' });
    }
  });

  /**
   * DELETE /api/group-engagement/ambassadors/:id
   * Remove an ambassador candidate
   */
  router.delete('/ambassadors/:id', deps.isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteAmbassadorCandidate(id);
      if (!deleted) {
        return res.status(404).json({ message: 'Ambassador candidate not found' });
      }
      logger.info(`Ambassador candidate deleted: ID ${id}`);
      res.json({ message: 'Ambassador candidate removed' });
    } catch (error) {
      logger.error('Error deleting ambassador candidate:', error);
      res.status(500).json({ message: 'Failed to delete ambassador candidate' });
    }
  });

  // ==================== Event History Route ====================

  /**
   * GET /api/group-engagement/organization/:canonicalName/events
   * Get event history for an organization
   */
  router.get('/organization/:canonicalName/events', deps.isAuthenticated, async (req, res) => {
    try {
      const { canonicalName } = req.params;
      const eventHistory = await getOrganizationEventHistory(canonicalName);
      res.json(eventHistory);
    } catch (error) {
      logger.error('Error fetching organization event history:', error);
      res.status(500).json({ message: 'Failed to fetch organization event history' });
    }
  });

  return router;
}

export default createGroupEngagementRoutes;
