import React from "react";

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { routes } from "@/lib/constants/routes";

const mocks = vi.hoisted(() => ({
  loginAuthPanel: vi.fn(),
  resetSessionOnLoad: vi.fn(),
}));

vi.mock("@/components/auth/login-auth-panel", () => ({
  LoginAuthPanel: (props: {
    redirectTo?: string;
    initialEmail?: string;
    shouldPromptPasskeyEnrollment?: boolean;
  }) => {
    mocks.loginAuthPanel(props);

    return React.createElement("div", { "data-testid": "login-auth-panel" });
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
    mocks.loginAuthPanel.mockReset();
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
      screen.getByText(
        /sign in with your password once and dotly will guide you straight into passkey setup right after/i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /resend verification/i }),
    ).toHaveAttribute("href", "/verify-email?email=new%40dotly.one");
    expect(mocks.loginAuthPanel).toHaveBeenCalledWith(
      expect.objectContaining({
        redirectTo: routes.app.home,
        initialEmail: "new@dotly.one",
        shouldPromptPasskeyEnrollment: true,
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

  it("surfaces passkey-first messaging in the hero panel", async () => {
    const page = await LoginPage({
      searchParams: Promise.resolve({}),
    });

    render(page);

    expect(screen.getByText(/passkey-first sign in/i)).toBeInTheDocument();
    expect(
      screen.getByText(
        /start with a passkey\. password sign-in stays right underneath/i,
      ),
    ).toBeInTheDocument();
  });

  it("explains the immediate passkey step after post-signup password login", async () => {
    const page = await LoginPage({
      searchParams: Promise.resolve({
        created: "1",
      }),
    });

    render(page);

    expect(
      screen.getByText(
        /if you sign in with your password today, dotly will guide you into passkey setup right after/i,
      ),
    ).toBeInTheDocument();
  });
});
