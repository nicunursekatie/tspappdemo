# Performance Monitoring & Observability

This document describes the comprehensive monitoring and observability infrastructure for The Sandwich Project Platform.

## Overview

The platform includes enterprise-grade monitoring capabilities:

- **Error Tracking**: Sentry integration for error tracking and alerting
- **Performance Metrics**: Prometheus-compatible metrics for API, database, and WebSocket performance
- **Business Metrics**: Domain-specific metrics for tracking key business KPIs
- **Health Checks**: Comprehensive health monitoring for all system components
- **Monitoring Dashboard**: Real-time dashboard for viewing key metrics

## Quick Start

### 1. Configure Environment Variables

Add the following to your `.env` file:

```bash
# Sentry Error Tracking (optional but recommended)
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
SENTRY_RELEASE=sandwich-platform@1.0.0

# For production deployments
NODE_ENV=production
```

### 2. Access Monitoring Endpoints

Once the server is running, you can access:

- **Dashboard**: `http://localhost:5000/monitoring/dashboard`
- **Metrics (Prometheus format)**: `http://localhost:5000/monitoring/metrics`
- **Metrics (JSON format)**: `http://localhost:5000/monitoring/metrics/json`
- **Health Check (Simple)**: `http://localhost:5000/monitoring/health`
- **Health Check (Detailed)**: `http://localhost:5000/monitoring/health/detailed`
- **Readiness Check**: `http://localhost:5000/monitoring/health/ready`
- **Liveness Check**: `http://localhost:5000/monitoring/health/live`

## Monitoring Features

### 1. Error Tracking with Sentry

**What it does:**
- Captures and reports all application errors
- Groups similar errors for easier analysis
- Provides stack traces and context
- Alerts you when new errors occur
- Tracks error frequency and patterns

