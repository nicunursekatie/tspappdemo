/**
 * WebSocket Performance Monitor
 *
 * Tracks WebSocket connection metrics and message delivery latency
 */

import { Server as SocketIOServer, Socket } from 'socket.io';
import {
  websocketConnections,
  websocketMessagesTotal,
  websocketMessageDuration,
  websocketErrors,
  chatMessagesTotal,
  chatMessageLatency,
} from './metrics';
import logger from '../utils/logger';
import * as Sentry from '@sentry/node';

/**
 * Monitor Socket.IO server
 */
export function monitorSocketIO(io: SocketIOServer): void {
  logger.info('Initializing Socket.IO monitoring');

  // Track connections
  io.on('connection', (socket: Socket) => {
    websocketConnections.inc({ type: 'socket.io' });

    logger.debug('Socket.IO client connected', {
      socketId: socket.id,
      userId: (socket.data as any)?.userId,
    });

    // Monitor all events
    const originalEmit = socket.emit;
    socket.emit = function (event: string, ...args: any[]) {
      websocketMessagesTotal.inc({
        type: 'socket.io',
        event,
        direction: 'outbound',
      });
      return originalEmit.call(this, event, ...args);
    };

    const originalOn = socket.on;
    socket.on = function (event: string, listener: (...args: any[]) => void) {
      const wrappedListener = (...args: any[]) => {
        const startTime = process.hrtime.bigint();

        websocketMessagesTotal.inc({
          type: 'socket.io',
          event,
          direction: 'inbound',
        });

        try {
          const result = listener(...args);

          // If listener returns a promise, monitor it
          if (result instanceof Promise) {
            return result
              .then((res) => {
                const endTime = process.hrtime.bigint();
                const duration = Number(endTime - startTime) / 1e9;
                websocketMessageDuration.observe({ type: 'socket.io', event }, duration);
                return res;
              })
              .catch((error) => {
                websocketErrors.inc({ type: 'socket.io', error_type: error.name || 'UnknownError' });
                Sentry.captureException(error, {
                  extra: {
                    socketId: socket.id,
                    event,
                    userId: (socket.data as any)?.userId,
                  },
                });
                throw error;
              });
          }

          // Synchronous listener
          const endTime = process.hrtime.bigint();
          const duration = Number(endTime - startTime) / 1e9;
          websocketMessageDuration.observe({ type: 'socket.io', event }, duration);

          return result;
        } catch (error: any) {
          websocketErrors.inc({ type: 'socket.io', error_type: error.name || 'UnknownError' });
          Sentry.captureException(error, {
            extra: {
              socketId: socket.id,
              event,
              userId: (socket.data as any)?.userId,
            },
          });
          throw error;
        }
      };

      return originalOn.call(this, event, wrappedListener);
    };

    // Track chat-specific events (using original socket.on to avoid double-wrapping)
    originalOn.call(socket, 'send-message', (data) => {
      const channel = data.channel || 'unknown';
      chatMessagesTotal.inc({ channel, type: 'user' });
    });

    originalOn.call(socket, 'join-channel', (data) => {
      const channel = data.channel || 'unknown';
      logger.debug('User joined channel', {
        socketId: socket.id,
        channel,
        userId: (socket.data as any)?.userId,
      });
    });

    // Track disconnections (use originalOn to avoid counting as inbound message)
    originalOn.call(socket, 'disconnect', (reason) => {
      websocketConnections.dec({ type: 'socket.io' });
      logger.debug('Socket.IO client disconnected', {
        socketId: socket.id,
        reason,
        userId: (socket.data as any)?.userId,
      });
    });

    // Track errors (use originalOn to avoid counting as inbound message)
    originalOn.call(socket, 'error', (error) => {
      websocketErrors.inc({ type: 'socket.io', error_type: error.name || 'UnknownError' });
      logger.error('Socket.IO error', {
        socketId: socket.id,
        error: error.message,
        userId: (socket.data as any)?.userId,
      });
    });
  });
}

/**
 * Monitor native WebSocket server
 */
export function monitorWebSocket(wss: any): void {
  logger.info('Initializing WebSocket monitoring');

  wss.on('connection', (ws: any) => {
    websocketConnections.inc({ type: 'native' });

    logger.debug('WebSocket client connected');

    ws.on('message', (message: any) => {
      const startTime = process.hrtime.bigint();

      websocketMessagesTotal.inc({
        type: 'native',
        event: 'message',
        direction: 'inbound',
      });

      try {
        // Parse message if JSON
        const data = JSON.parse(message.toString());
        const messageType = data.type || 'unknown';

        // Track notification messages
        if (messageType === 'notification') {
          logger.debug('WebSocket notification received', {
            type: data.notificationType,
          });
        }

        const endTime = process.hrtime.bigint();
        const duration = Number(endTime - startTime) / 1e9;
        websocketMessageDuration.observe({ type: 'native', event: messageType }, duration);
      } catch (error: any) {
        websocketErrors.inc({ type: 'native', error_type: 'ParseError' });
        logger.error('Failed to parse WebSocket message', { error: error.message });
      }
    });

    // Wrap send to track outbound messages
    const originalSend = ws.send;
    ws.send = function (data: any, ...args: any[]) {
      websocketMessagesTotal.inc({
        type: 'native',
        event: 'message',
        direction: 'outbound',
      });
      return originalSend.call(this, data, ...args);
    };

    ws.on('close', () => {
      websocketConnections.dec({ type: 'native' });
      logger.debug('WebSocket client disconnected');
    });

    ws.on('error', (error: any) => {
      websocketErrors.inc({ type: 'native', error_type: error.name || 'UnknownError' });
      logger.error('WebSocket error', { error: error.message });
    });
  });
}

/**
 * Track chat message latency
 */
export function trackChatMessageLatency(channel: string, sendTime: number): void {
  const latency = (Date.now() - sendTime) / 1000; // Convert to seconds
  chatMessageLatency.observe({ channel }, latency);

  // Log high latency
  if (latency > 1) {
    logger.warn('High chat message latency', {
      channel,
      latency: `${latency.toFixed(3)}s`,
    });
  }
}
