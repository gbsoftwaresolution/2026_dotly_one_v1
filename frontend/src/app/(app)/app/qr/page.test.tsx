import React from "react";

import { describe, expect, it, vi } from "vitest";

import { routes } from "@/lib/constants/routes";

const mocks = vi.hoisted(() => ({
  requireServerSession: vi.fn(),
  getMyFastShare: vi.fn(),
  meReferral: vi.fn(),
  meAnalytics: vi.fn(),
}));

vi.mock("@/lib/auth/protected-route", () => ({
  requireServerSession: mocks.requireServerSession,
}));

vi.mock("@/lib/api/persona-api", () => ({
  personaApi: {
    getMyFastShare: mocks.getMyFastShare,
  },
}));

vi.mock("@/lib/api/user-api", () => ({
  userApi: {
    meReferral: mocks.meReferral,
    meAnalytics: mocks.meAnalytics,
  },
}));

vi.mock("@/components/share/instant-share-experience", () => ({
  InstantShareExperience: ({
    initialUser,
    initialReferral,
    initialAnalytics,
  }: {
    initialUser: { email: string };
    initialReferral?: { referralCode: string } | null;
    initialAnalytics?: { totalConnections: number } | null;
  }) =>
    React.createElement(
      "div",
      null,
      `${initialUser.email}:${initialReferral?.referralCode ?? "none"}:${initialAnalytics?.totalConnections ?? 0}`,
    ),
}));

import QrPage from "./page";

describe("QrPage", () => {
  it("requires the protected session and passes the current user to the client share experience", async () => {
    mocks.getMyFastShare.mockResolvedValue(null);
    mocks.meReferral.mockResolvedValue({
      id: "user-1",
      referralCode: "SHARECODE1",
    });
    mocks.meAnalytics.mockResolvedValue({
      totalConnections: 24,
      connectionsThisMonth: 5,
    });
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

    expect(mocks.requireServerSession).toHaveBeenCalledWith(routes.app.qr);
    expect(mocks.meReferral).toHaveBeenCalledWith("token");
    expect(mocks.meAnalytics).toHaveBeenCalledWith("token");
    expect(element).toBeTruthy();
    expect(JSON.stringify(element)).toContain("user@dotly.one");
    expect(JSON.stringify(element)).toContain("SHARECODE1");
    expect(JSON.stringify(element)).toContain('"totalConnections":24');
  });
});