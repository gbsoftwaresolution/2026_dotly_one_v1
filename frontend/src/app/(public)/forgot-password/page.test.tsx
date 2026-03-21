import React from "react";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  forgotPassword: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  authApi: {
    forgotPassword: mocks.forgotPassword,
  },
}));

import { ApiError } from "@/lib/api/client";

import ForgotPasswordPage from "./page";

describe("ForgotPasswordPage", () => {
  beforeEach(() => {
    mocks.forgotPassword.mockReset();
  });

  it("shows the generic success message after submission", async () => {
    mocks.forgotPassword.mockResolvedValue({
      accepted: true,
      resetEmailSent: true,
    });

    const user = userEvent.setup();
    render(React.createElement(ForgotPasswordPage));

    await user.type(screen.getByLabelText(/email address/i), "User@Dotly.one");
    await user.click(screen.getByRole("button", { name: /send reset link/i }));

    await waitFor(() => {
      expect(mocks.forgotPassword).toHaveBeenCalledWith({
        email: "user@dotly.one",
      });
    });

    expect(
      screen.getByText(/if that address belongs to a dotly account, a reset link is on the way/i),
    ).toBeInTheDocument();
  });

  it("shows a dedicated rate-limit warning", async () => {
    mocks.forgotPassword.mockRejectedValue(
      new ApiError("Please wait before requesting another password reset email.", 429),
    );

    const user = userEvent.setup();
    render(React.createElement(ForgotPasswordPage));

    await user.type(screen.getByLabelText(/email address/i), "user@dotly.one");
    await user.click(screen.getByRole("button", { name: /send reset link/i }));

    expect(
      await screen.findByText(/too many reset requests for this address right now/i),
    ).toBeInTheDocument();
  });
});