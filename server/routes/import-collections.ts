import { Router } from 'express';
import { parse } from 'csv-parse/sync';
import fs from 'fs/promises';
import { storage } from '../storage-wrapper';
import { logger } from '../middleware/logger';
import { upload } from '../middleware/uploads';

const importCollectionsRouter = Router();

// CSV Import for Sandwich Collections
importCollectionsRouter.post(
  '/',
  upload.single('csvFile'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No CSV file uploaded' });
      }

      const csvContent = await fs.readFile(req.file.path, 'utf-8');
      logger.info(`CSV content preview: ${csvContent.substring(0, 200)}...`);

      // Detect CSV format type
      const lines = csvContent.split('\n');
      let formatType = 'standard';

      // Check for complex weekly totals format
      if (lines[0].includes('WEEK #') || lines[0].includes('Hosts:')) {
        formatType = 'complex';
      }
      // Check for structured weekly data format
      else if (
        lines[0].includes('Week_Number') &&
        lines[0].includes('Total_Sandwiches')
      ) {
        formatType = 'structured';
      }

      let records = [];

      if (formatType === 'complex') {
        logger.info('Complex weekly totals format detected');
        // Find the row with actual data (skip header rows)
        let startRow = 0;
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].match(/^\d+,/) && lines[i].includes('TRUE')) {
            startRow = i;
            break;
          }
        }

        // Parse the complex format manually
        for (let i = startRow; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line || !line.includes('TRUE')) continue;

          const parts = line.split(',');
          if (parts.length >= 5 && parts[4]) {
            const weekNum = parts[0];
            const date = parts[3];
            const totalSandwiches = parts[4].replace(/[",]/g, '');

            if (date && totalSandwiches && !isNaN(parseInt(totalSandwiches))) {
              records.push({
                'Host Name': `Week ${weekNum} Total`,
                'Sandwich Count': totalSandwiches,
                Date: date,
                'Logged By': 'CSV Import',
                Notes: `Weekly total import from complex spreadsheet`,
                'Created At': new Date().toISOString(),
              });
            }
          }
        }
      } else if (formatType === 'structured') {
        logger.info('Structured weekly data format detected');
        // Parse the structured format
        const parsedData = parse(csvContent, {
          columns: true,
          skip_empty_lines: true,
          trim: true,
          delimiter: ',',
          quote: '"',
        });

        // Convert structured data to standard format
        for (const row of parsedData) {
          if (
            row.Week_Number &&
            row.Date &&
            row.Total_Sandwiches &&
            parseInt(row.Total_Sandwiches) > 0
          ) {
            // Parse the date to a more readable format
            const date = new Date(row.Date);
            const formattedDate = date.toISOString().split('T')[0]; // YYYY-MM-DD format

            records.push({
              'Host Name': `Week ${row.Week_Number} Complete Data`,
              'Sandwich Count': row.Total_Sandwiches,
              Date: formattedDate,
              'Logged By': 'CSV Import',
              Notes: `Structured weekly data import with location and group details`,
              'Created At': new Date().toISOString(),
            });
          }
        }
      } else {
        logger.info('Standard CSV format detected');
        // Parse normal CSV format
        records = parse(csvContent, {
          columns: true,
          skip_empty_lines: true,
          trim: true,
          delimiter: ',',
          quote: '"',
        });
      }

      logger.info(`Parsed ${records.length} records`);
      if (records.length > 0) {
        logger.info(`First record: ${JSON.stringify(records[0])}`);
      }

      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      // Process each record
      for (let i = 0; i < records.length; i++) {
        const record = records[i];

        try {
          // Debug log the record structure
          logger.info(`Processing row ${i + 1}:`, {
            record: JSON.stringify(record),
          });

          // Check for alternative column names
          const hostName =
            record['Host Name'] ||
            record['Host'] ||
            record['host_name'] ||
            record['HostName'];
          const sandwichCountStr =
            record['Individual Sandwiches'] ||
            record['Sandwich Count'] ||
            record['Count'] ||
            record['sandwich_count'] ||
            record['SandwichCount'] ||
            record['Sandwiches'];
          const date =
            record['Collection Date'] ||
            record['Date'] ||
            record['date'] ||
            record['CollectionDate'];

          // Validate required fields with more detailed error reporting
          if (!hostName) {
            const availableKeys = Object.keys(record).join(', ');
            throw new Error(
              `Missing Host Name (available columns: ${availableKeys}) in row ${
                i + 1
              }`
            );
          }
          if (!sandwichCountStr) {
            const availableKeys = Object.keys(record).join(', ');
            throw new Error(
              `Missing Individual Sandwiches (available columns: ${availableKeys}) in row ${
                i + 1
              }`
            );
          }
          if (!date) {
            const availableKeys = Object.keys(record).join(', ');
            throw new Error(
              `Missing Collection Date (available columns: ${availableKeys}) in row ${
                i + 1
              }`
            );
          }

          // Parse sandwich count as integer
          const sandwichCount = parseInt(sandwichCountStr.toString().trim());
          if (isNaN(sandwichCount)) {
            throw new Error(
              `Invalid sandwich count "${sandwichCountStr}" in row ${i + 1}`
            );
          }

          // Parse dates
          let collectionDate = date;
          let submittedAt = new Date();

          // Try to parse Created At if provided
          const createdAt =
            record['Created At'] || record['created_at'] || record['CreatedAt'];
          if (createdAt) {
            const parsedDate = new Date(createdAt);
            if (!isNaN(parsedDate.getTime())) {
              submittedAt = parsedDate;
            }
          }

          // Handle Group Collections data
          const groupCollectionsStr = record['Group Collections'] || '';
          let groupCollections = '[]';
          if (groupCollectionsStr && groupCollectionsStr.trim() !== '') {
            // If it's a number, convert to simple array format
            const groupCount = parseInt(groupCollectionsStr.trim());
            if (!isNaN(groupCount) && groupCount > 0) {
              groupCollections = JSON.stringify([
                { count: groupCount, description: 'Group Collection' },
              ]);
            }
          }

          // Create sandwich collection
          await storage.createSandwichCollection({
            hostName: hostName.trim(),
            individualSandwiches: sandwichCount,
            collectionDate: collectionDate.trim(),
            groupCollections: groupCollections,
            submittedAt: submittedAt,
          });

          successCount++;
        } catch (error) {
          errorCount++;
          const errorMsg = `Row ${i + 1}: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`;
          errors.push(errorMsg);
          logger.error(errorMsg);
        }
      }

      // Clean up uploaded file
      await fs.unlink(req.file.path);

      const result = {
        totalRecords: records.length,
        successCount,
        errorCount,
        errors: errors.slice(0, 10), // Return first 10 errors
      };

      logger.info(
        `CSV import completed: ${successCount}/${records.length} records imported`
      );
      res.json(result);
    } catch (error) {
      // Clean up uploaded file if it exists
      if (req.file?.path) {
        try {
          await fs.unlink(req.file.path);
        } catch (cleanupError) {
          logger.error('Failed to clean up uploaded file', cleanupError);
        }
      }

      logger.error('CSV import failed', error);
      res.status(500).json({
        message: 'Failed to import CSV file',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

export default importCollectionsRouter;
