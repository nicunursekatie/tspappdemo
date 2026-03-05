import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { apiKeys } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';
import { logger } from '../utils/production-safe-logger';

interface ApiKeyRequest extends Request {
  apiKey?: {
    id: number;
    name: string;
    permissions: string[];
  };
  user?: any;
}

export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

export function generateApiKey(): { key: string; prefix: string; hash: string } {
  const key = `tsp_${crypto.randomBytes(32).toString('hex')}`;
  const prefix = key.substring(0, 12);
  const hash = hashApiKey(key);
  return { key, prefix, hash };
}

export async function apiKeyAuth(
  req: ApiKeyRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.substring(7);
  
  if (!token.startsWith('tsp_')) {
    return next();
  }

  try {
    const keyHash = hashApiKey(token);
    
    const [apiKeyRecord] = await db
      .select()
      .from(apiKeys)
      .where(and(
        eq(apiKeys.keyHash, keyHash),
        eq(apiKeys.isActive, true)
      ));

    if (!apiKeyRecord) {
      return res.status(401).json({
        message: 'Invalid API key',
        code: 'INVALID_API_KEY',
      });
    }

    if (apiKeyRecord.expiresAt && new Date(apiKeyRecord.expiresAt) < new Date()) {
      return res.status(401).json({
        message: 'API key has expired',
        code: 'API_KEY_EXPIRED',
      });
    }

    await db
      .update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeys.id, apiKeyRecord.id));

    req.apiKey = {
      id: apiKeyRecord.id,
      name: apiKeyRecord.name,
      permissions: (apiKeyRecord.permissions as string[]) || ['EVENT_REQUESTS_VIEW'],
    };

    logger.info(`API key authenticated: ${apiKeyRecord.name} (${apiKeyRecord.keyPrefix}...)`);
    
    next();
  } catch (error) {
    logger.error('API key authentication error:', error);
    return res.status(500).json({
      message: 'Authentication error',
      code: 'AUTH_ERROR',
    });
  }
}

export function requireApiKeyPermission(permission: string) {
  return (req: ApiKeyRequest, res: Response, next: NextFunction) => {
    if (req.user) {
      return next();
    }

    if (!req.apiKey) {
      return res.status(401).json({
        message: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
    }

    if (!req.apiKey.permissions.includes(permission) && !req.apiKey.permissions.includes('*')) {
      return res.status(403).json({
        message: 'Insufficient permissions',
        code: 'FORBIDDEN',
        required: permission,
      });
    }

    next();
  };
}

export function requireApiKeyOrSession(
  req: ApiKeyRequest,
  res: Response,
  next: NextFunction
) {
  if (req.user || req.apiKey) {
    return next();
  }

  return res.status(401).json({
    message: 'Authentication required (session or API key)',
    code: 'AUTH_REQUIRED',
  });
}

export function apiKeyReadOnly(
  req: ApiKeyRequest,
  res: Response,
  next: NextFunction
) {
  if (req.user) {
    return next();
  }

  if (req.apiKey) {
    const allowedMethods = ['GET'];
    
    // Allow POST if API key has CREATE permission
    if (req.apiKey.permissions.includes('EVENT_REQUESTS_CREATE') || 
        req.apiKey.permissions.includes('*')) {
      allowedMethods.push('POST');
    }
    
    // Allow PATCH/PUT if API key has UPDATE permission
    if (req.apiKey.permissions.includes('EVENT_REQUESTS_UPDATE') || 
        req.apiKey.permissions.includes('*')) {
      allowedMethods.push('PATCH', 'PUT');
    }
    
    if (!allowedMethods.includes(req.method)) {
      return res.status(403).json({
        message: `API key does not have permission for ${req.method} requests.`,
        code: 'API_KEY_INSUFFICIENT_PERMISSION',
        allowedMethods,
      });
    }
  }

  next();
}
