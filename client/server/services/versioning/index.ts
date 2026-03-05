/**
 * Versioning Service - Wraps version control functionality for routes
 */

import { VersionControl } from '../../middleware/version-control';

export class VersioningService {
  /**
   * Get version history for an entity
   */
  static async getVersionHistory(entityType: string, entityId: number) {
    try {
      return await VersionControl.getVersionHistory(
        entityType as any,
        entityId
      );
    } catch (error) {
      throw new Error(`Failed to get version history: ${error.message}`);
    }
  }

  /**
   * Get specific version of an entity
   */
  static async getVersion(
    entityType: string,
    entityId: number,
    version: number
  ) {
    try {
      const versionData = await VersionControl.getVersion(
        entityType as any,
        entityId,
        version
      );
      if (!versionData) {
        return null;
      }
      return versionData;
    } catch (error) {
      throw new Error(`Failed to get version: ${error.message}`);
    }
  }

  /**
   * Restore a specific version of an entity
   */
  static async restoreVersion(
    entityType: string,
    entityId: number,
    version: number,
    userId: string
  ) {
    try {
      const success = await VersionControl.restoreVersion(
        entityType as any,
        entityId,
        version,
        userId
      );
      return success;
    } catch (error) {
      throw new Error(`Failed to restore version: ${error.message}`);
    }
  }

  /**
   * Compare two versions of an entity
   */
  static async compareVersions(
    entityType: string,
    entityId: number,
    version1: number,
    version2: number
  ) {
    try {
      return await VersionControl.compareVersions(
        entityType as any,
        entityId,
        version1,
        version2
      );
    } catch (error) {
      throw new Error(`Failed to compare versions: ${error.message}`);
    }
  }

  /**
   * Create a changeset
   */
  static async createChangeset(changesetData: any, userId: string) {
    try {
      return await VersionControl.createChangeset({
        ...changesetData,
        userId,
      });
    } catch (error) {
      throw new Error(`Failed to create changeset: ${error.message}`);
    }
  }

  /**
   * Get change statistics
   */
  static async getChangeStats(
    entityType?: string,
    userId?: string,
    startDate?: Date,
    endDate?: Date
  ) {
    try {
      return await VersionControl.getChangeStats(
        entityType as any,
        userId,
        startDate,
        endDate
      );
    } catch (error) {
      throw new Error(`Failed to get change stats: ${error.message}`);
    }
  }

  /**
   * Export version history
   */
  static async exportVersionHistory(entityType?: string, entityId?: number) {
    try {
      return await VersionControl.exportVersionHistory(
        entityType as any,
        entityId
      );
    } catch (error) {
      throw new Error(`Failed to export version history: ${error.message}`);
    }
  }
}
