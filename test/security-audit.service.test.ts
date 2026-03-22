import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { AppLoggerService } from "../src/infrastructure/logging/logging.service";
import { SecurityAuditService } from "../src/infrastructure/logging/security-audit.service";

describe("SecurityAuditService", () => {
  it("redacts sensitive auth metadata before delegating to the structured logger", () => {
    const events: Array<{
      level: string;
      message: string;
      metadata: Record<string, unknown>;
      context?: string;
    }> = [];
    const logger = {
      logWithMeta: (
        level: string,
        message: string,
        metadata: Record<string, unknown>,
        context?: string,
      ) => {
        events.push({ level, message, metadata, context });
      },
    } as unknown as AppLoggerService;
    const audit = new SecurityAuditService(logger);

    audit.log({
      action: "auth.password_reset.request",
      outcome: "accepted",
      actorUserId: "user-1",
      metadata: {
        password: "NeverLogMe123!",
        resetToken: "reset-token-123",
        nested: {
          otpCode: "123456",
          authorization: "Bearer secret",
        },
      },
    });

    assert.deepEqual(events[0], {
      level: "log",
      message: "Security audit event",
      context: "SecurityAudit",
      metadata: {
        audit: true,
        action: "auth.password_reset.request",
        outcome: "accepted",
        actorUserId: "user-1",
        metadata: {
          password: "[REDACTED]",
          resetToken: "[REDACTED]",
          nested: {
            otpCode: "[REDACTED]",
            authorization: "[REDACTED]",
          },
        },
      },
    });
  });
});