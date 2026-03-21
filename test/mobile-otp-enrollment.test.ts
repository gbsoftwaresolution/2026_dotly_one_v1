import { createHash } from "node:crypto";
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { BadRequestException, HttpException } from "@nestjs/common";

import { AuthService } from "../src/modules/auth/auth.service";

interface UserRecord {
  id: string;
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

function createMobileOtpHarness(options?: {
  users?: UserRecord[];
  challenges?: MobileOtpChallengeRecord[];
}) {
  const state = {
    users: [...(options?.users ?? [])],
    challenges: [...(options?.challenges ?? [])],
    sentOtps: [] as Array<{ to: string; code: string; expiresInMinutes: number }>,
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
            .map(([key]) => [key, (user as unknown as Record<string, unknown>)[key]]),
        );
      },
      findFirst: async ({ where, select }: any) => {
        const user = state.users.find((candidate) => {
          if (where.phoneNumber && candidate.phoneNumber !== where.phoneNumber) {
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
            .map(([key]) => [key, (user as unknown as Record<string, unknown>)[key]]),
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
            .map(([key]) => [key, (user as unknown as Record<string, unknown>)[key]]),
        );
      },
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

            if (where.supersededAt === null && challenge.supersededAt !== null) {
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
            .map(([key]) => [key, (match as unknown as Record<string, unknown>)[key]]),
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
            .map(([key]) => [key, (challenge as unknown as Record<string, unknown>)[key]]),
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
            .map(([key]) => [key, (challenge as unknown as Record<string, unknown>)[key]]),
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
  );

  return { service, state };
}

describe("AuthService mobile OTP enrollment", () => {
  it("issues a hashed enrollment challenge and stores the pending phone number", async () => {
    const { service, state } = createMobileOtpHarness({
      users: [
        {
          id: "user-1",
          phoneNumber: null,
          pendingPhoneNumber: null,
          phoneVerifiedAt: null,
        },
      ],
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
  });

  it("blocks resend attempts while the enrollment cooldown is active", async () => {
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
          resendAvailableAt: new Date(Date.now() + 60 * 1000),
          createdAt: new Date(),
        },
      ],
    });

    await assert.rejects(
      () =>
        service.requestMobileOtp("user-1", {
          phoneNumber: "+14155550199",
        }),
      (error: any) => {
        assert.ok(error instanceof HttpException);
        assert.equal(error.getStatus(), 429);
        assert.match(error.message, /wait before requesting another verification code/i);
        return true;
      },
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
        assert.match(error.message, /request a verification code before trying again/i);
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
        assert.match(error.message, /too many incorrect codes/i);
        return true;
      },
    );

    assert.equal(state.challenges[0]?.invalidAttemptCount, 5);
    assert.ok(state.challenges[0]?.supersededAt instanceof Date);
  });

  it("rate limits rapid retry attempts between incorrect codes", async () => {
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
          invalidAttemptCount: 1,
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
        assert.match(error.message, /wait a moment before trying another verification code/i);
        return true;
      },
    );
  });

  it("verifies the selected enrollment challenge and activates the mobile trust factor", async () => {
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
  });
});