**Setup:**
1. Create a free account at [sentry.io](https://sentry.io)
2. Create a new project for Node.js
3. Copy your DSN and add it to `.env`:
   ```bash
   SENTRY_DSN=https://your-dsn-here@sentry.io/project-id
   ```
4. Restart the server

**Features:**
- Automatic error capture for unhandled exceptions
- Manual error reporting: `import { captureException } from './monitoring'`
- User context tracking
- Performance profiling
- Release tracking

### 2. Performance Metrics

**HTTP Request Metrics:**
- Request count by method, route, and status code
- Request duration (response time)
- Request/response sizes
- Error rates

**Database Metrics:**
- Query count by operation and table
- Query duration
- Connection pool status
- Query errors

**WebSocket Metrics:**
- Active connections (Socket.IO and native WebSocket)
- Message count by type and direction
- Message processing duration
- Connection errors

**Business Metrics:**
- Active users (5 minutes, 1 hour, 24 hours)
- Active sessions
- Event requests processed
- Notifications sent (by type and channel)
- Sandwich collections
- Chat messages
- External API calls

**System Metrics:**
- CPU usage
- Memory usage
- Event loop lag
- Garbage collection statistics

### 3. Health Checks

**Simple Health Check** (`/monitoring/health`):
- Fast endpoint for load balancers
- Returns 200 if database is accessible
- Returns 503 if system is unhealthy

**Detailed Health Check** (`/monitoring/health/detailed`):
- Comprehensive system status
- Individual component health (database, memory, disk, WebSocket)
- External service configuration status
- System uptime and version

**Kubernetes Health Checks:**
- **Readiness** (`/monitoring/health/ready`): Is the app ready to receive traffic?
- **Liveness** (`/monitoring/health/live`): Is the app still running?

### 4. Monitoring Dashboard

A real-time HTML dashboard showing:
- System health status
- HTTP request statistics
- Database query statistics
- WebSocket connections
- Active users and sessions
- Notifications sent
- Memory usage
- External API statistics

**Auto-refresh**: The dashboard automatically refreshes every 30 seconds.

## Integration with External Tools

### Grafana

1. Set up Prometheus to scrape metrics:
   ```yaml
   scrape_configs:
     - job_name: 'sandwich-platform'
       static_configs:
         - targets: ['your-server:5000']
       metrics_path: '/monitoring/metrics'
   ```

2. Add Prometheus as a data source in Grafana

3. Create dashboards using the metrics:
   - `sandwich_platform_http_request_duration_seconds`
   - `sandwich_platform_db_query_duration_seconds`
   - `sandwich_platform_active_users`
   - `sandwich_platform_websocket_connections`
   - And many more!

### Datadog

1. Install Datadog agent
2. Configure agent to scrape Prometheus metrics:
   ```yaml
   instances:
     - prometheus_url: http://localhost:5000/monitoring/metrics
       namespace: "sandwich_platform"
       metrics:
         - "*"
   ```

### New Relic

1. Install New Relic APM for Node.js
2. Configure using environment variables
3. Use the existing Prometheus metrics endpoint for additional metrics

### Uptime Monitoring

Use any uptime monitoring service (UptimeRobot, Pingdom, StatusCake):
- Monitor: `https://your-domain.com/monitoring/health`
- Checks every 1-5 minutes
- Alerts when status is not 200

## Available Metrics

All metrics are prefixed with `sandwich_platform_` and follow Prometheus naming conventions.

### HTTP Metrics
- `http_requests_total` - Total HTTP requests
- `http_request_duration_seconds` - HTTP request duration
- `http_request_size_bytes` - HTTP request size
- `http_response_size_bytes` - HTTP response size
- `http_errors_total` - Total HTTP errors

### Database Metrics
- `db_queries_total` - Total database queries
- `db_query_duration_seconds` - Database query duration
- `db_query_errors_total` - Total database errors
- `db_connection_pool_size` - Connection pool size

### WebSocket Metrics
- `websocket_connections` - Active WebSocket connections
- `websocket_messages_total` - Total WebSocket messages
- `websocket_message_duration_seconds` - Message processing time
- `websocket_errors_total` - Total WebSocket errors

### Business Metrics
- `active_users` - Number of active users
- `active_sessions` - Number of active sessions
- `event_requests_total` - Total event requests
- `event_request_processing_seconds` - Event processing time
- `notifications_total` - Total notifications sent
- `notification_delivery_seconds` - Notification delivery time
- `sandwich_collections_total` - Total sandwich collections
- `chat_messages_total` - Total chat messages
- `chat_message_latency_seconds` - Chat message latency

### Authentication Metrics
- `auth_attempts_total` - Total authentication attempts

### External API Metrics
- `external_api_calls_total` - Total external API calls
- `external_api_duration_seconds` - External API call duration
- `external_api_errors_total` - Total external API errors

### File Upload Metrics
- `file_uploads_total` - Total file uploads
- `file_upload_size_bytes` - File upload sizes
- `file_upload_duration_seconds` - File upload duration

### Background Job Metrics
- `background_jobs_total` - Total background jobs
- `background_job_duration_seconds` - Background job duration

### System Health Metrics
- `system_health` - System health status (1 = healthy, 0 = unhealthy)
- Plus default Node.js metrics (CPU, memory, event loop, GC)

## Using Metrics in Code

### Track Custom Events

```typescript
import {
  trackEventRequestCreated,
  trackNotificationSent,
  trackSandwichCollection
} from './monitoring';

// Track an event request
trackEventRequestCreated('approved', 'standard');

// Track a notification
trackNotificationSent('email', 'event-confirmation', 'success');

// Track a sandwich collection
trackSandwichCollection('completed');
```

### Monitor External API Calls

```typescript
import { monitorExternalApi } from './monitoring';

// Automatically track duration and errors
const result = await monitorExternalApi('google-sheets', 'fetch-data', async () => {
  return await fetchGoogleSheetData();
});
```

### Monitor Background Jobs

```typescript
import { monitorBackgroundJob } from './monitoring';

// Track job execution time and success/failure
await monitorBackgroundJob('sync-google-sheets', async () => {
  await syncGoogleSheets();
});
```

### Capture Errors

```typescript
import { captureException, captureMessage } from './monitoring';

try {
  // Your code
} catch (error) {
  captureException(error, {
    extra: {
      userId: user.id,
      action: 'create-event',
    },
  });
  throw error;
}

// Or capture a warning message
captureMessage('Unusual activity detected', 'warning', {
  userId: user.id,
  activity: 'multiple-failed-logins',
});
```

## Performance Optimization Tips

### Database Queries

The monitoring system tracks slow database queries (>500ms). To optimize:

1. Check the metrics for slow queries:
   - Look at `db_query_duration_seconds` histogram
   - Identify which tables have high latency

2. Add indexes to frequently queried columns

3. Use pagination for large result sets

4. Consider caching frequently accessed data

### API Response Times

Monitor API response times and optimize slow endpoints:

1. Check `http_request_duration_seconds` for slow routes

2. Common optimizations:
   - Add database indexes
   - Implement caching (Redis)
   - Optimize N+1 queries
   - Use database connection pooling
   - Enable response compression (already enabled)

### WebSocket Performance

Monitor WebSocket message latency:

1. Check `websocket_message_duration_seconds`

2. Optimize message processing:
   - Batch database operations
   - Use async processing for heavy tasks
   - Implement rate limiting

## Alerting

### Sentry Alerts

Configure alerts in Sentry dashboard:
- New issues
- Issue frequency thresholds
- Performance degradation
- Custom metric thresholds

### Grafana Alerts

Create alerts based on metrics:
- High error rate: `rate(http_errors_total[5m]) > 10`
- Slow API: `histogram_quantile(0.95, http_request_duration_seconds) > 2`
- Memory usage: `process_resident_memory_bytes > 500000000`
- Database slow: `histogram_quantile(0.95, db_query_duration_seconds) > 1`

### External Monitoring

Use services like:
- **PagerDuty**: For critical alerts
- **Slack**: For team notifications
- **Email**: For regular reports

## Troubleshooting

### No Metrics Showing

1. Check server logs for errors during monitoring initialization
2. Verify `/monitoring/metrics` endpoint is accessible
3. Check that `prom-client` is installed: `npm list prom-client`

### Sentry Not Capturing Errors

1. Verify `SENTRY_DSN` is set in environment variables
2. Check Sentry initialization logs
3. Test with: `captureException(new Error('Test error'))`
4. Verify Sentry project is active

### High Memory Usage

1. Check `/monitoring/health/detailed` for memory stats
2. Look for memory leaks in long-running processes
3. Monitor garbage collection metrics
4. Consider increasing available memory

### Slow Performance

1. Check `/monitoring/dashboard` for bottlenecks
2. Review database query metrics
3. Check external API latencies
4. Monitor WebSocket message processing times

## Best Practices

1. **Set up Sentry early**: Catch errors before they affect users
2. **Monitor in production**: Real user data provides the best insights
3. **Set up alerts**: Don't wait for users to report issues
4. **Review metrics weekly**: Identify trends and optimize proactively
5. **Track business metrics**: Understand user behavior and feature usage
6. **Test monitoring**: Regularly verify alerts and dashboards work
7. **Document incidents**: Use Sentry and metrics to understand what happened

## Security Considerations

- Metrics endpoints are unauthenticated by default (internal use only)
- For public deployments, add authentication middleware to `/monitoring/*`
- Sentry automatically redacts sensitive data (passwords, tokens, API keys)
- Health checks don't expose sensitive information
- Consider IP whitelisting for metrics endpoints

## Cost Optimization

### Sentry
- Free tier: 5,000 errors/month
- Reduce noise by ignoring expected errors
- Set appropriate sample rates for performance monitoring

### Storage
- Prometheus metrics are ephemeral (not stored by default)
- Use external storage (Prometheus server, Grafana Cloud) for long-term data
- Metrics are lightweight and don't significantly impact performance

## Support

For questions or issues:
1. Check the monitoring dashboard: `/monitoring/dashboard`
2. Review server logs for monitoring-related errors
3. Check Sentry dashboard for error details
4. Consult this documentation

## Future Enhancements

Potential additions:
- Custom dashboards per user role
- Automated performance regression detection
- Cost tracking and optimization suggestions
- Advanced anomaly detection
- Integration with more APM tools
- Custom metric alerts via webhooks
