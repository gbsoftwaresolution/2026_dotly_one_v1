import { Injectable, LoggerService } from "@nestjs/common";

type LogMetadata = Record<string, unknown>;
type LogLevel = "log" | "error" | "warn" | "debug" | "verbose" | "fatal";

const REDACTED_VALUE = "[REDACTED]";

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
    const sanitizedMetadata = metadata ? this.sanitizeMetadata(metadata) : undefined;

    return JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      context: context ?? "Application",
      message,
      ...(sanitizedMetadata ? { metadata: sanitizedMetadata } : {}),
      ...(trace ? { trace } : {}),
    });
  }

  private sanitizeMetadata(metadata: LogMetadata): LogMetadata {
    return this.sanitizeValue(undefined, metadata) as LogMetadata;
  }

  private sanitizeValue(key: string | undefined, value: unknown): unknown {
    if (value === null || value === undefined) {
      return value;
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.sanitizeValue(key, item));
    }

    if (typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value).map(([childKey, childValue]) => [
          childKey,
          this.sanitizeValue(childKey, childValue),
        ]),
      );
    }

    if (typeof value !== "string") {
      return value;
    }

    if (key && this.isSensitiveKey(key)) {
      return REDACTED_VALUE;
    }

    if (key && this.isEmailKey(key)) {
      return this.maskEmail(value);
    }

    if (key && this.isPhoneKey(key)) {
      return this.maskPhone(value);
    }

    if (key && this.isIdentifierKey(key)) {
      return this.maskIdentifier(value);
    }

    if (key && this.isUrlKey(key)) {
      return this.sanitizeUrl(value);
    }

    return value;
  }

  private isSensitiveKey(key: string): boolean {
    const normalized = key.trim().toLowerCase();

    return (
      normalized === "token" ||
      normalized.endsWith("token") ||
      normalized.endsWith("secret") ||
      normalized.endsWith("password") ||
      normalized === "jwt" ||
      normalized.endsWith("jwt") ||
      normalized === "otp_code" ||
      normalized === "otpcode" ||
      normalized === "verification_code" ||
      normalized === "verificationcode" ||
      normalized === "reset_code" ||
      normalized === "resetcode" ||
      normalized.includes("api_key") ||
      normalized.includes("apikey") ||
      normalized.includes("auth_token") ||
      normalized.includes("authtoken") ||
      normalized === "authorization" ||
      normalized.includes("cookie")
    );
  }

  private isEmailKey(key: string): boolean {
    const normalized = key.trim().toLowerCase();

    return normalized.includes("email") && !normalized.endsWith("hash");
  }

  private isPhoneKey(key: string): boolean {
    return key.trim().toLowerCase().includes("phone");
  }

  private isIdentifierKey(key: string): boolean {
    const normalized = key.trim().toLowerCase();

    return (
      normalized.endsWith("userid") ||
      normalized.endsWith("sessionid") ||
      normalized.endsWith("challengeid") ||
      normalized.endsWith("targetid")
    );
  }

  private isUrlKey(key: string): boolean {
    return key.trim().toLowerCase().endsWith("url");
  }

  private maskEmail(value: string): string {
    const normalized = value.trim();
    const atIndex = normalized.indexOf("@");

    if (atIndex <= 1) {
      return normalized;
    }

    return `${normalized.slice(0, 2)}***${normalized.slice(atIndex)}`;
  }

  private maskPhone(value: string): string {
    const normalized = value.trim();

    if (normalized.length <= 4) {
      return normalized;
    }

    return `${normalized.slice(0, 3)}***${normalized.slice(-2)}`;
  }

  private maskIdentifier(value: string): string {
    const normalized = value.trim();

    if (normalized.length <= 8) {
      return `${normalized.slice(0, 2)}***${normalized.slice(-2)}`;
    }

    return `${normalized.slice(0, 6)}***${normalized.slice(-4)}`;
  }

  private sanitizeUrl(value: string): string {
    try {
      const url = new URL(value);

      if (url.username) {
        url.username = REDACTED_VALUE;
      }

      if (url.password) {
        url.password = REDACTED_VALUE;
      }

      for (const key of [
        "token",
        "code",
        "secret",
        "password",
        "apiKey",
        "access_token",
      ]) {
        if (url.searchParams.has(key)) {
          url.searchParams.set(key, REDACTED_VALUE);
        }
      }

      return url.toString();
    } catch {
      return value;
    }
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
