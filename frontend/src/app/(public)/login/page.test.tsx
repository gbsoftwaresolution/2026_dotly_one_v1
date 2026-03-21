import React from "react";

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authForm: vi.fn(),
  resetSessionOnLoad: vi.fn(),
}));

vi.mock("@/components/forms/auth-form", () => ({
  AuthForm: (props: {
    mode: "login" | "signup";
    redirectTo?: string;
    initialEmail?: string;
  }) => {
    mocks.authForm(props);

    return React.createElement("div", { "data-testid": "auth-form" });
  },
}));

vi.mock("@/components/auth/reset-session-on-load", () => ({
  ResetSessionOnLoad: ({ enabled }: { enabled: boolean }) => {
    mocks.resetSessionOnLoad(enabled);

    return React.createElement("div", { "data-testid": "reset-session" });
  },
}));

import LoginPage from "./page";

describe("LoginPage", () => {
  beforeEach(() => {
    mocks.authForm.mockReset();
    mocks.resetSessionOnLoad.mockReset();
  });

  it("shows the post-signup guidance and preserves the initial email", async () => {
    const page = await LoginPage({
      searchParams: Promise.resolve({
        email: "new@dotly.one",
        created: "1",
      }),
    });

    render(page);

    expect(
      screen.getByText(/check your inbox, including spam, for your confirmation email/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /resend verification/i }),
    ).toHaveAttribute("href", "/verify-email?email=new%40dotly.one");
    expect(mocks.authForm).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "login",
        redirectTo: "/app",
        initialEmail: "new@dotly.one",
      }),
    );
  });
});