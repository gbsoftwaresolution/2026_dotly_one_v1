import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireServerSession: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("@/lib/auth/protected-route", () => ({
  requireServerSession: mocks.requireServerSession,
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

import AppHomePage from "./page";

describe("AppHomePage", () => {
  beforeEach(() => {
    mocks.requireServerSession.mockReset();
    mocks.redirect.mockReset();

    mocks.requireServerSession.mockResolvedValue({
      accessToken: "token",
      user: {
        id: "user-1",
        email: "user@dotly.one",
        isVerified: true,
      },
    });
  });

  it("redirects authenticated users straight into the QR share flow", async () => {
    await AppHomePage();

    expect(mocks.requireServerSession).toHaveBeenCalledWith("/app");
    expect(mocks.redirect).toHaveBeenCalledWith("/app/qr");
  });
});