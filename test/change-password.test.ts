import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import * as bcrypt from "bcrypt";
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

async function createHarness() {
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
        state.sessionCalls.push({
          type: "revokeOtherSessions",
          userId,
          sessionId,
          reason,
        });

        return 2;
      },
      revokeAllSessions: async (userId: string, reason: string) => {
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
});