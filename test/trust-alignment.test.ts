import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { ForbiddenException } from "@nestjs/common";

import { ProfilesService } from "../src/modules/profiles/profiles.service";
import { VerificationPolicyService } from "../src/modules/auth/verification-policy.service";

describe("Trust alignment", () => {
  it("verification policy ignores stale persona trust fields and gates on runtime user factors", async () => {
    const service = new VerificationPolicyService(
      {
        user: {
          findUnique: async () => ({
            id: "user-1",
            isVerified: false,
            phoneVerifiedAt: null,
          }),
        },
      } as any,
      undefined as any,
      undefined as any,
    );

    await assert.rejects(
      service.assertUserMeetsRequirement("user-1", "send_contact_request"),
      (error: unknown) => {
        assert.ok(error instanceof ForbiddenException);
        assert.equal(
          error.message,
          "Verify your email or complete mobile OTP before sending connection requests.",
        );
        return true;
      },
    );
  });

  it("public profile trust output reflects synchronized persona trust fields", async () => {
    const service = new ProfilesService(
      {
        persona: {
          findFirst: async () => ({
            id: "persona-id",
            username: "alice",
            publicUrl: "https://dotly.id/alice",
            fullName: "Alice Demo",
            jobTitle: "Founder",
            companyName: "Dotly",
            tagline: "Connect fast",
            profilePhotoUrl: null,
            accessMode: "OPEN",
            verifiedOnly: true,
            sharingMode: "SMART_CARD",
            emailVerified: true,
            phoneVerified: true,
            businessVerified: true,
            trustScore: 100,
            smartCardConfig: {
              primaryAction: "request_access",
              allowWhatsapp: true,
            },
            publicPhone: null,
            publicWhatsappNumber: "+15551234567",
            publicEmail: null,
          }),
        },
      } as any,
      {
        trackProfileView: async () => true,
      } as any,
    );

    const result = await service.getPublicProfile("alice");

    assert.deepEqual(result.trust, {
      isVerified: true,
      isStrongVerified: true,
      isBusinessVerified: true,
    });
  });
});
