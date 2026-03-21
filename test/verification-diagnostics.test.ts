import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { VerificationDiagnosticsService } from "../src/modules/auth/verification-diagnostics.service";

describe("VerificationDiagnosticsService", () => {
  it("returns verification runtime diagnostics with token metrics", async () => {
    const service = new VerificationDiagnosticsService(
      {
        getAppliedMigrationNames: async () => [
          "20260321121500_phase1_email_verification_hardening",
        ],
        tableExists: async () => true,
        emailVerificationToken: {
          count: async ({ where }: { where: Record<string, unknown> }) => {
            if (where.createdAt) {
              return 7;
            }

            if (where.consumedAt) {
              return 4;
            }

            return 3;
          },
        },
      } as any,
      {
        getConfigurationStatus: () => ({
          configured: true,
          missingSettings: [],
        }),
      } as any,
      {
        getAvailableTrustFactors: () => [
          {
            factor: "email_verified",
            available: true,
            source: "email",
          },
          {
            factor: "mobile_otp_verified",
            available: false,
            source: "mobile_otp",
          },
        ],
        getRequirementCatalog: () => ({
          create_event: {
            label: "Create trust-based events",
            anyOf: ["email_verified", "mobile_otp_verified"],
            message:
              "Verify your email before creating trust-based events. Check your inbox for the verification link, or resend it.",
          },
        }),
      } as any,
    );

    const diagnostics = await service.getRuntimeDiagnostics();

    assert.equal(diagnostics.status, "degraded");
    assert.equal(diagnostics.mailConfigured, true);
    assert.equal(diagnostics.emailVerificationTableExists, true);
    assert.deepEqual(diagnostics.missingRequiredMigrations, [
      "20260321123805_phase10_verification_followups",
    ]);
    assert.deepEqual(diagnostics.tokenMetrics, {
      activeTokens: 3,
      issuedLast24Hours: 7,
      consumedLast24Hours: 4,
    });
    assert.equal(diagnostics.requirements[0]?.requirement, "create_event");
  });
});