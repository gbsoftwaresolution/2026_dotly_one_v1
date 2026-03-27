import React from "react";

import { describe, expect, it, vi } from "vitest";

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

describe("RequestsPage", () => {
  it("requires the protected session before rendering", async () => {
    mocks.requireServerSession.mockResolvedValue({ accessToken: "token" });

    const element = await RequestsPage();

    expect(mocks.requireServerSession).toHaveBeenCalledWith("/app-old/requests");
    expect(element).toBeTruthy();
  });
});
