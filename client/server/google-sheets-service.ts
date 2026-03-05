import { google } from 'googleapis';
import { JWT } from 'google-auth-library';
import { createHash } from 'crypto';
import { logger } from './utils/production-safe-logger';

export interface GoogleSheetsConfig {
  spreadsheetId: string;
  worksheetName: string;
  credentialsPath?: string;
}

export interface SheetRow {
  project: string;
  reviewStatus: string; // P1, P2, P3, etc. (Column B)
  priority: string;
  owner: string;
  supportPeople: string;
  status: string; // In progress, Not started, etc. (Column F)
  startDate: string;
  endDate: string;
  category: string; // Category column (Column I)
  milestone: string; // Milestone column (Column J)
  subTasksOwners: string; // Individual sub-tasks within the project (Column K)
  deliverable: string;
  notes: string;
  lastDiscussedDate: string; // Column N: Last discussed date
  rowIndex?: number;
  // Bidirectional sync metadata fields (stored in hidden columns)
  appProjectId?: string; // Hidden column: App project ID for linking
  lastUpdatedAt?: string; // Hidden column: ISO timestamp of last update
  lastUpdatedBy?: string; // Hidden column: "app" or "sheet" to track update source
  dataHash?: string; // Hidden column: Hash of row data for change detection
}

export class GoogleSheetsService {
  protected auth!: JWT;
  protected sheets: any;

  constructor(private config: GoogleSheetsConfig) {
    // Don't call async initialization in constructor
  }

  protected async ensureInitialized() {
    if (!this.sheets) {
      await this.initializeAuth();
    }
  }

