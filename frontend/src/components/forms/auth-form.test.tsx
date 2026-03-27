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
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mocks.push,
    replace: mocks.replace,
    refresh: mocks.refresh,
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
});
