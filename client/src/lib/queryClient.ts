import { QueryClient, QueryFunction } from '@tanstack/react-query';
import { logger } from '@/lib/logger';

/**
 * Custom error class that preserves server response details.
 * This allows mutation onError handlers to access the original
 * error message, status code, and any structured data from the server.
 */
export class ApiError extends Error {
  status: number;
  statusText: string;
  data: any;
  code: string;

  constructor(status: number, statusText: string, body: string, data?: any) {
    // Determine error code for retry logic
    let code = `${status}: ${body || statusText}`;
    if (status === 401) code = 'AUTH_EXPIRED';
    else if (status === 403) code = 'PERMISSION_DENIED';
    else if (status === 404) code = 'DATA_LOADING_ERROR';
    else if (status >= 500) code = 'DATABASE_ERROR';
    else if (typeof navigator !== 'undefined' && !navigator.onLine) code = 'NETWORK_ERROR';

    // Use the server's error message if available, otherwise fall back to code
    const serverMessage = data?.message || data?.error || body || statusText;
    super(serverMessage);

    this.name = 'ApiError';
    this.status = status;
    this.statusText = statusText;
    this.code = code;
    this.data = data || {};
  }
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    let text = '';
    let jsonData: any = null;

    try {
      // Try to parse as JSON first to get structured error info
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        jsonData = await res.json();
        text = jsonData?.message || jsonData?.error || JSON.stringify(jsonData);
      } else {
        text = (await res.text()) || res.statusText;
      }
    } catch (e) {
      text = res.statusText || 'Unknown error';
    }

    throw new ApiError(res.status, res.statusText, text, jsonData);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  body?: any,
  timeoutMs: number = 30000 // 30 second default timeout
): Promise<any> {
  logger.log(`🔵 [apiRequest] ${method} ${url}`);
  if (body) {
    logger.log('📦 [apiRequest] Body:', JSON.stringify(body).substring(0, 200));
  }
  
  const isFormData = body instanceof FormData;
  
  // Create an AbortController for timeout handling
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    logger.log('🚀 [apiRequest] Sending fetch request...');
    const res = await fetch(url, {
      method,
      headers: isFormData
        ? {}
        : body
          ? { 'Content-Type': 'application/json' }
          : {},
      body: isFormData ? body : body ? JSON.stringify(body) : undefined,
      credentials: 'include',
      signal: controller.signal,
    });

    logger.log(`✅ [apiRequest] Response received: ${res.status} ${res.statusText}`);
    
    // Clear the timeout since the request completed
    clearTimeout(timeoutId);
    
    await throwIfResNotOk(res);

    // If response has content, parse as JSON
    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      try {
        const jsonData = await res.json();
        logger.log(`📥 [apiRequest] JSON response:`, jsonData);
        // Ensure we return a valid object, not null/undefined
        return jsonData ?? {};
      } catch (parseError) {
        logger.warn('Failed to parse JSON response:', parseError);
        return {};
      }
    }

    logger.log('📭 [apiRequest] No JSON content, returning empty object');
    // For empty responses (like 204), return empty object instead of null
    // This prevents "null is not an object" errors when accessing properties
    return {};
  } catch (error: any) {
    logger.error(`❌ [apiRequest] Error:`, error);
    // Clear timeout on error
    clearTimeout(timeoutId);
    
    // Handle timeout/abort errors
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeoutMs}ms`);
    }
    
    // Re-throw other errors
    throw error;
  }
}

type UnauthorizedBehavior = 'returnNull' | 'throw';
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey[0] as string, {
      credentials: 'include',
    });

    if (unauthorizedBehavior === 'returnNull' && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    
    // Check content-type to prevent parsing HTML as JSON
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const preview = await res.text().catch(() => '');
      logger.warn('DATA_LOADING_ERROR: Non-JSON API response', { 
        url: res.url, 
        status: res.status, 
        contentType, 
        preview: preview?.slice(0, 200) 
      });
      throw new Error('DATA_LOADING_ERROR: Non-JSON response from API');
    }
    
    try {
      const jsonData = await res.json();
      // Ensure we return a valid object, not null/undefined
      return jsonData ?? {};
    } catch (parseError) {
      // Get a preview of the actual response to debug HTML vs JSON issues
      const preview = await res.clone().text().catch(() => '');
      logger.warn('DEBUGGING: Failed to parse JSON response', { 
        url: res.url, 
        status: res.status, 
        contentType: res.headers.get('content-type'),
        bodyPreview: preview?.slice(0, 200),
        error: parseError 
      });
      return {};
    }
  };

/**
 * Invalidate and refetch all event request related queries.
 * Use this after any mutation that modifies event request data to ensure
 * the UI refreshes with the latest data immediately.
 *
 * This handles the query key mismatch between different query patterns:
 * - /api/event-requests (legacy)
 * - /api/event-requests/list (optimized list endpoint)
 * - /api/event-requests/status-counts (tab badge counts)
 */
export async function invalidateEventRequestQueries(qc: QueryClient) {
  // Use refetchQueries to force immediate refresh, not just mark as stale.
  // Await both promises so callers can wait for data to be fresh before
  // closing dialogs or clearing selected state.
  await Promise.all([
    qc.refetchQueries({
      predicate: (query) => {
        const key = query.queryKey;
        if (!Array.isArray(key) || typeof key[0] !== 'string') return false;
        return key[0].startsWith('/api/event-requests');
      },
    }),
    // Also refetch event map since it depends on event data
    qc.refetchQueries({ queryKey: ['/api/event-map'] }),
  ]);
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: 'throw' }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes - reduces aggressive refetching while allowing proper cache invalidation
      gcTime: 10 * 60 * 1000, // 10 minutes - garbage collection time (formerly cacheTime)
      retry: (failureCount, error) => {
        // Don't retry for auth, permission, or validation errors
        const noRetryErrors = [
          'AUTH_EXPIRED',
          'PERMISSION_DENIED',
          'VALIDATION_ERROR',
        ];
        // Check both ApiError.code and error.message for error codes
        const errorCode = (error as any)?.code || '';
        const errorMessage = error?.message || '';
        const errorStr = `${errorCode} ${errorMessage}`;

        if (noRetryErrors.some((code) => errorStr.includes(code))) {
          return false;
        }

        // Retry network and database errors (initial attempt + up to 2 retries = 3 total)
        const retryableErrors = ['NETWORK_ERROR', 'DATABASE_ERROR', 'Failed to fetch', 'Request timeout'];
        if (retryableErrors.some((code) => errorStr.includes(code)) && failureCount < 2) {
          return true;
        }

        return false;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
    mutations: {
      retry: (failureCount, error) => {
        // Don't retry auth/permission/validation errors
        const noRetryErrors = ['AUTH_EXPIRED', 'PERMISSION_DENIED', 'VALIDATION_ERROR'];
        const errorCode = (error as any)?.code || '';
        const errorMessage = error?.message || '';
        const errorStr = `${errorCode} ${errorMessage}`;

        if (noRetryErrors.some((code) => errorStr.includes(code))) {
          return false;
        }

        // Retry database, network, and timeout errors (initial attempt + up to 2 retries = 3 total)
        const retryableErrors = ['DATABASE_ERROR', 'NETWORK_ERROR', 'Failed to fetch', 'Request timeout'];
        return (
          retryableErrors.some((code) => errorStr.includes(code)) &&
          failureCount < 2
        );
      },
      // Cap at 5s for mutations since they're user-initiated and responsiveness matters
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
    },
  },
});
