import React from "react";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  signup: vi.fn(),
  login: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mocks.push,
    replace: mocks.replace,
    refresh: mocks.refresh,
    prefetch: mocks.prefetch,
  }),
}));

vi.mock("@/lib/api", () => ({
  authApi: {
    signup: mocks.signup,
    login: mocks.login,
  },
}));

import { ApiError } from "@/lib/api/client";
import { dotlyPositioning } from "@/lib/constants/positioning";

import { AuthForm } from "./auth-form";

describe("AuthForm", () => {
  const signupButtonLabel = new RegExp(dotlyPositioning.cta.primary, "i");

  beforeEach(() => {
    mocks.signup.mockReset();
    mocks.login.mockReset();
    mocks.push.mockReset();
    mocks.replace.mockReset();
    mocks.refresh.mockReset();
    mocks.prefetch.mockReset();
  });

  it("blocks signup when the passwords do not match", async () => {
    const user = userEvent.setup();

    render(React.createElement(AuthForm, { mode: "signup" }));

    expect(screen.getByRole("link", { name: /^terms$/i })).toHaveAttribute(
      "href",
      "/terms",
    );
    expect(
      screen.getByRole("link", { name: /privacy policy/i }),
    ).toHaveAttribute("href", "/privacy");

    await user.type(screen.getByLabelText(/email/i), "new@dotly.one");
    await user.type(screen.getByLabelText(/^password$/i), "SecurePass123!");
    await user.type(
      screen.getByLabelText(/^confirm password$/i),
      "SecurePass321!",
    );
    await user.click(screen.getByRole("button", { name: signupButtonLabel }));

    expect(
      screen.getByText(/passwords must match to continue/i),
    ).toBeInTheDocument();
    expect(mocks.signup).not.toHaveBeenCalled();
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("redirects to login with the prefilled email after signup", async () => {
    mocks.signup.mockResolvedValue({
      user: { id: "user-1", email: "new@dotly.one", isVerified: false },
      verificationPending: true,
      verificationEmailSent: true,
    });

    const user = userEvent.setup();

    render(React.createElement(AuthForm, { mode: "signup" }));

    await user.type(screen.getByLabelText(/email/i), " new@dotly.one ");
    await user.type(screen.getByLabelText(/^password$/i), "SecurePass123!");
    await user.type(
      screen.getByLabelText(/^confirm password$/i),
      "SecurePass123!",
    );
    await user.click(screen.getByRole("button", { name: signupButtonLabel }));

    await waitFor(() => {
      expect(mocks.signup).toHaveBeenCalledWith({
        email: "new@dotly.one",
        password: "SecurePass123!",
      });
    });

    expect(mocks.push).toHaveBeenCalledWith(
      "/login?email=new%40dotly.one&created=1&delivery=sent",
    );
    expect(
      screen.getByText(/verification email sent\. redirecting you to sign in/i),
    ).toBeInTheDocument();
  });

  it("includes the referral code when signup was opened from an invite link", async () => {
    mocks.signup.mockResolvedValue({
      user: { id: "user-1", email: "new@dotly.one", isVerified: false },
      verificationPending: true,
      verificationEmailSent: true,
    });

    const user = userEvent.setup();

    render(
      React.createElement(AuthForm, {
        mode: "signup",
        referralCode: "SHARECODE1",
      }),
    );

    await user.type(screen.getByLabelText(/email/i), "new@dotly.one");
    await user.type(screen.getByLabelText(/^password$/i), "SecurePass123!");
    await user.type(
      screen.getByLabelText(/^confirm password$/i),
      "SecurePass123!",
    );
    await user.click(screen.getByRole("button", { name: signupButtonLabel }));

    await waitFor(() => {
      expect(mocks.signup).toHaveBeenCalledWith({
        email: "new@dotly.one",
        password: "SecurePass123!",
        referralCode: "SHARECODE1",
      });
    });
  });

  it("shows a friendly duplicate email message", async () => {
    mocks.signup.mockRejectedValue(
      new ApiError("User already exists", 409, {
        message: "User already exists",
      }),
    );

    const user = userEvent.setup();

    render(React.createElement(AuthForm, { mode: "signup" }));

    await user.type(screen.getByLabelText(/email/i), "new@dotly.one");
    await user.type(screen.getByLabelText(/^password$/i), "SecurePass123!");
    await user.type(
      screen.getByLabelText(/^confirm password$/i),
      "SecurePass123!",
    );
    await user.click(screen.getByRole("button", { name: signupButtonLabel }));

    await waitFor(() => {
      expect(
        screen.getByText(/that email is already registered/i),
      ).toBeInTheDocument();
    });
  });

  it("renders login fallback copy when configured as collapsible", () => {
    render(
      React.createElement(AuthForm, {
        mode: "login",
        title: "Password fallback",
        description: "Use your email and password if needed.",
        collapsible: true,
        defaultExpanded: false,
      }),
    );

    expect(screen.getByText(/password fallback/i)).toBeInTheDocument();
    expect(
      screen.getByText(/use your email and password if needed/i),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument();
  });

  it("adds the one-time passkey enrollment flag after password login", async () => {
    mocks.login.mockResolvedValue({
      success: true,
      sessionId: "session-1",
    });

    const user = userEvent.setup();

    render(
      React.createElement(AuthForm, {
        mode: "login",
        redirectTo: "/app/requests?view=assigned",
        shouldPromptPasskeyEnrollment: true,
      }),
    );

    await user.type(screen.getByLabelText(/email/i), "ava@dotly.one");
    await user.type(screen.getByLabelText(/^password$/i), "SecurePass123!");
    await user.click(screen.getByRole("button", { name: /sign in to dotly/i }));

    await waitFor(() => {
      expect(mocks.login).toHaveBeenCalledWith({
        email: "ava@dotly.one",
        password: "SecurePass123!",
      });
    });

    await waitFor(() => {
      expect(mocks.replace).toHaveBeenCalledWith(
        "/app/requests?view=assigned&enrollPasskey=1",
      );
    });
  });
});
