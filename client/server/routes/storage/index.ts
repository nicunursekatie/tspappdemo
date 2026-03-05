import { Router, type Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { createStandardMiddleware, createErrorHandler } from '../../middleware';
import { logger } from '../../middleware/logger';
import { insertConfidentialDocumentSchema } from '@shared/schema';
import { storage } from '../../storage-wrapper';
import type { AuthenticatedRequest } from '../../types/express';

// Custom multer configuration for confidential documents
const confidentialDocumentsUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = 'server/uploads/confidential';
      // Ensure the directory exists
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      // Generate unique filename while preserving extension
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(file.originalname);
      const baseName = path.basename(file.originalname, ext);
      const uniqueFilename = `${baseName}-${uniqueSuffix}${ext}`;
      cb(null, uniqueFilename);
    }
  }),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
  fileFilter: (req, file, cb) => {
    // Allow common document types for confidential documents
    const allowedTypes = [
      'application/pdf',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'text/csv',
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File type not supported for confidential document uploads. Supported types: PDF, Word, Excel, PowerPoint, images, text, and CSV files.'));
    }
  },
});

// Custom multer configuration for general documents
const generalDocumentsUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = 'server/uploads/documents';
      // Ensure the directory exists
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      // Generate unique filename while preserving extension
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(file.originalname);
      const baseName = path.basename(file.originalname, ext);
      const uniqueFilename = `${baseName}-${uniqueSuffix}${ext}`;
      cb(null, uniqueFilename);
    }
  }),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit for general documents
  fileFilter: (req, file, cb) => {
    // Allow common document types
    const allowedTypes = [
      'application/pdf',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'text/csv',
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File type not supported. Supported types: PDF, Word, Excel, PowerPoint, images, text, and CSV files.'));
    }
  },
});

// Create storage routes router
const storageRouter = Router();

// Apply standard middleware (authentication, logging, sanitization)
storageRouter.use(createStandardMiddleware());

// Error handling for this module
const errorHandler = createErrorHandler('storage');

// Helper function to get user from request
const getUser = (req: AuthenticatedRequest) => {
  return req.user || req.session?.user;
};

// GET /api/storage/confidential - List user's accessible confidential documents
storageRouter.get('/confidential', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = getUser(req);
    
    if (!user || !user.email) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // AUDIT LOG: List access
    logger.info(`CONFIDENTIAL LIST ACCESS: User ${user.email} accessing confidential documents list`);

    const documents = await storage.getConfidentialDocumentsForUser(user.email);
    
    res.json({ documents });
  } catch (error: any) {
    logger.error('Error fetching confidential documents:', error);
    res.status(500).json({ error: 'Failed to fetch confidential documents' });
  }
});

// POST /api/storage/confidential - Upload new confidential document
storageRouter.post('/confidential', 
  confidentialDocumentsUpload.single('file'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = getUser(req);
      
      if (!user || !user.email) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // CRITICAL SECURITY: Only users with DOCUMENTS_CONFIDENTIAL permission can upload
      if (!user.permissions?.includes('DOCUMENTS_CONFIDENTIAL')) {
        logger.warn(`Unauthorized confidential document upload attempt by: ${user.email} (missing DOCUMENTS_CONFIDENTIAL permission)`);
        return res.status(403).json({ 
          error: 'Access denied. You do not have permission to upload confidential documents.' 
        });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      let { allowedEmails } = req.body;
      
      // Handle JSON string from FormData (client sends JSON.stringify(emails))
      if (typeof allowedEmails === 'string') {
        try {
          allowedEmails = JSON.parse(allowedEmails);
        } catch (parseError) {
          logger.error('Failed to parse allowedEmails JSON:', parseError);
          return res.status(400).json({ error: 'Invalid allowedEmails format - must be valid JSON array' });
        }
      }
      
      if (!allowedEmails || !Array.isArray(allowedEmails)) {
        return res.status(400).json({ error: 'allowedEmails must be provided as an array' });
      }

      // Validate email addresses
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      for (const email of allowedEmails) {
        if (!emailRegex.test(email)) {
          return res.status(400).json({ error: `Invalid email address: ${email}` });
        }
      }

      // AUDIT LOG: Record confidential document upload attempt
      logger.info(`CONFIDENTIAL UPLOAD: User ${user.email} uploading "${req.file.originalname}" with access for: [${allowedEmails.join(', ')}]`);

      const documentData = {
        fileName: req.file.filename,
        originalName: req.file.originalname,
        filePath: req.file.path,
        allowedEmails: allowedEmails,
        uploadedBy: user.id,
      };

      // Validate the document data
      const validatedData = insertConfidentialDocumentSchema.parse(documentData);
      
      const document = await storage.createConfidentialDocument(validatedData);
      
      // AUDIT LOG: Successful upload
      logger.info(`CONFIDENTIAL UPLOAD SUCCESS: Document ID ${document.id} created by ${user.email} - "${document.originalName}"`);
      
      res.status(201).json({ document });
    } catch (error: any) {
      logger.error('Error creating confidential document:', error);
      
      // Clean up uploaded file if document creation failed
      if (req.file && fs.existsSync(req.file.path)) {
        try {
          fs.unlinkSync(req.file.path);
          logger.info(`Cleaned up uploaded file: ${req.file.path}`);
        } catch (cleanupError) {
          logger.error('Error cleaning up uploaded file:', cleanupError);
        }
      }
      
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: 'Invalid document data', details: error.errors });
      }
      
      res.status(500).json({ error: 'Failed to create confidential document' });
    }
  }
);

