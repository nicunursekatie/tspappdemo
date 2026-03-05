import { storage } from '../storage-wrapper';
import { db } from '../db';
import { resources, resourceTags, resourceTagAssignments } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * Script to add the Community Service Hours form to the resources section
 * This form helps volunteers track their community service hours at The Sandwich Project
 */
async function addCommunityServiceForm() {
  try {
    console.log('📋 Adding Community Service Hours form to resources...');

    // Path to the uploaded PDF
    const pdfPath = path.join(
      process.cwd(),
      'attached_assets',
      'TSP COMMUNITY SERVICE HOURS (1) (1) (2)_1762801060043.pdf'
    );

    // Check if file exists
    const fileExists = await fs.access(pdfPath).then(() => true).catch(() => false);
    if (!fileExists) {
      throw new Error(`PDF file not found at: ${pdfPath}`);
    }

    // Get file stats
    const stats = await fs.stat(pdfPath);
    const fileSize = stats.size;

    // Read the file
    const fileBuffer = await fs.readFile(pdfPath);

    // Create upload directory if it doesn't exist
    const uploadDir = path.join(process.cwd(), 'server/uploads/documents');
    await fs.mkdir(uploadDir, { recursive: true });

    // Create a unique filename
    const timestamp = Date.now();
    const filename = `community-service-hours-form-${timestamp}.pdf`;
    const destinationPath = path.join(uploadDir, filename);

    // Copy file to uploads directory
    await fs.writeFile(destinationPath, fileBuffer);
    console.log(`✅ File copied to: ${destinationPath}`);

    // Create document record
    const documentData = {
      title: 'Community Service Hours Form',
      description: 'Official TSP Atlanta form for volunteers to log and verify community service hours. Includes sections for volunteer opportunities, service log, signatures, and TSP approval.',
      fileName: filename,
      originalName: 'TSP COMMUNITY SERVICE HOURS.pdf',
      filePath: destinationPath,
      fileSize: fileSize,
      mimeType: 'application/pdf',
      category: 'forms',
      isActive: true,
      uploadedBy: 'admin_1756853839752', // System admin
      uploadedByName: 'System Admin',
    };

    const document = await storage.createDocument(documentData);
    console.log(`✅ Document created: ID ${document.id}`);

    // Check if resource already exists
    const existingResources = await db
      .select()
      .from(resources)
      .where(eq(resources.title, 'Community Service Hours Form'))
      .limit(1);

    if (existingResources.length > 0) {
      console.log(`⚠️ Resource already exists with ID ${existingResources[0].id}`);
      console.log('Updating existing resource...');

      // Update existing resource with new document
      await db
        .update(resources)
        .set({
          documentId: document.id,
          description: documentData.description,
          updatedAt: new Date(),
        })
        .where(eq(resources.id, existingResources[0].id));

      console.log(`✅ Resource updated: ${existingResources[0].id}`);
      console.log('\n🎉 Community Service Hours form is ready in your resources section!');
      return existingResources[0].id;
    }

    // Create resource record
    const resourceData = {
      title: 'Community Service Hours Form',
      description: documentData.description,
      type: 'file' as const,
      category: 'forms_templates',
      documentId: document.id,
      url: null,
      icon: 'FileCheck',
      iconColor: '#47B3CB',
      isPinnedGlobal: false,
      pinnedOrder: null,
      createdBy: 'admin_1756853839752',
      createdByName: 'System Admin',
    };

    const [newResource] = await db.insert(resources).values(resourceData).returning();
    console.log(`✅ Resource created: ID ${newResource.id}`);

    // Add tags
    console.log('Adding tags to resource...');
    
    // Check if "volunteer" tag exists, create if not
    let volunteerTag = await db
      .select()
      .from(resourceTags)
      .where(eq(resourceTags.name, 'volunteer'))
      .limit(1);

    if (volunteerTag.length === 0) {
      const [newTag] = await db
        .insert(resourceTags)
        .values({
          name: 'volunteer',
          color: '#47B3CB',
          description: 'Resources related to volunteering',
          createdBy: 'admin_1756853839752',
        })
        .returning();
      volunteerTag = [newTag];
      console.log('✅ Created "volunteer" tag');
    }

    // Check if "forms" tag exists, create if not
    let formsTag = await db
      .select()
      .from(resourceTags)
      .where(eq(resourceTags.name, 'forms'))
      .limit(1);

    if (formsTag.length === 0) {
      const [newTag] = await db
        .insert(resourceTags)
        .values({
          name: 'forms',
          color: '#FBAD3F',
          description: 'Forms and documents',
          createdBy: 'admin_1756853839752',
        })
        .returning();
      formsTag = [newTag];
      console.log('✅ Created "forms" tag');
    }

    // Assign tags to resource
    await db.insert(resourceTagAssignments).values([
      {
        resourceId: newResource.id,
        tagId: volunteerTag[0].id,
      },
      {
        resourceId: newResource.id,
        tagId: formsTag[0].id,
      },
    ]);
    console.log('✅ Tags assigned to resource');

    console.log('\n🎉 Community Service Hours form successfully added to resources section!');
    console.log(`   - Document ID: ${document.id}`);
    console.log(`   - Resource ID: ${newResource.id}`);
    console.log(`   - Category: Forms & Templates`);
    console.log(`   - Tags: volunteer, forms`);
    console.log('\nUsers can now access this form from the Resources page.');

    return newResource.id;
  } catch (error) {
    console.error('❌ Error adding Community Service Hours form:', error);
    throw error;
  }
}

// Run the script
addCommunityServiceForm()
  .then((resourceId) => {
    console.log(`\nSuccess! Resource ID: ${resourceId}`);
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed to add resource:', error);
    process.exit(1);
  });