  private async initializeAuth() {
    try {
      logger.log('🔧 Initializing Google Sheets authentication...');

      // Run diagnostics if authentication fails repeatedly
      if (process.env.NODE_ENV === 'development') {
        logger.log('🔍 Running authentication diagnostics...');
        const { googleSheetsDiagnostics } = await import(
          './google-sheets-diagnostics'
        );
        const diagnosticResults =
          await googleSheetsDiagnostics.runFullDiagnostics();
        const criticalIssues = diagnosticResults.filter(
          (r) => r.severity === 'critical'
        );

        if (criticalIssues.length > 0) {
          logger.log('❌ Critical authentication issues detected:');
          criticalIssues.forEach((issue) => {
            logger.log(`   - ${issue.issue}: ${issue.description}`);
            logger.log(`     Solution: ${issue.solution}`);
          });
          googleSheetsDiagnostics.printDiagnosticReport(diagnosticResults);
        }
      }

      // Check for required environment variables - use consistent naming
      const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
      const privateKey = process.env.GOOGLE_PRIVATE_KEY;
      const projectId = process.env.GOOGLE_PROJECT_ID;

      if (!clientEmail || !privateKey || !projectId) {
        throw new Error(
          'Missing Google service account credentials (GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, GOOGLE_PROJECT_ID)'
        );
      }

      // Handle private key format more robustly - Node.js v20 compatibility fix
      let cleanPrivateKey = privateKey;

      logger.log('🔧 Original private key format check:', {
        hasBackslashN: cleanPrivateKey.includes('\\n'),
        hasRealNewlines: cleanPrivateKey.includes('\n'),
        hasBeginHeader: cleanPrivateKey.includes('-----BEGIN'),
        length: cleanPrivateKey.length,
      });

      // **NODE.JS v20 COMPATIBILITY FIX** - Handle all newline format issues
      // Replit often stores literal \n characters instead of actual newlines
      if (cleanPrivateKey.includes('\\n')) {
        cleanPrivateKey = cleanPrivateKey.replace(/\\n/g, '\n');
        logger.log('🔧 Converted \\n to actual newlines (Node.js v20 fix)');
      }

      // Additional newline handling for different platforms
      cleanPrivateKey = cleanPrivateKey
        .replace(/\\r\\n/g, '\n') // Handle Windows-style escaped newlines
        .replace(/\\r/g, '\n') // Handle Mac-style escaped newlines
        .replace(/\r\n/g, '\n') // Normalize Windows newlines
        .replace(/\r/g, '\n'); // Normalize Mac newlines

      // **CRITICAL NODE.JS v20 FIX** - Handle single-line key format from Replit
      if (
        !cleanPrivateKey.includes('\n') &&
        cleanPrivateKey.includes('-----BEGIN PRIVATE KEY-----')
      ) {
        logger.log(
          '🔧 Detected single-line private key - fixing for Node.js v20...'
        );

        // Extract the actual key content between headers
        const beginMarker = '-----BEGIN PRIVATE KEY-----';
        const endMarker = '-----END PRIVATE KEY-----';
        const beginIndex = cleanPrivateKey.indexOf(beginMarker);
        const endIndex = cleanPrivateKey.indexOf(endMarker);

        if (beginIndex !== -1 && endIndex !== -1) {
          const keyContent = cleanPrivateKey
            .substring(beginIndex + beginMarker.length, endIndex)
            .trim();

          // Rebuild key with proper line breaks every 64 characters
          const lines = [beginMarker];
          for (let i = 0; i < keyContent.length; i += 64) {
            lines.push(keyContent.substring(i, i + 64));
          }
          lines.push(endMarker);

          cleanPrivateKey = lines.join('\n');
          logger.log(
            '🔧 Rebuilt private key with proper line breaks for Node.js v20'
          );
        }
      }

      // Remove any quotes if the entire key is wrapped in quotes
      if (
        (cleanPrivateKey.startsWith('"') && cleanPrivateKey.endsWith('"')) ||
        (cleanPrivateKey.startsWith("'") && cleanPrivateKey.endsWith("'"))
      ) {
        cleanPrivateKey = cleanPrivateKey.slice(1, -1);
        logger.log('🔧 Removed surrounding quotes from private key');
      }

      // Ensure proper PEM format
      if (!cleanPrivateKey.includes('-----BEGIN PRIVATE KEY-----')) {
        // If it's just the key content without headers, add them
        cleanPrivateKey = `-----BEGIN PRIVATE KEY-----\n${cleanPrivateKey}\n-----END PRIVATE KEY-----`;
        logger.log('🔧 Added PEM headers to private key');
      }

      // Clean up any extra whitespace and normalize line endings
      cleanPrivateKey = cleanPrivateKey.trim().replace(/\r\n/g, '\n');

      // Ensure proper line breaks in PEM format
      const lines = cleanPrivateKey.split('\n');
      const properLines = [];

      for (let line of lines) {
        line = line.trim();
        if (
          line === '-----BEGIN PRIVATE KEY-----' ||
          line === '-----END PRIVATE KEY-----'
        ) {
          properLines.push(line);
        } else if (line.length > 0) {
          // Break long lines into 64-character chunks (standard PEM format)
          while (line.length > 64) {
            properLines.push(line.substring(0, 64));
            line = line.substring(64);
          }
          if (line.length > 0) {
            properLines.push(line);
          }
        }
      }

      cleanPrivateKey = properLines.join('\n');

      logger.log('🔧 Final private key format:', {
        lineCount: cleanPrivateKey.split('\n').length,
        hasProperHeaders:
          cleanPrivateKey.includes('-----BEGIN PRIVATE KEY-----') &&
          cleanPrivateKey.includes('-----END PRIVATE KEY-----'),
        properFormat:
          cleanPrivateKey.split('\n')[0] === '-----BEGIN PRIVATE KEY-----',
      });

      // Use direct JWT authentication - simpler and more reliable
      try {
        logger.log('🔧 Attempting direct JWT authentication...');

        // Simple JWT auth using google.auth.JWT directly
        const auth = new google.auth.JWT(
          clientEmail,
          undefined,
          cleanPrivateKey,
          ['https://www.googleapis.com/auth/spreadsheets']
        );

        this.auth = auth;
        this.sheets = google.sheets({ version: 'v4', auth });

        // Test with a simple API call to verify authentication actually works
        logger.log('🔧 Testing authentication with real API call...');

        try {
          // **REAL AUTH TEST** - Test against user's ACTUAL spreadsheet, not demo
          if (!this.config.spreadsheetId) {
            throw new Error(
              'No spreadsheetId provided for authentication test'
            );
          }

          const testResponse = await this.sheets.spreadsheets.get({
            spreadsheetId: this.config.spreadsheetId, // Test user's REAL spreadsheet
            fields: 'spreadsheetId,properties.title',
          });

          logger.log(
            "✅ Authentication test successful against USER'S spreadsheet:",
            {
              spreadsheetId: testResponse.data.spreadsheetId,
              title: testResponse.data.properties?.title || 'Unknown',
            }
          );

          logger.log(
            '✅ Google Sheets JWT authentication FULLY VERIFIED against actual spreadsheet'
          );
          return;
        } catch (testError) {
          const error = testError as Error;
          logger.error('❌ Authentication test failed:', error.message);
          throw new Error(
            `JWT authentication test failed: ${error.message}`
          );
        }
      } catch (authError) {
        logger.log(
          '⚠️ JWT auth failed, trying simplified approach:',
          (authError as Error).message
        );
      }

      // Fallback to file-based authentication if JWT fails
      const fs = await import('fs');
      const path = await import('path');

      // Use minimal service account content - avoid empty private_key_id
      const serviceAccountContent = JSON.stringify(
        {
          client_email: clientEmail,
          private_key: cleanPrivateKey,
        },
        null,
        2
      );

      const tempFilePath = path.join(
        process.cwd(),
        'google-service-account.json'
      );
      fs.writeFileSync(tempFilePath, serviceAccountContent);
      logger.log('🔧 Created temporary service account file');

      const auth = new google.auth.GoogleAuth({
        keyFile: tempFilePath,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });

      const authClient = await auth.getClient();
      this.auth = authClient as JWT;
      this.sheets = google.sheets({ version: 'v4', auth: authClient as any });

      // Test file-based authentication with real API call
      logger.log('🔧 Testing file-based authentication with real API call...');

      try {
        // **REAL AUTH TEST** - Test against user's ACTUAL spreadsheet
        if (!this.config.spreadsheetId) {
          throw new Error(
            'No spreadsheetId provided for file-based authentication test'
          );
        }

        const testResponse = await this.sheets.spreadsheets.get({
          spreadsheetId: this.config.spreadsheetId, // Test user's REAL spreadsheet
          fields: 'spreadsheetId,properties.title',
        });

        logger.log(
          "✅ File-based authentication test successful against USER'S spreadsheet:",
          {
            spreadsheetId: testResponse.data.spreadsheetId,
            title: testResponse.data.properties?.title || 'Unknown',
          }
        );
      } catch (testError) {
        const error = testError as Error;
        logger.error(
          "❌ File-based authentication test failed against user's spreadsheet:",
          error.message
        );
        throw new Error(
          `File-based JWT authentication test failed: ${error.message}`
        );
      }

      logger.log('✅ Google Sheets file-based authentication fully verified');

      // Clean up temp file
      fs.unlinkSync(tempFilePath);
      logger.log('🔧 Cleaned up temporary service account file');
    } catch (error) {
      const err = error as Error;
      logger.error('❌ Google Sheets authentication failed:', err.message);
      if (
        err.message.includes('DECODER') ||
        err.message.includes('OSSL_UNSUPPORTED')
      ) {
        logger.error(
          '💡 This is a Node.js v20 OpenSSL compatibility issue with the private key format'
        );
        logger.error(
          '💡 The private key from your Google Cloud Console may need to be regenerated for Node.js v20+'
        );
      }

      // Clean up temp file on error
      try {
        const fs = await import('fs');
        const path = await import('path');
        const tempFilePath = path.join(
          process.cwd(),
          'google-service-account.json'
        );
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      } catch (cleanupError) {
        // Ignore cleanup errors
      }

      throw new Error('Failed to initialize Google Sheets service');
    }
  }

