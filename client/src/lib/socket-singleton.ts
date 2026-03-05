import { io, Socket } from 'socket.io-client';
import { logger } from './logger';

let socketInstance: Socket | null = null;
let connectionPromise: Promise<Socket> | null = null;

export function getSocketInstance(): Socket | null {
  return socketInstance;
}

export function getOrCreateSocket(): Socket {
  if (socketInstance && socketInstance.connected) {
    return socketInstance;
  }
  
  if (socketInstance) {
    return socketInstance;
  }

  const socketUrl = typeof window !== 'undefined' ? window.location.origin : '';
  
  logger.log('[SocketSingleton] Creating new Socket.IO connection to:', socketUrl);
  
  socketInstance = io(socketUrl, {
    path: '/socket.io/',
    transports: ['polling', 'websocket'],
    upgrade: true,
    timeout: 30000,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 10,
    autoConnect: true,
  });

  socketInstance.on('connect', () => {
    logger.log('[SocketSingleton] Connected successfully');
  });

  socketInstance.on('disconnect', (reason) => {
    logger.log('[SocketSingleton] Disconnected:', reason);
  });

  socketInstance.on('connect_error', (error) => {
    logger.error('[SocketSingleton] Connection error:', error.message);

    // If we get a session-related error (400 Bad Request with invalid sid),
    // force a fresh connection by clearing the socket and reconnecting
    if (error.message.includes('xhr poll error') || error.message.includes('session')) {
      logger.log('[SocketSingleton] Session error detected, forcing fresh connection');
      if (socketInstance) {
        socketInstance.io.opts.query = {}; // Clear any stale query params
        socketInstance.disconnect();
        setTimeout(() => {
          if (socketInstance) {
            socketInstance.connect();
          }
        }, 1000);
      }
    }
  });

  return socketInstance;
}

export function disconnectSocket(): void {
  if (socketInstance) {
    logger.log('[SocketSingleton] Disconnecting socket');
    socketInstance.disconnect();
    socketInstance = null;
    connectionPromise = null;
  }
}

export function isSocketConnected(): boolean {
  return socketInstance?.connected ?? false;
}
