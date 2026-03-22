import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import {
  SecurityArtifactLifecycleService,
  type SecurityArtifactCleanupSummary,
} from "../src/modules/auth/security-artifact-lifecycle.service";

type TokenRecord = {
  id: string;
  expiresAt: Date;
  consumedAt: Date | null;
  supersededAt: Date | null;
};

type SessionRecord = {
  id: string;
  expiresAt: Date;
  revokedAt: Date | null;
};

function matchesDateLte(value: Date | null, clause: { lte: Date } | undefined) {
  if (!clause) {
    return true;
  }

  if (!value) {
    return false;
  }

  return value.getTime() <= clause.lte.getTime();
}

function matchesTokenCleanup(record: TokenRecord, where: any) {
  return (where.OR as any[]).some((candidate) => {
    if (candidate.consumedAt === null && record.consumedAt !== null) {
      return false;
    }

    if (candidate.supersededAt === null && record.supersededAt !== null) {
      return false;
    }

    if (
      candidate.consumedAt &&
      !matchesDateLte(record.consumedAt, candidate.consumedAt)
    ) {
      return false;
    }

    if (
      candidate.supersededAt &&
      !matchesDateLte(record.supersededAt, candidate.supersededAt)
    ) {
      return false;
    }

    if (candidate.expiresAt && !matchesDateLte(record.expiresAt, candidate.expiresAt)) {
      return false;
    }

    return true;
  });
}

function matchesSessionCleanup(record: SessionRecord, where: any) {
  if (where.revokedAt === null && record.revokedAt !== null) {
    return false;
  }

  if (where.revokedAt && !matchesDateLte(record.revokedAt, where.revokedAt)) {
    return false;
  }

  if (where.expiresAt && !matchesDateLte(record.expiresAt, where.expiresAt)) {
    return false;
  }

  return true;
}

function deleteMatching<T>(records: T[], predicate: (record: T) => boolean) {
  const retained = records.filter((record) => !predicate(record));
  const deletedCount = records.length - retained.length;

  records.splice(0, records.length, ...retained);

  return { count: deletedCount };
}

function createCleanupHarness() {
  const now = new Date("2026-03-22T12:00:00.000Z");
  const state = {
    emailVerificationTokens: [
      {
        id: "email-active",
        expiresAt: new Date("2026-03-22T13:00:00.000Z"),
        consumedAt: null,
        supersededAt: null,
      },
      {
        id: "email-expired-recent",
        expiresAt: new Date("2026-03-16T12:00:00.000Z"),
        consumedAt: null,
        supersededAt: null,
      },
      {
        id: "email-expired-old",
        expiresAt: new Date("2026-03-14T11:59:59.000Z"),
        consumedAt: null,
        supersededAt: null,
      },
      {
        id: "email-consumed-recent",
        expiresAt: new Date("2026-03-21T12:00:00.000Z"),
        consumedAt: new Date("2026-03-09T12:00:01.000Z"),
        supersededAt: null,
      },
      {
        id: "email-consumed-old",
        expiresAt: new Date("2026-03-20T12:00:00.000Z"),
        consumedAt: new Date("2026-03-08T12:00:00.000Z"),
        supersededAt: null,
      },
      {
        id: "email-superseded-old",
        expiresAt: new Date("2026-03-20T12:00:00.000Z"),
        consumedAt: null,
        supersededAt: new Date("2026-03-08T12:00:00.000Z"),
      },
    ] satisfies TokenRecord[],
    passwordResetTokens: [
      {
        id: "reset-active",
        expiresAt: new Date("2026-03-22T12:30:00.000Z"),
        consumedAt: null,
        supersededAt: null,
      },
      {
        id: "reset-expired-recent",
        expiresAt: new Date("2026-03-20T12:00:00.000Z"),
        consumedAt: null,
        supersededAt: null,
      },
      {
        id: "reset-expired-old",
        expiresAt: new Date("2026-03-19T11:59:59.000Z"),
        consumedAt: null,
        supersededAt: null,
      },
      {
        id: "reset-consumed-recent",
        expiresAt: new Date("2026-03-21T12:00:00.000Z"),
        consumedAt: new Date("2026-02-21T12:00:01.000Z"),
        supersededAt: null,
      },
      {
        id: "reset-consumed-old",
        expiresAt: new Date("2026-03-20T12:00:00.000Z"),
        consumedAt: new Date("2026-02-20T12:00:00.000Z"),
        supersededAt: null,
      },
      {
        id: "reset-superseded-old",
        expiresAt: new Date("2026-03-20T12:00:00.000Z"),
        consumedAt: null,
        supersededAt: new Date("2026-02-20T12:00:00.000Z"),
      },
    ] satisfies TokenRecord[],
    mobileOtpChallenges: [
      {
        id: "otp-active",
        expiresAt: new Date("2026-03-22T12:10:00.000Z"),
        consumedAt: null,
        supersededAt: null,
      },
      {
        id: "otp-expired-recent",
        expiresAt: new Date("2026-03-20T12:00:00.000Z"),
        consumedAt: null,
        supersededAt: null,
      },
      {
        id: "otp-expired-old",
        expiresAt: new Date("2026-03-19T11:59:59.000Z"),
        consumedAt: null,
        supersededAt: null,
      },
      {
        id: "otp-consumed-recent",
        expiresAt: new Date("2026-03-21T12:00:00.000Z"),
        consumedAt: new Date("2026-03-20T12:00:01.000Z"),
        supersededAt: null,
      },
      {
        id: "otp-consumed-old",
        expiresAt: new Date("2026-03-20T12:00:00.000Z"),
        consumedAt: new Date("2026-03-19T12:00:00.000Z"),
        supersededAt: null,
      },
      {
        id: "otp-superseded-old",
        expiresAt: new Date("2026-03-20T12:00:00.000Z"),
        consumedAt: null,
        supersededAt: new Date("2026-03-19T12:00:00.000Z"),
      },
    ] satisfies TokenRecord[],
    sessions: [
      {
        id: "session-active",
        expiresAt: new Date("2026-03-25T12:00:00.000Z"),
        revokedAt: null,
      },
      {
        id: "session-revoked-recent",
        expiresAt: new Date("2026-03-15T12:00:00.000Z"),
        revokedAt: new Date("2026-02-21T12:00:01.000Z"),
      },
      {
        id: "session-revoked-old",
        expiresAt: new Date("2026-03-14T12:00:00.000Z"),
        revokedAt: new Date("2026-02-20T12:00:00.000Z"),
      },
      {
        id: "session-expired-recent",
        expiresAt: new Date("2026-03-16T12:00:01.000Z"),
        revokedAt: null,
      },
      {
        id: "session-expired-old",
        expiresAt: new Date("2026-03-15T12:00:00.000Z"),
        revokedAt: null,
      },
      {
        id: "session-revoked-and-expired-old",
        expiresAt: new Date("2026-02-10T12:00:00.000Z"),
        revokedAt: new Date("2026-02-10T12:00:00.000Z"),
      },
    ] satisfies SessionRecord[],
    logs: [] as Array<Record<string, unknown>>,
  };

  const service = new SecurityArtifactLifecycleService(
    {} as any,
    {
      logWithMeta: (
        _level: string,
        _message: string,
        metadata: Record<string, unknown>,
      ) => {
        state.logs.push(metadata);
      },
    } as any,
  );

  const store = {
    emailVerificationToken: {
      deleteMany: async ({ where }: any) =>
        deleteMatching(state.emailVerificationTokens, (record) =>
          matchesTokenCleanup(record, where),
        ),
    },
    passwordResetToken: {
      deleteMany: async ({ where }: any) =>
        deleteMatching(state.passwordResetTokens, (record) =>
          matchesTokenCleanup(record, where),
        ),
    },
    mobileOtpChallenge: {
      deleteMany: async ({ where }: any) =>
        deleteMatching(state.mobileOtpChallenges, (record) =>
          matchesTokenCleanup(record, where),
        ),
    },
    authSession: {
      deleteMany: async ({ where }: any) =>
        deleteMatching(state.sessions, (record) => matchesSessionCleanup(record, where)),
    },
  };

  return {
    now,
    state,
    store,
    service,
  };
}