// GET /api/storage/confidential/:id/download - Download specific confidential document
storageRouter.get('/confidential/:id/download', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = getUser(req);
    
    if (!user || !user.email) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const documentId = parseInt(req.params.id);
    
    if (isNaN(documentId)) {
      return res.status(400).json({ error: 'Invalid document ID' });
    }

    // AUDIT LOG: Download attempt
    logger.info(`CONFIDENTIAL DOWNLOAD ATTEMPT: User ${user.email} requesting document ID ${documentId}`);

    const document = await storage.getConfidentialDocumentById(documentId, user.email);
    
    if (!document) {
      logger.warn(`CONFIDENTIAL ACCESS DENIED: User ${user.email} attempted to access document ID ${documentId} - not found or no permission`);
      return res.status(404).json({ error: 'Document not found or access denied' });
    }

    // Additional security verification: ensure user email is in allowed list
    if (!document.allowedEmails.includes(user.email)) {
      logger.warn(`CONFIDENTIAL ACCESS VIOLATION: User ${user.email} not in allowed list for document ID ${documentId} ("${document.originalName}")`);
      return res.status(403).json({ error: 'Access denied - you do not have permission to access this document' });
    }

    // Check if file exists on disk
    if (!fs.existsSync(document.filePath)) {
      logger.error(`File not found on disk: ${document.filePath}`);
      return res.status(404).json({ error: 'File not found on server' });
    }

    // Set appropriate headers for file download
    res.setHeader('Content-Disposition', `attachment; filename="${document.originalName}"`);
    res.setHeader('Content-Type', 'application/octet-stream');

    // Stream the file to the client
    const fileStream = fs.createReadStream(document.filePath);
    fileStream.pipe(res);
    
    // AUDIT LOG: Successful download
    logger.info(`CONFIDENTIAL DOWNLOAD SUCCESS: User ${user.email} downloaded document ID ${documentId} - "${document.originalName}"`);
  } catch (error: any) {
    logger.error('Error downloading confidential document:', error);
    res.status(500).json({ error: 'Failed to download document' });
  }
});

