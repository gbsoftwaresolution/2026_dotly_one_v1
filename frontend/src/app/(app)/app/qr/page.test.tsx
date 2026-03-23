import React from "react";

import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireServerSession: vi.fn(),
}));

vi.mock("@/lib/auth/protected-route", () => ({
  requireServerSession: mocks.requireServerSession,
}));

vi.mock("@/components/share/instant-share-experience", () => ({
  InstantShareExperience: ({ initialUser }: { initialUser: { email: string } }) =>
    React.createElement("div", null, initialUser.email),
}));

import QrPage from "./page";

describe("QrPage", () => {
  it("requires the protected session and passes the current user to the client share experience", async () => {
    mocks.requireServerSession.mockResolvedValue({
      accessToken: "token",
      user: {
        id: "user-1",
        email: "user@dotly.one",
        isVerified: true,
        security: {
          trustBadge: "verified",
          maskedEmail: "us**@dotly.one",
          mailDeliveryAvailable: true,
          passwordResetAvailable: true,
          smsDeliveryAvailable: true,
          maskedPhoneNumber: null,
          phoneVerificationStatus: "verified",
          mobileOtpEnrollment: null,
          explanation: "",
          unlockedActions: [],
          restrictedActions: [],
          requirements: [],
          trustFactors: [],
        },
      },
    });

    const element = await QrPage();

    expect(mocks.requireServerSession).toHaveBeenCalledWith("/app/qr");
    expect(element).toBeTruthy();
    expect(JSON.stringify(element)).toContain("user@dotly.one");
  });
});
