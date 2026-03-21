import React from "react";

import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireServerSession: vi.fn(),
  listPersonas: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("@/lib/auth/protected-route", () => ({
  requireServerSession: mocks.requireServerSession,
}));

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<object>("@/lib/api");

  return {
    ...actual,
    personaApi: {
      list: mocks.listPersonas,
    },
  };
});

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

vi.mock("@/components/qr/qr-generator-panel", () => ({
  QrGeneratorPanel: () => React.createElement("div", null, "QrGeneratorPanel"),
}));

vi.mock("@/components/shared/empty-state", () => ({
  EmptyState: ({ title }: { title: string }) =>
    React.createElement("div", null, title),
}));

vi.mock("@/components/shared/secondary-button", () => ({
  SecondaryButton: ({ children }: { children: React.ReactNode }) =>
    React.createElement("button", null, children),
}));

import { ApiError } from "@/lib/api/client";

import QrPage from "./page";

describe("QrPage", () => {
  it("requires the protected session and loads personas", async () => {
    mocks.requireServerSession.mockResolvedValue({ accessToken: "token" });
    mocks.listPersonas.mockResolvedValue([]);

    const element = await QrPage();

    expect(mocks.requireServerSession).toHaveBeenCalledWith("/app/qr");
    expect(mocks.listPersonas).toHaveBeenCalledWith("token");
    expect(element).toBeTruthy();
  });

  it("redirects expired sessions back to login", async () => {
    mocks.requireServerSession.mockResolvedValue({ accessToken: "token" });
    mocks.listPersonas.mockRejectedValue(
      new ApiError("Unauthorized", 401, { message: "Unauthorized" }),
    );

    await QrPage();

    expect(mocks.redirect).toHaveBeenCalledWith(
      "/login?next=/app/qr&reason=expired",
    );
  });
});
