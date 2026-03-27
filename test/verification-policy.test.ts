import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { ForbiddenException } from "@nestjs/common";

import { AuthMetricsService } from "../src/modules/auth/auth-metrics.service";
import { VerificationPolicyService } from "../src/modules/auth/verification-policy.service";

describe("VerificationPolicyService", () => {
  it("tracks blocked actions with missing trust factors", async () => {
    const tracked: Array<Record<string, unknown>> = [];
    const audits: Array<Record<string, unknown>> = [];
    const authMetricsService = new AuthMetricsService();
    const service = new VerificationPolicyService(
      {
        user: {
          findUnique: async () => ({
            id: "user-1",
            isVerified: false,
          }),
        },
        passkeyCredential: {
          count: async () => 0,
        },
      } as any,
      {
        trackVerificationBlockedAction: async (
          payload: Record<string, unknown>,
        ) => {
          tracked.push(payload);
          return true;
        },
      } as any,
      {
        log: (event: Record<string, unknown>) => {
          audits.push(event);
        },
      } as any,
      authMetricsService,
    );

    await assert.rejects(
      () => service.assertUserMeetsRequirement("user-1", "join_event"),
      (error: unknown) => {
        assert.ok(error instanceof ForbiddenException);
        assert.equal(
          error.message,
          "Verify your email, complete mobile OTP, or add a passkey before joining Dotly event networking.",
        );
        return true;
      },
    );

    assert.deepEqual(tracked[0], {
      actorUserId: "user-1",
      requirement: "join_event",
      allowedFactors: [
        "email_verified",
        "mobile_otp_verified",
        "passkey_verified",
      ],
      missingFactors: [
        "email_verified",
        "mobile_otp_verified",
        "passkey_verified",
      ],
    });
    assert.deepEqual(audits[0], {
      action: "auth.verification_requirement.enforcement",
      outcome: "blocked",
      actorUserId: "user-1",
      reason: "join_event",
      policySource: "verification_policy",
      metadata: {
        allowedFactors: [
          "email_verified",
          "mobile_otp_verified",
          "passkey_verified",
        ],
        missingFactors: [
          "email_verified",
          "mobile_otp_verified",
          "passkey_verified",
        ],
      },
    });
    assert.equal(
      authMetricsService.getCounterValue("dotly_auth_trust_blocked_total", {
        requirement: "join_event",
      }),
      1,
    );
  });

  it("reports satisfied requirements for verified accounts", async () => {
    const service = new VerificationPolicyService(
      {
        user: {
          findUnique: async () => ({
            id: "user-1",
            isVerified: true,
          }),
        },
        passkeyCredential: {
          count: async () => 0,
        },
      } as any,
      undefined as any,
      undefined as any,
    );

    const result = await service.getRequirementStatus(
      "user-1",
      "create_profile_qr",
    );

    assert.equal(result.satisfied, true);
    assert.deepEqual(result.allowedFactors, [
      "email_verified",
      "mobile_otp_verified",
      "passkey_verified",
    ]);
    assert.deepEqual(result.missingFactors, [
      "mobile_otp_verified",
      "passkey_verified",
    ]);
  });

  it("treats mobile OTP as a valid trust factor for current requirements", async () => {
    const service = new VerificationPolicyService(
      {
        user: {
          findUnique: async () => ({
            id: "user-1",
            isVerified: false,
            phoneVerifiedAt: new Date("2026-03-23T10:00:00.000Z"),
          }),
        },
        passkeyCredential: {
          count: async () => 0,
        },
      } as any,
      undefined as any,
      undefined as any,
    );

    const result = await service.getRequirementStatus(
      "user-1",
      "send_contact_request",
    );

    assert.equal(result.satisfied, true);
    assert.deepEqual(result.missingFactors, [
      "email_verified",
      "passkey_verified",
    ]);
  });

  it("applies the same trust-factor rule to instant connect", async () => {
    const service = new VerificationPolicyService(
      {
        user: {
          findUnique: async () => ({
            id: "user-1",
            isVerified: false,
            phoneVerifiedAt: new Date("2026-03-23T10:00:00.000Z"),
          }),
        },
        passkeyCredential: {
          count: async () => 0,
        },
      } as any,
      undefined as any,
      undefined as any,
    );

    const result = await service.getRequirementStatus(
      "user-1",
      "instant_connect",
    );

    assert.equal(result.satisfied, true);
    assert.equal(
      result.message,
      "Verify your email, complete mobile OTP, or add a passkey before using instant connect.",
    );
    assert.deepEqual(result.allowedFactors, [
      "email_verified",
      "mobile_otp_verified",
      "passkey_verified",
    ]);
    assert.deepEqual(result.missingFactors, [
      "email_verified",
      "passkey_verified",
    ]);
  });

  it("treats passkeys as a valid trust factor for current requirements", async () => {
    const service = new VerificationPolicyService(
      {
        user: {
          findUnique: async () => ({
            id: "user-1",
            isVerified: false,
            phoneVerifiedAt: null,
          }),
        },
        passkeyCredential: {
          count: async () => 1,
        },
      } as any,
      undefined as any,
      undefined as any,
    );

    const result = await service.getRequirementStatus(
      "user-1",
      "send_contact_request",
    );

    assert.equal(result.satisfied, true);
    assert.deepEqual(result.missingFactors, [
      "email_verified",
      "mobile_otp_verified",
    ]);
  });

  it("treats missing passkey storage as zero enrolled passkeys", async () => {
    const service = new VerificationPolicyService(
      {
        user: {
          findUnique: async () => ({
            id: "user-1",
            isVerified: true,
            phoneVerifiedAt: null,
          }),
        },
        passkeyCredential: {
          count: async () => {
            throw new Error(
              "The table `public.PasskeyCredential` does not exist in the current database.",
            );
          },
        },
      } as any,
      undefined as any,
      undefined as any,
    );

    const result = await service.getRequirementStatus(
      "user-1",
      "send_contact_request",
    );

    assert.equal(result.satisfied, true);
    assert.deepEqual(result.missingFactors, [
      "mobile_otp_verified",
      "passkey_verified",
    ]);
  });
});
