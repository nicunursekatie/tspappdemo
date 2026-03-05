/**
 * Centralized CORS Configuration
 *
 * Provides secure, environment-aware CORS configuration for both Express routes
 * and Socket.IO connections. Replaces scattered CORS configs with a single
 * source of truth that prevents security vulnerabilities.
 */

export interface CorsConfig {
  allowedOrigins: string[];
  credentials: boolean;
  methods: string[];
  allowedHeaders: string[];
  optionsSuccessStatus: number;
}

/**
 * Get allowed origins based on environment and current domain
 */
function getAllowedOrigins(): string[] {
  const origins: string[] = [];

  // Always allow the current Replit domain if available
  if (process.env.REPL_SLUG && process.env.REPL_OWNER) {
    const replitDomain = `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;
    origins.push(replitDomain);

    // Also allow the .replit.dev variant
    const replitDevDomain = `https://${process.env.REPL_SLUG}--${process.env.REPL_OWNER}.repl.co`;
    origins.push(replitDevDomain);

    // CRITICAL: Also allow the .replit.app production domain format
    const replitAppDomain = `https://${process.env.REPL_SLUG}.replit.app`;
    origins.push(replitAppDomain);
  }

  // Development specific origins
  if (process.env.NODE_ENV === 'development') {
    origins.push(
      'http://localhost:5000',
      'https://localhost:5000',
      'http://127.0.0.1:5000',
      'https://127.0.0.1:5000'
    );
  }

  // Add any additional production origins from environment variable
  if (process.env.ALLOWED_ORIGINS) {
    const additionalOrigins = process.env.ALLOWED_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0);
    origins.push(...additionalOrigins);
  }

  // CRITICAL: Ensure the exact production URLs are always allowed
  // Both the original long-form domain and the newer short domain
  if (process.env.NODE_ENV === 'production') {
    origins.push(
      'https://sandwich-project-platform-final.replit.app',
      'https://sandwich-project-platform-final-katielong2316.replit.app',
      'https://tspapp.org',
      'https://www.tspapp.org',
      'http://tspapp.org',
      'http://www.tspapp.org'
    );
  }

  // Also allow any *.replit.app domain for this project in all environments
  if (process.env.REPLIT_DEPLOYMENT) {
    const deploymentDomain = `https://${process.env.REPLIT_DEPLOYMENT}.replit.app`;
    origins.push(deploymentDomain);
  }

  return [...new Set(origins)]; // Remove duplicates
}

/**
 * Check if an origin is allowed
 */
export function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) {
    // Allow same-origin requests (no origin header)
    return true;
  }

  const allowedOrigins = getAllowedOrigins();

  // Exact match
  if (allowedOrigins.includes(origin)) {
    return true;
  }

  // In development, allow any localhost or 127.0.0.1 variants
  if (process.env.NODE_ENV === 'development') {
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return true;
    }
    // Allow Replit dev domains only in development
    if (origin.includes('.replit.dev') || origin.includes('.spock.replit')) {
      return true;
    }
  }

  // In production, also allow any .replit.app domain for this project
  if (origin.endsWith('.replit.app') && origin.includes('sandwich-project-platform-final')) {
    return true;
  }

  // Allow Replit preview deploy URLs (*.spock.prod.repl.run) in all environments
  if (origin.endsWith('.spock.prod.repl.run') || origin.endsWith('.spock.replit.dev')) {
    return true;
  }

  // Allow Railway deployment domains (*.railway.app, *.up.railway.app)
  if (origin.endsWith('.railway.app') || origin.endsWith('.up.railway.app')) {
    return true;
  }

  // Allow custom domain
  if (origin === 'https://tspapp.org' || origin === 'https://www.tspapp.org') {
    return true;
  }

  return false;
}

/**
 * Get the CORS configuration for Express middleware
 */
export function getExpressCorsConfig(): CorsConfig {
  return {
    allowedOrigins: getAllowedOrigins(),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'Cache-Control',
      'Pragma',
    ],
    optionsSuccessStatus: 200,
  };
}

/**
 * Get the CORS configuration for Socket.IO
 */
export function getSocketCorsConfig() {
  const allowedOrigins = getAllowedOrigins();

  return {
    origin: (
      origin: string,
      callback: (err: Error | null, allow?: boolean) => void
    ) => {
      // Socket.IO passes undefined for same-origin requests
      if (!origin) {
        return callback(null, true);
      }

      if (isOriginAllowed(origin)) {
        callback(null, true);
      } else {
        console.warn(`🚫 Socket.IO CORS: Blocked origin: ${origin}`);
        callback(new Error('Not allowed by CORS'), false);
      }
    },
    methods: ['GET', 'POST'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
  };
}

/**
 * Express middleware for CORS handling
 */
export function createCorsMiddleware() {
  return (req: any, res: any, next: any) => {
    const origin = req.headers.origin;
    const config = getExpressCorsConfig();

    // Handle CORS for allowed origins
    if (isOriginAllowed(origin)) {
      if (origin) {
        // Cross-origin request - set the specific origin
        res.header('Access-Control-Allow-Origin', origin);
      } else {
        // Same-origin request - don't set Access-Control-Allow-Origin header
        // Setting it to 'null' causes cookie rejection with sameSite: 'none'
        // For same-origin requests, the header isn't needed
      }
      // For same-origin requests (no origin header), don't set Access-Control-Allow-Origin
      // Setting it to 'null' breaks cookie handling with sameSite: 'none'
    } else if (origin) {
      console.warn(`🚫 Express CORS: Blocked origin: ${origin}`);
      // Don't set any CORS headers for blocked origins
      return res.status(403).json({ error: 'Origin not allowed' });
    }

    // Set other CORS headers
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', config.methods.join(','));
    res.header('Access-Control-Allow-Headers', config.allowedHeaders.join(','));

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.status(config.optionsSuccessStatus).end();
    } else {
      next();
    }
  };
}

/**
 * Log current CORS configuration (for debugging)
 */
export function logCorsConfig() {
  const allowedOrigins = getAllowedOrigins();
  console.log('🔒 CORS Configuration:');
  console.log('  Environment:', process.env.NODE_ENV || 'development');
  console.log('  Allowed Origins:', allowedOrigins);
  console.log('  Credentials:', true);
  console.log('  Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS');
}
