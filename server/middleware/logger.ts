import { Request, Response, NextFunction } from 'express';
import { logger as productionLogger } from '../utils/production-safe-logger';

export interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  method?: string;
  url?: string;
  ip?: string;
  userAgent?: string;
  statusCode?: number;
  responseTime?: number;
  error?: any;
  errors?: any; // For validation errors
  // Allow additional arbitrary properties for flexible logging
  [key: string]: any;
}

class Logger {
  private logs: LogEntry[] = [];
  private maxLogs = 1000; // Keep last 1000 logs in memory

  private createLogEntry(
    level: LogEntry['level'],
    message: string,
    extra?: Partial<LogEntry>
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...extra,
    };
  }

  private addLog(entry: LogEntry) {
    this.logs.push(entry);

    // Keep only the last maxLogs entries
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Output using production-safe logger
    const logMessage = `[${entry.timestamp}] ${entry.level.toUpperCase()}: ${
      entry.message
    }`;

    switch (entry.level) {
      case 'error':
        productionLogger.error(logMessage, entry.error || '');
        break;
      case 'warn':
        productionLogger.warn(logMessage);
        break;
      default:
        productionLogger.log(logMessage);
    }
  }

  // Helper to normalize extra parameter - accepts string or object
  private normalizeExtra(extra?: string | Partial<LogEntry>): Partial<LogEntry> | undefined {
    if (typeof extra === 'string') {
      // Use 'details' property to store string extras, avoiding conflict with 'message'
      return { details: extra };
    }
    return extra;
  }

  info(message: string, extra?: string | Partial<LogEntry>) {
    this.addLog(this.createLogEntry('info', message, this.normalizeExtra(extra)));
  }

  // Alias for info() - maintains backward compatibility with code calling logger.log()
  log(message: string, extra?: string | Partial<LogEntry>) {
    this.info(message, extra);
  }

  warn(message: string, extra?: string | Partial<LogEntry>) {
    this.addLog(this.createLogEntry('warn', message, this.normalizeExtra(extra)));
  }

  error(message: string, error?: any, extra?: string | Partial<LogEntry>) {
    this.addLog(this.createLogEntry('error', message, { ...this.normalizeExtra(extra), error }));
  }

  getLogs(level?: LogEntry['level'], limit = 100): LogEntry[] {
    let filteredLogs = level
      ? this.logs.filter((log) => log.level === level)
      : this.logs;
    return filteredLogs.slice(-limit);
  }

  clearLogs() {
    this.logs = [];
  }
}

export const logger = new Logger();

// Express middleware for request logging
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();

  res.on('finish', () => {
    const responseTime = Date.now() - start;
    const logLevel =
      res.statusCode >= 400 ? 'error' : res.statusCode >= 300 ? 'warn' : 'info';

    logger[logLevel](`${req.method} ${req.url}`, {
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      statusCode: res.statusCode,
      responseTime,
    });
  });

  next();
}

// Express error handling middleware
export function errorLogger(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  logger.error(`Request failed: ${req.method} ${req.url}`, err, {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });

  // Don't expose internal errors in production
  const isDevelopment = process.env.NODE_ENV === 'development';

  res.status(500).json({
    error: 'Internal server error',
    message: isDevelopment ? err.message : 'Something went wrong',
    ...(isDevelopment && { stack: err.stack }),
  });
}
