import { storage } from '../../storage-wrapper';
import { excelImportService } from './excel-import-service';
import { BulkOperationsManager } from '../../bulk-operations';
import { logger } from '../../utils/production-safe-logger';
import type {
  SandwichCollection,
  InsertSandwichCollection,
} from '@shared/schema';
import * as XLSX from 'xlsx';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';

/**
 * Collection Statistics Interface
 */
export interface CollectionStats {
  totalCollections: number;
  totalSandwiches: number;
  totalIndividual: number;
  totalGroups: number;
  averagePerCollection: number;
  largestCollection: number;
  smallestCollection: number;
  hostCount: number;
  dateRange: {
    earliest: string | null;
    latest: string | null;
  };
}

/**
 * Collection Analytics Interface
 */
export interface CollectionAnalytics {
  byHost: Array<{
    hostName: string;
    totalCollections: number;
    totalSandwiches: number;
    averagePerCollection: number;
  }>;
  byMonth: Array<{
    month: string;
    totalCollections: number;
    totalSandwiches: number;
  }>;
  byYear: Array<{
    year: string;
    totalCollections: number;
    totalSandwiches: number;
  }>;
  trends: {
    growthRate: number;
    averageMonthlyGrowth: number;
  };
}

/**
 * Collection Search Filters
 */
export interface CollectionFilters {
  hostName?: string;
  startDate?: string;
  endDate?: string;
  minSandwiches?: number;
  maxSandwiches?: number;
  createdBy?: string;
  submissionMethod?: string;
}

/**
 * Bulk Operation Result
 */
export interface BulkOperationResult {
  success: boolean;
  processed: number;
  created?: number;
  updated?: number;
  deleted?: number;
  errors: string[];
}

/**
 * Export Format
 */
export type ExportFormat = 'xlsx' | 'csv' | 'json';

/**
 * Export Options
 */
export interface ExportOptions {
  format: ExportFormat;
  filters?: CollectionFilters;
  includeMetadata?: boolean;
  filename?: string;
}

/**
 * Sandwich Collections Service Interface
 */
export interface ICollectionService {
  // Advanced collection tracking
  getCollectionStats(filters?: CollectionFilters): Promise<CollectionStats>;
  getCollectionAnalytics(
    filters?: CollectionFilters
  ): Promise<CollectionAnalytics>;
  getCollectionTrends(
    startDate: string,
    endDate: string
  ): Promise<CollectionAnalytics>;

  // Search and filtering
  searchCollections(
    filters: CollectionFilters,
    limit?: number,
    offset?: number
  ): Promise<SandwichCollection[]>;
  getCollectionsByHost(
    hostName: string,
    limit?: number,
    offset?: number
  ): Promise<SandwichCollection[]>;
  getCollectionsByDateRange(
    startDate: string,
    endDate: string,
    limit?: number,
    offset?: number
  ): Promise<SandwichCollection[]>;
  getCollectionsByUser(
    userId: string,
    limit?: number,
    offset?: number
  ): Promise<SandwichCollection[]>;

  // Validation and data quality
  validateCollection(
    collection: Partial<InsertSandwichCollection>
  ): { valid: boolean; errors: string[] };
  detectDuplicates(): Promise<
    Array<{ entries: SandwichCollection[]; reason: string }>
  >;
  validateDataIntegrity(): Promise<{
    issues: Array<{ type: string; description: string; count: number }>;
    summary: { totalIssues: number; criticalIssues: number };
  }>;

  // Bulk operations
  bulkCreateCollections(
    collections: InsertSandwichCollection[],
    userId?: string
  ): Promise<BulkOperationResult>;
  bulkUpdateCollections(
    updates: Array<{ id: number; data: Partial<SandwichCollection> }>,
    userId?: string
  ): Promise<BulkOperationResult>;
  bulkDeleteCollections(ids: number[]): Promise<BulkOperationResult>;
  deduplicateCollections(): Promise<BulkOperationResult>;

  // Import/Export functionality
  importFromExcel(
    buffer: Buffer,
    userId: string
  ): Promise<{
    success: boolean;
    imported: number;
    skipped: number;
    errors: Array<{ row: number; error: string }>;
  }>;
  importFromCSV(
    csvData: string,
    userId: string
  ): Promise<{
    success: boolean;
    imported: number;
    skipped: number;
    errors: Array<{ row: number; error: string }>;
  }>;
  exportCollections(options: ExportOptions): Promise<Buffer>;
  generateImportTemplate(format: 'xlsx' | 'csv'): Buffer;
}

