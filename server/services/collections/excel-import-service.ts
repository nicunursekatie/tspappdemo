import * as XLSX from 'xlsx';
import { storage } from '../../storage-wrapper';
import { logger } from '../../middleware/logger';
import { AuditLogger } from '../../audit-logger';

export interface ExcelImportRow {
  organizationName?: string;
  eventDate?: string;
  eventType?: string;
  sandwichesProvided?: number | string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  department?: string;
  location?: string;
  notes?: string;
  status?: string;
  tspContact?: string;
  // Allow any additional columns
  [key: string]: any;
}

export interface ImportResult {
  success: boolean;
  totalRows: number;
  imported: number;
  skipped: number;
  errors: ImportError[];
  summary: ImportSummary;
}

export interface ImportError {
  row: number;
  data: ExcelImportRow;
  error: string;
}

export interface ImportSummary {
  newOrganizations: string[];
  updatedOrganizations: string[];
  totalSandwiches: number;
}

export class ExcelImportService {
  /**
   * Column name mapping for flexible imports
   * Maps various common column names to expected field names
   */
  private normalizeColumnNames(row: any): ExcelImportRow {
    const normalized: ExcelImportRow = {};

    // Map each field from various possible column names (all lowercase for matching)
    const fieldMappings: Record<string, string[]> = {
      organizationName: [
        'organizationname', 'organization name', 'organization', 'org name', 'org',
        'groupe name', 'group name', 'group', 'name', 'recipient', 'destination/recipient',
        'destination', 'organization/recipient', 'group', 'groupe'
      ],
      eventDate: [
        'eventdate', 'event date', 'date', 'event_date', 'delivery date', 'delivery_date'
      ],
      sandwichesProvided: [
        'sandwichesprovided', 'sandwiches provided', 'sandwiches', 'final # sandwiches made',
        'final sandwiches', '# sandwiches', '# of sandwiches', 'number of sandwiches', 'sandwich count', 'count',
        'approx sandwiches', 'approx sandwiches -goal of', 'final # sandwiches made'
      ],
      eventType: [
        'eventtype', 'event type', 'type', 'type of sandwich', 'sandwich type', 'event_type'
      ],
      contactName: [
        'contactname', 'contact name', 'contact', 'contact_name', 'person', 'primary contact'
      ],
      contactEmail: [
        'contactemail', 'contact email', 'email', 'email address', 'contact_email', 'e-mail'
      ],
      contactPhone: [
        'contactphone', 'contact phone', 'phone', 'contact cell number', 'cell', 'cell number',
        'phone number', 'contact_phone', 'telephone'
      ],
      location: [
        'location', 'address', 'delivery location', 'delivery address', 'site', 'venue'
      ],
      tspContact: [
        'tspcontact', 'tsp contact', 'tsp', 'staff', 'staff contact', 'coordinator', 'tsp_contact'
      ],
      notes: [
        'notes', 'note', 'comments', 'remarks', 'driver', 'special instructions', 'details'
      ],
      status: [
        'status', 'event status', 'state', 'completion status'
      ],
      department: [
        'department', 'dept', 'division', 'unit'
      ]
    };

    // Normalize each row key-value pair
    const notesParts: string[] = []; // Collect multiple notes fields

    for (const [originalKey, value] of Object.entries(row)) {
      // Skip null/undefined but allow empty strings (we'll handle validation later)
      if (value === null || value === undefined) {
        continue;
      }

      const normalizedKey = originalKey.toLowerCase().trim();

      // Find which standard field this column maps to
      let mapped = false;
      for (const [standardField, variations] of Object.entries(fieldMappings)) {
        if (variations.includes(normalizedKey)) {
          // Special handling for notes - combine multiple sources
          if (standardField === 'notes') {
            if (value && String(value).trim()) {
              notesParts.push(`${originalKey}: ${value}`);
            }
          } else {
            // Only set if value is not empty
            if (value !== '') {
              normalized[standardField] = value;
            }
          }
          mapped = true;
          break;
        }
      }

      // If not mapped, keep original (in case of custom fields)
      if (!mapped && value !== '') {
        normalized[originalKey] = value;
      }
    }

    // Combine all notes parts
    if (notesParts.length > 0) {
      normalized.notes = notesParts.join('; ');
    }

    // Debug log for troubleshooting
    if (!normalized.organizationName) {
      logger.warn('No organization name found after normalization', {
        originalKeys: Object.keys(row),
        normalizedKeys: Object.keys(normalized),
        sampleValue: row['Group Name'] || row['Groupe Name'] || row['group name']
      });
    }

    return normalized;
  }

