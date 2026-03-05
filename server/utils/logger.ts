import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

// Define log levels
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors for each log level
const logColors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
};

winston.addColors(logColors);

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf((info) => {
    const { timestamp, level, message, service, userId, ...meta } = info;
    const metaStr = Object.keys(meta).length
      ? JSON.stringify(meta, null, 2)
      : '';
    const serviceStr = service ? `[${service}]` : '';
    const userStr = userId ? `[user:${userId}]` : '';
    return `${timestamp} ${level.toUpperCase()} ${serviceStr}${userStr} ${message} ${metaStr}`;
  })
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf((info) => {
    const { timestamp, level, message, service, userId, ...meta } = info;
    const serviceStr = service ? `[${service}]` : '';
    const userStr = userId ? `[user:${userId}]` : '';
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} ${level} ${serviceStr}${userStr} ${message}${metaStr}`;
  })
);

// Create transports
const transports: winston.transport[] = [
  // Console transport for development
  new winston.transports.Console({
    level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
    format: consoleFormat,
  }),
];

// Add file transports for production
if (process.env.NODE_ENV === 'production') {
  // All logs
  transports.push(
    new DailyRotateFile({
      filename: 'logs/application-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
      format: logFormat,
      level: 'info',
    })
  );

  // Error logs only
  transports.push(
    new DailyRotateFile({
      filename: 'logs/error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d',
      format: logFormat,
      level: 'error',
    })
  );
}

// Create the logger
const logger = winston.createLogger({
  levels: logLevels,
  level:
    process.env.LOG_LEVEL ||
    (process.env.NODE_ENV === 'development' ? 'debug' : 'info'),
  format: logFormat,
  transports,
  exitOnError: false,
});

// Create service-specific loggers
export const createServiceLogger = (serviceName: string) => {
  return {
    error: (message: string, meta?: any, userId?: string) =>
      logger.error(message, { service: serviceName, userId, ...meta }),
    warn: (message: string, meta?: any, userId?: string) =>
      logger.warn(message, { service: serviceName, userId, ...meta }),
    info: (message: string, meta?: any, userId?: string) =>
      logger.info(message, { service: serviceName, userId, ...meta }),
    http: (message: string, meta?: any, userId?: string) =>
      logger.http(message, { service: serviceName, userId, ...meta }),
    debug: (message: string, meta?: any, userId?: string) =>
      logger.debug(message, { service: serviceName, userId, ...meta }),
  };
};

// Export default logger
export default logger;

// Helper functions for common logging patterns
export const logRequest = (
  method: string,
  url: string,
  userId?: string,
  duration?: number
) => {
  logger.http(`${method} ${url}`, {
    service: 'http',
    userId,
    duration: duration ? `${duration}ms` : undefined,
  });
};

export const logError = (
  error: Error,
  context: string,
  userId?: string,
  meta?: any
) => {
  logger.error(`${context}: ${error.message}`, {
    service: 'error-handler',
    userId,
    stack: error.stack,
    ...meta,
  });
};

export const logUserAction = (action: string, userId: string, meta?: any) => {
  logger.info(`User action: ${action}`, {
    service: 'user-activity',
    userId,
    ...meta,
  });
};

export const logDatabaseOperation = (
  operation: string,
  table: string,
  duration?: number,
  meta?: any
) => {
  logger.debug(`DB ${operation} on ${table}`, {
    service: 'database',
    duration: duration ? `${duration}ms` : undefined,
    ...meta,
  });
};

export const logExternalAPI = (
  service: string,
  operation: string,
  success: boolean,
  duration?: number,
  meta?: any
) => {
  const level = success ? 'info' : 'warn';
  logger[level](
    `External API: ${service} ${operation} ${success ? 'success' : 'failed'}`,
    {
      service: 'external-api',
      duration: duration ? `${duration}ms` : undefined,
      ...meta,
    }
  );
};
