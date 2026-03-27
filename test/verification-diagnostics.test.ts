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
          verificationConfigured: true,
          passwordResetConfigured: true,
          missingSettings: [],
        }),
      } as any,
      {
        getConfigurationStatus: () => ({
          configured: false,
          missingSettings: ["TWILIO_AUTH_TOKEN"],
        }),
      } as any,
      {
        get: (key: string) => {
          if (key === "app.nodeEnv") {
            return "staging";
          }

          if (key === "webauthn.rpId") {
            return "app.dotly.one";
          }

          if (key === "webauthn.origins") {
            return ["https://app.dotly.one"];
          }

          return undefined;
        },
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
              "Verify your email or complete mobile OTP before creating trust-based events.",
          },
        }),
      } as any,
    );

    const diagnostics = await service.getRuntimeDiagnostics();

    assert.equal(diagnostics.status, "degraded");
    assert.equal(diagnostics.environment, "staging");
    assert.equal(diagnostics.mailConfigured, true);
    assert.equal(diagnostics.passwordResetConfigured, true);
    assert.equal(diagnostics.smsConfigured, false);
    assert.equal(diagnostics.webauthnConfigured, true);
    assert.equal(diagnostics.emailVerificationTableExists, true);
    assert.equal(diagnostics.verificationDependenciesOperational, false);
    assert.deepEqual(diagnostics.missingRequiredMigrations, [
      "20260321123805_phase10_verification_followups",
    ]);
    assert.deepEqual(diagnostics.missingSmsSettings, ["TWILIO_AUTH_TOKEN"]);
    assert.deepEqual(diagnostics.tokenMetrics, {
      activeTokens: 3,
      issuedLast24Hours: 7,
      consumedLast24Hours: 4,
    });
    assert.equal(diagnostics.requirements[0]?.requirement, "create_event");
  });
});
