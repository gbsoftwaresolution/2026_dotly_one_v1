import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../infrastructure/database/prisma.service";
import { MailService } from "../../infrastructure/mail/mail.service";

import {
  TrustFactor,
  VerificationPolicyService,
  VerificationRequirement,
} from "./verification-policy.service";

const REQUIRED_VERIFICATION_MIGRATION_NAMES = [
  "20260321121500_phase1_email_verification_hardening",
  "20260321123805_phase10_verification_followups",
] as const;

export interface VerificationRuntimeDiagnostics extends Record<string, unknown> {
  status: "ok" | "degraded";
  mailConfigured: boolean;
  missingMailSettings: string[];
  emailVerificationTableExists: boolean;
  missingRequiredMigrations: string[];
  trustFactors: Array<{
    factor: TrustFactor;
    available: boolean;
    source: string;
  }>;
  requirements: Array<{
    requirement: VerificationRequirement;
    label: string;
    allowedFactors: TrustFactor[];
    message: string;
  }>;
  tokenMetrics: {
    activeTokens: number;
    issuedLast24Hours: number;
    consumedLast24Hours: number;
  };
}

@Injectable()
export class VerificationDiagnosticsService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly mailService: MailService,
    private readonly verificationPolicyService: VerificationPolicyService,
  ) {}

  async getRuntimeDiagnostics(): Promise<VerificationRuntimeDiagnostics> {
    const mailConfigurationStatus = this.mailService.getConfigurationStatus();
    const [appliedMigrationNames, emailVerificationTableExists] =
      await Promise.all([
        this.prismaService.getAppliedMigrationNames(),
        this.prismaService.tableExists("EmailVerificationToken"),
      ]);
    const missingRequiredMigrations = REQUIRED_VERIFICATION_MIGRATION_NAMES.filter(
      (migrationName) => !appliedMigrationNames.includes(migrationName),
    );

    let tokenMetrics = {
      activeTokens: 0,
      issuedLast24Hours: 0,
      consumedLast24Hours: 0,
    };

    if (emailVerificationTableExists) {
      const now = new Date();
      const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const [activeTokens, issuedLast24Hours, consumedLast24Hours] =
        await Promise.all([
          this.prismaService.emailVerificationToken.count({
            where: {
              consumedAt: null,
              supersededAt: null,
              expiresAt: {
                gt: now,
              },
            },
          }),
          this.prismaService.emailVerificationToken.count({
            where: {
              createdAt: {
                gte: last24Hours,
              },
            },
          }),
          this.prismaService.emailVerificationToken.count({
            where: {
              consumedAt: {
                gte: last24Hours,
              },
            },
          }),
        ]);

      tokenMetrics = {
        activeTokens,
        issuedLast24Hours,
        consumedLast24Hours,
      };
    }

    const trustFactors = this.verificationPolicyService.getAvailableTrustFactors();
    const requirements = Object.entries(
      this.verificationPolicyService.getRequirementCatalog(),
    ).map(([requirement, definition]) => ({
      requirement: requirement as VerificationRequirement,
      label: definition.label,
      allowedFactors: definition.anyOf,
      message: definition.message,
    }));

    return {
      status:
        mailConfigurationStatus.configured &&
        emailVerificationTableExists &&
        missingRequiredMigrations.length === 0
          ? "ok"
          : "degraded",
      mailConfigured: mailConfigurationStatus.configured,
      missingMailSettings: mailConfigurationStatus.missingSettings,
      emailVerificationTableExists,
      missingRequiredMigrations,
      trustFactors,
      requirements,
      tokenMetrics,
    };
  }
}