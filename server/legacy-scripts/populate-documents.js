#!/usr/bin/env node

/**
 * Script to populate the documents table with existing files from public folders
 * This makes the documents available for attachment in the send toolkit feature
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { storage } from './storage-wrapper.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Document categories and their corresponding folders
const DOCUMENT_CATEGORIES = {
  'toolkit': {
    folder: 'public/toolkit',
    description: 'Event toolkit documents for hosts'
  },
  'documents': {
    folder: 'public/documents', 
    description: 'General organization documents'
  }
};

// Map file extensions to MIME types
const MIME_TYPES = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xls': 'application/vnd.ms-excel',
  '.txt': 'text/plain',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp'
};

// Helper function to get MIME type from file extension
function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

// Helper function to generate a title from filename
function generateTitle(fileName) {
  // Remove extension and replace underscores/hyphens with spaces
  const nameWithoutExt = path.parse(fileName).name;
  return nameWithoutExt
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
}

// Helper function to determine document category from filename
function determineCategory(fileName, folderCategory) {
  const lowerName = fileName.toLowerCase();
  
  // Specific category mappings
  if (lowerName.includes('food safety') || lowerName.includes('safety')) {
    return 'food-safety';
  }
  if (lowerName.includes('sandwich making') || lowerName.includes('making')) {
    return 'sandwich-making';
  }
  if (lowerName.includes('pbj') || lowerName.includes('pb&j')) {
    return 'pbj-guide';
  }
  if (lowerName.includes('deli')) {
    return 'deli-guide';
  }
  if (lowerName.includes('label')) {
    return 'labels';
  }
  if (lowerName.includes('inventory') || lowerName.includes('calculator')) {
    return 'inventory';
  }
  if (lowerName.includes('bylaw') || lowerName.includes('incorporation') || lowerName.includes('501c3') || lowerName.includes('tax exempt')) {
    return 'governance';
  }
  
  // Default to folder category
  return folderCategory;
}

async function populateDocuments() {
  console.log('🚀 Starting document population...');
  
  let totalProcessed = 0;
  let totalAdded = 0;
  let totalSkipped = 0;
  
  try {
    // Process each category
    for (const [categoryKey, categoryInfo] of Object.entries(DOCUMENT_CATEGORIES)) {
      const folderPath = path.join(__dirname, '..', categoryInfo.folder);
      
      console.log(`\n📁 Processing ${categoryKey} documents from ${folderPath}...`);
      
      if (!fs.existsSync(folderPath)) {
        console.log(`⚠️  Folder ${folderPath} does not exist, skipping...`);
        continue;
      }
      
      const files = fs.readdirSync(folderPath);
      
      for (const fileName of files) {
        totalProcessed++;
        const filePath = path.join(folderPath, fileName);
        const stat = fs.statSync(filePath);
        
        // Skip directories and hidden files
        if (stat.isDirectory() || fileName.startsWith('.')) {
          console.log(`⏭️  Skipping ${fileName} (directory or hidden file)`);
          totalSkipped++;
          continue;
        }
        
        // Skip README files
        if (fileName.toLowerCase().includes('readme')) {
          console.log(`⏭️  Skipping ${fileName} (README file)`);
          totalSkipped++;
          continue;
        }
        
        try {
          // Check if document already exists
          const existingDocs = await storage.getAllDocuments();
          const existingDoc = existingDocs.find(doc => 
            doc.fileName === fileName && doc.filePath === filePath
          );
          
          if (existingDoc) {
            console.log(`⏭️  Skipping ${fileName} (already exists in database)`);
            totalSkipped++;
            continue;
          }
          
          // Create document entry
          const documentData = {
            title: generateTitle(fileName),
            description: `${categoryInfo.description} - ${fileName}`,
            fileName: fileName,
            originalName: fileName,
            filePath: filePath,
            fileSize: stat.size,
            mimeType: getMimeType(fileName),
            category: determineCategory(fileName, categoryKey),
            isActive: true,
            uploadedBy: 'system',
            uploadedByName: 'System Import'
          };
          
          const newDoc = await storage.createDocument(documentData);
          console.log(`✅ Added: ${fileName} (ID: ${newDoc.id}, Category: ${documentData.category})`);
          totalAdded++;
          
        } catch (error) {
          console.error(`❌ Error processing ${fileName}:`, error.message);
        }
      }
    }
    
    console.log(`\n🎉 Document population completed!`);
    console.log(`📊 Summary:`);
    console.log(`   • Total files processed: ${totalProcessed}`);
    console.log(`   • Documents added: ${totalAdded}`);
    console.log(`   • Documents skipped: ${totalSkipped}`);
    
    if (totalAdded > 0) {
      console.log(`\n✨ The send toolkit feature should now show ${totalAdded} documents for attachment!`);
    }
    
  } catch (error) {
    console.error('❌ Error during document population:', error);
    process.exit(1);
  }
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  populateDocuments()
    .then(() => {
      console.log('\n🏁 Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Script failed:', error);
      process.exit(1);
    });
}

export { populateDocuments };
