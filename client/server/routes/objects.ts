import { Router } from 'express';
import { objectStorageService, objectStorageClient } from '../objectStorage';
import { logger } from '../utils/production-safe-logger';

const router = Router();

// POST /api/objects/upload - Get a signed upload URL for object storage
router.post('/upload', async (req, res) => {
  try {
    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    res.json({ uploadURL });
  } catch (error) {
    logger.error('Failed to get upload URL:', error);
    res.status(500).json({
      error: 'Failed to get upload URL',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/objects/proxy - Proxy private object storage files
router.get('/proxy', async (req, res) => {
  try {
    const { url, download, filename } = req.query;

    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'URL parameter is required' });
    }

    // Extract bucket and object path from the URL
    // URL format: https://storage.googleapis.com/{bucket}/{path}
    const urlMatch = url.match(/https:\/\/storage\.googleapis\.com\/([^\/]+)\/(.+)/);
    if (!urlMatch) {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    const [, bucketName, objectPath] = urlMatch;
    const bucket = objectStorageClient.bucket(bucketName);
    const file = bucket.file(objectPath);

    // Check if file exists
    const [exists] = await file.exists();
    if (!exists) {
      return res.status(404).json({ error: 'File not found' });
    }

    // If download=true, set Content-Disposition header to force download
    if (download === 'true') {
      const downloadFilename = typeof filename === 'string' && filename
        ? filename
        : objectPath.split('/').pop() || 'download';
      res.setHeader('Content-Disposition', `attachment; filename="${downloadFilename}"`);
    }

    // Download and stream the file
    await objectStorageService.downloadObject(file, res);
  } catch (error) {
    logger.error('Failed to proxy object:', error);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Failed to proxy object',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
});

export default router;