/**
 * Collections Service Implementation
 */
export class CollectionService implements ICollectionService {
  /**
   * Get comprehensive collection statistics
   */
  async getCollectionStats(
    filters?: CollectionFilters
  ): Promise<CollectionStats> {
    try {
      let collections = await storage.getAllSandwichCollections();

      // Apply filters if provided
      if (filters) {
        collections = this.applyFilters(collections, filters);
      }

      if (collections.length === 0) {
        return {
          totalCollections: 0,
          totalSandwiches: 0,
          totalIndividual: 0,
          totalGroups: 0,
          averagePerCollection: 0,
          largestCollection: 0,
          smallestCollection: 0,
          hostCount: 0,
          dateRange: { earliest: null, latest: null },
        };
      }

      let totalIndividual = 0;
      let totalGroups = 0;
      let largest = 0;
      let smallest = Number.MAX_VALUE;
      const hosts = new Set<string>();
      const dates: string[] = [];

      collections.forEach((collection) => {
        const individual = collection.individualSandwiches || 0;
        const groupTotal = this.calculateGroupTotal(collection);
        const total = individual + groupTotal;

        totalIndividual += individual;
        totalGroups += groupTotal;
        largest = Math.max(largest, total);
        smallest = Math.min(smallest, total);

        if (collection.hostName) {
          hosts.add(collection.hostName);
        }

        if (collection.collectionDate) {
          dates.push(collection.collectionDate);
        }
      });

      const totalSandwiches = totalIndividual + totalGroups;
      dates.sort();

      return {
        totalCollections: collections.length,
        totalSandwiches,
        totalIndividual,
        totalGroups,
        averagePerCollection:
          collections.length > 0 ? totalSandwiches / collections.length : 0,
        largestCollection: largest,
        smallestCollection: smallest === Number.MAX_VALUE ? 0 : smallest,
        hostCount: hosts.size,
        dateRange: {
          earliest: dates.length > 0 ? dates[0] : null,
          latest: dates.length > 0 ? dates[dates.length - 1] : null,
        },
      };
    } catch (error) {
      logger.error('Error getting collection stats:', error);
      throw new Error('Failed to get collection statistics');
    }
  }

  /**
   * Get detailed analytics for collections
   */
  async getCollectionAnalytics(
    filters?: CollectionFilters
  ): Promise<CollectionAnalytics> {
    try {
      let collections = await storage.getAllSandwichCollections();

      // Apply filters if provided
      if (filters) {
        collections = this.applyFilters(collections, filters);
      }

      // Analytics by host
      const hostMap = new Map<
        string,
        { count: number; sandwiches: number }
      >();
      collections.forEach((collection) => {
        const hostName = collection.hostName || 'Unknown';
        const total = this.calculateTotal(collection);

        if (!hostMap.has(hostName)) {
          hostMap.set(hostName, { count: 0, sandwiches: 0 });
        }

        const hostData = hostMap.get(hostName)!;
        hostData.count++;
        hostData.sandwiches += total;
      });

      const byHost = Array.from(hostMap.entries())
        .map(([hostName, data]) => ({
          hostName,
          totalCollections: data.count,
          totalSandwiches: data.sandwiches,
          averagePerCollection: data.sandwiches / data.count,
        }))
        .sort((a, b) => b.totalSandwiches - a.totalSandwiches);

      // Analytics by month
      const monthMap = new Map<string, { count: number; sandwiches: number }>();
      collections.forEach((collection) => {
        const date = new Date(collection.collectionDate);
        const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const total = this.calculateTotal(collection);

        if (!monthMap.has(month)) {
          monthMap.set(month, { count: 0, sandwiches: 0 });
        }

        const monthData = monthMap.get(month)!;
        monthData.count++;
        monthData.sandwiches += total;
      });

      const byMonth = Array.from(monthMap.entries())
        .map(([month, data]) => ({
          month,
          totalCollections: data.count,
          totalSandwiches: data.sandwiches,
        }))
        .sort((a, b) => a.month.localeCompare(b.month));

      // Analytics by year
      const yearMap = new Map<string, { count: number; sandwiches: number }>();
      collections.forEach((collection) => {
        const date = new Date(collection.collectionDate);
        const year = String(date.getFullYear());
        const total = this.calculateTotal(collection);

        if (!yearMap.has(year)) {
          yearMap.set(year, { count: 0, sandwiches: 0 });
        }

        const yearData = yearMap.get(year)!;
        yearData.count++;
        yearData.sandwiches += total;
      });

      const byYear = Array.from(yearMap.entries())
        .map(([year, data]) => ({
          year,
          totalCollections: data.count,
          totalSandwiches: data.sandwiches,
        }))
        .sort((a, b) => a.year.localeCompare(b.year));

      // Calculate trends
      const growthRate = this.calculateGrowthRate(byMonth);
      const averageMonthlyGrowth = this.calculateAverageMonthlyGrowth(byMonth);

      return {
        byHost,
        byMonth,
        byYear,
        trends: {
          growthRate,
          averageMonthlyGrowth,
        },
      };
    } catch (error) {
      logger.error('Error getting collection analytics:', error);
      throw new Error('Failed to get collection analytics');
    }
  }

