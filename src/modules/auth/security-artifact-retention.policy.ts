const DAY_MS = 24 * 60 * 60 * 1000;

export type SecurityArtifactLifecycleState =
  | "active"
  | "expired"
  | "consumed"
  | "superseded"
  | "revoked";

type TokenRetentionPolicy = {
  expiredMs: number;
  consumedMs: number;
  supersededMs: number;
};

type SessionRetentionPolicy = {
  revokedMs: number;
  expiredMs: number;
};

export const SECURITY_ARTIFACT_RETENTION_POLICY = {
  emailVerificationTokens: {
    expiredMs: 7 * DAY_MS,
    consumedMs: 14 * DAY_MS,
    supersededMs: 14 * DAY_MS,
  } satisfies TokenRetentionPolicy,
  passwordResetTokens: {
    expiredMs: 3 * DAY_MS,
    consumedMs: 30 * DAY_MS,
    supersededMs: 30 * DAY_MS,
  } satisfies TokenRetentionPolicy,
  mobileOtpChallenges: {
    expiredMs: 3 * DAY_MS,
    consumedMs: 3 * DAY_MS,
    supersededMs: 3 * DAY_MS,
  } satisfies TokenRetentionPolicy,
  passkeyChallenges: {
    expiredMs: 3 * DAY_MS,
    consumedMs: 3 * DAY_MS,
    supersededMs: 3 * DAY_MS,
  } satisfies TokenRetentionPolicy,
  authSessions: {
    revokedMs: 30 * DAY_MS,
    expiredMs: 7 * DAY_MS,
  } satisfies SessionRetentionPolicy,
  cleanupCadence: "hourly",
} as const;

export function buildTokenCleanupWhere(
  now: Date,
  policy: TokenRetentionPolicy,
) {
  return {
    OR: [
      {
        consumedAt: {
          lte: new Date(now.getTime() - policy.consumedMs),
        },
      },
      {
        supersededAt: {
          lte: new Date(now.getTime() - policy.supersededMs),
        },
      },
      {
        consumedAt: null,
        supersededAt: null,
        expiresAt: {
          lte: new Date(now.getTime() - policy.expiredMs),
        },
      },
    ],
  };
}

export function buildRevokedSessionCleanupWhere(
  now: Date,
  policy: SessionRetentionPolicy,
) {
  return {
    revokedAt: {
      lte: new Date(now.getTime() - policy.revokedMs),
    },
  };
}

export function buildExpiredSessionCleanupWhere(
  now: Date,
  policy: SessionRetentionPolicy,
) {
  return {
    revokedAt: null,
    expiresAt: {
      lte: new Date(now.getTime() - policy.expiredMs),
    },
  };
}
