import { Injectable, LoggerService } from "@nestjs/common";

@Injectable()
export class AppLoggerService implements LoggerService {
  log(message: string, context?: string): void {
    console.log(this.format("LOG", message, context));
  }

  error(message: string, trace?: string, context?: string): void {
    console.error(this.format("ERROR", message, context));

    if (trace) {
      console.error(trace);
    }
  }

  warn(message: string, context?: string): void {
    console.warn(this.format("WARN", message, context));
  }

  debug(message: string, context?: string): void {
    console.debug(this.format("DEBUG", message, context));
  }

  verbose(message: string, context?: string): void {
    console.info(this.format("VERBOSE", message, context));
  }

  fatal(message: string, trace?: string, context?: string): void {
    console.error(this.format("FATAL", message, context));

    if (trace) {
      console.error(trace);
    }
  }

  private format(level: string, message: string, context?: string): string {
    const timestamp = new Date().toISOString();
    const scopedContext = context ?? "Application";

    return `[${timestamp}] ${level} [${scopedContext}] ${message}`;
  }
}
