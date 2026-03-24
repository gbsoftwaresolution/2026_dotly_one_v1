import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import {
  ForbiddenException,
  ServiceUnavailableException,
} from "@nestjs/common";

import { SupportRateLimitService } from "../src/modules/support/support-rate-limit.service";
import { SupportService } from "../src/modules/support/support.service";

describe("SupportService", () => {
  it("returns sent when email delivery succeeds", async () => {
    const service = new SupportService(
      {
        sendSupportRequest: async () => "sent",
      } as any,
      {
        logWithMeta: () => undefined,
      } as any,
      {
        get: () => "test",
      } as any,
      {
        consume: async () => undefined,
      } as any,
      {
        verify: async () => true,
      } as any,
      {
        supportRequest: {
          create: async () => ({ id: "support-request-id" }),
        },
      } as any,
    );

    const result = await service.createRequest(
      {
        email: "person@example.com",
        topic: "Bug report",
        details: "The support flow needs attention.",
      },
      {
        requestId: "request-123",
      },
    );

    assert.deepEqual(result, {
      accepted: true,
      delivery: "sent",
      referenceId: "request-123",
    });
  });

  it("returns logged when email delivery is skipped", async () => {
    const service = new SupportService(
      {
        sendSupportRequest: async () => "skipped",
      } as any,
      {
        logWithMeta: () => undefined,
      } as any,
      {
        get: () => "development",
      } as any,
      {
        consume: async () => undefined,
      } as any,
      {
        verify: async () => true,
      } as any,
      {
        supportRequest: {
          create: async () => ({ id: "support-request-id" }),
        },
      } as any,
    );

    const result = await service.createRequest(
      {
        email: "person@example.com",
        topic: "Privacy request",
        details: "I need help with my account.",
      },
      {},
    );

    assert.equal(result.accepted, true);
    assert.equal(result.delivery, "logged");
    assert.equal(typeof result.referenceId, "string");
    assert.notEqual(result.referenceId.length, 0);
  });

  it("throws when configured email delivery fails", async () => {
    const service = new SupportService(
      {
        sendSupportRequest: async () => "failed",
      } as any,
      {
        logWithMeta: () => undefined,
      } as any,
      {
        get: () => "production",
      } as any,
      {
        consume: async () => undefined,
      } as any,
      {
        verify: async () => true,
      } as any,
      {
        supportRequest: {
          create: async () => ({ id: "support-request-id" }),
        },
      } as any,
    );

    await assert.rejects(
      service.createRequest(
        {
          email: "person@example.com",
          topic: "Account access",
          details: "I cannot log in.",
        },
        {},
      ),
      ServiceUnavailableException,
    );
  });

  it("checks support rate limits before sending", async () => {
    let consumed = false;

    const service = new SupportService(
      {
        sendSupportRequest: async () => "sent",
      } as any,
      {
        logWithMeta: () => undefined,
      } as any,
      {
        get: () => "test",
      } as any,
      {
        consume: async () => {
          consumed = true;
        },
      } as any,
      {
        verify: async () => true,
      } as any,
      {
        supportRequest: {
          create: async () => ({ id: "support-request-id" }),
        },
      } as any,
    );

    await service.createRequest(
      {
        email: "person@example.com",
        topic: "Bug report",
        details: "The support flow needs attention.",
      },
      {},
    );

    assert.equal(consumed, true);
  });

  it("rejects support submissions caught by the honeypot field", async () => {
    const service = new SupportService(
      {
        sendSupportRequest: async () => "sent",
      } as any,
      {
        logWithMeta: () => undefined,
      } as any,
      {
        get: () => "test",
      } as any,
      {
        consume: async () => undefined,
      } as any,
      {
        verify: async () => true,
      } as any,
      {
        supportRequest: {
          create: async () => ({ id: "support-request-id" }),
        },
      } as any,
    );

    await assert.rejects(
      service.createRequest(
        {
          email: "person@example.com",
          topic: "Bug report",
          details: "Spam bot",
          website: "https://spam.example",
        },
        {},
      ),
      ForbiddenException,
    );
  });
});

describe("SupportRateLimitService", () => {
  it("rejects when email attempts exceed the configured window", async () => {
    let callCount = 0;
    const service = new SupportRateLimitService({
      increment: async (key: string) => {
        callCount += 1;
        return key.includes(":email:") ? 4 : 1;
      },
    } as any);

    await assert.rejects(
      service.consume("person@example.com", "127.0.0.1"),
      /Too many support requests right now/,
    );

    assert.equal(callCount >= 1, true);
  });

  it("allows requests when cache is unavailable", async () => {
    const service = new SupportRateLimitService({
      increment: async () => null,
    } as any);

    await assert.doesNotReject(
      service.consume("person@example.com", "127.0.0.1"),
    );
  });

  it("rejects when IP attempts exceed the configured window", async () => {
    const service = new SupportRateLimitService({
      increment: async (key: string) => (key.includes(":ip:") ? 6 : 1),
    } as any);

    await assert.rejects(
      service.consume("person@example.com", "127.0.0.1"),
      /Too many support requests right now/,
    );
  });
});
