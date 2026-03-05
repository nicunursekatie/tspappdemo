/**
 * Batch Operations Utilities
 *
 * Provides utilities for handling batch operations that should continue
 * even if individual operations fail (e.g., sending multiple emails).
 *
 * See: BUG_FIXES_IMPLEMENTATION_GUIDE.md - BUG-013
 */

import { logger } from './production-safe-logger';

export interface BatchResult<T> {
  successful: T[];
  failed: Array<{ error: unknown; index: number; input?: any }>;
  total: number;
  successCount: number;
  failureCount: number;
}

/**
 * Process array of promises, continuing even if some fail
 * Uses Promise.allSettled instead of Promise.all for resilience
 *
 * @param promises - Array of promises to execute
 * @param context - Optional context for logging (e.g., "Email batch", "File uploads")
 * @returns BatchResult with successful results and failed operations
 *
 * @example
 * const emailPromises = users.map(user => sendEmail(user.email));
 * const result = await batchProcess(emailPromises, 'User notifications');
 * console.log(`Sent ${result.successCount}/${result.total} emails`);
 * console.log(`Failed: ${result.failureCount}`);
 */
export async function batchProcess<T>(
  promises: Promise<T>[],
  context?: string
): Promise<BatchResult<T>> {
  const results = await Promise.allSettled(promises);

  const successful: T[] = [];
  const failed: Array<{ error: any; index: number }> = [];

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      successful.push(result.value);
    } else {
      failed.push({ error: result.reason, index });
      logger.error(`Batch operation failed at index ${index}`, {
        context,
        error: result.reason,
        index
      });
    }
  });

  const summary = {
    successful,
    failed,
    total: promises.length,
    successCount: successful.length,
    failureCount: failed.length
  };

  if (context) {
    logger.info(`Batch operation complete: ${context}`, {
      total: summary.total,
      successful: summary.successCount,
      failed: summary.failureCount
    });
  }

  return summary;
}

/**
 * Send emails in batch with individual error handling
 * Specialized wrapper for email operations
 *
 * @param emailPromises - Array of email send promises
 * @param context - Description of email batch (e.g., "Weekly summaries", "Event notifications")
 * @returns BatchResult with send status
 *
 * @example
 * const emails = users.map(user =>
 *   emailService.send(user.email, 'Subject', 'Body')
 * );
 * const result = await batchSendEmails(emails, 'Weekly newsletter');
 *
 * if (result.failureCount > 0) {
 *   logger.warn(`${result.failureCount} emails failed`, {
 *     failed: result.failed
 *   });
 * }
 */
export async function batchSendEmails(
  emailPromises: Promise<any>[],
  context: string
): Promise<BatchResult<any>> {
  const result = await batchProcess(emailPromises, `Email: ${context}`);

  // Log detailed failure information for emails
  if (result.failureCount > 0) {
    logger.warn(`${result.failureCount} emails failed to send`, {
      context,
      failures: result.failed.map(f => ({
        index: f.index,
        error: f.error instanceof Error ? f.error.message : String(f.error)
      }))
    });
  }

  return result;
}

/**
 * Execute batch operations with retry logic for failed items
 *
 * @param operations - Array of operation functions to execute
 * @param maxRetries - Maximum number of retry attempts per operation
 * @param delayMs - Delay between retries in milliseconds
 * @param context - Context for logging
 * @returns BatchResult after retries
 *
 * @example
 * const operations = users.map(user => () => sendSMS(user.phone, message));
 * const result = await batchProcessWithRetry(
 *   operations,
 *   3,      // Retry up to 3 times
 *   2000,   // Wait 2 seconds between retries
 *   'SMS notifications'
 * );
 */
export async function batchProcessWithRetry<T>(
  operations: Array<() => Promise<T>>,
  maxRetries: number = 3,
  delayMs: number = 1000,
  context?: string
): Promise<BatchResult<T>> {
  const promises = operations.map(async (op, index) => {
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await op();
      } catch (error) {
        lastError = error;

        if (attempt < maxRetries) {
          logger.warn(`Operation ${index} failed, retrying (${attempt}/${maxRetries})`, {
            context,
            error,
            attempt
          });

          // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
        }
      }
    }

    // All retries exhausted
    throw lastError;
  });

  return batchProcess(promises, context);
}

/**
 * Batch process with chunking to avoid overwhelming resources
 *
 * @param items - Array of items to process
 * @param processor - Function to process each item
 * @param chunkSize - Number of items to process concurrently
 * @param context - Context for logging
 * @returns Combined BatchResult from all chunks
 *
 * @example
 * // Process 1000 emails in chunks of 50
 * const result = await batchProcessChunked(
 *   users,
 *   async (user) => sendEmail(user.email, subject, body),
 *   50,
 *   'Mass email campaign'
 * );
 */
export async function batchProcessChunked<T, R>(
  items: T[],
  processor: (item: T, index: number) => Promise<R>,
  chunkSize: number,
  context?: string
): Promise<BatchResult<R>> {
  const allSuccessful: R[] = [];
  const allFailed: Array<{ error: any; index: number; input?: any }> = [];
  let processedCount = 0;

  // Process in chunks
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    const chunkPromises = chunk.map((item, chunkIndex) =>
      processor(item, i + chunkIndex)
    );

    const chunkResult = await batchProcess(
      chunkPromises,
      context ? `${context} (chunk ${Math.floor(i / chunkSize) + 1})` : undefined
    );

    allSuccessful.push(...chunkResult.successful);

    // Adjust indices for failed operations
    allFailed.push(
      ...chunkResult.failed.map(f => ({
        ...f,
        index: i + f.index,
        input: chunk[f.index]
      }))
    );

    processedCount += chunk.length;

    logger.info(`Chunk processed: ${processedCount}/${items.length}`, {
      context,
      chunkSuccess: chunkResult.successCount,
      chunkFailure: chunkResult.failureCount
    });
  }

  return {
    successful: allSuccessful,
    failed: allFailed,
    total: items.length,
    successCount: allSuccessful.length,
    failureCount: allFailed.length
  };
}

/**
 * Helper to determine if a batch result should be considered successful
 * Based on a minimum success threshold
 *
 * @param result - Batch result to evaluate
 * @param minSuccessRate - Minimum success rate (0-1)
 * @returns true if success rate meets threshold
 *
 * @example
 * const result = await batchSendEmails(emailPromises, 'Notifications');
 * if (!isBatchSuccessful(result, 0.9)) {
 *   logger.error('Less than 90% of emails sent successfully');
 *   throw new Error('Batch operation failed to meet success threshold');
 * }
 */
export function isBatchSuccessful<T>(
  result: BatchResult<T>,
  minSuccessRate: number = 0.8
): boolean {
  if (result.total === 0) return true;
  const successRate = result.successCount / result.total;
  return successRate >= minSuccessRate;
}

/**
 * Get a summary message for a batch operation
 *
 * @param result - Batch result to summarize
 * @returns Human-readable summary string
 *
 * @example
 * const result = await batchProcess(operations, 'File uploads');
 * console.log(getBatchSummary(result));
 * // Output: "Batch complete: 95/100 succeeded (95%), 5 failed"
 */
export function getBatchSummary<T>(result: BatchResult<T>): string {
  const successRate = result.total > 0
    ? ((result.successCount / result.total) * 100).toFixed(1)
    : '0';

  return `Batch complete: ${result.successCount}/${result.total} succeeded (${successRate}%), ${result.failureCount} failed`;
}