  /**
   * Read all rows from the Google Sheet
   */
  async readSheet(): Promise<SheetRow[]> {
    try {
      await this.ensureInitialized();

      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.config.spreadsheetId,
        range: `${this.config.worksheetName}!A:M`, // A through M columns
      });

      const rows = response.data.values || [];
      if (rows.length === 0) return [];

      // Skip header row and parse data
      // Headers: project, priority, status, owner, support people, sub-tasks | owners, start date, end date, category, milestone, deliverable, notes, last discussed date
      const dataRows = rows.slice(1);
      return dataRows.map((row: any[], index: number) => ({
        project: row[0] || '', // Column A: Project
        priority: row[1] || '', // Column B: Priority
        status: row[2] || '', // Column C: Status
        owner: row[3] || '', // Column D: Owner
        supportPeople: row[4] || '', // Column E: Support people
        subTasksOwners: row[5] || '', // Column F: Sub-Tasks | Owners
        startDate: row[6] || '', // Column G: Start date
        endDate: row[7] || '', // Column H: End date
        category: row[8] || '', // Column I: Category
        milestone: row[9] || '', // Column J: Milestone
        deliverable: row[10] || '', // Column K: Deliverable
        notes: row[11] || '', // Column L: Notes
        lastDiscussedDate: row[12] || '', // Column M: Last Discussed Date
        reviewStatus: '', // No longer in sheet
        rowIndex: index + 2, // +2 because sheets are 1-indexed and we skip header
      }));
    } catch (error) {
      logger.error('Error reading Google Sheet:', error);
      throw new Error('Failed to read from Google Sheets');
    }
  }

  /**
   * Write or update rows in the Google Sheet (preserves formatting)
   */
  async updateSheet(rows: SheetRow[]): Promise<boolean> {
    try {
      // Get existing data to identify what rows to update vs append
      const existingRows = await this.readSheet();
      const existingRowMap = new Map();
      existingRows.forEach((row) => {
        if (row.project && row.rowIndex) {
          existingRowMap.set(row.project.toLowerCase().trim(), row.rowIndex);
        }
      });

      const updates: any[] = [];
      const newRows: any[] = [];

      for (const row of rows) {
        const rowData = [
          row.project, // Column A - Project
          row.priority, // Column B - Priority
          row.status, // Column C - Status
          row.owner, // Column D - Owner
          row.supportPeople, // Column E - Support People
          row.subTasksOwners, // Column F - Sub-Tasks | Owners
          row.startDate, // Column G - Start Date
          row.endDate, // Column H - End Date
          row.category, // Column I - Category
          row.milestone, // Column J - Milestone
          row.deliverable, // Column K - Deliverable
          row.notes, // Column L - Notes
          row.lastDiscussedDate, // Column M - Last Discussed Date
        ];

        // Column mapping: A=project, B=priority, C=status, D=owner, E=supportPeople, F=subTasksOwners, G=startDate, H=endDate, I=category, J=milestone, K=deliverable, L=notes, M=lastDiscussedDate

        // Check if this project already exists in the sheet
        const existingRowIndex = existingRowMap.get(
          row.project.toLowerCase().trim()
        );

        if (existingRowIndex) {
          // Update existing row - FORCE full row update to fix column mapping
          updates.push({
            range: `${this.config.worksheetName}!A${existingRowIndex}:M${existingRowIndex}`,
            values: [rowData],
          });
          logger.log(
            `🔄 Updating existing row ${existingRowIndex} for: "${row.project}"`
          );
        } else {
          // New row to append
          newRows.push(rowData);
          logger.log(`➕ Adding new row for: "${row.project}"`);
        }
      }

      // Batch update existing rows (preserves formatting)
      if (updates.length > 0) {
        await this.sheets.spreadsheets.values.batchUpdate({
          spreadsheetId: this.config.spreadsheetId,
          resource: {
            valueInputOption: 'USER_ENTERED',
            data: updates,
          },
        });
        logger.log(`Updated ${updates.length} existing rows`);
      }

      // Insert new rows at specific location (NOT append to avoid column drift)
      if (newRows.length > 0) {
        // Find the last row with data in column A
        const lastRowResponse = await this.sheets.spreadsheets.values.get({
          spreadsheetId: this.config.spreadsheetId,
          range: `${this.config.worksheetName}!A:A`,
        });

        const lastRowWithData = lastRowResponse.data.values?.length || 0;
        const insertRowStart = lastRowWithData + 1;
        const insertRowEnd = insertRowStart + newRows.length - 1;

        // Insert directly at specific row range in A:N columns
        await this.sheets.spreadsheets.values.update({
          spreadsheetId: this.config.spreadsheetId,
          range: `${this.config.worksheetName}!A${insertRowStart}:N${insertRowEnd}`,
          valueInputOption: 'USER_ENTERED',
          resource: {
            values: newRows,
          },
        });

        logger.log(
          `📍 Added ${newRows.length} new rows directly at A${insertRowStart}:N${insertRowEnd}`
        );
      }

      return true;
    } catch (error) {
      logger.error('Error updating Google Sheet:', error);
      throw new Error('Failed to update Google Sheets');
    }
  }

  /**
   * Safe append-only mode for highly formatted sheets
   */
  async appendOnlySync(
    rows: SheetRow[]
  ): Promise<{ added: number; skipped: number }> {
    try {
      // Get existing project titles to avoid duplicates
      const existingRows = await this.readSheet();
      const existingTitles = new Set(
        existingRows.map((row) => row.task.toLowerCase().trim())
      );

      // Only append truly new projects
      const newRows = rows
        .filter(
          (row) =>
            row.task && !existingTitles.has(row.task.toLowerCase().trim())
        )
        .map((row) => [
          row.task,
          row.reviewStatus,
          row.priority,
          row.owner,
          row.supportPeople,
          row.status,
          row.startDate,
          row.endDate,
          row.category, // FIXED: was missing Category column
          row.milestone,
          row.subTasksOwners,
          row.deliverable,
          row.notes,
          row.lastDiscussedDate,
        ]);

      if (newRows.length > 0) {
        // Find the last row with data in column A (the actual table)
        const lastRowResponse = await this.sheets.spreadsheets.values.get({
          spreadsheetId: this.config.spreadsheetId,
          range: `${this.config.worksheetName}!A:A`,
        });

        const lastRowWithData = lastRowResponse.data.values?.length || 0;
        const insertRowStart = lastRowWithData + 1; // Next available row
        const insertRowEnd = insertRowStart + newRows.length - 1;

        // Insert directly at specific row range in A:N columns
        await this.sheets.spreadsheets.values.update({
          spreadsheetId: this.config.spreadsheetId,
          range: `${this.config.worksheetName}!A${insertRowStart}:N${insertRowEnd}`, // FIXED: was A:M, now A:N to match column count
          valueInputOption: 'USER_ENTERED',
          resource: {
            values: newRows,
          },
        });

        logger.log(
          `📍 Inserted ${newRows.length} rows directly at A${insertRowStart}:N${insertRowEnd}` // FIXED: was A:M, now A:N
        );
      }

      return {
        added: newRows.length,
        skipped: rows.length - newRows.length,
      };
    } catch (error) {
      logger.error('Error in append-only sync:', error);
      throw new Error('Failed to perform append-only sync');
    }
  }

  /**
   * Add header row to the sheet if needed
   */
  async ensureHeaders(): Promise<void> {
    try {
      const headers = [
        'Task', // Column A (Project title)
        'Review Status', // Column B (Review Status: P1, P2, etc.) - FIXED: was duplicate "Status"
        'Priority', // Column C
        'Owner', // Column D
        'Support people', // Column E
        'Status', // Column F (Actual project status)
        'Start', // Column G
        'End date', // Column H
        'Category', // Column I (NEW - added after end date) - FIXED: was missing
        'Milestone', // Column J (shifted from I) - FIXED: was in wrong position
        'Sub-Tasks | Owners', // Column K (Individual tasks within project)
        'Deliverable', // Column L
        'Notes', // Column M - FIXED: was in wrong position
        'Last Discussed Date', // Column N - FIXED: was missing entirely
      ];

      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.config.spreadsheetId,
        range: `${this.config.worksheetName}!A1:N1`, // FIXED: was A1:L1, now A1:N1 to match read/write operations
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [headers],
        },
      });
    } catch (error) {
      logger.error('Error setting headers:', error);
      throw new Error('Failed to set sheet headers');
    }
  }

  /**
   * Parse tasks and owners from text format
   */
  parseTasksAndOwners(
    text: string
  ): Array<{ task: string; owner: string | null }> {
    if (!text || typeof text !== 'string') return [];

    const tasks: Array<{ task: string; owner: string | null }> = [];

    // Split by commas first
    const segments = text.split(',').map((s) => s.trim());

    for (const segment of segments) {
      // Look for "Name: Task" format
      const colonMatch = segment.match(/^([^:]+):\s*(.+)$/);
      if (colonMatch) {
        const owner = colonMatch[1].trim();
        const task = colonMatch[2].trim();
        tasks.push({ task, owner });
        continue;
      }

      // Look for "Task (Name)" format
      const parenMatch = segment.match(/^(.+?)\s*\(([^)]+)\)$/);
      if (parenMatch) {
        const task = parenMatch[1].trim();
        const owner = parenMatch[2].trim();
        tasks.push({ task, owner });
        continue;
      }

      // Just a task with no owner
      if (segment) {
        tasks.push({ task: segment, owner: null });
      }
    }

    return tasks;
  }

  /**
   * Format tasks and owners into text format
   */
  formatTasksAndOwners(
    tasks: Array<{ task: string; owner: string | null }>
  ): string {
    return tasks
      .map(({ task, owner }) => (owner ? `${owner}: ${task}` : task))
      .join(', ');
  }

  private parseBoolean(value: any): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      return ['yes', 'true', '1', 'on'].includes(value.toLowerCase());
    }
    return false;
  }

  /**
   * Calculate hash of row data for change detection (excluding metadata fields)
   */
  public calculateRowHash(row: SheetRow): string {
    // Create a normalized version of the row data (excluding metadata and rowIndex)
    const dataToHash = {
      task: row.task?.trim() || '',
      reviewStatus: row.reviewStatus?.trim() || '',
      priority: row.priority?.trim() || '',
      owner: row.owner?.trim() || '',
      supportPeople: row.supportPeople?.trim() || '',
      status: row.status?.trim() || '',
      startDate: row.startDate?.trim() || '',
      endDate: row.endDate?.trim() || '',
      category: row.category?.trim() || '',
      milestone: row.milestone?.trim() || '',
      subTasksOwners: row.subTasksOwners?.trim() || '',
      deliverable: row.deliverable?.trim() || '',
      notes: row.notes?.trim() || '',
      lastDiscussedDate: row.lastDiscussedDate?.trim() || '',
    };

    // Create deterministic hash of the data
    const dataString = JSON.stringify(dataToHash, Object.keys(dataToHash).sort());
    return createHash('sha256').update(dataString).digest('hex').substring(0, 16); // Use first 16 chars for readability
  }

  /**
   * Resolve conflict between app and sheet data using timestamp-based approach
   */
  public resolveConflict(
    appData: SheetRow,
    sheetData: SheetRow
  ): { 
    resolved: SheetRow; 
    winner: 'app' | 'sheet' | 'no-conflict'; 
    reason: string 
  } {
    const appTimestamp = appData.lastUpdatedAt ? new Date(appData.lastUpdatedAt) : new Date(0);
    const sheetTimestamp = sheetData.lastUpdatedAt ? new Date(sheetData.lastUpdatedAt) : new Date(0);

    // If hashes are the same, no conflict
    if (appData.dataHash === sheetData.dataHash) {
      return { 
        resolved: appData, 
        winner: 'no-conflict', 
        reason: 'Data hashes match - no changes detected' 
      };
    }

    // If one side has no timestamp, prefer the one with timestamp
    if (appTimestamp.getTime() === 0 && sheetTimestamp.getTime() > 0) {
      return { 
        resolved: sheetData, 
        winner: 'sheet', 
        reason: 'App data has no timestamp, sheet has recent updates' 
      };
    }
    if (sheetTimestamp.getTime() === 0 && appTimestamp.getTime() > 0) {
      return { 
        resolved: appData, 
        winner: 'app', 
        reason: 'Sheet data has no timestamp, app has recent updates' 
      };
    }

    // Timestamp-based conflict resolution (most recent wins)
    if (appTimestamp > sheetTimestamp) {
      return { 
        resolved: appData, 
        winner: 'app', 
        reason: `App data is newer (${appData.lastUpdatedAt} > ${sheetData.lastUpdatedAt})` 
      };
    } else if (sheetTimestamp > appTimestamp) {
      return { 
        resolved: sheetData, 
        winner: 'sheet', 
        reason: `Sheet data is newer (${sheetData.lastUpdatedAt} > ${appData.lastUpdatedAt})` 
      };
    } else {
      // Same timestamp - prefer app data as source of truth
      return { 
        resolved: appData, 
        winner: 'app', 
        reason: 'Same timestamp - defaulting to app as source of truth' 
      };
    }
  }

  /**
   * Update row with sync metadata for bidirectional tracking
   */
  public updateRowWithMetadata(
    row: SheetRow, 
    appProjectId: string, 
    updatedBy: 'app' | 'sheet'
  ): SheetRow {
    const now = new Date().toISOString();
    const updatedRow = { ...row };
    
    updatedRow.appProjectId = appProjectId;
    updatedRow.lastUpdatedAt = now;
    updatedRow.lastUpdatedBy = updatedBy;
    updatedRow.dataHash = this.calculateRowHash(row);
    
    return updatedRow;
  }

  /**
   * Check if row data has changed by comparing hashes
   */
  public hasRowChanged(previousRow: SheetRow, currentRow: SheetRow): boolean {
    const previousHash = previousRow.dataHash || this.calculateRowHash(previousRow);
    const currentHash = this.calculateRowHash(currentRow);
    return previousHash !== currentHash;
  }
}

