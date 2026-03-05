/**
 * Prometheus-compatible Metrics Collection Service
 *
 * Provides comprehensive performance and business metrics
 * that can be exported to Grafana, Datadog, or other monitoring tools.
 */

import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';
import logger from '../utils/logger';

// Create a custom registry
export const register = new Registry();

// Add default metrics (CPU, memory, event loop, etc.)
collectDefaultMetrics({
  register,
  prefix: 'sandwich_platform_',
  gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
  eventLoopMonitoringPrecision: 10,
});

// ======================
// HTTP METRICS
// ======================

export const httpRequestDuration = new Histogram({
  name: 'sandwich_platform_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
  registers: [register],
});

export const httpRequestTotal = new Counter({
  name: 'sandwich_platform_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

export const httpRequestSize = new Histogram({
  name: 'sandwich_platform_http_request_size_bytes',
  help: 'Size of HTTP requests in bytes',
  labelNames: ['method', 'route'],
  buckets: [100, 1000, 10000, 100000, 1000000, 10000000],
  registers: [register],
});

export const httpResponseSize = new Histogram({
  name: 'sandwich_platform_http_response_size_bytes',
  help: 'Size of HTTP responses in bytes',
  labelNames: ['method', 'route'],
  buckets: [100, 1000, 10000, 100000, 1000000, 10000000],
  registers: [register],
});

export const httpErrorsTotal = new Counter({
  name: 'sandwich_platform_http_errors_total',
  help: 'Total number of HTTP errors',
  labelNames: ['method', 'route', 'error_type'],
  registers: [register],
});

// ======================
// DATABASE METRICS
// ======================

export const dbQueryDuration = new Histogram({
  name: 'sandwich_platform_db_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['operation', 'table'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [register],
});

export const dbQueryTotal = new Counter({
  name: 'sandwich_platform_db_queries_total',
  help: 'Total number of database queries',
  labelNames: ['operation', 'table', 'status'],
  registers: [register],
});

export const dbConnectionPoolSize = new Gauge({
  name: 'sandwich_platform_db_connection_pool_size',
  help: 'Current size of database connection pool',
  labelNames: ['state'],
  registers: [register],
});

export const dbQueryErrors = new Counter({
  name: 'sandwich_platform_db_query_errors_total',
  help: 'Total number of database query errors',
  labelNames: ['operation', 'table', 'error_type'],
  registers: [register],
});

// ======================
// WEBSOCKET METRICS
// ======================

export const websocketConnections = new Gauge({
  name: 'sandwich_platform_websocket_connections',
  help: 'Current number of WebSocket connections',
  labelNames: ['type'],
  registers: [register],
});

export const websocketMessagesTotal = new Counter({
  name: 'sandwich_platform_websocket_messages_total',
  help: 'Total number of WebSocket messages',
  labelNames: ['type', 'event', 'direction'],
  registers: [register],
});

export const websocketMessageDuration = new Histogram({
  name: 'sandwich_platform_websocket_message_duration_seconds',
  help: 'Duration to process WebSocket messages',
  labelNames: ['type', 'event'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
  registers: [register],
});

export const websocketErrors = new Counter({
  name: 'sandwich_platform_websocket_errors_total',
  help: 'Total number of WebSocket errors',
  labelNames: ['type', 'error_type'],
  registers: [register],
});

// ======================
// BUSINESS METRICS
// ======================

export const activeUsers = new Gauge({
  name: 'sandwich_platform_active_users',
  help: 'Number of active users',
  labelNames: ['timeframe'],
  registers: [register],
});

export const eventRequestsTotal = new Counter({
  name: 'sandwich_platform_event_requests_total',
  help: 'Total number of event requests',
  labelNames: ['status', 'type'],
  registers: [register],
});

export const eventRequestProcessingDuration = new Histogram({
  name: 'sandwich_platform_event_request_processing_seconds',
  help: 'Time to process event requests',
  labelNames: ['status'],
  buckets: [1, 5, 10, 30, 60, 300, 600],
  registers: [register],
});

export const notificationsTotal = new Counter({
  name: 'sandwich_platform_notifications_total',
  help: 'Total number of notifications sent',
  labelNames: ['type', 'channel', 'status'],
  registers: [register],
});

export const notificationDeliveryDuration = new Histogram({
  name: 'sandwich_platform_notification_delivery_seconds',
  help: 'Time to deliver notifications',
  labelNames: ['type', 'channel'],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
  registers: [register],
});

export const sandwichCollectionsTotal = new Counter({
  name: 'sandwich_platform_sandwich_collections_total',
  help: 'Total number of sandwich collections',
  labelNames: ['status'],
  registers: [register],
});

export const chatMessagesTotal = new Counter({
  name: 'sandwich_platform_chat_messages_total',
  help: 'Total number of chat messages',
  labelNames: ['channel', 'type'],
  registers: [register],
});

export const chatMessageLatency = new Histogram({
  name: 'sandwich_platform_chat_message_latency_seconds',
  help: 'Latency from message send to delivery',
  labelNames: ['channel'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2],
  registers: [register],
});

// ======================
// EXTERNAL API METRICS
// ======================

export const externalApiCalls = new Counter({
  name: 'sandwich_platform_external_api_calls_total',
  help: 'Total number of external API calls',
  labelNames: ['service', 'endpoint', 'status'],
  registers: [register],
});

export const externalApiDuration = new Histogram({
  name: 'sandwich_platform_external_api_duration_seconds',
  help: 'Duration of external API calls',
  labelNames: ['service', 'endpoint'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
  registers: [register],
});

export const externalApiErrors = new Counter({
  name: 'sandwich_platform_external_api_errors_total',
  help: 'Total number of external API errors',
  labelNames: ['service', 'error_type'],
  registers: [register],
});

// ======================
// AUTH METRICS
// ======================

export const authAttempts = new Counter({
  name: 'sandwich_platform_auth_attempts_total',
  help: 'Total number of authentication attempts',
  labelNames: ['method', 'status'],
  registers: [register],
});

export const activeSessions = new Gauge({
  name: 'sandwich_platform_active_sessions',
  help: 'Number of active user sessions',
  registers: [register],
});

// ======================
// FILE UPLOAD METRICS
// ======================

export const fileUploadsTotal = new Counter({
  name: 'sandwich_platform_file_uploads_total',
  help: 'Total number of file uploads',
  labelNames: ['type', 'status'],
  registers: [register],
});

export const fileUploadSize = new Histogram({
  name: 'sandwich_platform_file_upload_size_bytes',
  help: 'Size of uploaded files',
  labelNames: ['type'],
  buckets: [1024, 10240, 102400, 1024000, 10240000, 102400000],
  registers: [register],
});

export const fileUploadDuration = new Histogram({
  name: 'sandwich_platform_file_upload_duration_seconds',
  help: 'Duration of file uploads',
  labelNames: ['type'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
  registers: [register],
});

// ======================
// SYSTEM HEALTH METRICS
// ======================

export const systemHealth = new Gauge({
  name: 'sandwich_platform_system_health',
  help: 'System health status (1 = healthy, 0 = unhealthy)',
  labelNames: ['component'],
  registers: [register],
});

export const backgroundJobsTotal = new Counter({
  name: 'sandwich_platform_background_jobs_total',
  help: 'Total number of background jobs executed',
  labelNames: ['job_type', 'status'],
  registers: [register],
});

export const backgroundJobDuration = new Histogram({
  name: 'sandwich_platform_background_job_duration_seconds',
  help: 'Duration of background jobs',
  labelNames: ['job_type'],
  buckets: [1, 5, 10, 30, 60, 300, 600, 1800],
  registers: [register],
});

// ======================
// UTILITY FUNCTIONS
// ======================

/**
 * Record HTTP request metrics
 */
export function recordHttpRequest(
  method: string,
  route: string,
  statusCode: number,
  duration: number,
  requestSize?: number,
  responseSize?: number
): void {
  try {
    httpRequestTotal.inc({ method, route, status_code: statusCode });
    httpRequestDuration.observe({ method, route, status_code: statusCode }, duration);

    if (requestSize) {
      httpRequestSize.observe({ method, route }, requestSize);
    }

    if (responseSize) {
      httpResponseSize.observe({ method, route }, responseSize);
    }

    if (statusCode >= 400) {
      const errorType = statusCode >= 500 ? 'server_error' : 'client_error';
      httpErrorsTotal.inc({ method, route, error_type: errorType });
    }
  } catch (error) {
    logger.error('Failed to record HTTP metrics', { error });
  }
}

/**
 * Record database query metrics
 */
export function recordDbQuery(
  operation: string,
  table: string,
  duration: number,
  success: boolean,
  error?: Error
): void {
  try {
    const status = success ? 'success' : 'error';
    dbQueryTotal.inc({ operation, table, status });
    dbQueryDuration.observe({ operation, table }, duration);

    if (error) {
      const errorType = error.name || 'UnknownError';
      dbQueryErrors.inc({ operation, table, error_type: errorType });
    }
  } catch (error) {
    logger.error('Failed to record DB metrics', { error });
  }
}

/**
 * Get all metrics in Prometheus format
 */
export async function getMetrics(): Promise<string> {
  return register.metrics();
}

/**
 * Get metrics as JSON
 */
export async function getMetricsJSON(): Promise<any> {
  const metrics = await register.getMetricsAsJSON();
  return metrics;
}

/**
 * Clear all metrics (useful for testing)
 */
export function clearMetrics(): void {
  register.clear();
}

logger.info('Metrics collection initialized');
