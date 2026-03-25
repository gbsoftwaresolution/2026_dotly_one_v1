import {
  Injectable,
  LoggerService as NestLoggerService,
  Scope,
} from "@nestjs/common";
import pino from "pino";
import { ConfigService } from "../config/config.service";

@Injectable({ scope: Scope.TRANSIENT })
export class LoggerService implements NestLoggerService {
  private logger!: pino.Logger;
  private context: Record<string, any> = {};

  constructor(private configService: ConfigService) {
    this.initializeLogger();
  }

  private initializeLogger() {
    const isDevelopment = this.configService.nodeEnv === "development";
    const options: pino.LoggerOptions = {
      level: this.configService.logLevel,
      formatters: {
        level: (label) => ({ level: label }),
      },
      timestamp: pino.stdTimeFunctions.isoTime,
    };

    if (isDevelopment) {
      options.transport = {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:standard",
          ignore: "pid,hostname",
        },
      } as any;
    }

    this.logger = pino(options);
  }

  /**
   * Set context for this logger instance (e.g., requestId, userId, etc.)
   */
  setContext(context: Record<string, any>): void {
    this.context = { ...this.context, ...context };
  }

  /**
   * Create a child logger with additional context
   */
  child(context: Record<string, any>): LoggerService {
    const childLogger = new LoggerService(this.configService);
    childLogger.setContext({ ...this.context, ...context });
    return childLogger;
  }

  /**
   * Get current context
   */
  getContext(): Record<string, any> {
    return { ...this.context };
  }

  private formatMessage(message: any): any {
    if (typeof message === "string") {
      return { msg: message, ...this.context };
    }
    if (message && typeof message === "object") {
      return { ...message, ...this.context };
    }
    return { msg: String(message), ...this.context };
  }

  log(message: any, ...optionalParams: any[]) {
    this.logger.info(this.formatMessage(message), ...optionalParams);
  }

  error(message: any, ...optionalParams: any[]) {
    this.logger.error(this.formatMessage(message), ...optionalParams);
  }

  warn(message: any, ...optionalParams: any[]) {
    this.logger.warn(this.formatMessage(message), ...optionalParams);
  }

  debug(message: any, ...optionalParams: any[]) {
    this.logger.debug(this.formatMessage(message), ...optionalParams);
  }

  verbose(message: any, ...optionalParams: any[]) {
    this.logger.trace(this.formatMessage(message), ...optionalParams);
  }

  fatal(message: any, ...optionalParams: any[]) {
    this.logger.fatal(this.formatMessage(message), ...optionalParams);
  }
}
