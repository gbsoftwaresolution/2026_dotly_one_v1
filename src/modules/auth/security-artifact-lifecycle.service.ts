import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

import { PrismaService } from "../../infrastructure/database/prisma.service";
import { AppLoggerService } from "../../infrastructure/logging/logging.service";

import {
  SECURITY_ARTIFACT_RETENTION_POLICY,
  buildExpiredSessionCleanupWhere,
  buildRevokedSessionCleanupWhere,
  buildTokenCleanupWhere,
} from "./security-artifact-retention.policy";

type SecurityArtifactCleanupStore = {
  emailVerificationToken: {
    deleteMany: (args: any) => Promise<{ count: number }>;
  };
  passwordResetToken: {
    deleteMany: (args: any) => Promise<{ count: number }>;
  };
  mobileOtpChallenge: {
    deleteMany: (args: any) => Promise<{ count: number }>;
  };
  passkeyChallenge: {
    deleteMany: (args: any) => Promise<{ count: number }>;
  };
  authSession: {
    deleteMany: (args: any) => Promise<{ count: number }>;
  };
};

export type SecurityArtifactCleanupSummary = {
  emailVerificationTokensDeleted: number;
  passwordResetTokensDeleted: number;
  mobileOtpChallengesDeleted: number;
  passkeyChallengesDeleted: number;
  revokedSessionsDeleted: number;
  expiredSessionsDeleted: number;
  totalDeleted: number;
};

@Injectable()
export class SecurityArtifactLifecycleService {
  static readonly cleanupJobName = "security-artifact-cleanup";

  constructor(
    private readonly prismaService: PrismaService,
    private readonly logger: AppLoggerService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR, {
    name: SecurityArtifactLifecycleService.cleanupJobName,
  })
  async pruneSecurityArtifacts() {
    await this.cleanupArtifacts({ trigger: "scheduled" });
  }

  async cleanupArtifacts(options?: {
    now?: Date;
    trigger?: "scheduled" | "manual" | "test";
    store?: SecurityArtifactCleanupStore;
  }): Promise<SecurityArtifactCleanupSummary> {
    const now = options?.now ?? new Date();
    const trigger = options?.trigger ?? "manual";
    const store = this.getStore(options?.store);

    const [
      emailVerificationTokensDeleted,
      passwordResetTokensDeleted,
      mobileOtpChallengesDeleted,
      passkeyChallengesDeleted,
      revokedSessionsDeleted,
      expiredSessionsDeleted,
    ] = await Promise.all([
      store.emailVerificationToken
        .deleteMany({
          where: buildTokenCleanupWhere(
            now,
            SECURITY_ARTIFACT_RETENTION_POLICY.emailVerificationTokens,
          ),
        })
        .then((result) => result.count),
      store.passwordResetToken
        .deleteMany({
          where: buildTokenCleanupWhere(
            now,
            SECURITY_ARTIFACT_RETENTION_POLICY.passwordResetTokens,
          ),
        })
        .then((result) => result.count),
      store.mobileOtpChallenge
        .deleteMany({
          where: buildTokenCleanupWhere(
            now,
            SECURITY_ARTIFACT_RETENTION_POLICY.mobileOtpChallenges,
          ),
        })
        .then((result) => result.count),
      store.passkeyChallenge
        .deleteMany({
          where: buildTokenCleanupWhere(
            now,
            SECURITY_ARTIFACT_RETENTION_POLICY.passkeyChallenges,
          ),
        })
        .then((result) => result.count),
      store.authSession
        .deleteMany({
          where: buildRevokedSessionCleanupWhere(
            now,
            SECURITY_ARTIFACT_RETENTION_POLICY.authSessions,
          ),
        })
        .then((result) => result.count),
      store.authSession
        .deleteMany({
          where: buildExpiredSessionCleanupWhere(
            now,
            SECURITY_ARTIFACT_RETENTION_POLICY.authSessions,
          ),
        })
        .then((result) => result.count),
    ]);

    const summary = {
      emailVerificationTokensDeleted,
      passwordResetTokensDeleted,
      mobileOtpChallengesDeleted,
      passkeyChallengesDeleted,
      revokedSessionsDeleted,
      expiredSessionsDeleted,
      totalDeleted:
        emailVerificationTokensDeleted +
        passwordResetTokensDeleted +
        mobileOtpChallengesDeleted +
        passkeyChallengesDeleted +
        revokedSessionsDeleted +
        expiredSessionsDeleted,
    } satisfies SecurityArtifactCleanupSummary;

    this.logger.logWithMeta(
      "log",
      "Security artifact cleanup completed",
      {
        trigger,
        cleanupCadence: SECURITY_ARTIFACT_RETENTION_POLICY.cleanupCadence,
        executedAt: now.toISOString(),
        ...summary,
      },
      "SecurityArtifactLifecycleService",
    );

    return summary;
  }

  private getStore(
    store?: SecurityArtifactCleanupStore,
  ): SecurityArtifactCleanupStore {
    return (
      store ?? (this.prismaService as unknown as SecurityArtifactCleanupStore)
    );
  }
}
