import fs from 'fs/promises';
import path from 'path';
import { createReadStream } from 'fs';
import { logger } from '../../middleware/logger';

export interface FileMetadata {
  fileName: string;
  filePath: string;
  fileType: string;
  mimeType: string;
}

export interface FileUploadResult {
  metadata: FileMetadata;
  summary: string;
}

export class MeetingFileService {
  private readonly uploadsDir: string;

  constructor() {
    this.uploadsDir = path.join(process.cwd(), 'uploads', 'meeting-minutes');
  }

  /**
   * Process uploaded meeting minutes file
   */
  async processUploadedFile(
    file: Express.Multer.File
  ): Promise<FileUploadResult> {
    try {
      // Create permanent storage directory
      await fs.mkdir(this.uploadsDir, { recursive: true });

      // Generate permanent path
      const permanentFilename = file.filename;
      const permanentPath = path.join(this.uploadsDir, permanentFilename);

      // Copy file to permanent location
      await fs.copyFile(file.path, permanentPath);

      // Determine file type and generate summary
      const { fileType, summary } = this.detectFileType(file);

      // Store file metadata
      const metadata: FileMetadata = {
        fileName: file.originalname,
        filePath: permanentPath,
        fileType,
        mimeType: file.mimetype,
      };

      // Clean up temporary file
      await fs.unlink(file.path).catch((err) => {
        logger.error('Failed to clean up temp file', err);
      });

      logger.info('Meeting minutes file processed successfully', {
        fileName: file.originalname,
        fileType,
      });

      return { metadata, summary };
    } catch (error) {
      // Clean up uploaded file even if processing failed
      try {
        await fs.unlink(file.path);
      } catch (unlinkError) {
        logger.error('Failed to clean up uploaded file', unlinkError);
      }
      throw error;
    }
  }

  /**
   * Detect file type from uploaded file
   */
  private detectFileType(file: Express.Multer.File): {
    fileType: string;
    summary: string;
  } {
    let fileType = 'unknown';
    let summary = `Document: ${file.originalname}`;

    if (file.mimetype === 'application/pdf') {
      fileType = 'pdf';
      summary = `PDF document: ${file.originalname}`;
    } else if (
      file.mimetype ===
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      file.originalname.toLowerCase().endsWith('.docx')
    ) {
      fileType = 'docx';
      summary = `DOCX document: ${file.originalname}`;
    } else if (
      file.mimetype === 'application/msword' ||
      file.originalname.toLowerCase().endsWith('.doc')
    ) {
      fileType = 'doc';
      summary = `DOC document: ${file.originalname}`;
    }

    return { fileType, summary };
  }

  /**
   * Detect content type from file header
   */
  async detectContentType(
    filePath: string,
    fileName?: string
  ): Promise<string> {
    const buffer = Buffer.alloc(50);
    const fd = await fs.open(filePath, 'r');

    try {
      await fd.read(buffer, 0, 50, 0);
    } finally {
      await fd.close();
    }

    const fileHeader = buffer.toString('utf8', 0, 20);

    if (fileHeader.startsWith('%PDF')) {
      return 'application/pdf';
    } else if (
      fileHeader.includes('[Content_Types].xml') ||
      fileHeader.startsWith('PK')
    ) {
      // Microsoft Office document
      if (fileName?.toLowerCase().endsWith('.docx')) {
        return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      } else if (fileName?.toLowerCase().endsWith('.xlsx')) {
        return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      }
      // Default to DOCX
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    }

    return 'application/octet-stream';
  }

  /**
   * Get file stream for serving
   */
  async serveFile(filePath: string, fileName?: string) {
    // Handle both absolute and relative paths
    const absolutePath = path.isAbsolute(filePath)
      ? filePath
      : path.join(process.cwd(), filePath);

    // Check if file exists
    await fs.access(absolutePath);

    // Get file info
    const stats = await fs.stat(absolutePath);

    // Detect content type
    const contentType = await this.detectContentType(absolutePath, fileName);

    // Determine content disposition
    const disposition =
      contentType === 'application/pdf'
        ? `inline; filename="${fileName || 'document'}"`
        : `attachment; filename="${fileName || 'document'}"`;

    return {
      filePath: absolutePath,
      stats,
      contentType,
      disposition,
      stream: createReadStream(absolutePath),
    };
  }

  /**
   * Serve file by filename (legacy support)
   */
  async serveFileByName(filename: string) {
    const filePath = path.join(this.uploadsDir, filename);

    // Check if file exists
    await fs.access(filePath);

    // Get file info
    const stats = await fs.stat(filePath);
    const fileBuffer = await fs.readFile(filePath);

    // Detect content type from file signature
    let contentType = 'application/octet-stream';
    let displayName = filename;

    // Check for PDF signature
    if (
      fileBuffer.length > 4 &&
      fileBuffer.toString('ascii', 0, 4) === '%PDF'
    ) {
      contentType = 'application/pdf';
      if (!filename.toLowerCase().endsWith('.pdf')) {
        displayName = filename + '.pdf';
      }
    } else {
      // Fallback to extension-based detection
      const ext = path.extname(filename).toLowerCase();
      if (ext === '.pdf') {
        contentType = 'application/pdf';
      } else if (ext === '.docx') {
        contentType =
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      } else if (ext === '.doc') {
        contentType = 'application/msword';
      }
    }

    return {
      buffer: fileBuffer,
      stats,
      contentType,
      displayName,
    };
  }
}

export const meetingFileService = new MeetingFileService();
