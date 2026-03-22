import { Injectable } from "@nestjs/common";

import { AppLoggerService } from "./logging.service";

type AuditMetadata = Record<string, unknown>;

export type SecurityAuditOutcome =
  | "success"
  | "failure"
  | "accepted"
  | "suppressed"
  | "blocked"
  | "rate_limited";

export type SecurityAuditSeverity = "log" | "warn" | "debug" | "verbose";

export interface SecurityAuditEvent {
  action: string;
  outcome: SecurityAuditOutcome;
  actorUserId?: string | null;
  requestId?: string | null;
  sessionId?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  reason?: string | null;
  policySource?: string | null;
  metadata?: AuditMetadata;
  severity?: SecurityAuditSeverity;
}

const REDACTED_VALUE = "[REDACTED]";

export const noopSecurityAuditService: Pick<SecurityAuditService, "log"> = {
  log: () => undefined,
};

@Injectable()
export class SecurityAuditService {
  constructor(private readonly logger: AppLoggerService) {}

  log(event: SecurityAuditEvent): void {
    const { severity, ...metadata } = event;

    this.logger.logWithMeta(
      severity ?? this.resolveSeverity(event.outcome),
      "Security audit event",
      this.compactObject({
        audit: true,
        action: metadata.action,
        outcome: metadata.outcome,
        actorUserId: metadata.actorUserId,
        requestId: metadata.requestId,
        sessionId: metadata.sessionId,
        targetType: metadata.targetType,
        targetId: metadata.targetId,
        reason: metadata.reason,
        policySource: metadata.policySource,
        metadata: metadata.metadata
          ? this.sanitizeMetadata([], metadata.metadata)
          : undefined,
      }),
      "SecurityAudit",
    );
  }

  private resolveSeverity(outcome: SecurityAuditOutcome): SecurityAuditSeverity {
    return outcome === "success" || outcome === "accepted" ? "log" : "warn";
  }

  private sanitizeMetadata(path: string[], value: unknown): unknown {
    if (value === null || value === undefined) {
      return value;
    }

    if (Array.isArray(value)) {
      return value.map((entry) => this.sanitizeMetadata(path, entry));
    }

    if (typeof value === "object") {
      return this.compactObject(
        Object.fromEntries(
          Object.entries(value).map(([key, entry]) => [
            key,
            this.sanitizeMetadata([...path, key], entry),
          ]),
        ),
      );
    }

    if (typeof value !== "string") {
      return value;
    }

    if (this.isSensitivePath(path)) {
      return REDACTED_VALUE;
    }

    return value;
  }

  private isSensitivePath(path: string[]): boolean {
    if (path.length === 0) {
      return false;
    }

    const normalizedPath = path.map((segment) => this.normalizeKey(segment));
    const currentKey = normalizedPath[normalizedPath.length - 1] ?? "";
    const joinedPath = normalizedPath.join(".");

    if (
      currentKey === "token" ||
      currentKey.endsWith("token") ||
      currentKey === "jwt" ||
      currentKey.endsWith("jwt") ||
      currentKey === "authorization" ||
      currentKey.includes("cookie") ||
      currentKey.includes("apikey") ||
      currentKey.endsWith("secret") ||
      currentKey.endsWith("password") ||
      currentKey === "otp" ||
      currentKey === "otpcode" ||
      currentKey === "verificationcode" ||
      currentKey === "resetcode"
    ) {
      return true;
    }

    return currentKey === "code" && /(otp|verification|reset)/.test(joinedPath);
  }

  private normalizeKey(key: string): string {
    return key.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  private compactObject<T extends Record<string, unknown>>(value: T): T {
    return Object.fromEntries(
      Object.entries(value).filter(([, entry]) => entry !== undefined),
    ) as T;
  }
}