import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { ForbiddenException } from "@nestjs/common";

import { VerificationPolicyService } from "../src/modules/auth/verification-policy.service";

describe("VerificationPolicyService", () => {
  it("tracks blocked actions with missing trust factors", async () => {
    const tracked: Array<Record<string, unknown>> = [];
    const service = new VerificationPolicyService(
      {
        user: {
          findUnique: async () => ({
            id: "user-1",
            isVerified: false,
          }),
        },
      } as any,
      {
        trackVerificationBlockedAction: async (payload: Record<string, unknown>) => {
          tracked.push(payload);
          return true;
        },
      } as any,
    );

    await assert.rejects(
      () => service.assertUserMeetsRequirement("user-1", "join_event"),
      (error: unknown) => {
        assert.ok(error instanceof ForbiddenException);
        assert.equal(
          error.message,
          "Verify your email before joining Dotly event networking. Check your inbox for the verification link, or resend it.",
        );
        return true;
      },
    );

    assert.deepEqual(tracked[0], {
      actorUserId: "user-1",
      requirement: "join_event",
      allowedFactors: ["email_verified", "mobile_otp_verified"],
      missingFactors: ["email_verified", "mobile_otp_verified"],
    });
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
      } as any,
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
    ]);
    assert.deepEqual(result.missingFactors, ["mobile_otp_verified"]);
  });
});