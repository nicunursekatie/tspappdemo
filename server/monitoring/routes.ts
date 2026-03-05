/**
 * Monitoring Routes
 *
 * Provides endpoints for accessing metrics and health check data
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { getMetrics, getMetricsJSON } from './metrics';
import {
  simpleHealthCheck,
  detailedHealthCheck,
  readinessCheck,
  livenessCheck,
} from './health-checks';
import logger from '../utils/logger';

/**
 * Create monitoring routes
 */
export function createMonitoringRoutes(io?: any, wss?: any): Router {
  const router = Router();

  /**
   * GET /metrics
   * Returns Prometheus-formatted metrics
   * Can be scraped by Prometheus, Grafana, Datadog, etc.
   */
  router.get('/metrics', async (req: Request, res: Response) => {
    try {
      const metrics = await getMetrics();
      res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
      res.send(metrics);
    } catch (error: any) {
      logger.error('Failed to get metrics', { error: error.message });
      res.status(500).json({ error: 'Failed to retrieve metrics' });
    }
  });

  /**
   * GET /metrics/json
   * Returns metrics in JSON format for easier consumption
   */
  router.get('/metrics/json', async (req: Request, res: Response) => {
    try {
      const metrics = await getMetricsJSON();
      res.json(metrics);
    } catch (error: any) {
      logger.error('Failed to get metrics JSON', { error: error.message });
      res.status(500).json({ error: 'Failed to retrieve metrics' });
    }
  });

  /**
   * GET /health
   * Simple health check for load balancers
   */
  router.get('/health', simpleHealthCheck);

  /**
   * GET /health/detailed
   * Detailed health check with all component statuses
   */
  router.get('/health/detailed', async (req: Request, res: Response) => {
    await detailedHealthCheck(req, res, io, wss);
  });

  /**
   * GET /health/ready
   * Readiness check for Kubernetes
   */
  router.get('/health/ready', readinessCheck);

  /**
   * GET /health/live
   * Liveness check for Kubernetes
   */
  router.get('/health/live', livenessCheck);

  /**
   * GET /monitoring/dashboard
   * Simple HTML dashboard showing key metrics
   */
  router.get('/dashboard', async (req: Request, res: Response) => {
    try {
      const metrics = await getMetricsJSON();
      const html = generateDashboardHTML(metrics);
      res.set('Content-Type', 'text/html');
      res.send(html);
    } catch (error: any) {
      logger.error('Failed to generate dashboard', { error: error.message });
      res.status(500).send('<h1>Dashboard Error</h1><p>Failed to load metrics</p>');
    }
  });

  return router;
}

/**
 * Generate a simple HTML dashboard
 */
