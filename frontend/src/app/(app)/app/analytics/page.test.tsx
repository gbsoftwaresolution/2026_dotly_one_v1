import React from "react";

import { describe, expect, it, vi } from "vitest";

import { routes } from "@/lib/constants/routes";

const mocks = vi.hoisted(() => ({
  requireServerSession: vi.fn(),
}));

vi.mock("@/lib/auth/protected-route", () => ({
  requireServerSession: mocks.requireServerSession,
}));

vi.mock("@/components/analytics/analytics-screen", () => ({
  AnalyticsScreen: () => React.createElement("div", null, "AnalyticsScreen"),
}));

vi.mock("@/components/shared/page-header", () => ({
  PageHeader: ({ title }: { title: string }) =>
    React.createElement("div", null, title),
}));

import AnalyticsPage from "./page";

describe("AnalyticsPage", () => {
  it("requires the protected session before rendering", async () => {
    mocks.requireServerSession.mockResolvedValue({ accessToken: "token" });

    const element = await AnalyticsPage();

    expect(mocks.requireServerSession).toHaveBeenCalledWith(routes.app.analytics);
    expect(element).toBeTruthy();
  });
});