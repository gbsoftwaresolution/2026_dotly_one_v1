import React from "react";

import { describe, expect, it, vi } from "vitest";

import { routes } from "@/lib/constants/routes";

const mocks = vi.hoisted(() => ({
  requireServerSession: vi.fn(),
  meAnalytics: vi.fn(),
}));

vi.mock("@/lib/auth/protected-route", () => ({
  requireServerSession: mocks.requireServerSession,
}));

vi.mock("@/lib/api/user-api", () => ({
  userApi: {
    meAnalytics: mocks.meAnalytics,
  },
}));

vi.mock("@/components/shared/page-header", () => ({
  PageHeader: ({ title }: { title: string }) =>
    React.createElement("div", null, title),
}));

vi.mock("@/components/settings/account-security-settings", () => ({
  AccountSecuritySettings: () =>
    React.createElement("div", null, "security-settings"),
}));

vi.mock("@/components/app-shell/theme-switcher", () => ({
  ThemeSwitcher: () => React.createElement("div", null, "theme-switcher"),
}));

vi.mock("@/components/analytics/connection-progress-note", () => ({
  ConnectionProgressNote: ({
    analytics,
  }: {
    analytics?: {
      totalConnections: number;
      connectionsThisMonth: number;
    } | null;
  }) =>
    React.createElement(
      "div",
      null,
      `connections:${analytics?.totalConnections ?? 0}:month:${analytics?.connectionsThisMonth ?? 0}`,
    ),
}));

import SettingsPage from "./page";

describe("SettingsPage", () => {
  it("loads connection progress for the new /app settings surface", async () => {
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
    mocks.meAnalytics.mockResolvedValue({
      totalConnections: 24,
      connectionsThisMonth: 5,
    });

    const element = await SettingsPage();

    expect(mocks.requireServerSession).toHaveBeenCalledWith(routes.app.settings);
    expect(mocks.meAnalytics).toHaveBeenCalledWith("token");
    expect(JSON.stringify(element)).toContain('"totalConnections":24');
    expect(JSON.stringify(element)).toContain('"connectionsThisMonth":5');
  });
});