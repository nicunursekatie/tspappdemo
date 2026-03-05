import { db } from "../server/db";
import { messages, eventCollaborationComments, users } from "../shared/schema";
import { eq, and, isNotNull } from "drizzle-orm";

async function migrateMessagesToComments() {
  console.log("Starting migration: Moving event messages to collaboration comments...");

  const eventMessages = await db
    .select({
      id: messages.id,
      userId: messages.senderId,
      senderName: messages.sender,
      content: messages.content,
      contextId: messages.contextId,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .where(
      and(
        eq(messages.contextType, "event"),
        isNotNull(messages.contextId)
      )
    );

  console.log(`Found ${eventMessages.length} event messages to migrate`);

  if (eventMessages.length === 0) {
    console.log("No messages to migrate. Done!");
    return;
  }

  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  for (const msg of eventMessages) {
    try {
      const eventRequestId = parseInt(msg.contextId!, 10);
      if (isNaN(eventRequestId)) {
        console.log(`Skipping message ${msg.id}: invalid contextId "${msg.contextId}"`);
        skipped++;
        continue;
      }

      let userName = msg.senderName || "Unknown User";
      if (!msg.senderName && msg.userId) {
        const user = await db
          .select({ fullName: users.fullName, email: users.email })
          .from(users)
          .where(eq(users.id, msg.userId))
          .limit(1);
        if (user.length > 0) {
          userName = user[0].fullName || user[0].email || "Unknown User";
        }
      }

      const existingComment = await db
        .select({ id: eventCollaborationComments.id })
        .from(eventCollaborationComments)
        .where(
          and(
            eq(eventCollaborationComments.eventRequestId, eventRequestId),
            eq(eventCollaborationComments.userId, msg.userId || "system"),
            eq(eventCollaborationComments.content, msg.content)
          )
        )
        .limit(1);

      console.log(`Checking for duplicate: eventRequestId=${eventRequestId}, userId=${msg.userId}, content starts with "${msg.content.substring(0, 30)}..."`);
      console.log(`Found ${existingComment.length} existing comments matching criteria`);

      if (existingComment.length > 0) {
        console.log(`Skipping message ${msg.id}: already migrated (found id ${existingComment[0].id})`);
        skipped++;
        continue;
      }

      await db.insert(eventCollaborationComments).values({
        eventRequestId,
        userId: msg.userId || "system",
        userName,
        content: msg.content,
        parentCommentId: null,
        createdAt: msg.createdAt || new Date(),
        updatedAt: msg.createdAt || new Date(),
      });

      migrated++;
      console.log(`Migrated message ${msg.id} → event ${eventRequestId}`);
    } catch (error) {
      console.error(`Error migrating message ${msg.id}:`, error);
      errors++;
    }
  }

  console.log("\n=== Migration Summary ===");
  console.log(`Total messages found: ${eventMessages.length}`);
  console.log(`Successfully migrated: ${migrated}`);
  console.log(`Skipped (already migrated or invalid): ${skipped}`);
  console.log(`Errors: ${errors}`);
  console.log("Migration complete!");
}

migrateMessagesToComments()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exit(1);
  });
