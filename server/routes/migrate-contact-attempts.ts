import { Router } from 'express';
import { isAuthenticated } from '../auth';
import { requirePermission } from '../middleware/auth';
import { IStorage } from '../database-storage';
import logger from '../utils/logger';

/**
 * Migration endpoint to convert legacy unresponsiveNotes to structured contactAttemptsLog
 * This is a one-time migration script that can be run to convert existing data
 */
export function createMigrateContactAttemptsRoutes(storage: IStorage) {
  const router = Router();

  // Migration endpoint - requires admin permission
  router.post(
    '/migrate',
    isAuthenticated,
    requirePermission('EVENT_REQUESTS_EDIT'),
    async (req, res) => {
      try {
        logger.log('Starting migration of legacy contact attempts...');

        // Get all event requests
        const eventRequests = await storage.getAllEventRequests();

        let migratedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;

        for (const request of eventRequests) {
          try {
            // Skip if no unresponsiveNotes or already has contactAttemptsLog
            if (
              !request.unresponsiveNotes ||
              (request.contactAttemptsLog &&
                Array.isArray(request.contactAttemptsLog) &&
                request.contactAttemptsLog.length > 0)
            ) {
              skippedCount++;
              continue;
            }

            const legacyText = request.unresponsiveNotes.trim();

            // Parse legacy format into structured format
            const attemptBlocks = legacyText
              .split(/\n\n+/)
              .filter((block) => block.trim().length > 0);
            const migratedAttempts: Array<{
              attemptNumber: number;
              timestamp: string;
              method: string;
              outcome: string;
              notes?: string;
              createdBy: string;
              createdByName?: string;
            }> = [];

            // If we have multiple blocks or can find "Attempt #" patterns, parse individually
            if (attemptBlocks.length > 1 || legacyText.includes('Attempt #')) {
              attemptBlocks.forEach((block) => {
                const blockTrimmed = block.trim();

                // Match pattern: [optional date] Attempt #number - Method: content
                const attemptMatch = blockTrimmed.match(
                  /(?:\[([^\]]+)\]\s*)?Attempt\s*#(\d+)\s*-\s*([^:]+):\s*(.+)/is
                );

                if (attemptMatch) {
                  const dateStr = attemptMatch[1]; // Date from [Nov 7, 2025, 4:21 PM]
                  const attemptNumber = parseInt(attemptMatch[2]);
                  const method = attemptMatch[3].trim(); // "Email", "Phone", etc.
                  const content = attemptMatch[4].trim();

                  // Parse outcome and notes (content may have " - " separator)
                  let outcome = content;
                  let notes: string | undefined;

                  // Try to split by " - " but be careful not to split dates or other content
                  const dashIndex = content.indexOf(' - ');
                  if (dashIndex > 0 && dashIndex < content.length - 3) {
                    outcome = content.substring(0, dashIndex).trim();
                    notes = content.substring(dashIndex + 3).trim();
                  }

                  // Parse date
                  let parsedDate: Date;
                  if (dateStr) {
                    try {
                      parsedDate = new Date(dateStr);
                      if (isNaN(parsedDate.getTime())) {
                        parsedDate = new Date(); // Fallback to current date
                      }
                    } catch (e) {
                      parsedDate = new Date(); // Fallback to current date
                    }
                  } else {
                    parsedDate = new Date(); // Fallback to current date
                  }

                  // Normalize method to standard values
                  const methodLower = method.toLowerCase();
                  let normalizedMethod = 'unknown';
                  if (methodLower.includes('phone')) {
                    normalizedMethod = 'phone';
                  } else if (methodLower.includes('email')) {
                    normalizedMethod = 'email';
                  } else if (methodLower.includes('both')) {
                    normalizedMethod = 'both';
                  }

                  // Normalize outcome to standard values
                  const outcomeLower = outcome.toLowerCase();
                  let normalizedOutcome = 'other';
                  if (
                    outcomeLower.includes('successfully') ||
                    outcomeLower.includes('got response')
                  ) {
                    normalizedOutcome = 'successful';
                  } else if (
                    outcomeLower.includes('no answer') ||
                    outcomeLower.includes('no response')
                  ) {
                    normalizedOutcome = 'no_answer';
                  } else if (
                    outcomeLower.includes('left') ||
                    outcomeLower.includes('voicemail') ||
                    outcomeLower.includes('message')
                  ) {
                    normalizedOutcome = 'left_message';
                  } else if (
                    outcomeLower.includes('wrong') ||
                    outcomeLower.includes('disconnected')
                  ) {
                    normalizedOutcome = 'wrong_number';
                  } else if (
                    outcomeLower.includes('bounced') ||
                    outcomeLower.includes('failed')
                  ) {
                    normalizedOutcome = 'email_bounced';
                  } else if (
                    outcomeLower.includes('callback') ||
                    outcomeLower.includes('follow-up')
                  ) {
                    normalizedOutcome = 'requested_callback';
                  }

                  migratedAttempts.push({
                    attemptNumber,
                    timestamp: parsedDate.toISOString(),
                    method: normalizedMethod,
                    outcome: normalizedOutcome,
                    notes: notes || undefined,
                    createdBy: 'system',
                    // Don't set createdByName for migrated entries - display logic will skip badge
                    createdByName: undefined,
                  });
                }
              });
            }

            // Only update if we successfully parsed attempts
            if (migratedAttempts.length > 0) {
              await storage.updateEventRequest(request.id!, {
                contactAttemptsLog: migratedAttempts,
                // Keep unresponsiveNotes for now (can be cleaned up later)
                // unresponsiveNotes: null, // Uncomment to clear legacy data after migration
              });
              migratedCount++;
              logger.log(
                `Migrated ${migratedAttempts.length} attempts for event request ${request.id}`
              );
            } else {
              skippedCount++;
              logger.log(
                `Skipped event request ${request.id} - could not parse attempts`
              );
            }
          } catch (error) {
            errorCount++;
            logger.error(`Error migrating event request ${request.id}:`, error);
          }
        }

        logger.log(
          `Migration complete: ${migratedCount} migrated, ${skippedCount} skipped, ${errorCount} errors`
        );

        res.json({
          success: true,
          message: 'Migration completed',
          stats: {
            migrated: migratedCount,
            skipped: skippedCount,
            errors: errorCount,
          },
        });
      } catch (error) {
        logger.error('Migration error:', error);
        res.status(500).json({
          success: false,
          message: 'Migration failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );

  // Preview endpoint - shows what would be migrated without actually migrating
  router.get(
    '/preview',
    isAuthenticated,
    requirePermission('EVENT_REQUESTS_VIEW'),
    async (req, res) => {
      try {
        const eventRequests = await storage.getAllEventRequests();

        const preview: Array<{
          id: number;
          organizationName: string;
          hasUnresponsiveNotes: boolean;
          hasContactAttemptsLog: boolean;
          unresponsiveNotesLength: number;
          canMigrate: boolean;
        }> = [];

        for (const request of eventRequests) {
          const hasUnresponsiveNotes = !!request.unresponsiveNotes;
          const hasContactAttemptsLog = !!(
            request.contactAttemptsLog &&
            Array.isArray(request.contactAttemptsLog) &&
            request.contactAttemptsLog.length > 0
          );

          preview.push({
            id: request.id!,
            organizationName: request.organizationName || 'Unknown',
            hasUnresponsiveNotes,
            hasContactAttemptsLog,
            unresponsiveNotesLength: request.unresponsiveNotes?.length || 0,
            canMigrate: hasUnresponsiveNotes && !hasContactAttemptsLog,
          });
        }

        const canMigrateCount = preview.filter((p) => p.canMigrate).length;

        res.json({
          preview,
          summary: {
            total: preview.length,
            canMigrate: canMigrateCount,
            alreadyMigrated: preview.filter((p) => p.hasContactAttemptsLog)
              .length,
            noData: preview.filter(
              (p) => !p.hasUnresponsiveNotes && !p.hasContactAttemptsLog
            ).length,
          },
        });
      } catch (error) {
        logger.error('Preview error:', error);
        res.status(500).json({
          success: false,
          message: 'Preview failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );

  return router;
}
