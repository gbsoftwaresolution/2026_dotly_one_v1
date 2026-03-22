import { createHash } from "node:crypto";
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import * as bcrypt from "bcryptjs";
import { HttpException } from "@nestjs/common";

import { AuthAbuseProtectionService } from "../src/modules/auth/auth-abuse-protection.service";
import { AuthMetricsService } from "../src/modules/auth/auth-metrics.service";
import { AuthService } from "../src/modules/auth/auth.service";

interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
}

interface PasswordResetTokenRecord {
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

function hashPasswordResetKey(email: string): string {
  return hashToken(`password-reset:${email.trim().toLowerCase()}`);
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

function cloneValue<T>(value: T): T {
  return globalThis.structuredClone(value);
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
  token: PasswordResetTokenRecord,
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

  if (
    typeof where.tokenHash === "string" &&
    token.tokenHash !== where.tokenHash
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

function createPasswordResetHarness(options?: {
  users?: UserRecord[];
  tokens?: PasswordResetTokenRecord[];
  cooldownAccepted?: boolean | null;
  windowCount?: number | null;
  authMetricsService?: AuthMetricsService;
  failSessionRevocation?: boolean;
  authAbuseProtectionService?: AuthAbuseProtectionService;
}) {
  const state = {
    users: [...(options?.users ?? [])],
    tokens: [...(options?.tokens ?? [])],
    sentMails: [] as Array<{ to: string; token: string; expiresAt: Date }>,
    revokedSessions: [] as Array<{ userId: string; reason: string }>,
    audits: [] as Array<Record<string, unknown>>,
    cacheCalls: [] as Array<
      | { type: "setIfAbsent"; key: string; ttlSeconds: number }
      | { type: "increment"; key: string; ttlSeconds: number }
    >,
  };

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

          return false;
        });

        return user ? selectFields(user, select) : null;
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
    passwordResetToken: {
      findUnique: async ({ where, include }: any) => {
        const token = state.tokens.find((candidate) => candidate.tokenHash === where.tokenHash);

        if (!token) {
          return null;
        }

        if (include?.user?.select) {
          const user = state.users.find((candidate) => candidate.id === token.userId);

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
        state.tokens.filter((token) => matchesTokenWhere(token, where ?? {})).length,
      update: async ({ where, data }: any) => {
        const token = state.tokens.find((candidate) => candidate.id === where.id);

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
        const token: PasswordResetTokenRecord = {
          id: `reset-${++tokenSequence}`,
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
      {
        const snapshot = cloneValue({
          users: state.users,
          tokens: state.tokens,
        });

        return callback(prisma).catch((error) => {
          state.users.splice(0, state.users.length, ...snapshot.users);
          state.tokens.splice(0, state.tokens.length, ...snapshot.tokens);
          throw error;
        });
      },
  };

  const service = new AuthService(
    prisma,
    { signAsync: async () => "access-token" } as any,
    {
      sendPasswordReset: async ({
        to,
        token,
        expiresAt,
      }: {
        to: string;
        token: string;
        expiresAt: Date;
      }) => {
        state.sentMails.push({ to, token, expiresAt });
        return true;
      },
      isConfigured: () => true,
      isPasswordResetConfigured: () => true,
    } as any,
    {} as any,
    undefined as any,
    {
      revokeAllSessions: async (userId: string, reason: string) => {
        if (options?.failSessionRevocation) {
          throw new Error("session revoke failed");
        }

        state.revokedSessions.push({ userId, reason });
        return 1;
      },
      revokeOtherSessions: async () => 0,
      revokeSession: async () => true,
      listSessions: async () => [],
      createSession: async () => ({
        id: "session-1",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      }),
    } as any,
    undefined as any,
    {
      setIfAbsent: async (key: string, _value: string, ttlSeconds: number) => {
        state.cacheCalls.push({ type: "setIfAbsent", key, ttlSeconds });
        return options?.cooldownAccepted ?? true;
      },
      increment: async (key: string, ttlSeconds: number) => {
        state.cacheCalls.push({ type: "increment", key, ttlSeconds });
        return options?.windowCount ?? 1;
      },
    } as any,
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

describe("AuthService password reset", () => {
  it("stores only a hashed reset token and returns the generic response", async () => {
    const authMetricsService = new AuthMetricsService();
    const { service, state } = createPasswordResetHarness({
      users: [
        {
          id: "user-1",
          email: "user@dotly.one",
          passwordHash: await bcrypt.hash("OldPass123!", 10),
        },
      ],
      authMetricsService,
    });

    const result = await service.requestPasswordReset({
      email: "user@dotly.one",
    });

    assert.deepEqual(result, {
      accepted: true,
      resetEmailSent: true,
    });
    assert.equal(state.tokens.length, 1);
    assert.equal(state.sentMails.length, 1);
    assert.notEqual(state.tokens[0]?.tokenHash, state.sentMails[0]?.token);
    assert.equal(state.tokens[0]?.tokenHash, hashToken(state.sentMails[0]!.token));
    assert.equal((state.audits[0] as any).action, "auth.password_reset.request");
    assert.equal((state.audits[0] as any).outcome, "accepted");
    assert.equal((state.audits[0] as any).actorUserId, "user-1");
    assert.equal((state.audits[0] as any).metadata.emailSent, true);
    assert.doesNotMatch(JSON.stringify(state.audits[0]), new RegExp(state.sentMails[0]!.token));
    assert.equal(
      authMetricsService.getCounterValue(
        "dotly_auth_password_reset_request_total",
        {
          outcome: "requested",
          reason: "issued",
        },
      ),
      1,
    );
  });

  it("does not leak account existence for unknown emails", async () => {
    const { service, state } = createPasswordResetHarness();

    const result = await service.requestPasswordReset({
      email: "missing@dotly.one",
    });

    assert.deepEqual(result, {
      accepted: true,
      resetEmailSent: true,
    });
    assert.equal(state.tokens.length, 0);
    assert.equal(state.sentMails.length, 0);
  });

  it("silently suppresses repeat issuance for the same account during cooldown", async () => {
    const authMetricsService = new AuthMetricsService();
    const { service, state } = createPasswordResetHarness({
      users: [
        {
          id: "user-1",
          email: "user@dotly.one",
          passwordHash: await bcrypt.hash("OldPass123!", 10),
        },
      ],
      tokens: [
        {
          id: "reset-1",
          userId: "user-1",
          tokenHash: hashToken("existing-token"),
          expiresAt: new Date(Date.now() + 30 * 60 * 1000),
          consumedAt: null,
          supersededAt: null,
          createdAt: new Date(),
        },
      ],
      authMetricsService,
    });

    const result = await service.requestPasswordReset({
      email: "user@dotly.one",
    });

    assert.deepEqual(result, {
      accepted: true,
      resetEmailSent: true,
    });
    assert.equal(state.tokens.length, 1);
    assert.equal(state.sentMails.length, 0);
    assert.deepEqual(state.audits[0], {
      action: "auth.password_reset.request",
      outcome: "suppressed",
      actorUserId: "user-1",
      requestId: undefined,
      sessionId: undefined,
      targetType: undefined,
      targetId: undefined,
      reason: "per_account_rate_limited",
      policySource: undefined,
      metadata: undefined,
    });
    assert.equal(
      authMetricsService.getCounterValue(
        "dotly_auth_password_reset_request_total",
        {
          outcome: "suppressed",
          reason: "per_account_rate_limited",
        },
      ),
      1,
    );
  });

  it("rate limits repeated anonymous reset requests without relying on account existence", async () => {
    const authMetricsService = new AuthMetricsService();
    const { service } = createPasswordResetHarness({
      cooldownAccepted: false,
      authMetricsService,
    });

    await assert.rejects(
      () =>
        service.requestPasswordReset({
          email: "user@dotly.one",
        }),
      (error: any) => {
        assert.ok(error instanceof HttpException);
        assert.equal(error.getStatus(), 429);
        assert.match(error.message, /wait before requesting another password reset email/i);
        return true;
      },
    );

    assert.equal(
      authMetricsService.getCounterValue(
        "dotly_auth_password_reset_request_total",
        {
          outcome: "throttled",
          reason: "cooldown_active",
        },
      ),
      1,
    );
  });

  it("rate limits forgot-password bursts from the same IP across different accounts", async () => {
    const authMetricsService = new AuthMetricsService();
    const { service, state } = createPasswordResetHarness({
      authMetricsService,
      authAbuseProtectionService: createAuthAbuseProtectionService(),
    });

    for (let attemptIndex = 0; attemptIndex < 12; attemptIndex += 1) {
      const result = await service.requestPasswordReset(
        {
          email: `user-${attemptIndex}@dotly.one`,
        },
        { ipAddress: "198.51.100.23" },
      );

      assert.deepEqual(result, {
        accepted: true,
        resetEmailSent: true,
      });
    }

    await assert.rejects(
      () =>
        service.requestPasswordReset(
          {
            email: "user-12@dotly.one",
          },
          { ipAddress: "198.51.100.23" },
        ),
      (error: any) => {
        assert.ok(error instanceof HttpException);
        assert.equal(error.getStatus(), 429);
        assert.match(error.message, /too many password reset requests/i);
        return true;
      },
    );

    assert.equal(
      authMetricsService.getCounterValue(
        "dotly_auth_password_reset_request_total",
        {
          outcome: "throttled",
          reason: "ip_rate_limited",
        },
      ),
      1,
    );
    assert.equal((state.audits.at(-1) as any).policySource, "auth.password_reset.request.ip");
  });

  it("normalizes the email before building anonymous reset rate-limit keys", async () => {
    const { service, state } = createPasswordResetHarness();

    await service.requestPasswordReset({
      email: "  USER@Dotly.One ",
    });

    assert.deepEqual(state.cacheCalls, [
      {
        type: "setIfAbsent",
        key: `auth:password-reset:cooldown:${hashPasswordResetKey("user@dotly.one")}`,
        ttlSeconds: 60,
      },
      {
        type: "increment",
        key: `auth:password-reset:window:${hashPasswordResetKey("user@dotly.one")}`,
        ttlSeconds: 3600,
      },
    ]);
  });

  it("resets the password, consumes the token, and revokes all sessions", async () => {
    const rawToken = "reset-me-token";
    const authMetricsService = new AuthMetricsService();
    const { service, state } = createPasswordResetHarness({
      users: [
        {
          id: "user-1",
          email: "user@dotly.one",
          passwordHash: await bcrypt.hash("OldPass123!", 10),
        },
      ],
      tokens: [
        {
          id: "reset-active",
          userId: "user-1",
          tokenHash: hashToken(rawToken),
          expiresAt: new Date(Date.now() + 60_000),
          consumedAt: null,
          supersededAt: null,
          createdAt: new Date(Date.now() - 60_000),
        },
        {
          id: "reset-other",
          userId: "user-1",
          tokenHash: hashToken("older-token"),
          expiresAt: new Date(Date.now() + 60_000),
          consumedAt: null,
          supersededAt: null,
          createdAt: new Date(Date.now() - 120_000),
        },
      ],
      authMetricsService,
    });

    const result = await service.resetPassword({
      token: rawToken,
      password: "NewPass123!",
    });

    assert.deepEqual(result, {
      success: true,
      signedOutSessions: true,
    });
    assert.equal(
      await bcrypt.compare("NewPass123!", state.users[0]!.passwordHash),
      true,
    );
    assert.ok(state.tokens[0]?.consumedAt instanceof Date);
    assert.ok(state.tokens[1]?.supersededAt instanceof Date);
    assert.deepEqual(state.revokedSessions, [
      {
        userId: "user-1",
        reason: "password_reset",
      },
    ]);
    assert.deepEqual(state.audits.at(-1), {
      action: "auth.password_reset.complete",
      outcome: "success",
      actorUserId: "user-1",
      requestId: undefined,
      sessionId: undefined,
      targetType: "user",
      targetId: "user-1",
      reason: undefined,
      policySource: undefined,
      metadata: {
        revokedAllSessions: true,
      },
    });
    assert.equal(
      authMetricsService.getCounterValue(
        "dotly_auth_password_reset_complete_total",
        {
          outcome: "completed",
          reason: "none",
        },
      ),
      1,
    );
  });

  it("rejects invalid or expired reset tokens", async () => {
    const authMetricsService = new AuthMetricsService();
    const { service } = createPasswordResetHarness({ authMetricsService });

    await assert.rejects(
      () =>
        service.resetPassword({
          token: "missing-token",
          password: "NewPass123!",
        }),
      /invalid or expired/i,
    );

    assert.equal(
      authMetricsService.getCounterValue(
        "dotly_auth_password_reset_complete_total",
        {
          outcome: "failed",
          reason: "invalid_or_expired_token",
        },
      ),
      1,
    );
  });

  it("rejects choosing the same password again", async () => {
    const rawToken = "reset-same-password";
    const existingPasswordHash = await bcrypt.hash("OldPass123!", 10);
    const { service } = createPasswordResetHarness({
      users: [
        {
          id: "user-1",
          email: "user@dotly.one",
          passwordHash: existingPasswordHash,
        },
      ],
      tokens: [
        {
          id: "reset-active",
          userId: "user-1",
          tokenHash: hashToken(rawToken),
          expiresAt: new Date(Date.now() + 60_000),
          consumedAt: null,
          supersededAt: null,
          createdAt: new Date(Date.now() - 60_000),
        },
      ],
    });

    await assert.rejects(
      () =>
        service.resetPassword({
          token: rawToken,
          password: "OldPass123!",
        }),
      /different from your current one/i,
    );
  });

  it("rolls the reset back when session revocation fails", async () => {
    const rawToken = "reset-rollback-token";
    const previousPasswordHash = await bcrypt.hash("OldPass123!", 10);
    const { service, state } = createPasswordResetHarness({
      users: [
        {
          id: "user-1",
          email: "user@dotly.one",
          passwordHash: previousPasswordHash,
        },
      ],
      tokens: [
        {
          id: "reset-active",
          userId: "user-1",
          tokenHash: hashToken(rawToken),
          expiresAt: new Date(Date.now() + 60_000),
          consumedAt: null,
          supersededAt: null,
          createdAt: new Date(Date.now() - 60_000),
        },
      ],
      failSessionRevocation: true,
    });

    await assert.rejects(
      service.resetPassword({
        token: rawToken,
        password: "NewPass123!",
      }),
      /session revoke failed/i,
    );

    assert.equal(
      await bcrypt.compare("OldPass123!", state.users[0]!.passwordHash),
      true,
    );
    assert.equal(state.tokens[0]?.consumedAt, null);
    assert.equal(state.tokens[0]?.supersededAt, null);
    assert.deepEqual(state.revokedSessions, []);
  });
});