import { logger } from '@/lib/logger';

// WebSocket connection utility to handle various deployment environments
// This helps fix WebSocket URL construction issues across different platforms

export interface WebSocketConfig {
  path: string;
  protocol?: 'ws' | 'wss';
  maxRetries?: number;
  retryDelay?: number;
}

export function getWebSocketUrl(config: WebSocketConfig): string {
  if (typeof window === 'undefined') return '';

  const { path, protocol: forcedProtocol, maxRetries = 3, retryDelay = 5000 } = config;

  // Determine protocol
  const protocol = forcedProtocol || (window.location.protocol === 'https:' ? 'wss:' : 'ws:');

  // Get hostname and port from current location
  const hostname = window.location.hostname;
  const port = window.location.port;

  logger.log('WebSocket URL Construction Debug:', {
    hostname,
    port,
    protocol,
    path,
    fullHost: window.location.host,
    origin: window.location.origin
  });

  let host;

  // Handle different deployment scenarios
  if (hostname.includes('replit.app')) {
    // Production Replit apps - DO NOT add port, reverse proxy handles routing
    host = hostname;
    logger.log('Detected Replit production environment, using host without port:', host);
  } else if (hostname.includes('replit.dev') || hostname.includes('replit.com') || hostname.includes('spock.replit.dev')) {
    // Replit development environments - DO NOT add port, proxy handles routing
    // Adding :5000 causes "Invalid frame header" errors as Replit's proxy corrupts WebSocket frames
    host = hostname;
    logger.log('Detected Replit dev environment, using host without port:', host);
  } else if (hostname === 'localhost' || hostname === '127.0.0.1') {
    // Local development - force port 5000 if no port specified
    const resolvedPort = port || '5000';
    host = `${hostname}:${resolvedPort}`;
    logger.log('Detected localhost environment, using host:', host);
  } else if (hostname) {
    // Other deployments - use hostname with port if available
    host = port ? `${hostname}:${port}` : hostname;
    logger.log('Detected other environment, using host:', host);
  } else {
    // Fallback
    host = 'localhost:5000';
    logger.warn('Unable to detect hostname, using fallback:', host);
  }

  const url = `${protocol}//${host}${path}`;
  logger.log('Final WebSocket URL:', url);

  return url;
}

export function createWebSocketConnection(
  config: WebSocketConfig,
  options: {
    onOpen?: (ws: WebSocket) => void;
    onMessage?: (event: MessageEvent) => void;
    onError?: (event: Event) => void;
    onClose?: (event: CloseEvent) => void;
    autoReconnect?: boolean;
  } = {}
): { ws: WebSocket | null; cleanup: () => void } {
  const { onOpen, onMessage, onError, onClose, autoReconnect = true } = options;
  let ws: WebSocket | null = null;
  let reconnectAttempts = 0;
  let reconnectTimeout: NodeJS.Timeout | null = null;
  let isCleanedUp = false;

  const connect = () => {
    if (isCleanedUp) return;

    try {
      const url = getWebSocketUrl(config);
      logger.log(`Attempting WebSocket connection to: ${url}`);

      ws = new WebSocket(url);

      ws.onopen = (event) => {
        logger.log('WebSocket connected successfully');
        reconnectAttempts = 0;
        onOpen?.(ws!);
      };

      ws.onmessage = (event) => {
        onMessage?.(event);
      };

      ws.onerror = (event) => {
        logger.error('WebSocket error:', event);
        onError?.(event);
      };

      ws.onclose = (event) => {
        logger.log('WebSocket closed:', event.code, event.reason);
        onClose?.(event);

        // Auto-reconnect if not a normal closure and not cleaned up
        if (autoReconnect && !isCleanedUp && event.code !== 1000) {
          const maxRetries = config.maxRetries || 5;
          if (reconnectAttempts < maxRetries) {
            reconnectAttempts++;
            const delay = (config.retryDelay || 5000) * reconnectAttempts;
            logger.log(`Attempting reconnect ${reconnectAttempts}/${maxRetries} in ${delay}ms`);

            reconnectTimeout = setTimeout(connect, delay);
          } else {
            logger.error('Max reconnection attempts reached');
          }
        }
      };

    } catch (error) {
      logger.error('Failed to create WebSocket:', error);
      onError?.(new Event('error'));
    }
  };

  const cleanup = () => {
    isCleanedUp = true;
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }
    if (ws && ws.readyState !== WebSocket.CLOSED) {
      ws.close(1000, 'Component cleanup');
    }
  };

  // Start initial connection
  connect();

  return { ws, cleanup };
}