// Export singleton instance
let sheetsService: GoogleSheetsService | null = null;

export function getGoogleSheetsService(
  customConfig?: GoogleSheetsConfig
): GoogleSheetsService | null {
  if (
    !process.env.GOOGLE_PROJECT_ID ||
    !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ||
    !process.env.GOOGLE_PRIVATE_KEY
  ) {
    logger.log(
      'Google Sheets service not configured - missing environment variables'
    );
    return null;
  }

  // If custom config is provided, create a new instance
  if (customConfig) {
    if (!customConfig.spreadsheetId) {
      logger.log(
        'Google Sheets service not configured - missing spreadsheetId in custom config'
      );
      return null;
    }
    return new GoogleSheetsService(customConfig);
  }

  // Default singleton behavior for backward compatibility
  if (!sheetsService) {
    const config: GoogleSheetsConfig = {
      spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID || '',
      worksheetName: process.env.GOOGLE_WORKSHEET_NAME || 'Sheet1',
    };

    if (!config.spreadsheetId) {
      logger.log(
        'Google Sheets service not configured - missing GOOGLE_SPREADSHEET_ID'
      );
      return null;
    }

    sheetsService = new GoogleSheetsService(config);
  }

  return sheetsService;
}

// Project-specific Google Sheets service
export function getProjectsGoogleSheetsService(): GoogleSheetsService | null {
  if (!process.env.PROJECTS_SHEET_ID) {
    logger.log(
      'Projects Google Sheets service not configured - missing PROJECTS_SHEET_ID'
    );
    return null;
  }

  const config: GoogleSheetsConfig = {
    spreadsheetId: process.env.PROJECTS_SHEET_ID,
    worksheetName: process.env.PROJECTS_WORKSHEET_NAME || 'Sheet1',
  };

  return getGoogleSheetsService(config);
}