function generateDashboardHTML(metrics: any): string {
  const formatMetric = (metric: any) => {
    if (!metric || !metric.values) return 'N/A';
    const value = metric.values[0];
    if (!value) return '0';
    return value.value;
  };

  const findMetric = (name: string) => {
    return metrics.find((m: any) => m.name === name);
  };

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sandwich Platform - Monitoring Dashboard</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 20px;
    }
    .container {
      max-width: 1400px;
      margin: 0 auto;
    }
    h1 {
      color: white;
      text-align: center;
      margin-bottom: 30px;
      font-size: 2.5em;
      text-shadow: 2px 2px 4px rgba(0,0,0,0.2);
    }
    .last-updated {
      color: rgba(255,255,255,0.9);
      text-align: center;
      margin-bottom: 30px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    .card {
      background: white;
      border-radius: 12px;
      padding: 24px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.2);
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .card:hover {
      transform: translateY(-5px);
      box-shadow: 0 15px 40px rgba(0,0,0,0.3);
    }
    .card h2 {
      color: #333;
      font-size: 1.2em;
      margin-bottom: 16px;
      padding-bottom: 10px;
      border-bottom: 2px solid #667eea;
    }
    .metric {
      display: flex;
      justify-content: space-between;
      padding: 10px 0;
      border-bottom: 1px solid #eee;
    }
    .metric:last-child {
      border-bottom: none;
    }
    .metric-label {
      color: #666;
      font-size: 0.9em;
    }
    .metric-value {
      color: #333;
      font-weight: 600;
      font-size: 1.1em;
    }
    .metric-value.large {
      font-size: 2em;
      color: #667eea;
    }
    .status-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 0.85em;
      font-weight: 600;
    }
    .status-healthy {
      background: #10b981;
      color: white;
    }
    .status-warning {
      background: #f59e0b;
      color: white;
    }
    .status-error {
      background: #ef4444;
      color: white;
    }
    .refresh-btn {
      background: white;
      color: #667eea;
      border: none;
      padding: 12px 30px;
      border-radius: 8px;
      font-size: 1em;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      transition: all 0.2s;
      display: block;
      margin: 0 auto;
    }
    .refresh-btn:hover {
      background: #667eea;
      color: white;
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(0,0,0,0.2);
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🥪 Sandwich Platform Monitoring</h1>
    <p class="last-updated">Last updated: ${new Date().toLocaleString()}</p>

    <div class="grid">
      <div class="card">
        <h2>System Health</h2>
        <div class="metric">
          <span class="metric-label">Status</span>
          <span class="metric-value"><span class="status-badge status-healthy">Healthy</span></span>
        </div>
        <div class="metric">
          <span class="metric-label">Uptime</span>
          <span class="metric-value">${Math.floor(process.uptime() / 3600)}h ${Math.floor((process.uptime() % 3600) / 60)}m</span>
        </div>
        <div class="metric">
          <span class="metric-label">Environment</span>
          <span class="metric-value">${process.env.NODE_ENV || 'development'}</span>
        </div>
      </div>

      <div class="card">
        <h2>HTTP Requests</h2>
        <div class="metric">
          <span class="metric-label">Total Requests</span>
          <span class="metric-value large">${formatMetric(findMetric('sandwich_platform_http_requests_total'))}</span>
        </div>
        <div class="metric">
          <span class="metric-label">Errors</span>
          <span class="metric-value">${formatMetric(findMetric('sandwich_platform_http_errors_total'))}</span>
        </div>
      </div>

      <div class="card">
        <h2>Database</h2>
        <div class="metric">
          <span class="metric-label">Total Queries</span>
          <span class="metric-value large">${formatMetric(findMetric('sandwich_platform_db_queries_total'))}</span>
        </div>
        <div class="metric">
          <span class="metric-label">Query Errors</span>
          <span class="metric-value">${formatMetric(findMetric('sandwich_platform_db_query_errors_total'))}</span>
        </div>
      </div>

      <div class="card">
        <h2>WebSocket</h2>
        <div class="metric">
          <span class="metric-label">Active Connections</span>
          <span class="metric-value large">${formatMetric(findMetric('sandwich_platform_websocket_connections'))}</span>
        </div>
        <div class="metric">
          <span class="metric-label">Messages Sent</span>
          <span class="metric-value">${formatMetric(findMetric('sandwich_platform_websocket_messages_total'))}</span>
        </div>
      </div>

      <div class="card">
        <h2>Active Users</h2>
        <div class="metric">
          <span class="metric-label">Last 5 minutes</span>
          <span class="metric-value">${formatMetric(findMetric('sandwich_platform_active_users'))}</span>
        </div>
        <div class="metric">
          <span class="metric-label">Active Sessions</span>
          <span class="metric-value">${formatMetric(findMetric('sandwich_platform_active_sessions'))}</span>
        </div>
      </div>

      <div class="card">
        <h2>Notifications</h2>
        <div class="metric">
          <span class="metric-label">Total Sent</span>
          <span class="metric-value large">${formatMetric(findMetric('sandwich_platform_notifications_total'))}</span>
        </div>
        <div class="metric">
          <span class="metric-label">Chat Messages</span>
          <span class="metric-value">${formatMetric(findMetric('sandwich_platform_chat_messages_total'))}</span>
        </div>
      </div>

      <div class="card">
        <h2>Memory Usage</h2>
        <div class="metric">
          <span class="metric-label">Heap Used</span>
          <span class="metric-value">${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB</span>
        </div>
        <div class="metric">
          <span class="metric-label">Heap Total</span>
          <span class="metric-value">${(process.memoryUsage().heapTotal / 1024 / 1024).toFixed(2)} MB</span>
        </div>
        <div class="metric">
          <span class="metric-label">RSS</span>
          <span class="metric-value">${(process.memoryUsage().rss / 1024 / 1024).toFixed(2)} MB</span>
        </div>
      </div>

      <div class="card">
        <h2>External APIs</h2>
        <div class="metric">
          <span class="metric-label">Total Calls</span>
          <span class="metric-value">${formatMetric(findMetric('sandwich_platform_external_api_calls_total'))}</span>
        </div>
        <div class="metric">
          <span class="metric-label">Errors</span>
          <span class="metric-value">${formatMetric(findMetric('sandwich_platform_external_api_errors_total'))}</span>
        </div>
      </div>
    </div>

    <button class="refresh-btn" onclick="location.reload()">Refresh Dashboard</button>
  </div>

  <script>
    // Auto-refresh every 30 seconds
    setTimeout(() => location.reload(), 30000);
  </script>
</body>
</html>
  `;
}
