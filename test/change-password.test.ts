import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import * as bcrypt from "bcryptjs";
import { BadRequestException } from "@nestjs/common";

import { AuthService } from "../src/modules/auth/auth.service";

interface UserRecord {
  id: string;
  passwordHash: string;
}

interface PasswordResetTokenRecord {
  id: string;
  userId: string;
  consumedAt: Date | null;
  supersededAt: Date | null;
}

function cloneValue<T>(value: T): T {
  return globalThis.structuredClone(value);
}

async function createHarness(options?: { failSessionRevocation?: boolean }) {
  const state = {
    users: [
      {
        id: "user-1",
        passwordHash: await bcrypt.hash("OldPass123!", 10),
      },
    ] satisfies UserRecord[],
    passwordResetTokens: [
      {
        id: "reset-active-1",
        userId: "user-1",
        consumedAt: null,
        supersededAt: null,
      },
      {
        id: "reset-consumed",
        userId: "user-1",
        consumedAt: new Date("2026-03-20T12:00:00.000Z"),
        supersededAt: null,
      },
    ] satisfies PasswordResetTokenRecord[],
    sessionCalls: [] as Array<
      | { type: "revokeOtherSessions"; userId: string; sessionId: string; reason: string }
      | { type: "revokeAllSessions"; userId: string; reason: string }
    >,
    audits: [] as Array<Record<string, unknown>>,
  };

  const prisma = {
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
            .map(([key]) => [key, (user as Record<string, unknown>)[key]]),
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
            .map(([key]) => [key, (user as Record<string, unknown>)[key]]),
        );
      },
    },
    passwordResetToken: {
      updateMany: async ({ where, data }: any) => {
        let count = 0;

        for (const token of state.passwordResetTokens) {
          if (token.userId !== where.userId) {
            continue;
          }

          if (where.consumedAt === null && token.consumedAt !== null) {
            continue;
          }

          if (where.supersededAt === null && token.supersededAt !== null) {
            continue;
          }

          Object.assign(token, data);
          count += 1;
        }

        return { count };
      },
    },
    $transaction: async <T>(callback: (tx: any) => Promise<T>) => {
      const snapshot = cloneValue({
        users: state.users,
        passwordResetTokens: state.passwordResetTokens,
      });

      try {
        return await callback(prisma);
      } catch (error) {
        state.users.splice(0, state.users.length, ...snapshot.users);
        state.passwordResetTokens.splice(
          0,
          state.passwordResetTokens.length,
          ...snapshot.passwordResetTokens,
        );
        throw error;
      }
    },
  };

  const service = new AuthService(
    prisma as any,
    { signAsync: async () => "access-token" } as any,
    { isConfigured: () => true } as any,
    {} as any,
    undefined as any,
    {
      revokeOtherSessions: async (
        userId: string,
        sessionId: string,
        reason: string,
      ) => {
        if (options?.failSessionRevocation) {
          throw new Error("session revoke failed");
        }

        state.sessionCalls.push({
          type: "revokeOtherSessions",
          userId,
          sessionId,
          reason,
        });

        return 2;
      },
      revokeAllSessions: async (userId: string, reason: string) => {
        if (options?.failSessionRevocation) {
          throw new Error("session revoke failed");
        }

        state.sessionCalls.push({
          type: "revokeAllSessions",
          userId,
          reason,
        });

        return 3;
      },
    } as any,
    undefined as any,
    undefined as any,
    undefined as any,
    undefined as any,
    {
      log: (event: Record<string, unknown>) => {
        state.audits.push(event);
      },
    } as any,
  );

  return { service, state };
}

describe("AuthService changePassword", () => {
  it("updates the password and revokes other sessions while keeping the current session", async () => {
    const { service, state } = await createHarness();

    const result = await service.changePassword(
      "user-1",
      {
        currentPassword: "OldPass123!",
        newPassword: "NewPass123!",
      },
      "session-current",
    );

    assert.deepEqual(result, {
      success: true,
      signedOutSessions: true,
    });
    assert.equal(
      await bcrypt.compare("NewPass123!", state.users[0]!.passwordHash),
      true,
    );
    assert.notEqual(state.passwordResetTokens[0]?.supersededAt, null);
    assert.equal(state.passwordResetTokens[1]?.supersededAt, null);
    assert.deepEqual(state.sessionCalls, [
      {
        type: "revokeOtherSessions",
        userId: "user-1",
        sessionId: "session-current",
        reason: "password_changed",
      },
    ]);
    assert.deepEqual(state.audits[0], {
      action: "auth.password.change",
      outcome: "success",
      actorUserId: "user-1",
      requestId: undefined,
      sessionId: "session-current",
      targetType: undefined,
      targetId: undefined,
      reason: undefined,
      policySource: undefined,
      metadata: {
        retainedCurrentSession: true,
      },
    });
  });

  it("rejects an incorrect current password", async () => {
    const { service, state } = await createHarness();

    await assert.rejects(
      service.changePassword(
        "user-1",
        {
          currentPassword: "WrongPass123!",
          newPassword: "NewPass123!",
        },
        "session-current",
      ),
      (error: any) => {
        assert.ok(error instanceof BadRequestException);
        assert.equal(error.message, "Current password is incorrect.");
        return true;
      },
    );

    assert.equal(
      await bcrypt.compare("OldPass123!", state.users[0]!.passwordHash),
      true,
    );
    assert.deepEqual(state.sessionCalls, []);
    assert.deepEqual(state.audits[0], {
      action: "auth.password.change",
      outcome: "failure",
      actorUserId: "user-1",
      requestId: undefined,
      sessionId: "session-current",
      targetType: undefined,
      targetId: undefined,
      reason: "incorrect_current_password",
      policySource: undefined,
      metadata: undefined,
    });
  });

  it("rejects weak replacement passwords before updating credentials", async () => {
    const { service, state } = await createHarness();

    await assert.rejects(
      service.changePassword(
        "user-1",
        {
          currentPassword: "OldPass123!",
          newPassword: "weakpass",
        },
        "session-current",
      ),
      (error: any) => {
        assert.ok(error instanceof BadRequestException);
        assert.equal(error.message, "Use at least 10 characters for your password.");
        return true;
      },
    );

    assert.equal(
      await bcrypt.compare("OldPass123!", state.users[0]!.passwordHash),
      true,
    );
    assert.equal(state.passwordResetTokens[0]?.supersededAt, null);
    assert.deepEqual(state.sessionCalls, []);
  });

  it("rolls the password change back when session revocation fails", async () => {
    const { service, state } = await createHarness({
      failSessionRevocation: true,
    });

    await assert.rejects(
      service.changePassword(
        "user-1",
        {
          currentPassword: "OldPass123!",
          newPassword: "NewPass123!",
        },
        "session-current",
      ),
      /session revoke failed/i,
    );

    assert.equal(
      await bcrypt.compare("OldPass123!", state.users[0]!.passwordHash),
      true,
    );
    assert.equal(state.passwordResetTokens[0]?.supersededAt, null);
    assert.deepEqual(state.sessionCalls, []);
  });
});