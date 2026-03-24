import { createHash } from "node:crypto";
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { AuthAbuseProtectionService } from "../src/modules/auth/auth-abuse-protection.service";
import { AuthMetricsService } from "../src/modules/auth/auth-metrics.service";
import { AuthService } from "../src/modules/auth/auth.service";

interface UserRecord {
  id: string;
  email: string;
  referralCode: string;
  referredBy?: string | null;
  passwordHash: string;
  isVerified: boolean;
  phoneVerifiedAt?: Date | null;
}

interface EmailVerificationTokenRecord {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  consumedAt: Date | null;
  supersededAt: Date | null;
  createdAt: Date;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
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

function selectFields<T>(
  record: T,
  select?: Record<string, boolean>,
): Partial<T> {
  const recordMap = record as Record<string, unknown>;

  if (!select) {
    return { ...recordMap } as Partial<T>;
  }

  return Object.fromEntries(
    Object.entries(select)
      .filter(([, value]) => value)
      .map(([key]) => [key, recordMap[key]]),
  ) as Partial<T>;
}

function matchesTokenWhere(
  token: EmailVerificationTokenRecord,
  where: Record<string, unknown>,
): boolean {
  if (typeof where.userId === "string" && token.userId !== where.userId) {
    return false;
  }

  if (
    where.id &&
    typeof where.id === "object" &&
    where.id !== null &&
    "not" in where.id &&
    token.id === (where.id as { not?: string }).not
  ) {
    return false;
  }

  if (where.consumedAt === null && token.consumedAt !== null) {
    return false;
  }

  if (where.supersededAt === null && token.supersededAt !== null) {
    return false;
  }

  if (
    where.expiresAt &&
    typeof where.expiresAt === "object" &&
    where.expiresAt !== null &&
    "gt" in where.expiresAt &&
    token.expiresAt.getTime() <= (where.expiresAt as { gt: Date }).gt.getTime()
  ) {
    return false;
  }

  if (
    where.createdAt &&
    typeof where.createdAt === "object" &&
    where.createdAt !== null &&
    "gte" in where.createdAt &&
    token.createdAt.getTime() < (where.createdAt as { gte: Date }).gte.getTime()
  ) {
    return false;
  }

  return true;
}

function createAuthServiceHarness(options?: {
  users?: UserRecord[];
  tokens?: EmailVerificationTokenRecord[];
  mailDeliveryEnabled?: boolean;
  authMetricsService?: AuthMetricsService;
  authAbuseProtectionService?: AuthAbuseProtectionService;
}) {
  const state = {
    users: [...(options?.users ?? [])],
    tokens: [...(options?.tokens ?? [])],
    sentMails: [] as Array<{ to: string; token: string; expiresAt: Date }>,
    audits: [] as Array<Record<string, unknown>>,
    analyticsEvents: [] as Array<{
      type: string;
      payload: Record<string, unknown>;
    }>,
    personas: [] as Array<Record<string, unknown>>,
    mailDeliveryEnabled: options?.mailDeliveryEnabled ?? true,
  };

  let userSequence = state.users.length;
  let tokenSequence = state.tokens.length;

  const prisma: any = {
    user: {
      findUnique: async ({ where, select }: any) => {
        const user = state.users.find((candidate) => {
          if (where.email) {
            return candidate.email === where.email;
          }

          if (where.id) {
            return candidate.id === where.id;
          }

          if (where.referralCode) {
            return candidate.referralCode === where.referralCode;
          }

          return false;
        });

        return user ? selectFields(user, select) : null;
      },
      create: async ({ data, select }: any) => {
        const user: UserRecord = {
          id: `user-${++userSequence}`,
          email: data.email,
          referralCode: data.referralCode,
          referredBy: data.referredBy ?? null,
          passwordHash: data.passwordHash,
          isVerified: data.isVerified ?? false,
        };

        state.users.push(user);

        return selectFields(user, select);
      },
      update: async ({ where, data, select }: any) => {
        const user = state.users.find((candidate) => candidate.id === where.id);

        if (!user) {
          throw new Error("User not found");
        }

        Object.assign(user, data);

        return selectFields(user, select);
      },
    },
    persona: {
      updateMany: async () => ({ count: state.personas.length }),
    },
    emailVerificationToken: {
      findUnique: async ({ where, include }: any) => {
        const token = state.tokens.find(
          (candidate) => candidate.tokenHash === where.tokenHash,
        );

        if (!token) {
          return null;
        }

        if (include?.user?.select) {
          const user = state.users.find(
            (candidate) => candidate.id === token.userId,
          );

          return {
            ...token,
            user: user ? selectFields(user, include.user.select) : null,
          };
        }

        return { ...token };
      },
      findFirst: async ({ where, orderBy, select }: any) => {
        const matchingTokens = state.tokens
          .filter((token) => matchesTokenWhere(token, where ?? {}))
          .sort((left, right) => {
            if (orderBy?.createdAt === "desc") {
              return right.createdAt.getTime() - left.createdAt.getTime();
            }

            return left.createdAt.getTime() - right.createdAt.getTime();
          });

        return matchingTokens[0]
          ? selectFields(matchingTokens[0], select)
          : null;
      },
      count: async ({ where }: any) =>
        state.tokens.filter((token) => matchesTokenWhere(token, where ?? {}))
          .length,
      update: async ({ where, data }: any) => {
        const token = state.tokens.find(
          (candidate) => candidate.id === where.id,
        );

        if (!token) {
          throw new Error("Token not found");
        }

        Object.assign(token, data);

        return { ...token };
      },
      updateMany: async ({ where, data }: any) => {
        let count = 0;

        for (const token of state.tokens) {
          if (!matchesTokenWhere(token, where ?? {})) {
            continue;
          }

          Object.assign(token, data);
          count += 1;
        }

        return { count };
      },
      create: async ({ data }: any) => {
        const token: EmailVerificationTokenRecord = {
          id: `token-${++tokenSequence}`,
          userId: data.userId,
          tokenHash: data.tokenHash,
          expiresAt: data.expiresAt,
          consumedAt: data.consumedAt ?? null,
          supersededAt: data.supersededAt ?? null,
          createdAt: data.createdAt ?? new Date(),
        };

        state.tokens.push(token);

        return { ...token };
      },
    },
    $transaction: async (callback: (tx: any) => Promise<unknown>) =>
      callback(prisma),
  };

  const mailService = {
    isConfigured: () => state.mailDeliveryEnabled,
    sendEmailVerification: async ({
      to,
      token,
      expiresAt,
    }: {
      to: string;
      token: string;
      expiresAt: Date;
    }) => {
      state.sentMails.push({ to, token, expiresAt });
      return state.mailDeliveryEnabled;
    },
  };

  const service = new AuthService(
    prisma,
    {
      signAsync: async () => "access-token",
    } as any,
    mailService as any,
    {
      trackVerificationEmailIssued: async (
        payload: Record<string, unknown>,
      ) => {
        state.analyticsEvents.push({
          type: "EMAIL_VERIFICATION_ISSUED",
          payload,
        });
        return true;
      },
      trackVerificationResend: async (payload: Record<string, unknown>) => {
        state.analyticsEvents.push({
          type: "EMAIL_VERIFICATION_RESENT",
          payload,
        });
        return true;
      },
      trackEmailVerified: async (payload: Record<string, unknown>) => {
        state.analyticsEvents.push({
          type: "EMAIL_VERIFICATION_VERIFIED",
          payload,
        });
        return true;
      },
    } as any,
    undefined as any,
    undefined as any,
    undefined as any,
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

  return {
    service,
    state,
  };
}

describe("AuthService email verification hardening", () => {
  it("creates an unverified user and stores only a hashed verification token on signup", async () => {
    const authMetricsService = new AuthMetricsService();
    const { service, state } = createAuthServiceHarness({ authMetricsService });

    const result = await service.signup({
      email: "new@dotly.one",
      password: "SecurePass123!",
    });

    assert.equal(result.user.email, "new@dotly.one");
    assert.equal(result.user.isVerified, false);
    assert.ok(typeof result.user.referralCode === "string");
    assert.equal(result.user.referralCode.length, 10);
    assert.equal(result.user.referredBy, null);
    assert.equal(result.verificationPending, true);
    assert.equal(result.verificationEmailSent, true);
    assert.equal(state.tokens.length, 1);
    assert.equal(state.sentMails.length, 1);
    assert.notEqual(state.tokens[0]?.tokenHash, state.sentMails[0]?.token);
    assert.equal(
      state.tokens[0]?.tokenHash,
      hashToken(state.sentMails[0]!.token),
    );
    assert.deepEqual(state.analyticsEvents[0], {
      type: "EMAIL_VERIFICATION_ISSUED",
      payload: {
        actorUserId: "user-1",
        context: "signup",
        emailSent: true,
      },
    });
    assert.deepEqual(state.audits[0], {
      action: "auth.signup",
      outcome: "success",
      actorUserId: "user-1",
      requestId: undefined,
      targetType: "user",
      targetId: "user-1",
      sessionId: undefined,
      reason: undefined,
      policySource: undefined,
      metadata: {
        verificationPending: true,
        verificationEmailSent: true,
        mailDeliveryAvailable: true,
      },
    });
    assert.equal(
      (state.audits[1] as any).action,
      "auth.email_verification.issue",
    );
    assert.equal((state.audits[1] as any).outcome, "accepted");
    assert.equal((state.audits[1] as any).reason, "signup");
    assert.equal((state.audits[1] as any).actorUserId, "user-1");
    assert.equal((state.audits[1] as any).metadata.emailSent, true);
    assert.equal(
      authMetricsService.getCounterValue("dotly_auth_signup_total", {
        outcome: "success",
        reason: "none",
      }),
      1,
    );
    assert.equal(
      authMetricsService.getCounterValue(
        "dotly_auth_verification_email_issue_total",
        {
          context: "signup",
          outcome: "issued",
        },
      ),
      1,
    );
  });

  it("keeps signup successful when verification email delivery is disabled", async () => {
    const { service, state } = createAuthServiceHarness({
      mailDeliveryEnabled: false,
    });

    const result = await service.signup({
      email: "offline-mail@dotly.one",
      password: "SecurePass123!",
    });

    assert.equal(result.user.isVerified, false);
    assert.equal(result.user.referredBy, null);
    assert.equal(result.verificationPending, true);
    assert.equal(result.verificationEmailSent, false);
    assert.equal(state.tokens.length, 1);
    assert.equal(state.sentMails.length, 1);
    assert.deepEqual(state.analyticsEvents[0], {
      type: "EMAIL_VERIFICATION_ISSUED",
      payload: {
        actorUserId: "user-1",
        context: "signup",
        emailSent: false,
      },
    });
  });

  it("allows unverified users to log in while verification remains pending", async () => {
    const { service, state } = createAuthServiceHarness();

    await service.signup({
      email: "pending@dotly.one",
      password: "SecurePass123!",
    });

    const result = await service.login({
      email: "pending@dotly.one",
      password: "SecurePass123!",
    });

    assert.equal(result.accessToken, "access-token");
    assert.deepEqual(state.audits.at(-1), {
      action: "auth.login",
      outcome: "success",
      actorUserId: "user-1",
      requestId: undefined,
      sessionId: "session-test",
      targetType: undefined,
      targetId: undefined,
      reason: undefined,
      policySource: undefined,
      metadata: {
        expiresAt: result.expiresAt.toISOString(),
        hasUserAgent: false,
        hasIpAddress: false,
      },
    });
  });

  it("tracks the referrer when signup uses a valid referral code", async () => {
    const { service, state } = createAuthServiceHarness({
      users: [
        {
          id: "user-1",
          email: "referrer@dotly.one",
          referralCode: "REFERRAL10",
          referredBy: null,
          passwordHash: "hash",
          isVerified: true,
        },
      ],
    });

    const result = await service.signup({
      email: "new@dotly.one",
      password: "SecurePass123!",
      referralCode: " referral10 ",
    });

    assert.equal(result.user.referredBy, "user-1");
    assert.equal(state.users[1]?.referredBy, "user-1");
  });

  it("rejects signup when the referral code is invalid", async () => {
    const { service } = createAuthServiceHarness();

    await assert.rejects(
      () =>
        service.signup({
          email: "new@dotly.one",
          password: "SecurePass123!",
          referralCode: "MISSING10",
        }),
      /referral code is invalid/i,
    );
  });

  it("records failed logins without leaking raw credentials", async () => {
    const authMetricsService = new AuthMetricsService();
    const { service, state } = createAuthServiceHarness({ authMetricsService });

    await service.signup({
      email: "pending@dotly.one",
      password: "SecurePass123!",
    });

    await assert.rejects(
      () =>
        service.login({
          email: "pending@dotly.one",
          password: "WrongPass123!",
        }),
      /invalid email or password/i,
    );

    assert.deepEqual(state.audits.at(-1), {
      action: "auth.login",
      outcome: "failure",
      actorUserId: "user-1",
      requestId: undefined,
      sessionId: undefined,
      targetType: undefined,
      targetId: undefined,
      reason: "invalid_password",
      policySource: undefined,
      metadata: undefined,
    });
    assert.doesNotMatch(JSON.stringify(state.audits), /WrongPass123!/);
    assert.equal(
      authMetricsService.getCounterValue("dotly_auth_login_total", {
        outcome: "failure",
        reason: "invalid_password",
      }),
      1,
    );
  });

  it("temporarily locks repeated failed logins for the same account", async () => {
    const authMetricsService = new AuthMetricsService();
    const { service, state } = createAuthServiceHarness({
      authMetricsService,
      authAbuseProtectionService: createAuthAbuseProtectionService(),
    });

    await service.signup({
      email: "pending@dotly.one",
      password: "SecurePass123!",
    });

    for (let attemptIndex = 0; attemptIndex < 5; attemptIndex += 1) {
      await assert.rejects(
        () =>
          service.login(
            {
              email: "pending@dotly.one",
              password: "WrongPass123!",
            },
            { ipAddress: "203.0.113.8" },
          ),
        /invalid email or password/i,
      );
    }

    await assert.rejects(
      () =>
        service.login(
          {
            email: "pending@dotly.one",
            password: "WrongPass123!",
          },
          { ipAddress: "203.0.113.8" },
        ),
      (error: any) => {
        assert.equal(error.getStatus(), 429);
        assert.match(error.message, /too many failed sign-in attempts/i);
        return true;
      },
    );

    assert.equal(
      authMetricsService.getCounterValue("dotly_auth_login_total", {
        outcome: "throttled",
        reason: "account_lockout",
      }),
      1,
    );
    assert.deepEqual(state.audits.at(-1), {
      action: "auth.login",
      outcome: "rate_limited",
      actorUserId: undefined,
      requestId: undefined,
      sessionId: undefined,
      targetType: undefined,
      targetId: undefined,
      reason: "account_lockout",
      policySource: "auth.login.failure.account",
      metadata: {
        throttleDimension: "account",
        riskLevel: "standard",
        challengeRecommended: false,
        emailHash: hashToken("pending@dotly.one").slice(0, 12),
      },
    });
  });

  it("verifies a user successfully and consumes the verification token", async () => {
    const rawToken = "verify-me-token";
    const authMetricsService = new AuthMetricsService();
    const { service, state } = createAuthServiceHarness({
      users: [
        {
          id: "user-1",
          email: "user@dotly.one",
          referralCode: "VERIFY001A",
          passwordHash: "hash",
          isVerified: false,
        },
      ],
      tokens: [
        {
          id: "token-1",
          userId: "user-1",
          tokenHash: hashToken(rawToken),
          expiresAt: new Date(Date.now() + 60_000),
          consumedAt: null,
          supersededAt: null,
          createdAt: new Date(Date.now() - 60_000),
        },
      ],
      authMetricsService,
    });

    const result = await service.verifyEmail({ token: rawToken });

    assert.equal(result.verified, true);
    assert.equal(result.alreadyVerified, false);
    assert.equal(result.user.isVerified, true);
    assert.equal(state.users[0]?.isVerified, true);
    assert.ok(state.tokens[0]?.consumedAt instanceof Date);
    assert.deepEqual(state.analyticsEvents[0], {
      type: "EMAIL_VERIFICATION_VERIFIED",
      payload: {
        actorUserId: "user-1",
      },
    });
    assert.deepEqual(state.audits[0], {
      action: "auth.email_verification.complete",
      outcome: "success",
      actorUserId: "user-1",
      requestId: undefined,
      sessionId: undefined,
      targetType: "user",
      targetId: "user-1",
      reason: undefined,
      policySource: undefined,
      metadata: {
        alreadyVerified: false,
      },
    });
    assert.equal(
      authMetricsService.getCounterValue(
        "dotly_auth_verification_email_complete_total",
        {
          outcome: "success",
          reason: "none",
        },
      ),
      1,
    );
  });

  it("rejects invalid verification tokens", async () => {
    const { service } = createAuthServiceHarness();

    await assert.rejects(
      () => service.verifyEmail({ token: "missing-token" }),
      /invalid or expired/i,
    );
  });

  it("rejects expired verification tokens", async () => {
    const rawToken = "expired-token";
    const { service } = createAuthServiceHarness({
      users: [
        {
          id: "user-1",
          email: "user@dotly.one",
          referralCode: "VERIFY002B",
          passwordHash: "hash",
          isVerified: false,
        },
      ],
      tokens: [
        {
          id: "token-1",
          userId: "user-1",
          tokenHash: hashToken(rawToken),
          expiresAt: new Date(Date.now() - 1_000),
          consumedAt: null,
          supersededAt: null,
          createdAt: new Date(Date.now() - 120_000),
        },
      ],
    });

    await assert.rejects(
      () => service.verifyEmail({ token: rawToken }),
      /invalid or expired/i,
    );
  });

  it("resends verification by issuing a new token and superseding the previous active one", async () => {
    const previousRawToken = "older-token";
    const { service, state } = createAuthServiceHarness({
      users: [
        {
          id: "user-1",
          email: "user@dotly.one",
          referralCode: "VERIFY003C",
          passwordHash: "hash",
          isVerified: false,
        },
      ],
      tokens: [
        {
          id: "token-1",
          userId: "user-1",
          tokenHash: hashToken(previousRawToken),
          expiresAt: new Date(Date.now() + 3_600_000),
          consumedAt: null,
          supersededAt: null,
          createdAt: new Date(Date.now() - 120_000),
        },
      ],
    });

    const result = await service.resendVerificationEmail({
      email: "user@dotly.one",
    });

    assert.equal(result.accepted, true);
    assert.equal(result.verificationPending, true);
    assert.equal(result.verificationEmailSent, true);
    assert.equal(state.tokens.length, 2);
    assert.ok(state.tokens[0]?.supersededAt instanceof Date);
    assert.equal(state.sentMails.length, 1);
    assert.equal(
      state.tokens[1]?.tokenHash,
      hashToken(state.sentMails[0]!.token),
    );
    assert.deepEqual(state.analyticsEvents, [
      {
        type: "EMAIL_VERIFICATION_ISSUED",
        payload: {
          actorUserId: "user-1",
          context: "resend",
          emailSent: true,
        },
      },
      {
        type: "EMAIL_VERIFICATION_RESENT",
        payload: {
          actorUserId: "user-1",
          emailSent: true,
        },
      },
    ]);
  });

  it("rate limits immediate resend attempts", async () => {
    const authMetricsService = new AuthMetricsService();
    const { service } = createAuthServiceHarness({
      users: [
        {
          id: "user-1",
          email: "user@dotly.one",
          referralCode: "VERIFY004D",
          passwordHash: "hash",
          isVerified: false,
        },
      ],
      tokens: [
        {
          id: "token-1",
          userId: "user-1",
          tokenHash: hashToken("fresh-token"),
          expiresAt: new Date(Date.now() + 3_600_000),
          consumedAt: null,
          supersededAt: null,
          createdAt: new Date(),
        },
      ],
      authMetricsService,
    });

    await assert.rejects(
      () => service.resendVerificationEmail({ email: "user@dotly.one" }),
      /please wait/i,
    );

    assert.equal(
      authMetricsService.getCounterValue(
        "dotly_auth_verification_resend_total",
        {
          outcome: "throttled",
          reason: "cooldown_active",
        },
      ),
      1,
    );
  });

  it("rate limits resend bursts across the rolling window", async () => {
    const now = Date.now();
    const { service } = createAuthServiceHarness({
      users: [
        {
          id: "user-1",
          email: "user@dotly.one",
          referralCode: "VERIFY005E",
          passwordHash: "hash",
          isVerified: false,
        },
      ],
      tokens: Array.from({ length: 5 }, (_, index) => ({
        id: `token-${index + 1}`,
        userId: "user-1",
        tokenHash: hashToken(`window-token-${index + 1}`),
        expiresAt: new Date(now + 3_600_000),
        consumedAt: null,
        supersededAt: new Date(now - 120_000),
        createdAt: new Date(now - 120_000 - index * 1_000),
      })),
    });

    await assert.rejects(
      () => service.resendVerificationEmail({ email: "user@dotly.one" }),
      /too many verification emails requested/i,
    );
  });
});
