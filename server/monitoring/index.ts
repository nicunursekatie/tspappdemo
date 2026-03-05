/**
 * Monitoring Module - Main Export
 *
 * Provides comprehensive performance monitoring, error tracking,
 * and observability for the Sandwich Platform
 */

// Sentry Error Tracking
export {
  initializeSentry,
  captureException,
  captureMessage,
  setUser,
  addBreadcrumb,
  wrapAsync,
  sentryErrorHandler,
  sentryRequestHandler,
  Sentry,
} from './sentry';

// Metrics Collection
export {
  register,
  httpRequestDuration,
  httpRequestTotal,
  httpRequestSize,
  httpResponseSize,
  httpErrorsTotal,
  dbQueryDuration,
  dbQueryTotal,
  dbConnectionPoolSize,
  dbQueryErrors,
  websocketConnections,
  websocketMessagesTotal,
  websocketMessageDuration,
  websocketErrors,
  activeUsers,
  eventRequestsTotal,
  eventRequestProcessingDuration,
  notificationsTotal,
  notificationDeliveryDuration,
  sandwichCollectionsTotal,
  chatMessagesTotal,
  chatMessageLatency,
  externalApiCalls,
  externalApiDuration,
  externalApiErrors,
  authAttempts,
  activeSessions,
  fileUploadsTotal,
  fileUploadSize,
  fileUploadDuration,
  systemHealth,
  backgroundJobsTotal,
  backgroundJobDuration,
  recordHttpRequest,
  recordDbQuery,
  getMetrics,
  getMetricsJSON,
  clearMetrics,
} from './metrics';

// Performance Middleware
export {
  performanceMonitoringMiddleware,
  errorTrackingMiddleware,
  trackActiveUsers,
} from './performance-middleware';

// Database Monitoring
export {
  monitorDbOperation,
  monitorDbOperationSync,
  createDbWrapper,
} from './database-monitor';

// WebSocket Monitoring
export {
  monitorSocketIO,
  monitorWebSocket,
  trackChatMessageLatency,
} from './websocket-monitor';

// Business Metrics
export {
  updateActiveUsersCount,
  trackEventRequestCreated,
  trackEventRequestProcessing,
  trackNotificationSent,
  trackNotificationDelivery,
  trackSandwichCollection,
  trackAuthAttempt,
  updateActiveSessionsCount,
  trackExternalApiCall,
  trackExternalApiError,
  trackBackgroundJob,
  monitorExternalApi,
  monitorBackgroundJob,
  startMetricsUpdates,
} from './business-metrics';

// Health Checks
export {
  performHealthCheck,
  simpleHealthCheck,
  detailedHealthCheck,
  readinessCheck,
  livenessCheck,
} from './health-checks';

export type { HealthCheckResult, ComponentHealth } from './health-checks';

// Routes
export { createMonitoringRoutes } from './routes';
