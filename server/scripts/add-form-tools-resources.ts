/**
 * Script to add Auto Form Filler and Service Hours Form Generator to resources
 * Run with: tsx server/scripts/add-form-tools-resources.ts
 */

import { db } from '../db';
import { resources, resourceTags, resourceTagAssignments } from '../../shared/schema';
import { eq } from 'drizzle-orm';

async function addFormToolsResources() {
  console.log('🔧 Adding form tools to resources...');

  try {
    // Get the Forms tag
    const [formsTag] = await db
      .select()
      .from(resourceTags)
      .where(eq(resourceTags.name, 'Forms'))
      .limit(1);

    const systemUser = {
      id: 'system',
      name: 'System Administrator',
    };

    const newResources = [
      {
        title: 'Auto Form Filler',
        description:
          'AI-powered tool to automatically fill out TSP forms by uploading documents. Supports Service Hours Forms, Event Requests, Volunteer Applications, and more.',
        type: 'link' as const,
        category: 'forms_templates',
        url: '/dashboard?section=auto-form-filler',
        isPinnedGlobal: false,
      },
      {
        title: 'Service Hours Form Generator',
        description:
          'Quickly generate filled Community Service Hours verification forms for volunteers with automatic PDF creation.',
        type: 'link' as const,
        category: 'forms_templates',
        url: '/dashboard?section=generate-service-hours',
        isPinnedGlobal: false,
      },
    ];

    for (const resource of newResources) {
      // Check if resource already exists
      const [existing] = await db
        .select()
        .from(resources)
        .where(eq(resources.title, resource.title))
        .limit(1);

      if (existing) {
        console.log(`  ℹ️  Resource already exists: ${resource.title}`);
        continue;
      }

      // Create the resource
      const [created] = await db
        .insert(resources)
        .values({
          ...resource,
          createdBy: systemUser.id,
          createdByName: systemUser.name,
        })
        .returning();

      console.log(`  ✓ Created: ${resource.title}`);

      // Assign Forms tag if it exists
      if (formsTag && created) {
        await db.insert(resourceTagAssignments).values({
          resourceId: created.id,
          tagId: formsTag.id,
        });
        console.log(`    ✓ Tagged with 'Forms'`);
      }
    }

    console.log('\n✅ Form tools resources added successfully!');
    console.log('\n💡 These tools are now available in:');
    console.log('   - Resources tab under "Forms & Templates" category');
    console.log('   - Sidebar navigation under "Documentation" section');
  } catch (error) {
    console.error('❌ Error adding resources:', error);
    process.exit(1);
  }

  process.exit(0);
}

// Run the script
addFormToolsResources();
