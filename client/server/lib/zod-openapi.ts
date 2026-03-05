/**
 * Zod with OpenAPI extension
 * This file MUST be imported instead of 'zod' directly in any file that uses .openapi()
 * 
 * Import this in your files:
 *   import { z } from '../lib/zod-openapi';
 * 
 * NOT:
 *   import { z } from 'zod';
 */
import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

// Extend Zod with OpenAPI support
extendZodWithOpenApi(z);

// Re-export the extended z for use throughout the application
export { z };
