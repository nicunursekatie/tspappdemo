/**
 * Migration script to link existing email messages into threads
 *
 * This script finds emails with "Re: " in the subject and links them
 * to their parent messages by matching the subject line and participants.
 *
 * Run with: npx tsx scripts/migrate-email-threads.ts
 */

import { db } from '../server/db';
import { emailMessages } from '../shared/schema';
import { eq, and, or, isNull, sql } from 'drizzle-orm';

interface EmailRecord {
  id: number;
  senderId: string;
  senderName: string;
  recipientId: string;
  recipientName: string;
  subject: string;
  parentMessageId: number | null;
  createdAt: Date | null;
}

async function migrateEmailThreads() {
  console.log('Starting email thread migration...\n');

  // Get all emails that don't have a parentMessageId set
  const allEmails = await db
    .select({
      id: emailMessages.id,
      senderId: emailMessages.senderId,
      senderName: emailMessages.senderName,
      recipientId: emailMessages.recipientId,
      recipientName: emailMessages.recipientName,
      subject: emailMessages.subject,
      parentMessageId: emailMessages.parentMessageId,
      createdAt: emailMessages.createdAt,
    })
    .from(emailMessages)
    .orderBy(emailMessages.createdAt);

  console.log(`Found ${allEmails.length} total emails`);

  // Find emails that look like replies (have "Re: " in subject) but no parentMessageId
  const replyEmails = allEmails.filter(
    (email) =>
      email.subject?.toLowerCase().startsWith('re: ') &&
      email.parentMessageId === null
  );

  console.log(`Found ${replyEmails.length} reply emails without parent links\n`);

  let linkedCount = 0;
  let notFoundCount = 0;

  for (const reply of replyEmails) {
    // Extract the original subject (remove "Re: " prefix, possibly multiple times)
    let originalSubject = reply.subject;
    while (originalSubject?.toLowerCase().startsWith('re: ')) {
      originalSubject = originalSubject.substring(4);
    }

    if (!originalSubject) {
      console.log(`  Skipping email ${reply.id}: empty subject after removing Re:`);
      notFoundCount++;
      continue;
    }

    // Find potential parent messages:
    // 1. Subject matches (either exact or the original subject)
    // 2. The participants are related (sender/recipient swap)
    // 3. Created before this reply
    const potentialParents = allEmails.filter((email) => {
      // Must be created before this reply
      if (!email.createdAt || !reply.createdAt) return false;
      if (new Date(email.createdAt) >= new Date(reply.createdAt)) return false;

      // Must not be the same email
      if (email.id === reply.id) return false;

      // Subject must match (case-insensitive)
      const emailSubject = email.subject?.toLowerCase().replace(/^(re:\s*)+/i, '');
      const replyOriginalSubject = originalSubject.toLowerCase();

      if (emailSubject !== replyOriginalSubject) return false;

      // Participants should be related (conversation between same people)
      const isRelated =
        // Reply sender was original recipient
        (reply.senderId === email.recipientId && reply.recipientId === email.senderId) ||
        // Or same sender (follow-up)
        (reply.senderId === email.senderId && reply.recipientId === email.recipientId) ||
        // Or reply recipient was original sender
        (reply.recipientId === email.senderId);

      return isRelated;
    });

    if (potentialParents.length === 0) {
      console.log(`  No parent found for email ${reply.id}: "${reply.subject}"`);
      notFoundCount++;
      continue;
    }

    // Sort by createdAt descending to get the most recent potential parent
    potentialParents.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });

    const parent = potentialParents[0];

    // Update the reply with the parent message ID
    try {
      await db
        .update(emailMessages)
        .set({ parentMessageId: parent.id })
        .where(eq(emailMessages.id, reply.id));

      console.log(
        `  Linked email ${reply.id} ("${reply.subject}") -> parent ${parent.id} ("${parent.subject}")`
      );
      linkedCount++;
    } catch (error) {
      console.error(`  Error linking email ${reply.id}:`, error);
    }
  }

  console.log('\n--- Migration Summary ---');
  console.log(`Total emails processed: ${allEmails.length}`);
  console.log(`Reply emails found: ${replyEmails.length}`);
  console.log(`Successfully linked: ${linkedCount}`);
  console.log(`Could not find parent: ${notFoundCount}`);
  console.log('Migration complete!');
}

// Run the migration
migrateEmailThreads()
  .then(() => {
    console.log('\nDone.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
