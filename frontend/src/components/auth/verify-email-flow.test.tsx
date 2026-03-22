import React from "react";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  verifyEmail: vi.fn(),
  resendVerificationEmail: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  authApi: {
    verifyEmail: mocks.verifyEmail,
    resendVerificationEmail: mocks.resendVerificationEmail,
  },
}));

import { ApiError } from "@/lib/api/client";

import { VerifyEmailFlow } from "./verify-email-flow";

describe("VerifyEmailFlow", () => {
  beforeEach(() => {
    mocks.verifyEmail.mockReset();
    mocks.resendVerificationEmail.mockReset();
  });

  it("shows a success state after verifying a valid token", async () => {
    mocks.verifyEmail.mockResolvedValue({
      verified: true,
      alreadyVerified: false,
      user: {
        id: "user-1",
        email: "user@dotly.one",
        isVerified: true,
      },
    });

    render(
      React.createElement(VerifyEmailFlow, {
        initialToken: "valid-token",
      }),
    );

    expect(screen.getByText(/verifying your email/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/email verified/i)).toBeInTheDocument();
    });

    expect(
      screen.getByRole("link", { name: /open dotly/i }),
    ).toHaveAttribute("href", "/login?email=user%40dotly.one&verified=1");
  });

  it("shows the expired state and resend form when verification fails", async () => {
    mocks.verifyEmail.mockRejectedValue(
      new ApiError("Verification link is invalid or expired", 400, {
        message: "Verification link is invalid or expired",
      }),
    );

    render(
      React.createElement(VerifyEmailFlow, {
        initialToken: "expired-token",
      }),
    );

    await waitFor(() => {
      expect(
        screen.getByText(/this link is invalid or expired/i),
      ).toBeInTheDocument();
    });

    expect(
      screen.getByRole("button", { name: /resend link/i }),
    ).toBeInTheDocument();
  });

  it("resends a verification link from the fallback form", async () => {
    mocks.resendVerificationEmail.mockResolvedValue({
      accepted: true,
      verificationPending: true,
      verificationEmailSent: true,
    });

    const user = userEvent.setup();

    render(
      React.createElement(VerifyEmailFlow, {
        initialEmail: "user@dotly.one",
      }),
    );

    await user.clear(screen.getByLabelText(/email/i));
    await user.type(screen.getByLabelText(/email/i), "user@dotly.one");
    await user.click(screen.getByRole("button", { name: /resend link/i }));

    await waitFor(() => {
      expect(mocks.resendVerificationEmail).toHaveBeenCalledWith({
        email: "user@dotly.one",
      });
    });

    expect(
      screen.getByText(/a new link is on the way/i),
    ).toBeInTheDocument();
  });

  it("shows cooldown feedback when resending too quickly", async () => {
    mocks.resendVerificationEmail.mockRejectedValue(
      new ApiError("Please wait before requesting another verification email", 429, {
        message: "Please wait before requesting another verification email",
      }),
    );

    const user = userEvent.setup();

    render(
      React.createElement(VerifyEmailFlow, {
        initialEmail: "user@dotly.one",
      }),
    );

    await user.click(screen.getByRole("button", { name: /resend link/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/please wait a minute before asking for another verification email/i),
      ).toBeInTheDocument();
    });
  });
});