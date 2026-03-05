import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { requirePermissions } from '../middleware/requirePermissions';
import { PERMISSIONS } from '@shared/auth-utils';
import { migrateOnboardingChallenges } from '../scripts/migrate-onboarding-challenges';
import { logger } from '../utils/production-safe-logger';

const router = Router();

/**
 * Admin endpoint to run onboarding challenges migration
 * POST /api/onboarding/admin/migrate
 */
router.post(
  '/admin/migrate',
  requireAuth,
  requirePermissions([PERMISSIONS.ADMIN_PANEL_ACCESS]),
  async (req, res) => {
    try {
      logger.log('Running onboarding challenges migration...');
      await migrateOnboardingChallenges();
      res.json({ success: true, message: 'Migration completed successfully' });
    } catch (error: any) {
      logger.error('Migration failed:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

export default router;
