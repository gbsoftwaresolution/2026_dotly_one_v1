import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { AppLoggerService } from "../src/infrastructure/logging/logging.service";

describe("AppLoggerService", () => {
  it("redacts secrets and masks auth identifiers in structured metadata", () => {
    const logger = new AppLoggerService();
    const originalLog = console.log;
    let payload = "";

    console.log = (message?: unknown) => {
      payload = String(message ?? "");
    };

    try {
      logger.logWithMeta(
        "log",
        "Security event",
        {
          actorUserId: "user-1234567890",
          sessionId: "session-abcdef123456",
          email: "person@example.com",
          phoneNumber: "+14155550199",
          accessToken: "top-secret-token",
          redisUrl: "redis://user:pass@cache.internal:6379/0",
        },
        "AuthSecurity",
      );
    } finally {
      console.log = originalLog;
    }

    assert.doesNotMatch(payload, /top-secret-token/);
    assert.doesNotMatch(payload, /person@example.com/);
    assert.doesNotMatch(payload, /session-abcdef123456/);
    assert.doesNotMatch(payload, /user-1234567890/);
    assert.match(payload, /\[REDACTED\]/);
    assert.match(payload, /pe\*\*\*@example.com/);
    assert.match(payload, /use.*\*\*\*/i);
    assert.match(
      payload,
      /redis:\/\/%5BREDACTED%5D:%5BREDACTED%5D@cache.internal:6379\/0/,
    );
  });
});