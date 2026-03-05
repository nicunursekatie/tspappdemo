import { db } from '../db';
import { auditLogs } from '@shared/schema';
import * as fs from 'fs';
import * as path from 'path';

async function importAuditLogs() {
  try {
    // Read the JSON file
    const filePath = path.join(process.cwd(), 'attached_assets/audit_logs 11-10_1762804881686.json');
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const logs = JSON.parse(fileContent);

    console.log(`Found ${logs.length} audit log entries to import`);

    // Clear existing audit logs to avoid duplicates
    console.log('Clearing existing audit logs...');
    await db.delete(auditLogs);

    // Insert in batches to avoid overwhelming the database
    const batchSize = 100;
    let imported = 0;

    for (let i = 0; i < logs.length; i += batchSize) {
      const batch = logs.slice(i, i + batchSize);
      
      await db.insert(auditLogs).values(
        batch.map((log: any) => ({
          id: log.id,
          action: log.action,
          tableName: log.table_name,
          recordId: log.record_id,
          oldData: log.old_data,
          newData: log.new_data,
          userId: log.user_id,
          ipAddress: log.ip_address,
          userAgent: log.user_agent,
          sessionId: log.session_id,
          timestamp: new Date(log.timestamp),
        }))
      );

      imported += batch.length;
      console.log(`Imported ${imported} / ${logs.length} entries...`);
    }

    console.log('✅ Successfully imported all audit logs!');
    console.log(`Total entries: ${logs.length}`);

    // Show some stats
    const firstLog = logs[0];
    const lastLog = logs[logs.length - 1];
    console.log(`\nDate range: ${firstLog.timestamp} to ${lastLog.timestamp}`);

  } catch (error) {
    console.error('❌ Error importing audit logs:', error);
    process.exit(1);
  }
}

importAuditLogs();
