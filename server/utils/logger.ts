import { Request, Response } from 'express';

type LogMetadata = Record<string, unknown>;

export interface LogContext extends LogMetadata {
  requestId?: string;
  userId?: string;
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  service: string;
}

export class Logger {
  private service: string;
  private logLevel: string;

  constructor(service: string, logLevel: string = 'info') {
    this.service = service;
    this.logLevel = logLevel;
  }

  private shouldLog(level: string): boolean {
    const levels: { [key: string]: number } = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3,
    };
    return levels[level] >= levels[this.logLevel];
  }

  private formatLog(context: LogContext): string {
    const { timestamp, level, service, requestId, userId, message, ...rest } = context;
    return JSON.stringify({
      timestamp,
      level,
      service,
      requestId,
      userId,
      message,
      ...rest,
    });
  }

  debug(message: string, context: LogMetadata = {}, requestId?: string): void {
    if (this.shouldLog('debug')) {
      const logContext: LogContext = {
        level: 'debug',
        message,
        service: this.service,
        timestamp: new Date().toISOString(),
        requestId,
        ...context,
      };
      console.log(this.formatLog(logContext));
    }
  }

  info(message: string, context: LogMetadata = {}, requestId?: string): void {
    if (this.shouldLog('info')) {
      const logContext: LogContext = {
        level: 'info',
        message,
        service: this.service,
        timestamp: new Date().toISOString(),
        requestId,
        ...context,
      };
      console.log(this.formatLog(logContext));
    }
  }

  warn(message: string, context: LogMetadata = {}, requestId?: string): void {
    if (this.shouldLog('warn')) {
      const logContext: LogContext = {
        level: 'warn',
        message,
        service: this.service,
        timestamp: new Date().toISOString(),
        requestId,
        ...context,
      };
      console.warn(this.formatLog(logContext));
    }
  }

  error(message: string, error?: unknown, context: LogMetadata = {}, requestId?: string): void {
    if (this.shouldLog('error')) {
      const logContext: LogContext = {
        level: 'error',
        message,
        service: this.service,
        timestamp: new Date().toISOString(),
        requestId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        ...context,
      };
      console.error(this.formatLog(logContext));
    }
  }

  logRequest(req: Request, res: Response, duration: number, requestId?: string): void {
    this.info('HTTP Request', {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      requestId,
    }, requestId);
  }

  logSecurityEvent(
    event: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    context: LogMetadata,
    requestId?: string
  ): void {
    this.warn(`SECURITY: ${event}`, {
      severity,
      ...context,
      requestId,
    }, requestId);
  }
}

export const createLogger = (service: string): Logger => {
  return new Logger(service, process.env.LOG_LEVEL || 'info');
};
