import React from "react";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useAuthState: vi.fn(),
  resendVerificationEmail: vi.fn(),
}));

vi.mock("@/hooks/use-auth-state", () => ({
  useAuthState: mocks.useAuthState,
}));

vi.mock("@/lib/api", () => ({
  authApi: {
    resendVerificationEmail: mocks.resendVerificationEmail,
  },
}));

import { ApiError } from "@/lib/api/client";

import { EmailVerificationBanner } from "./email-verification-banner";

describe("EmailVerificationBanner", () => {
  beforeEach(() => {
    mocks.useAuthState.mockReset();
    mocks.resendVerificationEmail.mockReset();
  });

  it("renders the unverified banner with badge", () => {
    mocks.useAuthState.mockReturnValue({
      isLoading: false,
      isAuthenticated: true,
      user: {
        id: "user-1",
        email: "user@dotly.one",
        isVerified: false,
        security: {
          requirements: [],
        },
      },
    });

    render(React.createElement(EmailVerificationBanner));

    expect(
      screen.getByText(/add a trust factor to unlock trust actions/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/email unverified/i)).toBeInTheDocument();
  });

  it("shows cooldown feedback when resend is rate limited", async () => {
    mocks.useAuthState.mockReturnValue({
      isLoading: false,
      isAuthenticated: true,
      user: {
        id: "user-1",
        email: "user@dotly.one",
        isVerified: false,
        security: {
          requirements: [],
        },
      },
    });
    mocks.resendVerificationEmail.mockRejectedValue(
      new ApiError("Please wait before requesting another verification email", 429),
    );

    const user = userEvent.setup();

    render(React.createElement(EmailVerificationBanner));
    await user.click(
      screen.getByRole("button", { name: /resend verification email/i }),
    );

    await waitFor(() => {
      expect(
        screen.getByText(/you can request another verification email in about a minute/i),
      ).toBeInTheDocument();
    });
  });
});