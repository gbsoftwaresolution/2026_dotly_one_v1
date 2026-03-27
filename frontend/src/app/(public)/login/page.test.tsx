import React from "react";

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { routes } from "@/lib/constants/routes";

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
      screen.getByText(
        /check your inbox, including spam, for your confirmation email/i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /resend verification/i }),
    ).toHaveAttribute("href", "/verify-email?email=new%40dotly.one");
    expect(mocks.authForm).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "login",
        redirectTo: routes.app.home,
        initialEmail: "new@dotly.one",
      }),
    );
  });

  it("shows the password reset completion banner", async () => {
    const page = await LoginPage({
      searchParams: Promise.resolve({
        reason: "password-reset",
      }),
    });

    render(page);

    expect(
      screen.getByText(
        /password reset complete\. sign in with your new password\./i,
      ),
    ).toBeInTheDocument();
    expect(mocks.resetSessionOnLoad).toHaveBeenCalledWith(false);
  });
});