  /**
   * Parse Excel file buffer and return rows
   */
  parseExcelFile(buffer: Buffer): ExcelImportRow[] {
    try {
      const workbook = XLSX.read(buffer, { type: 'buffer' });

      // Get first sheet
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        throw new Error('No sheets found in Excel file');
      }

      const worksheet = workbook.Sheets[sheetName];

      // Convert to JSON with header row
      const rawData = XLSX.utils.sheet_to_json(worksheet, {
        raw: false,
        defval: undefined,
      });

      // Normalize column names
      const data = rawData.map(row => this.normalizeColumnNames(row));

      logger.info('Excel file parsed successfully', {
        sheetName,
        rowCount: data.length,
        originalColumns: rawData.length > 0 ? Object.keys(rawData[0]) : [],
        normalizedColumns: data.length > 0 ? Object.keys(data[0]) : [],
      });

      return data;
    } catch (error) {
      logger.error('Failed to parse Excel file', error);
      throw new Error(`Excel parsing error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate and normalize a single row
   */
  private validateRow(row: ExcelImportRow, rowIndex: number): {
    valid: boolean;
    error?: string;
    normalized?: any;
  } {
    // Required fields
    if (!row.organizationName || typeof row.organizationName !== 'string') {
      return {
        valid: false,
        error: 'Missing or invalid organization name',
      };
    }

    // Normalize organization name
    const organizationName = row.organizationName.trim();
    if (!organizationName) {
      return {
        valid: false,
        error: 'Organization name cannot be empty',
      };
    }

    // Parse date if provided
    let eventDate: Date | null = null;
    if (row.eventDate) {
      try {
        const dateStr = String(row.eventDate).trim();
        if (dateStr) {
          // Try parsing various date formats
          const parsed = new Date(dateStr);
          if (!isNaN(parsed.getTime())) {
            eventDate = parsed;
          } else {
            // Try Excel date serial number
            const excelDate = parseFloat(dateStr);
            if (!isNaN(excelDate)) {
              // Excel epoch is 1899-12-30
              const excelEpoch = new Date(1899, 11, 30);
              eventDate = new Date(excelEpoch.getTime() + excelDate * 24 * 60 * 60 * 1000);
            }
          }
        }
      } catch (error) {
        logger.warn(`Invalid date format in row ${rowIndex + 2}:`, row.eventDate);
      }
    }

    // Parse sandwiches count
    let sandwichesProvided = 0;
    if (row.sandwichesProvided) {
      const parsed = parseInt(String(row.sandwichesProvided), 10);
      if (!isNaN(parsed) && parsed >= 0) {
        sandwichesProvided = parsed;
      }
    }

    // Normalize status
    const validStatuses = ['completed', 'planned', 'cancelled'];
    let status = 'completed'; // Default for historical records
    if (row.status) {
      const normalizedStatus = String(row.status).toLowerCase().trim();
      if (validStatuses.includes(normalizedStatus)) {
        status = normalizedStatus;
      }
    }

    return {
      valid: true,
      normalized: {
        organizationName,
        eventDate,
        eventType: row.eventType?.trim() || 'sandwich_distribution',
        sandwichesProvided,
        contactName: row.contactName?.trim() || null,
        contactEmail: row.contactEmail?.trim() || null,
        contactPhone: row.contactPhone?.trim() || null,
        department: row.department?.trim() || null,
        location: row.location?.trim() || null,
        notes: row.notes?.trim() || null,
        status,
        tspContact: row.tspContact?.trim() || null,
      },
    };
  }

  /**
   * Import historical event records from parsed Excel data
   */
  async importHistoricalRecords(
    rows: ExcelImportRow[],
    userId: string
  ): Promise<ImportResult> {
    const errors: ImportError[] = [];
    const newOrganizations: string[] = [];
    const updatedOrganizations: string[] = [];
    let imported = 0;
    let skipped = 0;
    let totalSandwiches = 0;

    logger.info('Starting historical records import', {
      totalRows: rows.length,
      userId,
    });

    // Get existing organizations for deduplication
    const existingOrgs = new Map<string, any>();
    try {
      const allRecipients = await storage.getAllRecipients();
      allRecipients.forEach((org: any) => {
        const canonicalName = this.canonicalizeOrgName(org.name);
        existingOrgs.set(canonicalName, org);
      });
    } catch (error) {
      logger.error('Failed to fetch existing organizations', error);
    }

    // Process each row
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2; // Excel row number (1-indexed + header)

      // Validate row
      const validation = this.validateRow(row, i);
      if (!validation.valid) {
        errors.push({
          row: rowNumber,
          data: row,
          error: validation.error || 'Validation failed',
        });
        skipped++;
        continue;
      }

      const normalized = validation.normalized!;

      try {
        // Check if organization exists
        const canonicalName = this.canonicalizeOrgName(normalized.organizationName);
        let organization = existingOrgs.get(canonicalName);

        if (!organization) {
          // Create new organization
          organization = await storage.createRecipient({
            name: normalized.organizationName,
            contactName: normalized.contactName,
            contactEmail: normalized.contactEmail,
            contactPhone: normalized.contactPhone,
            department: normalized.department,
            location: normalized.location,
            isActive: false, // Mark as inactive since it's historical
            notes: normalized.notes || 'Imported from historical records',
          });

          existingOrgs.set(canonicalName, organization);
          newOrganizations.push(normalized.organizationName);

          logger.info('Created organization from import', {
            name: normalized.organizationName,
            id: organization.id,
          });
        } else {
          // Update existing organization if we have new contact info
          const updates: any = {};
          if (normalized.contactName && !organization.contactName) {
            updates.contactName = normalized.contactName;
          }
          if (normalized.contactEmail && !organization.contactEmail) {
            updates.contactEmail = normalized.contactEmail;
          }
          if (normalized.contactPhone && !organization.contactPhone) {
            updates.contactPhone = normalized.contactPhone;
          }
          if (normalized.department && !organization.department) {
            updates.department = normalized.department;
          }

          if (Object.keys(updates).length > 0) {
            await storage.updateRecipient(organization.id, updates);
            updatedOrganizations.push(normalized.organizationName);
          }
        }

        // Create event request if we have an event date
        if (normalized.eventDate) {
          try {
            const createdEvent = await storage.createEventRequest({
              // Required fields
              firstName: normalized.contactName?.split(' ')[0] || 'Historical',
              lastName: normalized.contactName?.split(' ').slice(1).join(' ') || 'Import',
              organizationName: normalized.organizationName,
              previouslyHosted: 'yes', // Historical events have already been hosted
              // Event details
              organizationId: organization.id,
              scheduledEventDate: normalized.eventDate, // Use scheduledEventDate for historical events
              eventType: normalized.eventType,
              status: normalized.status,
              sandwichesRequested: normalized.sandwichesProvided,
              sandwichesProvided: normalized.sandwichesProvided,
              contactName: normalized.contactName || organization.contactName,
              email: normalized.contactEmail || organization.contactEmail,
              phone: normalized.contactPhone || organization.contactPhone,
              location: normalized.location || organization.location,
              notes: normalized.notes,
              tspContact: normalized.tspContact,
            });

            // Add audit logging for Excel import
            await AuditLogger.logEventRequestChange(
              createdEvent.id?.toString() || 'unknown',
              null,
              createdEvent,
              {
                userId: 'SYSTEM',
                ipAddress: 'SYSTEM_IMPORT',
                userAgent: 'Excel - Historical Records Import Service',
                sessionId: 'IMPORT_SESSION',
              },
              { actionType: 'CREATE', operation: 'EXCEL_HISTORICAL_RECORDS_IMPORT' }
            );

            totalSandwiches += normalized.sandwichesProvided;
          } catch (eventError) {
            logger.warn('Failed to create event request', {
              organization: normalized.organizationName,
              error: eventError,
            });
          }
        }

        imported++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.push({
          row: rowNumber,
          data: row,
          error: errorMessage,
        });
        skipped++;
        logger.error('Failed to import row', {
          row: rowNumber,
          error: errorMessage,
        });
      }
    }

    logger.info('Historical records import completed', {
      totalRows: rows.length,
      imported,
      skipped,
      errorCount: errors.length,
    });

    return {
      success: errors.length < rows.length,
      totalRows: rows.length,
      imported,
      skipped,
      errors,
      summary: {
        newOrganizations,
        updatedOrganizations,
        totalSandwiches,
      },
    };
  }

  /**
   * Canonicalize organization name for matching
   */
  private canonicalizeOrgName(name: string): string {
    if (!name || typeof name !== 'string') return '';

    return name
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s]/g, '');
  }

  /**
   * Generate Excel template for imports
   */
  generateTemplate(): Buffer {
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

    const exampleData = [
      {
        organizationName: 'Example Organization',
        eventDate: '2024-01-15',
        eventType: 'sandwich_distribution',
        sandwichesProvided: 50,
        contactName: 'John Doe',
        contactEmail: 'john@example.org',
        contactPhone: '555-0123',
        department: 'Community Services',
        location: '123 Main St',
        notes: 'Regular monthly distribution',
        status: 'completed',
        tspContact: 'Jane Smith',
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(exampleData, {
      header: headers,
    });

    // Set column widths
    worksheet['!cols'] = headers.map(() => ({ width: 20 }));

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Historical Events');

    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  }
}

export const excelImportService = new ExcelImportService();