// DELETE /api/storage/confidential/:id - Delete confidential document
storageRouter.delete('/confidential/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = getUser(req);
    
    if (!user || !user.email) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const documentId = parseInt(req.params.id);
    
    if (isNaN(documentId)) {
      return res.status(400).json({ error: 'Invalid document ID' });
    }

    // AUDIT LOG: Delete attempt
    logger.info(`CONFIDENTIAL DELETE ATTEMPT: User ${user.email} requesting to delete document ID ${documentId}`);

    // Get document first to get file path for cleanup
    const document = await storage.getConfidentialDocumentById(documentId, user.email);
    
    if (!document) {
      logger.warn(`CONFIDENTIAL DELETE DENIED: User ${user.email} attempted to delete document ID ${documentId} - not found or no access`);
      return res.status(404).json({ error: 'Document not found or access denied' });
    }

    // Enhanced authorization: uploader, admin, or user in allowed emails can delete
    const canDelete = document.uploadedBy === user.id || 
                     user.role === 'admin' || 
                     document.allowedEmails.includes(user.email);
    
    if (!canDelete) {
      logger.warn(`CONFIDENTIAL DELETE VIOLATION: User ${user.email} denied deletion of document ID ${documentId} ("${document.originalName}") - insufficient permissions`);
      return res.status(403).json({ error: 'Access denied - only the uploader, admin, or authorized users can delete this document' });
    }

    const deleted = await storage.deleteConfidentialDocument(documentId, user.email);
    
    if (!deleted) {
      return res.status(404).json({ error: 'Document not found or access denied' });
    }

    // Clean up the file from disk
    if (fs.existsSync(document.filePath)) {
      try {
        fs.unlinkSync(document.filePath);
        logger.info(`Cleaned up file: ${document.filePath}`);
      } catch (fileError) {
        logger.error('Error cleaning up file:', fileError);
        // Don't fail the request if file cleanup fails
      }
    }

    // AUDIT LOG: Successful deletion
    logger.info(`CONFIDENTIAL DELETE SUCCESS: User ${user.email} deleted document ID ${documentId} - "${document.originalName}"`);
    
    res.json({ success: true, message: 'Document deleted successfully' });
  } catch (error: any) {
    logger.error('Error deleting confidential document:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

// GET /api/storage/documents - List all documents for email attachments
storageRouter.get('/documents', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = getUser(req);
    
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    logger.info(`User ${user.email} accessing documents list for email attachments`);

    const documents = await storage.getAllDocuments();
    
    // Filter to ONLY toolkit documents (matching event-email-composer logic)
    // Include: food safety (except for hosts), deli, pbj/pb&j, sandwich making
    // Exclude: confidential category, Food Safety Guide for Hosts
    const toolkitDocuments = documents.filter(doc => {
      if (doc.isActive === false || doc.category === 'confidential') {
        return false;
      }
      
      const searchText = `${doc.title} ${doc.fileName}`.toLowerCase();
      
      // Exclude Food Safety Guide for Hosts specifically
      if (doc.title === 'Food Safety Guide for Hosts') {
        return false;
      }
      
      // Only include toolkit documents
      return searchText.includes('food safety') || 
             searchText.includes('deli') || 
             searchText.includes('pbj') || 
             searchText.includes('pb&j') ||
             searchText.includes('sandwich making');
    });
    
    // Disable caching to ensure fresh data
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    res.json(toolkitDocuments);
  } catch (error: any) {
    logger.error('Error fetching documents:', error);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

// POST /api/storage/documents/populate - Populate documents table with public files
storageRouter.post('/documents/populate', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = getUser(req);
    
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Only allow admin users to populate documents
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    logger.info(`User ${user.email} populating documents table`);

    const fs = require('fs');
    const path = require('path');
    
    // Document categories and their corresponding folders
    const DOCUMENT_CATEGORIES = {
      'toolkit': {
        folder: path.join(process.cwd(), 'public/toolkit'),
        description: 'Event toolkit documents for hosts'
      },
      'documents': {
        folder: path.join(process.cwd(), 'public/documents'), 
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

    // Helper functions
    const getMimeType = (filePath: string) => {
      const ext = path.extname(filePath).toLowerCase();
      return MIME_TYPES[ext] || 'application/octet-stream';
    };

    const generateTitle = (fileName: string) => {
      const nameWithoutExt = path.parse(fileName).name;
      return nameWithoutExt
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase());
    };

    const determineCategory = (fileName: string, folderCategory: string) => {
      const lowerName = fileName.toLowerCase();
      
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
      
      return folderCategory;
    };

    let totalProcessed = 0;
    let totalAdded = 0;
    let totalSkipped = 0;
    const results = [];

    // Process each category
    for (const [categoryKey, categoryInfo] of Object.entries(DOCUMENT_CATEGORIES)) {
      if (!fs.existsSync(categoryInfo.folder)) {
        results.push(`⚠️  Folder ${categoryInfo.folder} does not exist, skipping...`);
        continue;
      }
      
      const files = fs.readdirSync(categoryInfo.folder);
      
      for (const fileName of files) {
        totalProcessed++;
        const filePath = path.join(categoryInfo.folder, fileName);
        const stat = fs.statSync(filePath);
        
        // Skip directories and hidden files
        if (stat.isDirectory() || fileName.startsWith('.')) {
          results.push(`⏭️  Skipped ${fileName} (directory or hidden file)`);
          totalSkipped++;
          continue;
        }
        
        // Skip README files
        if (fileName.toLowerCase().includes('readme')) {
          results.push(`⏭️  Skipped ${fileName} (README file)`);
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
            results.push(`⏭️  Skipped ${fileName} (already exists in database)`);
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
            uploadedBy: user.id,
            uploadedByName: user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.email
          };
          
          const newDoc = await storage.createDocument(documentData);
          results.push(`✅ Added: ${fileName} (ID: ${newDoc.id}, Category: ${documentData.category})`);
          totalAdded++;
          
        } catch (error: any) {
          results.push(`❌ Error processing ${fileName}: ${error.message}`);
        }
      }
    }
    
    logger.info(`Document population completed by ${user.email}: ${totalAdded} added, ${totalSkipped} skipped`);
    
    res.json({
      success: true,
      message: `Document population completed successfully`,
      summary: {
        totalProcessed,
        totalAdded,
        totalSkipped
      },
      results
    });
    
  } catch (error: any) {
    logger.error('Error populating documents:', error);
    res.status(500).json({ error: 'Failed to populate documents' });
  }
});

// Apply error handling middleware
storageRouter.use(errorHandler);

export default storageRouter;