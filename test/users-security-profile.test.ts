import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { UsersService } from "../src/modules/users/users.service";

describe("UsersService security profile", () => {
  it("returns trust and verification metadata for the authenticated user", async () => {
    const service = new UsersService(
      {
        user: {
          findUnique: async () => ({
            id: "user-1",
            email: "user@dotly.one",
            isVerified: false,
          }),
        },
        mobileOtpChallenge: {
          findFirst: async () => null,
        },
        passkeyCredential: {
          count: async () => 0,
        },
      } as any,
      {
        isConfigured: () => false,
        isEmailVerificationConfigured: () => false,
      } as any,
      {
        isConfigured: () => false,
      } as any,
      {
        getRequirementCatalog: () => ({
          send_contact_request: {
            label: "Send contact requests",
            anyOf: [
              "email_verified",
              "mobile_otp_verified",
              "passkey_verified",
            ],
          },
          create_event: {
            label: "Create trust-based events",
            anyOf: [
              "email_verified",
              "mobile_otp_verified",
              "passkey_verified",
            ],
          },
        }),
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
          {
            factor: "passkey_verified",
            available: true,
            source: "passkey",
          },
        ],
      } as any,
      {} as any,
    );

    const result = await service.getCurrentUser("user-1");

    assert.equal(result.email, "user@dotly.one");
    assert.equal(result.security.trustBadge, "attention");
    assert.equal(result.security.maskedEmail, "us**@dotly.one");
    assert.equal(result.security.mailDeliveryAvailable, false);
    assert.equal(result.security.mobileOtpEnrollment, null);
    assert.deepEqual(result.activation, {
      milestones: {
        firstPersonaCreatedAt: null,
        firstQrOpenedAt: null,
        firstShareCompletedAt: null,
        firstRequestReceivedAt: null,
      },
      completedCount: 0,
      nextMilestoneKey: "firstPersonaCreated",
      firstResponseNudge: null,
    });
    assert.deepEqual(result.security.unlockedActions, []);
    assert.deepEqual(result.security.restrictedActions, [
      "Send contact requests",
      "Create trust-based events",
    ]);
    assert.deepEqual(result.security.trustFactors, [
      {
        key: "email_verified",
        label: "Email verified",
        status: "inactive",
        description:
          "Email verification is the first trust factor for your Dotly identity and unlocks current trust-sensitive actions.",
      },
      {
        key: "mobile_otp_verified",
        label: "Mobile OTP verified",
        status: "planned",
        description:
          "Verify a mobile number to add a second live trust factor for step-up account protection and future phone-based sign-in.",
      },
      {
        key: "passkey_verified",
        label: "Passkey added",
        status: "inactive",
        description:
          "Add a passkey for phishing-resistant sign-in and a stronger device-bound trust factor on this account.",
      },
    ]);
  });

  it("derives unlocked actions only from runtime verification-policy factors", async () => {
    const service = new UsersService(
      {
        user: {
          findUnique: async () => ({
            id: "user-1",
            email: "user@dotly.one",
            isVerified: false,
            phoneNumber: null,
            pendingPhoneNumber: null,
            phoneVerifiedAt: new Date("2026-03-23T10:00:00.000Z"),
          }),
        },
        mobileOtpChallenge: {
          findFirst: async () => null,
        },
        passkeyCredential: {
          count: async () => 1,
        },
      } as any,
      {
        isConfigured: () => false,
        isEmailVerificationConfigured: () => false,
      } as any,
      {
        isConfigured: () => false,
      } as any,
      {
        getRequirementCatalog: () => ({
          send_contact_request: {
            label: "Send contact requests",
            anyOf: [
              "email_verified",
              "mobile_otp_verified",
              "passkey_verified",
            ],
          },
        }),
        getAvailableTrustFactors: () => [
          {
            factor: "email_verified",
            available: true,
            source: "email",
          },
          {
            factor: "mobile_otp_verified",
            available: true,
            source: "mobile_otp",
          },
          {
            factor: "passkey_verified",
            available: true,
            source: "passkey",
          },
        ],
      } as any,
      {} as any,
    );

    const result = await service.getCurrentUser("user-1");

    assert.equal(result.security.trustBadge, "verified");
    assert.deepEqual(result.security.unlockedActions, [
      "Send contact requests",
    ]);
    assert.deepEqual(result.security.restrictedActions, []);
  });

  it("returns the current user's referral code for sharing", async () => {
    const service = new UsersService(
      {
        user: {
          findUnique: async ({ select }: any) => {
            if (select?.referralCode) {
              return {
                id: "user-1",
                referralCode: "SHARECODE1",
              };
            }

            return {
              id: "user-1",
              email: "user@dotly.one",
              isVerified: false,
              phoneNumber: null,
              pendingPhoneNumber: null,
              phoneVerifiedAt: null,
            };
          },
        },
        mobileOtpChallenge: {
          findFirst: async () => null,
        },
        passkeyCredential: {
          count: async () => 0,
        },
      } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    const result = await service.getCurrentUserReferral("user-1");

    assert.deepEqual(result, {
      id: "user-1",
      referralCode: "SHARECODE1",
    });
  });

  it("delegates authenticated resend requests to AuthService", async () => {
    const calls: string[] = [];
    const service = new UsersService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {
        resendVerificationEmailForCurrentUser: async (userId: string) => {
          calls.push(userId);
          return { accepted: true };
        },
      } as any,
    );

    const result = await service.resendVerificationEmail("user-42");

    assert.deepEqual(calls, ["user-42"]);
    assert.deepEqual(result, { accepted: true });
  });
});
