/**
 * Event Requests - Google Sheets Sync Routes
 *
 * Handles bidirectional syncing with Google Sheets (NOT the import endpoint).
 * The import endpoint remains in the legacy file as it's critical.
 * Split from event-requests-legacy.ts for better organization.
 */

import { Router, Response } from 'express';
import { storage } from '../../storage-wrapper';
import { PERMISSIONS } from '@shared/auth-utils';
import { requirePermission } from '../../middleware/auth';
import { isAuthenticated } from '../../auth';
import { getEventRequestsGoogleSheetsService } from '../../google-sheets-event-requests-sync';
import { logger } from '../../middleware/logger';
import type { AuthenticatedRequest } from '../../types/express';

const router = Router();

// Enhanced logging function for activity tracking
const logActivity = async (
  req: AuthenticatedRequest,
  res: Response,
  permission: string,
  message: string,
  metadata?: Record<string, unknown>
) => {
  if (metadata) {
    res.locals.eventRequestAuditDetails = metadata;
  }
};

// ============================================================================
// Google Sheets Sync Routes
// ============================================================================

// DEBUG: Test endpoint to check authentication
router.get('/debug/auth', (req, res) => {
  res.json({
    user: req.user
      ? {
          id: req.user.id,
          email: req.user.email,
          role: req.user.role,
          permissionCount: req.user.permissions?.length || 0,
        }
      : null,
    session: req.session?.user
      ? {
          email: req.session.user.email,
          role: req.session.user.role,
        }
      : null,
  });
});

// Sync event requests TO Google Sheets
router.post(
  '/sync/to-sheets',
  isAuthenticated,
  requirePermission('EVENT_REQUESTS_SYNC'),
  async (req, res) => {
    try {
      const user = req.user;

      if (!user) {
        return res.status(403).json({ message: 'Authentication required' });
      }

      const syncService = getEventRequestsGoogleSheetsService(storage as any);
      if (!syncService) {
        return res.status(500).json({
          success: false,
          message: 'Google Sheets service not configured',
        });
      }

      const result = await syncService.syncToGoogleSheets();
      await logActivity(
        req,
        res,
        PERMISSIONS.EVENT_REQUESTS_EDIT,
        `Smart-synced ${
          result.synced || 0
        } event requests to Google Sheets (preserving manual columns N+)`
      );

      res.json(result);
    } catch (error) {
      logger.error('Error syncing event requests to Google Sheets:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to sync to Google Sheets',
      });
    }
  }
);

// Sync event requests FROM Google Sheets
router.post(
  '/sync/from-sheets',
  isAuthenticated,
  requirePermission('EVENT_REQUESTS_SYNC'),
  async (req, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(403).json({ message: 'Authentication required' });
      }

      const syncService = getEventRequestsGoogleSheetsService(storage as any);
      if (!syncService) {
        return res.status(500).json({
          success: false,
          message: 'Google Sheets service not configured',
        });
      }

      const result = await syncService.syncFromGoogleSheets();
      await logActivity(
        req,
        res,
        PERMISSIONS.EVENT_REQUESTS_EDIT,
        `Synced from Google Sheets: ${
          result.created || 0
        } created, ${result.updated || 0} updated`
      );

      res.json(result);
    } catch (error) {
      logger.error('Error syncing event requests from Google Sheets:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to sync from Google Sheets',
      });
    }
  }
);

// Get sync status and health check
router.get(
  '/sync/status',
  isAuthenticated,
  requirePermission('EVENT_REQUESTS_VIEW'),
  async (req, res) => {
    try {
      const { getBackgroundSyncService } = await import('../../background-sync-service');
      const syncService = getBackgroundSyncService();

      if (!syncService) {
        return res.json({
          running: false,
          message: 'Background sync service not initialized',
        });
      }

      const status = syncService.getStatus();
      return res.json({
        running: status.isRunning,
        nextSyncIn: status.nextSyncIn,
        lastSuccessfulSync: status.lastSuccessfulSync,
        minutesSinceLastSuccess: status.minutesSinceLastSuccess,
        consecutiveFailures: status.consecutiveFailures,
        isHealthy: status.isHealthy,
        message: status.isRunning
          ? (status.isHealthy
              ? 'Background sync is running and healthy'
              : `Background sync is running but stale (${status.minutesSinceLastSuccess} minutes since last success)`)
          : 'Background sync is not running',
      });
    } catch (error) {
      logger.error('Error getting sync status:', error);
      return res.status(500).json({
        running: false,
        message: 'Failed to get sync status',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

// Analyze Google Sheets structure
router.get(
  '/sync/analyze',
  isAuthenticated,
  requirePermission('EVENT_REQUESTS_VIEW'),
  async (req, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(403).json({ message: 'Authentication required' });
      }

      const syncService = getEventRequestsGoogleSheetsService(storage as any);
      if (!syncService) {
        return res.status(500).json({
          success: false,
          message: 'Google Sheets service not configured',
        });
      }

      const analysis = await syncService.analyzeSheetStructure();
      await logActivity(
        req,
        res,
        'EVENT_REQUESTS_VIEW',
        'Analyzed Event Requests Google Sheet structure'
      );

      res.json({
        success: true,
        analysis,
        sheetUrl: `https://docs.google.com/spreadsheets/d/${process.env.EVENT_REQUESTS_SHEET_ID}/edit`,
        targetSpreadsheetId: process.env.EVENT_REQUESTS_SHEET_ID,
      });
    } catch (error) {
      logger.error('Error analyzing Event Requests Google Sheet:', error);
      res.status(500).json({
        success: false,
        message: 'Google Sheets analysis failed. Please check API credentials.',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

// Find missing events - DRY RUN diagnostic (does not insert anything)
router.get(
  '/sync/find-missing',
  isAuthenticated,
  requirePermission('EVENT_REQUESTS_EDIT'),
  async (req, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(403).json({ message: 'Authentication required' });
      }

      const syncService = getEventRequestsGoogleSheetsService(storage as any);
      if (!syncService) {
        return res.status(500).json({
          success: false,
          message: 'Google Sheets service not configured',
        });
      }

      logger.log('🔍 Running find-missing diagnostic (dry run - no insertions)...');
      const result = await syncService.findMissingEvents();

      await logActivity(
        req,
        res,
        'EVENT_REQUESTS_VIEW',
        `Ran find-missing diagnostic: ${result.missingEvents.length} potentially missing events found`
      );

      res.json({
        success: true,
        message: 'Dry-run diagnostic complete - NO data was inserted',
        sheetRowCount: result.sheetRowCount,
        databaseCount: result.databaseCount,
        missingCount: result.missingEvents.length,
        missingEvents: result.missingEvents,
        duplicatesInSheet: result.duplicatesInSheet,
      });
    } catch (error) {
      logger.error('Error running find-missing diagnostic:', error);
      res.status(500).json({
        success: false,
        message: 'Find-missing diagnostic failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

export default router;