function assertSummary(
  result: SecurityArtifactCleanupSummary,
  expected: SecurityArtifactCleanupSummary,
) {
  assert.deepEqual(result, expected);
}

describe("SecurityArtifactLifecycleService", () => {
  it("deletes only stale terminal artifacts and keeps rows still needed by active flows", async () => {
    const { now, state, store, service } = createCleanupHarness();

    const result = await service.cleanupArtifacts({
      now,
      trigger: "test",
      store,
    });

    assertSummary(result, {
      emailVerificationTokensDeleted: 3,
      passwordResetTokensDeleted: 3,
      mobileOtpChallengesDeleted: 3,
      revokedSessionsDeleted: 2,
      expiredSessionsDeleted: 1,
      totalDeleted: 12,
    });
    assert.deepEqual(
      state.emailVerificationTokens.map((record) => record.id),
      ["email-active", "email-expired-recent", "email-consumed-recent"],
    );
    assert.deepEqual(
      state.passwordResetTokens.map((record) => record.id),
      ["reset-active", "reset-expired-recent", "reset-consumed-recent"],
    );
    assert.deepEqual(
      state.mobileOtpChallenges.map((record) => record.id),
      ["otp-active", "otp-expired-recent", "otp-consumed-recent"],
    );
    assert.deepEqual(
      state.sessions.map((record) => record.id),
      ["session-active", "session-revoked-recent", "session-expired-recent"],
    );
    assert.deepEqual(state.logs[0], {
      trigger: "test",
      cleanupCadence: "hourly",
      executedAt: now.toISOString(),
      emailVerificationTokensDeleted: 3,
      passwordResetTokensDeleted: 3,
      mobileOtpChallengesDeleted: 3,
      revokedSessionsDeleted: 2,
      expiredSessionsDeleted: 1,
      totalDeleted: 12,
    });
  });

  it("is idempotent after stale rows are removed", async () => {
    const { now, store, service } = createCleanupHarness();

    await service.cleanupArtifacts({
      now,
      trigger: "test",
      store,
    });

    const secondResult = await service.cleanupArtifacts({
      now,
      trigger: "test",
      store,
    });

    assertSummary(secondResult, {
      emailVerificationTokensDeleted: 0,
      passwordResetTokensDeleted: 0,
      mobileOtpChallengesDeleted: 0,
      revokedSessionsDeleted: 0,
      expiredSessionsDeleted: 0,
      totalDeleted: 0,
    });
  });
});