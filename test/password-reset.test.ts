import { createHash } from "node:crypto";
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import * as bcrypt from "bcrypt";
import { HttpException } from "@nestjs/common";

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
}) {
  const state = {
    users: [...(options?.users ?? [])],
    tokens: [...(options?.tokens ?? [])],
    sentMails: [] as Array<{ to: string; token: string; expiresAt: Date }>,
    revokedSessions: [] as Array<{ userId: string; reason: string }>,
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
      callback(prisma),
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
  );

  return { service, state };
}

describe("AuthService password reset", () => {
  it("stores only a hashed reset token and returns the generic response", async () => {
    const { service, state } = createPasswordResetHarness({
      users: [
        {
          id: "user-1",
          email: "user@dotly.one",
          passwordHash: await bcrypt.hash("OldPass123!", 10),
        },
      ],
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
  });

  it("rate limits repeated anonymous reset requests without relying on account existence", async () => {
    const { service } = createPasswordResetHarness({
      cooldownAccepted: false,
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
  });

  it("rejects invalid or expired reset tokens", async () => {
    const { service } = createPasswordResetHarness();

    await assert.rejects(
      () =>
        service.resetPassword({
          token: "missing-token",
          password: "NewPass123!",
        }),
      /invalid or expired/i,
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
});