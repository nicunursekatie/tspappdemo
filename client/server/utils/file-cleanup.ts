/**
 * File Cleanup Utilities
 *
 * Provides safe file deletion with proper error handling and logging
 * to prevent disk space leaks from failed cleanup operations.
 *
 * See: BUG_FIXES_IMPLEMENTATION_GUIDE.md - BUG-007
 */

import { promises as fs } from 'fs';
import { logger } from './production-safe-logger';

export interface CleanupResult {
  success: boolean;
  path: string;
  error?: any;
}

/**
 * Safely delete a file with proper error handling and logging
 *
 * @param path - Path to file to delete
 * @param context - Optional context for logging (e.g., "expense receipt upload", "temp file")
 * @returns CleanupResult indicating success/failure
 *
 * @example
 * const result = await safeDeleteFile(req.file.path, 'expense receipt upload');
 * if (!result.success) {
 *   logger.warn('File cleanup failed but continuing', { path: result.path });
 * }
 */
export async function safeDeleteFile(
  path: string,
  context?: string
): Promise<CleanupResult> {
  try {
    await fs.unlink(path);

    logger.debug('File deleted successfully', {
      path,
      context
    });

    return { success: true, path };
  } catch (error) {
    const errorCode = (error as any)?.code;

    // ENOENT = file doesn't exist (not really an error)
    if (errorCode === 'ENOENT') {
      logger.debug('File already deleted or does not exist', {
        path,
        context
      });
      return { success: true, path };
    }

    // Other errors are concerning (permission issues, disk errors, etc.)
    logger.error('Failed to delete file', {
      path,
      context,
      error,
      errorCode
    });

    return { success: false, path, error };
  }
}

/**
 * Clean up multiple files
 * Continues attempting to delete all files even if some fail
 *
 * @param paths - Array of file paths to delete
 * @param context - Context for logging
 * @returns Array of CleanupResults
 *
 * @example
 * const tempFiles = [file1.path, file2.path, file3.path];
 * const results = await cleanupFiles(tempFiles, 'batch upload cleanup');
 * const failures = results.filter(r => !r.success);
 * if (failures.length > 0) {
 *   logger.warn(`${failures.length} files failed to cleanup`);
 * }
 */
export async function cleanupFiles(
  paths: string[],
  context?: string
): Promise<CleanupResult[]> {
  const results = await Promise.allSettled(
    paths.map(path => safeDeleteFile(path, context))
  );

  return results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      return {
        success: false,
        path: paths[index],
        error: result.reason
      };
    }
  });
}

/**
 * Delete file and log any errors (fire-and-forget)
 * Use when file deletion is not critical to operation
 *
 * @param path - File path to delete
 * @param context - Context for logging
 *
 * @example
 * // After successful file upload
 * deleteFileAsync(req.file.path, 'upload temp file');
 * // Continue without awaiting deletion
 */
export function deleteFileAsync(path: string, context?: string): void {
  safeDeleteFile(path, context)
    .then(result => {
      if (!result.success) {
        logger.warn('Async file deletion failed', {
          path,
          context,
          error: result.error
        });
      }
    })
    .catch(error => {
      logger.error('Unexpected error in async file deletion', {
        path,
        context,
        error
      });
    });
}

/**
 * Clean up file on request object (common pattern in Express)
 *
 * @param file - Multer file object from request
 * @param context - Context for logging
 * @returns CleanupResult
 *
 * @example
 * // In Express route
 * if (req.file) {
 *   await cleanupUploadedFile(req.file, 'receipt upload error');
 * }
 */
export async function cleanupUploadedFile(
  file: { path: string; originalname?: string },
  context?: string
): Promise<CleanupResult> {
  const fileContext = context
    ? `${context} (${file.originalname || 'unknown'})`
    : file.originalname || 'uploaded file';

  return safeDeleteFile(file.path, fileContext);
}

/**
 * Clean up multiple uploaded files
 *
 * @param files - Array of Multer file objects
 * @param context - Context for logging
 * @returns Array of CleanupResults
 */
export async function cleanupUploadedFiles(
  files: Array<{ path: string; originalname?: string }>,
  context?: string
): Promise<CleanupResult[]> {
  return Promise.all(
    files.map(file => cleanupUploadedFile(file, context))
  );
}
