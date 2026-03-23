import { createHash } from "node:crypto";
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { BadRequestException, HttpException } from "@nestjs/common";

import { AuthAbuseProtectionService } from "../src/modules/auth/auth-abuse-protection.service";
import { AuthMetricsService } from "../src/modules/auth/auth-metrics.service";
import { AuthService } from "../src/modules/auth/auth.service";

const OTP_ATTEMPT_COOLDOWN_MS = 5 * 1000;

interface UserRecord {
  id: string;
  isVerified?: boolean;
  phoneNumber: string | null;
  pendingPhoneNumber: string | null;
  phoneVerifiedAt: Date | null;
}

interface MobileOtpChallengeRecord {
  id: string;
  userId: string;
  phoneNumber: string;
  purpose: "ENROLLMENT";
  codeHash: string;
  expiresAt: Date;
  consumedAt: Date | null;
  supersededAt: Date | null;
  invalidAttemptCount: number;
  lastAttemptAt: Date | null;
  resendAvailableAt: Date;
  createdAt: Date;
}

function hashToken(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function createAuthAbuseProtectionService() {
  const counters = new Map<string, number>();
  const locks = new Map<string, string>();

  return new AuthAbuseProtectionService({
    get: async (key: string) => locks.get(key) ?? null,
    increment: async (key: string) => {
      const nextValue = (counters.get(key) ?? 0) + 1;
      counters.set(key, nextValue);
      return nextValue;
    },
    setIfAbsent: async (key: string, value: string) => {
      if (locks.has(key)) {
        return false;
      }

      locks.set(key, value);
      return true;
    },
  } as any);
}

function createMobileOtpHarness(options?: {
  users?: UserRecord[];
  challenges?: MobileOtpChallengeRecord[];
  authMetricsService?: AuthMetricsService;
  authAbuseProtectionService?: AuthAbuseProtectionService;
}) {
  const state = {
    users: [...(options?.users ?? [])],
    personas: [] as Array<Record<string, unknown>>,
    challenges: [...(options?.challenges ?? [])],
    sentOtps: [] as Array<{
      to: string;
      code: string;
      expiresInMinutes: number;
    }>,
    audits: [] as Array<Record<string, unknown>>,
  };

  let challengeSequence = state.challenges.length;

  const prisma: any = {
    user: {
      findUnique: async ({ where, select }: any) => {
        const user = state.users.find((candidate) => candidate.id === where.id);

        if (!user) {
          return null;
        }

        if (!select) {
          return { ...user };
        }

        return Object.fromEntries(
          Object.entries(select)
            .filter(([, value]) => value)
            .map(([key]) => [
              key,
              (user as unknown as Record<string, unknown>)[key],
            ]),
        );
      },
      findFirst: async ({ where, select }: any) => {
        const user = state.users.find((candidate) => {
          if (
            where.phoneNumber &&
            candidate.phoneNumber !== where.phoneNumber
          ) {
            return false;
          }

          if (
            where.id &&
            typeof where.id === "object" &&
            where.id !== null &&
            "not" in where.id &&
            candidate.id === where.id.not
          ) {
            return false;
          }

          return true;
        });

        if (!user) {
          return null;
        }

        if (!select) {
          return { ...user };
        }

        return Object.fromEntries(
          Object.entries(select)
            .filter(([, value]) => value)
            .map(([key]) => [
              key,
              (user as unknown as Record<string, unknown>)[key],
            ]),
        );
      },
      update: async ({ where, data, select }: any) => {
        const user = state.users.find((candidate) => candidate.id === where.id);

        if (!user) {
          throw new Error("User not found");
        }

        Object.assign(user, data);

        if (!select) {
          return { ...user };
        }

        return Object.fromEntries(
          Object.entries(select)
            .filter(([, value]) => value)
            .map(([key]) => [
              key,
              (user as unknown as Record<string, unknown>)[key],
            ]),
        );
      },
    },
    persona: {
      updateMany: async () => ({ count: state.personas.length }),
    },
    mobileOtpChallenge: {
      findFirst: async ({ where, orderBy, select }: any) => {
        const matches = state.challenges
          .filter((challenge) => {
            if (where.userId && challenge.userId !== where.userId) {
              return false;
            }

            if (where.id && challenge.id !== where.id) {
              return false;
            }

            if (where.purpose && challenge.purpose !== where.purpose) {
              return false;
            }

            if (where.consumedAt === null && challenge.consumedAt !== null) {
              return false;
            }

            if (
              where.supersededAt === null &&
              challenge.supersededAt !== null
            ) {
              return false;
            }

            if (
              where.expiresAt &&
              typeof where.expiresAt === "object" &&
              where.expiresAt !== null &&
              "gt" in where.expiresAt &&
              challenge.expiresAt.getTime() <= where.expiresAt.gt.getTime()
            ) {
              return false;
            }

            if (
              where.createdAt &&
              typeof where.createdAt === "object" &&
              where.createdAt !== null &&
              "gte" in where.createdAt &&
              challenge.createdAt.getTime() < where.createdAt.gte.getTime()
            ) {
              return false;
            }

            return true;
          })
          .sort((left, right) => {
            if (orderBy?.createdAt === "desc") {
              return right.createdAt.getTime() - left.createdAt.getTime();
            }

            return left.createdAt.getTime() - right.createdAt.getTime();
          });

        const match = matches[0];

        if (!match) {
          return null;
        }

        if (!select) {
          return { ...match };
        }

        return Object.fromEntries(
          Object.entries(select)
            .filter(([, value]) => value)
            .map(([key]) => [
              key,
              (match as unknown as Record<string, unknown>)[key],
            ]),
        );
      },
      count: async ({ where }: any) =>
        state.challenges.filter((challenge) => {
          if (where.userId && challenge.userId !== where.userId) {
            return false;
          }

          if (where.purpose && challenge.purpose !== where.purpose) {
            return false;
          }

          if (
            where.createdAt &&
            typeof where.createdAt === "object" &&
            where.createdAt !== null &&
            "gte" in where.createdAt &&
            challenge.createdAt.getTime() < where.createdAt.gte.getTime()
          ) {
            return false;
          }

          return true;
        }).length,
      update: async ({ where, data, select }: any) => {
        const challenge = state.challenges.find(
          (candidate) => candidate.id === where.id,
        );

        if (!challenge) {
          throw new Error("Challenge not found");
        }

        Object.assign(challenge, data);

        if (!select) {
          return { ...challenge };
        }

        return Object.fromEntries(
          Object.entries(select)
            .filter(([, value]) => value)
            .map(([key]) => [
              key,
              (challenge as unknown as Record<string, unknown>)[key],
            ]),
        );
      },
      updateMany: async ({ where, data }: any) => {
        let count = 0;

        for (const challenge of state.challenges) {
          if (where.userId && challenge.userId !== where.userId) {
            continue;
          }

          if (where.purpose && challenge.purpose !== where.purpose) {
            continue;
          }

          if (
            where.id &&
            typeof where.id === "object" &&
            where.id !== null &&
            "not" in where.id &&
            challenge.id === where.id.not
          ) {
            continue;
          }

          if (where.consumedAt === null && challenge.consumedAt !== null) {
            continue;
          }

          if (where.supersededAt === null && challenge.supersededAt !== null) {
            continue;
          }

          if (
            where.expiresAt &&
            typeof where.expiresAt === "object" &&
            where.expiresAt !== null &&
            "gt" in where.expiresAt &&
            challenge.expiresAt.getTime() <= where.expiresAt.gt.getTime()
          ) {
            continue;
          }

          Object.assign(challenge, data);
          count += 1;
        }

        return { count };
      },
      create: async ({ data, select }: any) => {
        const challenge: MobileOtpChallengeRecord = {
          id: `challenge-${++challengeSequence}`,
          userId: data.userId,
          phoneNumber: data.phoneNumber,
          purpose: data.purpose,
          codeHash: data.codeHash,
          expiresAt: data.expiresAt,
          consumedAt: data.consumedAt ?? null,
          supersededAt: data.supersededAt ?? null,
          invalidAttemptCount: data.invalidAttemptCount ?? 0,
          lastAttemptAt: data.lastAttemptAt ?? null,
          resendAvailableAt: data.resendAvailableAt,
          createdAt: data.createdAt ?? new Date(),
        };

        state.challenges.push(challenge);

        if (!select) {
          return { ...challenge };
        }

        return Object.fromEntries(
          Object.entries(select)
            .filter(([, value]) => value)
            .map(([key]) => [
              key,
              (challenge as unknown as Record<string, unknown>)[key],
            ]),
        );
      },
    },
    $transaction: async (callback: (tx: any) => Promise<unknown>) =>
      callback(prisma),
  };

  const service = new AuthService(
    prisma,
    { signAsync: async () => "access-token" } as any,
    { isConfigured: () => true } as any,
    {} as any,
    undefined as any,
    undefined as any,
    {
      isConfigured: () => true,
      sendOtp: async ({ to, code, expiresInMinutes }: any) => {
        state.sentOtps.push({ to, code, expiresInMinutes });
        return true;
      },
    } as any,
    undefined as any,
    undefined as any,
    undefined as any,
    {
      log: (event: Record<string, unknown>) => {
        state.audits.push(event);
      },
    } as any,
    options?.authMetricsService,
    options?.authAbuseProtectionService,
  );

  return { service, state };
}

describe("AuthService mobile OTP enrollment", () => {
  it("issues a hashed enrollment challenge and stores the pending phone number", async () => {
    const authMetricsService = new AuthMetricsService();
    const { service, state } = createMobileOtpHarness({
      users: [
        {
          id: "user-1",
          phoneNumber: null,
          pendingPhoneNumber: null,
          phoneVerifiedAt: null,
        },
      ],
      authMetricsService,
    });

    const result = await service.requestMobileOtp("user-1", {
      phoneNumber: "+14155550199",
    });

    assert.equal(result.status, "sent");
    assert.equal(result.challengeId, "challenge-1");
    assert.equal(result.purpose, "ENROLLMENT");
    assert.equal(result.phoneNumber, "+14***99");
    assert.equal(state.users[0]?.pendingPhoneNumber, "+14155550199");
    assert.equal(state.sentOtps.length, 1);
    assert.notEqual(state.challenges[0]?.codeHash, state.sentOtps[0]?.code);
    assert.equal(
      state.challenges[0]?.codeHash,
      hashToken(state.sentOtps[0]!.code),
    );
    assert.deepEqual(state.audits[0], {
      action: "auth.mobile_otp.request",
      outcome: "accepted",
      actorUserId: "user-1",
      requestId: undefined,
      sessionId: undefined,
      targetType: "mobile_otp_challenge",
      targetId: "challenge-1",
      reason: undefined,
      policySource: undefined,
      metadata: {
        phoneNumberMasked: "+14***99",
        deliveryAvailable: true,
        expiresAt: result.expiresAt.toISOString(),
      },
    });
    assert.doesNotMatch(
      JSON.stringify(state.audits[0]),
      new RegExp(state.sentOtps[0]!.code),
    );
    assert.equal(
      authMetricsService.getCounterValue("dotly_auth_otp_request_total", {
        outcome: "requested",
        reason: "none",
      }),
      1,
    );
    assert.equal(
      authMetricsService.getCounterValue("dotly_auth_otp_request_total", {
        outcome: "sent",
        reason: "none",
      }),
      1,
    );
  });

  it("blocks resend attempts while the enrollment cooldown is active", async () => {
    const authMetricsService = new AuthMetricsService();
    const { service, state } = createMobileOtpHarness({
      users: [
        {
          id: "user-1",
          phoneNumber: null,
          pendingPhoneNumber: "+14155550199",
          phoneVerifiedAt: null,
        },
      ],
      challenges: [
        {
          id: "challenge-1",
          userId: "user-1",
          phoneNumber: "+14155550199",
          purpose: "ENROLLMENT",
          codeHash: hashToken("123456"),
          expiresAt: new Date(Date.now() + 10 * 60 * 1000),
          consumedAt: null,
          supersededAt: null,
          invalidAttemptCount: 0,
          lastAttemptAt: null,
          resendAvailableAt: new Date(Date.now() + 60 * 1000),
          createdAt: new Date(),
        },
      ],
      authMetricsService,
    });

    await assert.rejects(
      () =>
        service.requestMobileOtp("user-1", {
          phoneNumber: "+14155550199",
        }),
      (error: any) => {
        assert.ok(error instanceof HttpException);
        assert.equal(error.getStatus(), 429);
        assert.match(
          error.message,
          /wait before requesting another verification code/i,
        );
        return true;
      },
    );

    assert.deepEqual(state.audits[0], {
      action: "auth.mobile_otp.request",
      outcome: "rate_limited",
      actorUserId: "user-1",
      requestId: undefined,
      sessionId: undefined,
      targetType: undefined,
      targetId: undefined,
      reason: "cooldown_active",
      policySource: undefined,
      metadata: undefined,
    });
    assert.equal(
      authMetricsService.getCounterValue("dotly_auth_otp_request_total", {
        outcome: "throttled",
        reason: "cooldown_active",
      }),
      1,
    );
  });

  it("rate limits OTP requests for the same phone number across multiple accounts", async () => {
    const authMetricsService = new AuthMetricsService();
    const { service } = createMobileOtpHarness({
      users: Array.from({ length: 7 }, (_, index) => ({
        id: `user-${index + 1}`,
        phoneNumber: null,
        pendingPhoneNumber: null,
        phoneVerifiedAt: null,
      })),
      authMetricsService,
      authAbuseProtectionService: createAuthAbuseProtectionService(),
    });

    for (let userIndex = 0; userIndex < 6; userIndex += 1) {
      const result = await service.requestMobileOtp(
        `user-${userIndex + 1}`,
        {
          phoneNumber: "+14155550199",
        },
        {
          sessionId: `session-${userIndex + 1}`,
          ipAddress: `203.0.113.${userIndex + 1}`,
        },
      );

      assert.equal(result.status, "sent");
    }

    await assert.rejects(
      () =>
        service.requestMobileOtp(
          "user-7",
          {
            phoneNumber: "+14155550199",
          },
          {
            sessionId: "session-7",
            ipAddress: "203.0.113.70",
          },
        ),
      (error: any) => {
        assert.ok(error instanceof HttpException);
        assert.equal(error.getStatus(), 429);
        assert.match(error.message, /too many verification codes requested/i);
        return true;
      },
    );

    assert.equal(
      authMetricsService.getCounterValue("dotly_auth_otp_request_total", {
        outcome: "throttled",
        reason: "phone_rate_limited",
      }),
      1,
    );
  });

  it("requires the active challenge id when verifying an enrollment code", async () => {
    const { service } = createMobileOtpHarness({
      users: [
        {
          id: "user-1",
          phoneNumber: null,
          pendingPhoneNumber: "+14155550199",
          phoneVerifiedAt: null,
        },
      ],
      challenges: [
        {
          id: "challenge-1",
          userId: "user-1",
          phoneNumber: "+14155550199",
          purpose: "ENROLLMENT",
          codeHash: hashToken("123456"),
          expiresAt: new Date(Date.now() + 10 * 60 * 1000),
          consumedAt: null,
          supersededAt: null,
          invalidAttemptCount: 0,
          lastAttemptAt: null,
          resendAvailableAt: new Date(Date.now() - 1_000),
          createdAt: new Date(),
        },
      ],
    });

    await assert.rejects(
      () =>
        service.verifyMobileOtp("user-1", {
          challengeId: "missing-challenge",
          code: "123456",
        }),
      (error: any) => {
        assert.ok(error instanceof BadRequestException);
        assert.match(
          error.message,
          /request a verification code before trying again/i,
        );
        return true;
      },
    );
  });

  it("locks the challenge after too many incorrect attempts", async () => {
    const { service, state } = createMobileOtpHarness({
      users: [
        {
          id: "user-1",
          phoneNumber: null,
          pendingPhoneNumber: "+14155550199",
          phoneVerifiedAt: null,
        },
      ],
      challenges: [
        {
          id: "challenge-1",
          userId: "user-1",
          phoneNumber: "+14155550199",
          purpose: "ENROLLMENT",
          codeHash: hashToken("123456"),
          expiresAt: new Date(Date.now() + 10 * 60 * 1000),
          consumedAt: null,
          supersededAt: null,
          invalidAttemptCount: 4,
          lastAttemptAt: null,
          resendAvailableAt: new Date(Date.now() - 1_000),
          createdAt: new Date(),
        },
      ],
    });

    await assert.rejects(
      () =>
        service.verifyMobileOtp("user-1", {
          challengeId: "challenge-1",
          code: "000000",
        }),
      (error: any) => {
        assert.ok(error instanceof HttpException);
        assert.equal(error.getStatus(), 429);
        assert.match(error.message, /too many incorrect verification codes/i);
        return true;
      },
    );

    assert.equal(state.challenges[0]?.invalidAttemptCount, 5);
    assert.ok(state.challenges[0]?.supersededAt instanceof Date);
  });

  it("returns 429 for an exhausted challenge even if its retry cooldown is still active", async () => {
    const { service, state } = createMobileOtpHarness({
      users: [
        {
          id: "user-1",
          phoneNumber: null,
          pendingPhoneNumber: "+14155550199",
          phoneVerifiedAt: null,
        },
      ],
      challenges: [
        {
          id: "challenge-1",
          userId: "user-1",
          phoneNumber: "+14155550199",
          purpose: "ENROLLMENT",
          codeHash: hashToken("123456"),
          expiresAt: new Date(Date.now() + 10 * 60 * 1000),
          consumedAt: null,
          supersededAt: null,
          invalidAttemptCount: 5,
          lastAttemptAt: new Date(),
          resendAvailableAt: new Date(Date.now() - 1_000),
          createdAt: new Date(),
        },
      ],
    });

    await assert.rejects(
      () =>
        service.verifyMobileOtp("user-1", {
          challengeId: "challenge-1",
          code: "000000",
        }),
      (error: any) => {
        assert.ok(error instanceof HttpException);
        assert.equal(error.getStatus(), 429);
        assert.match(error.message, /too many incorrect verification codes/i);
        return true;
      },
    );

    assert.equal(state.challenges[0]?.invalidAttemptCount, 5);
  });

  it("rate limits rapid retry attempts between incorrect codes", async () => {
    const { service, state } = createMobileOtpHarness({
      users: [
        {
          id: "user-1",
          phoneNumber: null,
          pendingPhoneNumber: "+14155550199",
          phoneVerifiedAt: null,
        },
      ],
      challenges: [
        {
          id: "challenge-1",
          userId: "user-1",
          phoneNumber: "+14155550199",
          purpose: "ENROLLMENT",
          codeHash: hashToken("123456"),
          expiresAt: new Date(Date.now() + 10 * 60 * 1000),
          consumedAt: null,
          supersededAt: null,
          invalidAttemptCount: 1,
          lastAttemptAt: new Date(Date.now() - (OTP_ATTEMPT_COOLDOWN_MS - 250)),
          resendAvailableAt: new Date(Date.now() - 1_000),
          createdAt: new Date(),
        },
      ],
    });

    await assert.rejects(
      () =>
        service.verifyMobileOtp("user-1", {
          challengeId: "challenge-1",
          code: "000000",
        }),
      (error: any) => {
        assert.ok(error instanceof HttpException);
        assert.equal(error.getStatus(), 429);
        assert.match(
          error.message,
          /please wait before trying another verification code/i,
        );
        return true;
      },
    );

    assert.equal(state.challenges[0]?.invalidAttemptCount, 1);
  });

  it("returns 400 for an incorrect code after the retry cooldown and increments attempts", async () => {
    const authMetricsService = new AuthMetricsService();
    const { service, state } = createMobileOtpHarness({
      users: [
        {
          id: "user-1",
          phoneNumber: null,
          pendingPhoneNumber: "+14155550199",
          phoneVerifiedAt: null,
        },
      ],
      challenges: [
        {
          id: "challenge-1",
          userId: "user-1",
          phoneNumber: "+14155550199",
          purpose: "ENROLLMENT",
          codeHash: hashToken("123456"),
          expiresAt: new Date(Date.now() + 10 * 60 * 1000),
          consumedAt: null,
          supersededAt: null,
          invalidAttemptCount: 1,
          lastAttemptAt: new Date(Date.now() - (OTP_ATTEMPT_COOLDOWN_MS + 250)),
          resendAvailableAt: new Date(Date.now() - 1_000),
          createdAt: new Date(),
        },
      ],
      authMetricsService,
    });

    await assert.rejects(
      () =>
        service.verifyMobileOtp("user-1", {
          challengeId: "challenge-1",
          code: "000000",
        }),
      (error: any) => {
        assert.ok(error instanceof BadRequestException);
        assert.match(error.message, /code you entered is invalid/i);
        return true;
      },
    );

    assert.equal(state.challenges[0]?.invalidAttemptCount, 2);
    assert.equal(state.challenges[0]?.supersededAt, null);
    assert.equal(
      authMetricsService.getCounterValue("dotly_auth_otp_verify_total", {
        outcome: "invalid",
        reason: "invalid_code",
      }),
      1,
    );
  });

  it("rate limits OTP verification bursts from the same session across challenges", async () => {
    const authMetricsService = new AuthMetricsService();
    const { service } = createMobileOtpHarness({
      users: [
        {
          id: "user-1",
          phoneNumber: null,
          pendingPhoneNumber: "+14155550199",
          phoneVerifiedAt: null,
        },
      ],
      challenges: Array.from({ length: 13 }, (_, index) => ({
        id: `challenge-${index + 1}`,
        userId: "user-1",
        phoneNumber: "+14155550199",
        purpose: "ENROLLMENT" as const,
        codeHash: hashToken(`12345${index}`),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        consumedAt: null,
        supersededAt: null,
        invalidAttemptCount: 0,
        lastAttemptAt: null,
        resendAvailableAt: new Date(Date.now() - 1_000),
        createdAt: new Date(Date.now() - index * 1_000),
      })),
      authMetricsService,
      authAbuseProtectionService: createAuthAbuseProtectionService(),
    });

    for (let challengeIndex = 0; challengeIndex < 12; challengeIndex += 1) {
      await assert.rejects(
        () =>
          service.verifyMobileOtp(
            "user-1",
            {
              challengeId: `challenge-${challengeIndex + 1}`,
              code: "000000",
            },
            {
              sessionId: "session-current",
              ipAddress: "198.51.100.7",
            },
          ),
        /invalid/i,
      );
    }

    await assert.rejects(
      () =>
        service.verifyMobileOtp(
          "user-1",
          {
            challengeId: "challenge-13",
            code: "000000",
          },
          {
            sessionId: "session-current",
            ipAddress: "198.51.100.7",
          },
        ),
      (error: any) => {
        assert.ok(error instanceof HttpException);
        assert.equal(error.getStatus(), 429);
        assert.match(error.message, /too many verification attempts/i);
        return true;
      },
    );

    assert.equal(
      authMetricsService.getCounterValue("dotly_auth_otp_verify_total", {
        outcome: "throttled",
        reason: "session_rate_limited",
      }),
      1,
    );
  });

  it("verifies the selected enrollment challenge and activates the mobile trust factor", async () => {
    const authMetricsService = new AuthMetricsService();
    const { service, state } = createMobileOtpHarness({
      users: [
        {
          id: "user-1",
          phoneNumber: null,
          pendingPhoneNumber: "+14155550199",
          phoneVerifiedAt: null,
        },
      ],
      challenges: [
        {
          id: "challenge-1",
          userId: "user-1",
          phoneNumber: "+14155550199",
          purpose: "ENROLLMENT",
          codeHash: hashToken("123456"),
          expiresAt: new Date(Date.now() + 10 * 60 * 1000),
          consumedAt: null,
          supersededAt: null,
          invalidAttemptCount: 0,
          lastAttemptAt: null,
          resendAvailableAt: new Date(Date.now() - 1_000),
          createdAt: new Date(),
        },
        {
          id: "challenge-older",
          userId: "user-1",
          phoneNumber: "+14155550198",
          purpose: "ENROLLMENT",
          codeHash: hashToken("654321"),
          expiresAt: new Date(Date.now() + 10 * 60 * 1000),
          consumedAt: null,
          supersededAt: null,
          invalidAttemptCount: 0,
          lastAttemptAt: null,
          resendAvailableAt: new Date(Date.now() - 1_000),
          createdAt: new Date(Date.now() - 60_000),
        },
      ],
      authMetricsService,
    });

    const result = await service.verifyMobileOtp("user-1", {
      challengeId: "challenge-1",
      code: "123456",
    });

    assert.equal(result.verified, true);
    assert.equal(result.phoneNumber, "+14***99");
    assert.equal(state.users[0]?.phoneNumber, "+14155550199");
    assert.equal(state.users[0]?.pendingPhoneNumber, null);
    assert.ok(state.users[0]?.phoneVerifiedAt instanceof Date);
    assert.ok(state.challenges[0]?.consumedAt instanceof Date);
    assert.ok(state.challenges[1]?.supersededAt instanceof Date);
    assert.deepEqual(state.audits.at(-1), {
      action: "auth.mobile_otp.verify",
      outcome: "success",
      actorUserId: "user-1",
      requestId: undefined,
      sessionId: undefined,
      targetType: "mobile_otp_challenge",
      targetId: "challenge-1",
      reason: undefined,
      policySource: undefined,
      metadata: {
        phoneNumberMasked: "+14***99",
      },
    });
    assert.equal(
      authMetricsService.getCounterValue("dotly_auth_otp_verify_total", {
        outcome: "verified",
        reason: "none",
      }),
      1,
    );
  });

  it("returns a conflict when another account claims the phone number first", async () => {
    const { service } = createMobileOtpHarness({
      users: [
        {
          id: "user-1",
          isVerified: false,
          phoneNumber: null,
          pendingPhoneNumber: "+14155550199",
          phoneVerifiedAt: null,
        },
      ],
      challenges: [
        {
          id: "challenge-1",
          userId: "user-1",
          phoneNumber: "+14155550199",
          purpose: "ENROLLMENT",
          codeHash: hashToken("123456"),
          expiresAt: new Date(Date.now() + 10 * 60 * 1000),
          consumedAt: null,
          supersededAt: null,
          invalidAttemptCount: 0,
          lastAttemptAt: null,
          resendAvailableAt: new Date(Date.now() - 1_000),
          createdAt: new Date(),
        },
      ],
    });

    const prisma = (service as any).prismaService;
    prisma.user.update = async () => {
      throw { code: "P2002" };
    };

    await assert.rejects(
      () =>
        service.verifyMobileOtp("user-1", {
          challengeId: "challenge-1",
          code: "123456",
        }),
      (error: any) => {
        assert.equal(error.status, 409);
        assert.match(
          error.message,
          /already verified on another dotly account/i,
        );
        return true;
      },
    );
  });
});
