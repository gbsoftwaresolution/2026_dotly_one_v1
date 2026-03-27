import React from "react";

import { describe, expect, it, vi } from "vitest";
import { routes } from "@/lib/constants/routes";

const mocks = vi.hoisted(() => ({
  requireServerSession: vi.fn(),
  getMyFastShare: vi.fn(),
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
    meAnalytics: mocks.meAnalytics,
  },
}));

vi.mock("@/components/share/instant-share-experience", () => ({
  InstantShareExperience: ({
    initialUser,
    initialAnalytics,
  }: {
    initialUser: { email: string };
    initialAnalytics?: { totalConnections: number } | null;
  }) =>
    React.createElement(
      "div",
      null,
      `${initialUser.email}:${initialAnalytics?.totalConnections ?? 0}`,
    ),
}));

import QrPage from "./page";

describe("QrPage", () => {
  it("requires the protected session and passes the current user to the client share experience", async () => {
    mocks.getMyFastShare.mockResolvedValue(null);
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
    expect(mocks.meAnalytics).toHaveBeenCalledWith("token");
    expect(element).toBeTruthy();
    expect(JSON.stringify(element)).toContain("user@dotly.one");
    expect(JSON.stringify(element)).toContain('"totalConnections":24');
  });
});
