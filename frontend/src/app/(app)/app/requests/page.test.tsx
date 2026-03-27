import React from "react";

import { describe, expect, it, vi } from "vitest";

import { routes } from "@/lib/constants/routes";

const mocks = vi.hoisted(() => ({
  requireServerSession: vi.fn(),
}));

vi.mock("@/lib/auth/protected-route", () => ({
  requireServerSession: mocks.requireServerSession,
}));

vi.mock("@/components/requests/requests-screen", () => ({
  RequestsScreen: () => React.createElement("div", null, "RequestsScreen"),
}));

vi.mock("@/components/shared/page-header", () => ({
  PageHeader: ({ title }: { title: string }) =>
    React.createElement("div", null, title),
}));

import RequestsPage from "./page";

describe("AppRequestsPage", () => {
  it("requires the protected session before rendering the app route", async () => {
    mocks.requireServerSession.mockResolvedValue({ accessToken: "token" });

    const element = await RequestsPage();

    expect(mocks.requireServerSession).toHaveBeenCalledWith(
      routes.app.requests,
    );
    expect(element).toBeTruthy();
  });
});