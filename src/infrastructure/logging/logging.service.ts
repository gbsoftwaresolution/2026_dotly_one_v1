import { Injectable, LoggerService } from "@nestjs/common";

type LogMetadata = Record<string, unknown>;
type LogLevel = "log" | "error" | "warn" | "debug" | "verbose" | "fatal";

@Injectable()
export class AppLoggerService implements LoggerService {
  log(message: string, context?: string): void {
    this.write("log", message, context);
  }

  error(message: string, trace?: string, context?: string): void {
    this.write("error", message, context, trace);
  }

  warn(message: string, context?: string): void {
    this.write("warn", message, context);
  }

  debug(message: string, context?: string): void {
    this.write("debug", message, context);
  }

  verbose(message: string, context?: string): void {
    this.write("verbose", message, context);
  }

  fatal(message: string, trace?: string, context?: string): void {
    this.write("fatal", message, context, trace);
  }

  errorWithMeta(
    message: string,
    metadata: LogMetadata,
    trace?: string,
    context?: string,
  ): void {
    this.write("error", message, context, trace, metadata);
  }

  logWithMeta(
    level: Exclude<LogLevel, "error">,
    message: string,
    metadata: LogMetadata,
    context?: string,
  ): void {
    this.write(level, message, context, undefined, metadata);
  }

  private format(
    level: LogLevel,
    message: string,
    context?: string,
    trace?: string,
    metadata?: LogMetadata,
  ): string {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      context: context ?? "Application",
      message,
      ...(metadata ? { metadata } : {}),
      ...(trace ? { trace } : {}),
    });
  }

  private write(
    level: LogLevel,
    message: string,
    context?: string,
    trace?: string,
    metadata?: LogMetadata,
  ): void {
    const payload = this.format(level, message, context, trace, metadata);

    if (level === "error" || level === "fatal") {
      console.error(payload);
      return;
    }

    if (level === "warn") {
      console.warn(payload);
      return;
    }

    if (level === "debug") {
      console.debug(payload);
      return;
    }

    if (level === "verbose") {
      console.info(payload);
      return;
    }

    console.log(payload);
  }
}