  /**
   * Get collection trends over a date range
   */
  async getCollectionTrends(
    startDate: string,
    endDate: string
  ): Promise<CollectionAnalytics> {
    return this.getCollectionAnalytics({
      startDate,
      endDate,
    });
  }

  /**
   * Search collections with filters
   */
  async searchCollections(
    filters: CollectionFilters,
    limit: number = 50,
    offset: number = 0
  ): Promise<SandwichCollection[]> {
    try {
      let collections = await storage.getAllSandwichCollections();
      collections = this.applyFilters(collections, filters);

      // Sort by collection date descending
      collections.sort(
        (a, b) =>
          new Date(b.collectionDate).getTime() -
          new Date(a.collectionDate).getTime()
      );

      return collections.slice(offset, offset + limit);
    } catch (error) {
      logger.error('Error searching collections:', error);
      throw new Error('Failed to search collections');
    }
  }

  /**
   * Get collections by host
   */
  async getCollectionsByHost(
    hostName: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<SandwichCollection[]> {
    return this.searchCollections({ hostName }, limit, offset);
  }

  /**
   * Get collections by date range
   */
  async getCollectionsByDateRange(
    startDate: string,
    endDate: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<SandwichCollection[]> {
    return this.searchCollections({ startDate, endDate }, limit, offset);
  }

  /**
   * Get collections by user
   */
  async getCollectionsByUser(
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<SandwichCollection[]> {
    return this.searchCollections({ createdBy: userId }, limit, offset);
  }

  /**
   * Validate collection data
   */
  validateCollection(
    collection: Partial<InsertSandwichCollection>
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Required fields
    if (!collection.collectionDate) {
      errors.push('Collection date is required');
    }

    if (!collection.hostName || collection.hostName.trim() === '') {
      errors.push('Host name is required');
    }

    // Validate date format
    if (collection.collectionDate) {
      const date = new Date(collection.collectionDate);
      if (isNaN(date.getTime())) {
        errors.push('Invalid collection date format');
      }

      // Check if date is not in the future
      if (date > new Date()) {
        errors.push('Collection date cannot be in the future');
      }
    }

    // Validate sandwich counts
    const individual = collection.individualSandwiches || 0;
    if (individual < 0) {
      errors.push('Individual sandwiches count cannot be negative');
    }

    // Validate group collections if present
    if (collection.groupCollections) {
      if (
        typeof collection.groupCollections === 'string' ||
        Array.isArray(collection.groupCollections)
      ) {
        try {
          const groups =
            typeof collection.groupCollections === 'string'
              ? JSON.parse(collection.groupCollections)
              : collection.groupCollections;

          if (Array.isArray(groups)) {
            groups.forEach((group: any, index: number) => {
              if (!group.name || group.name.trim() === '') {
                errors.push(`Group ${index + 1} must have a name`);
              }
              if (
                typeof group.count !== 'number' ||
                group.count < 0
              ) {
                errors.push(
                  `Group ${index + 1} must have a valid count (non-negative number)`
                );
              }
            });
          }
        } catch (e) {
          errors.push('Invalid group collections format');
        }
      }
    }

    // At least some sandwiches should be collected
    // Use EITHER groupCollections OR group1/group2, never both
    let groupTotal = 0;
    if (collection.groupCollections) {
      try {
        const groups =
          typeof collection.groupCollections === 'string'
            ? JSON.parse(collection.groupCollections)
            : collection.groupCollections;
        if (Array.isArray(groups) && groups.length > 0) {
          groupTotal = groups.reduce((sum: number, g: any) => sum + (g.count || 0), 0);
        }
      } catch (e) {
        // Invalid format already caught above
      }
    } else {
      groupTotal = (collection.group1Count || 0) + (collection.group2Count || 0);
    }

    if (individual === 0 && groupTotal === 0) {
      errors.push(
        'Collection must have at least some sandwiches (individual or group)'
      );
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Detect duplicate collections
   */
  async detectDuplicates(): Promise<
    Array<{ entries: SandwichCollection[]; reason: string }>
  > {
    try {
      const collections = await storage.getAllSandwichCollections();
      const duplicateGroups = new Map<string, SandwichCollection[]>();

      collections.forEach((collection) => {
        // Create a key based on date, host, and counts
        const key = `${collection.collectionDate}-${collection.hostName}-${collection.individualSandwiches}-${this.calculateGroupTotal(collection)}`;

        if (!duplicateGroups.has(key)) {
          duplicateGroups.set(key, []);
        }
        duplicateGroups.get(key)!.push(collection);
      });

      const duplicates: Array<{
        entries: SandwichCollection[];
        reason: string;
      }> = [];

      duplicateGroups.forEach((group) => {
        if (group.length > 1) {
          duplicates.push({
            entries: group,
            reason: `${group.length} collections with same date, host, and sandwich counts`,
          });
        }
      });

      return duplicates;
    } catch (error) {
      logger.error('Error detecting duplicates:', error);
      throw new Error('Failed to detect duplicates');
    }
  }

  /**
   * Validate data integrity
   */
  async validateDataIntegrity(): Promise<{
    issues: Array<{ type: string; description: string; count: number }>;
    summary: { totalIssues: number; criticalIssues: number };
  }> {
    try {
      const collections = await storage.getAllSandwichCollections();
      const issues: Array<{ type: string; description: string; count: number }> =
        [];

      // Check for missing dates
      const missingDates = collections.filter((c) => !c.collectionDate);
      if (missingDates.length > 0) {
        issues.push({
          type: 'missing_dates',
          description: 'Collections with missing dates',
          count: missingDates.length,
        });
      }

      // Check for invalid dates
      const invalidDates = collections.filter((c) => {
        if (!c.collectionDate) return false;
        const date = new Date(c.collectionDate);
        return isNaN(date.getTime());
      });
      if (invalidDates.length > 0) {
        issues.push({
          type: 'invalid_dates',
          description: 'Collections with invalid date format',
          count: invalidDates.length,
        });
      }

      // Check for missing host names
      const missingHosts = collections.filter(
        (c) => !c.hostName || c.hostName.trim() === ''
      );
      if (missingHosts.length > 0) {
        issues.push({
          type: 'missing_hosts',
          description: 'Collections with missing host names',
          count: missingHosts.length,
        });
      }

      // Check for zero sandwich counts
      const zeroSandwiches = collections.filter((c) => {
        const total = this.calculateTotal(c);
        return total === 0;
      });
      if (zeroSandwiches.length > 0) {
        issues.push({
          type: 'zero_sandwiches',
          description: 'Collections with zero sandwiches',
          count: zeroSandwiches.length,
        });
      }

      // Check for suspicious patterns (test/dummy data, not legitimate organizations)
      const suspiciousNames = collections.filter((c) => {
        const name = (c.hostName || '').toLowerCase().trim();
        return (
          // Test data patterns (specific patterns to avoid false positives)
          name === 'test' ||
          name === 'sample' ||
          name === 'demo' ||
          name.startsWith('test ') || // "test something" but not "Contest Hall"
          name.startsWith('test_') || // "test_location"
          name.startsWith('test-') || // "test-location"
          name.endsWith(' test') || // "something test"
          // Location placeholders (very specific patterns)
          name === 'loc' || // Exact match only
          name === 'location' || // Exact match only
          name.match(/^loc\s*\d+$/) || // "loc 1", "loc1", "loc 123" but not "Local Kitchen"
          name.match(/^location\s*\d+$/) || // "location 1", "location1"
          // Only flag very obvious test group patterns (single digit groups)
          name.match(/^group\s*[1-9]$/) || // "group 1", "group1" through "group 9" only
          // Placeholder names
          name === 'unknown' ||
          name === 'tbd' ||
          name === 'tba' ||
          name === 'placeholder' ||
          name === 'n/a' ||
          name === 'na' ||
          name === 'none' ||
          // Invalid formats (but allow legitimate 2-letter abbreviations)
          name.length < 2 || // Single character only
          name.match(/^\d+$/) || // Pure numbers like "123"
          (name.length === 2 && name.match(/^[a-z]{2}$/) && !this.isLegitimateAbbreviation(name)) // Two lowercase letters (not uppercase abbreviations)
        );
      });
      if (suspiciousNames.length > 0) {
        issues.push({
          type: 'suspicious_names',
          description: 'Collections with suspicious host names',
          count: suspiciousNames.length,
        });
      }

      const totalIssues = issues.reduce((sum, issue) => sum + issue.count, 0);
      const criticalIssues = issues
        .filter(
          (i) =>
            i.type === 'missing_dates' ||
            i.type === 'invalid_dates' ||
            i.type === 'missing_hosts'
        )
        .reduce((sum, issue) => sum + issue.count, 0);

      return {
        issues,
        summary: { totalIssues, criticalIssues },
      };
    } catch (error) {
      logger.error('Error validating data integrity:', error);
      throw new Error('Failed to validate data integrity');
    }
  }

  /**
   * Bulk create collections
   */
  async bulkCreateCollections(
    collections: InsertSandwichCollection[],
    userId?: string
  ): Promise<BulkOperationResult> {
    const result: BulkOperationResult = {
      success: true,
      processed: 0,
      created: 0,
      errors: [],
    };

    try {
      for (const collection of collections) {
        // Validate collection
        const validation = this.validateCollection(collection);
        if (!validation.valid) {
          result.errors.push(
            `Invalid collection for ${collection.hostName}: ${validation.errors.join(', ')}`
          );
          continue;
        }

        try {
          // Add user attribution
          const enriched = {
            ...collection,
            createdBy: userId || collection.createdBy || 'system',
          };

          await storage.createSandwichCollection(enriched);
          result.created!++;
          result.processed++;
        } catch (error) {
          result.errors.push(
            `Failed to create collection for ${collection.hostName}: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
      }

      if (result.errors.length > 0) {
        result.success = false;
      }

      return result;
    } catch (error) {
      logger.error('Bulk create collections failed:', error);
      return {
        success: false,
        processed: 0,
        errors: [
          `Bulk creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ],
      };
    }
  }

  /**
   * Bulk update collections
   */
  async bulkUpdateCollections(
    updates: Array<{ id: number; data: Partial<SandwichCollection> }>,
    userId?: string
  ): Promise<BulkOperationResult> {
    const result: BulkOperationResult = {
      success: true,
      processed: 0,
      updated: 0,
      errors: [],
    };

    try {
      for (const update of updates) {
        try {
          const updated = await storage.updateSandwichCollection(
            update.id,
            update.data
          );
          if (updated) {
            result.updated!++;
            result.processed++;
          } else {
            result.errors.push(
              `Collection with ID ${update.id} not found`
            );
          }
        } catch (error) {
          result.errors.push(
            `Failed to update collection ${update.id}: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
      }

      if (result.errors.length > 0) {
        result.success = false;
      }

      return result;
    } catch (error) {
      logger.error('Bulk update collections failed:', error);
      return {
        success: false,
        processed: 0,
        errors: [
          `Bulk update failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ],
      };
    }
  }

  /**
   * Bulk delete collections
   */
  async bulkDeleteCollections(ids: number[]): Promise<BulkOperationResult> {
    const result: BulkOperationResult = {
      success: true,
      processed: 0,
      deleted: 0,
      errors: [],
    };

    try {
      for (const id of ids) {
        try {
          const deleted = await storage.deleteSandwichCollection(id);
          if (deleted) {
            result.deleted!++;
            result.processed++;
          } else {
            result.errors.push(`Collection with ID ${id} not found`);
          }
        } catch (error) {
          result.errors.push(
            `Failed to delete collection ${id}: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
      }

      if (result.errors.length > 0) {
        result.success = false;
      }

      return result;
    } catch (error) {
      logger.error('Bulk delete collections failed:', error);
      return {
        success: false,
        processed: 0,
        errors: [
          `Bulk deletion failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ],
      };
    }
  }

  /**
   * Deduplicate collections
   */
  async deduplicateCollections(): Promise<BulkOperationResult> {
    try {
      const duplicates = await this.detectDuplicates();
      const idsToDelete: number[] = [];

      // Keep the newest entry from each duplicate group
      duplicates.forEach((group) => {
        const sorted = group.entries.sort((a, b) => {
          // Primary sort: newest first (by submittedAt)
          const timeDiff =
            new Date(b.submittedAt).getTime() -
            new Date(a.submittedAt).getTime();

          // Secondary sort: if timestamps are identical, sort by ID (highest first)
          // This ensures deterministic behavior for bulk imports with same timestamp
          if (timeDiff === 0) {
            return b.id - a.id;
          }

          return timeDiff;
        });
        // Keep first (newest), delete rest
        idsToDelete.push(...sorted.slice(1).map((c) => c.id));
      });

      return this.bulkDeleteCollections(idsToDelete);
    } catch (error) {
      logger.error('Deduplication failed:', error);
      return {
        success: false,
        processed: 0,
        errors: [
          `Deduplication failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ],
      };
    }
  }

  /**
   * Import collections from Excel
   */
  async importFromExcel(
    buffer: Buffer,
    userId: string
  ): Promise<{
    success: boolean;
    imported: number;
    skipped: number;
    errors: Array<{ row: number; error: string }>;
  }> {
    try {
      const rows = excelImportService.parseExcelFile(buffer);
      const result = await excelImportService.importHistoricalRecords(
        rows,
        userId
      );

      return {
        success: result.success,
        imported: result.imported,
        skipped: result.skipped,
        errors: result.errors.map((e) => ({
          row: e.row,
          error: e.error,
        })),
      };
    } catch (error) {
      logger.error('Excel import failed:', error);
      throw new Error(
        `Excel import failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Import collections from CSV
   */
  async importFromCSV(
    csvData: string,
    userId: string
  ): Promise<{
    success: boolean;
    imported: number;
    skipped: number;
    errors: Array<{ row: number; error: string }>;
  }> {
    try {
      const rows = parse(csvData, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });

      const result = await excelImportService.importHistoricalRecords(
        rows,
        userId
      );

      return {
        success: result.success,
        imported: result.imported,
        skipped: result.skipped,
        errors: result.errors.map((e) => ({
          row: e.row,
          error: e.error,
        })),
      };
    } catch (error) {
      logger.error('CSV import failed:', error);
      throw new Error(
        `CSV import failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Export collections to various formats
   */
  async exportCollections(options: ExportOptions): Promise<Buffer> {
    try {
      let collections = await storage.getAllSandwichCollections();

      // Apply filters if provided
      if (options.filters) {
        collections = this.applyFilters(collections, options.filters);
      }

      // Prepare data for export
      const exportData = collections.map((c) => {
        const baseData = {
          id: c.id,
          collectionDate: c.collectionDate,
          hostName: c.hostName,
          individualSandwiches: c.individualSandwiches || 0,
          group1Name: c.group1Name || '',
          group1Count: c.group1Count || 0,
          group2Name: c.group2Name || '',
          group2Count: c.group2Count || 0,
          totalSandwiches: this.calculateTotal(c),
        };

        if (options.includeMetadata) {
          return {
            ...baseData,
            createdBy: c.createdBy || '',
            createdByName: c.createdByName || '',
            submittedAt: c.submittedAt,
            submissionMethod: c.submissionMethod || 'standard',
          };
        }

        return baseData;
      });

      // Generate export based on format
      switch (options.format) {
        case 'xlsx':
          return this.exportToExcel(exportData, options.includeMetadata || false);
        case 'csv':
          return this.exportToCSV(exportData, options.includeMetadata || false);
        case 'json':
          return Buffer.from(JSON.stringify(exportData, null, 2), 'utf-8');
        default:
          throw new Error(`Unsupported export format: ${options.format}`);
      }
    } catch (error) {
      logger.error('Export collections failed:', error);
      throw new Error(
        `Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Generate import template
   */
  generateImportTemplate(format: 'xlsx' | 'csv'): Buffer {
    if (format === 'xlsx') {
      return excelImportService.generateTemplate();
    } else {
      // CSV template
      const headers = [
        'organizationName',
        'eventDate',
        'eventType',
        'sandwichesProvided',
        'contactName',
        'contactEmail',
        'contactPhone',
        'department',
        'location',
        'notes',
        'status',
        'tspContact',
      ];

      const exampleRow = {
        organizationName: 'Example Organization',
        eventDate: '2024-01-15',
        eventType: 'sandwich_distribution',
        sandwichesProvided: '50',
        contactName: 'John Doe',
        contactEmail: 'john@example.org',
        contactPhone: '555-0123',
        department: 'Community Services',
        location: '123 Main St',
        notes: 'Regular monthly distribution',
        status: 'completed',
        tspContact: 'Jane Smith',
      };

      const csvContent = stringify([headers, Object.values(exampleRow)]);
      return Buffer.from(csvContent, 'utf-8');
    }
  }

  // ========== Private Helper Methods ==========

  /**
   * Calculate total sandwiches in a collection
   */
  private calculateTotal(collection: SandwichCollection): number {
    const individual = collection.individualSandwiches || 0;
    const groupTotal = this.calculateGroupTotal(collection);
    return individual + groupTotal;
  }

  /**
   * Calculate group total from collection
   */
  private calculateGroupTotal(collection: SandwichCollection): number {
    let groupTotal = 0;

    // Check new groupCollections JSONB array
    if (
      collection.groupCollections &&
      Array.isArray(collection.groupCollections) &&
      collection.groupCollections.length > 0
    ) {
      groupTotal = collection.groupCollections.reduce(
        (sum: number, group: any) => sum + (group.count || 0),
        0
      );
    }
    // Fallback to legacy columns
    else {
      groupTotal =
        (collection.group1Count || 0) + (collection.group2Count || 0);
    }

    return groupTotal;
  }

  /**
   * Apply filters to collections
   */
  private applyFilters(
    collections: SandwichCollection[],
    filters: CollectionFilters
  ): SandwichCollection[] {
    let filtered = [...collections];

    if (filters.hostName) {
      const searchTerm = filters.hostName.toLowerCase();
      filtered = filtered.filter((c) =>
        c.hostName?.toLowerCase().includes(searchTerm)
      );
    }

    if (filters.startDate) {
      const startDate = new Date(filters.startDate);
      filtered = filtered.filter(
        (c) => new Date(c.collectionDate) >= startDate
      );
    }

    if (filters.endDate) {
      const endDate = new Date(filters.endDate);
      filtered = filtered.filter(
        (c) => new Date(c.collectionDate) <= endDate
      );
    }

    if (filters.minSandwiches !== undefined) {
      filtered = filtered.filter(
        (c) => this.calculateTotal(c) >= filters.minSandwiches!
      );
    }

    if (filters.maxSandwiches !== undefined) {
      filtered = filtered.filter(
        (c) => this.calculateTotal(c) <= filters.maxSandwiches!
      );
    }

    if (filters.createdBy) {
      filtered = filtered.filter((c) => c.createdBy === filters.createdBy);
    }

    if (filters.submissionMethod) {
      filtered = filtered.filter(
        (c) => c.submissionMethod === filters.submissionMethod
      );
    }

    return filtered;
  }

  /**
   * Check if a 2-letter name is a legitimate abbreviation
   * (e.g., "VA", "UN", "NY") rather than test data (e.g., "ab", "xy")
   */
  private isLegitimateAbbreviation(name: string): boolean {
    // Common legitimate 2-letter abbreviations
    const legitimateAbbreviations = new Set([
      'va', // Veterans Affairs / Virginia
      'un', // United Nations
      'ny', // New York
      'la', // Los Angeles / Louisiana
      'dc', // District of Columbia
      'aa', // Alcoholics Anonymous
      'ca', // California
      'ma', // Massachusetts
      'pa', // Pennsylvania
      'tx', // Texas
      'fl', // Florida
      'il', // Illinois
      'oh', // Ohio
      'nc', // North Carolina
      'ga', // Georgia
      'mi', // Michigan
      'nj', // New Jersey
      'az', // Arizona
      'wa', // Washington
      'tn', // Tennessee
      'md', // Maryland
      'mn', // Minnesota
      'co', // Colorado
      'wi', // Wisconsin
      'or', // Oregon
      'sc', // South Carolina
      'ky', // Kentucky
      'al', // Alabama
      'ok', // Oklahoma
      'ct', // Connecticut
      'ia', // Iowa
      'ms', // Mississippi
      'ar', // Arkansas
      'ks', // Kansas
      'nv', // Nevada
      'nm', // New Mexico
      'wv', // West Virginia
      'ne', // Nebraska
      'id', // Idaho
      'hi', // Hawaii
      'me', // Maine
      'nh', // New Hampshire
      'ri', // Rhode Island
      'mt', // Montana
      'de', // Delaware
      'sd', // South Dakota
      'nd', // North Dakota
      'ak', // Alaska
      'vt', // Vermont
      'wy', // Wyoming
      'ut', // Utah
      'in', // Indiana
      'mo', // Missouri
    ]);

    return legitimateAbbreviations.has(name.toLowerCase());
  }

  /**
   * Calculate growth rate from monthly data
   */
  private calculateGrowthRate(
    monthlyData: Array<{ month: string; totalSandwiches: number }>
  ): number {
    if (monthlyData.length < 2) return 0;

    const firstMonth = monthlyData[0].totalSandwiches;
    const lastMonth = monthlyData[monthlyData.length - 1].totalSandwiches;

    if (firstMonth === 0) return 0;

    return ((lastMonth - firstMonth) / firstMonth) * 100;
  }

  /**
   * Calculate average monthly growth
   */
  private calculateAverageMonthlyGrowth(
    monthlyData: Array<{ month: string; totalSandwiches: number }>
  ): number {
    if (monthlyData.length < 2) return 0;

    let totalGrowth = 0;
    let validMonths = 0;

    for (let i = 1; i < monthlyData.length; i++) {
      const prev = monthlyData[i - 1].totalSandwiches;
      const curr = monthlyData[i].totalSandwiches;

      if (prev > 0) {
        totalGrowth += ((curr - prev) / prev) * 100;
        validMonths++;
      }
    }

    return validMonths > 0 ? totalGrowth / validMonths : 0;
  }

  /**
   * Export data to Excel format
   */
  private exportToExcel(data: any[], includeMetadata: boolean = false): Buffer {
    // Handle empty data array
    if (data.length === 0) {
      // Define headers based on whether metadata is included
      const baseHeaders = [
        'id',
        'collectionDate',
        'hostName',
        'individualSandwiches',
        'group1Name',
        'group1Count',
        'group2Name',
        'group2Count',
        'totalSandwiches',
      ];

      const metadataHeaders = [
        'createdBy',
        'createdByName',
        'submittedAt',
        'submissionMethod',
      ];

      const headers = includeMetadata
        ? [...baseHeaders, ...metadataHeaders]
        : baseHeaders;

      // Create worksheet from headers array
      const worksheet = XLSX.utils.aoa_to_sheet([headers]);

      // Set column widths
      worksheet['!cols'] = headers.map(() => ({ width: 20 }));

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Collections');

      return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    }

    const worksheet = XLSX.utils.json_to_sheet(data);

    // Set column widths
    const headers = Object.keys(data[0]);
    worksheet['!cols'] = headers.map(() => ({ width: 20 }));

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Collections');

    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  }

  /**
   * Export data to CSV format
   */
  private exportToCSV(data: any[], includeMetadata: boolean = false): Buffer {
    // Handle empty data array
    if (data.length === 0) {
      // Define headers based on whether metadata is included
      const baseHeaders = [
        'id',
        'collectionDate',
        'hostName',
        'individualSandwiches',
        'group1Name',
        'group1Count',
        'group2Name',
        'group2Count',
        'totalSandwiches',
      ];

      const metadataHeaders = [
        'createdBy',
        'createdByName',
        'submittedAt',
        'submissionMethod',
      ];

      const headers = includeMetadata
        ? [...baseHeaders, ...metadataHeaders]
        : baseHeaders;

      const csvContent = stringify([headers]);
      return Buffer.from(csvContent, 'utf-8');
    }

    const csvContent = stringify(data, {
      header: true,
      columns: Object.keys(data[0]),
    });
    return Buffer.from(csvContent, 'utf-8');
  }
}

// Export singleton instance
export const collectionService = new CollectionService();
