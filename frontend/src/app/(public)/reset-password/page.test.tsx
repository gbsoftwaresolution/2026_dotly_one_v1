import React from "react";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resetPassword: vi.fn(),
  push: vi.fn(),
  getToken: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  authApi: {
    resetPassword: mocks.resetPassword,
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mocks.push,
  }),
  useSearchParams: () => ({
    get: mocks.getToken,
  }),
}));

import { ApiError } from "@/lib/api/client";

import ResetPasswordPage from "./page";

describe("ResetPasswordPage", () => {
  beforeEach(() => {
    mocks.resetPassword.mockReset();
    mocks.push.mockReset();
    mocks.getToken.mockReset();
  });

  it("shows the invalid state when the token is missing", () => {
    mocks.getToken.mockReturnValue(null);

    render(React.createElement(ResetPasswordPage));

    expect(screen.getByText(/Invalid link\./i)).toBeInTheDocument();
    expect(
      screen.getByText(/This reset link is missing what it needs to continue/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /request another reset link/i }),
    ).toHaveAttribute("href", "/forgot-password");
  });

  it("shows the expired state for invalid or expired reset tokens", async () => {
    mocks.getToken.mockReturnValue("expired-token");
    mocks.resetPassword.mockRejectedValue(
      new ApiError("Reset link is invalid or expired", 400),
    );

    const user = userEvent.setup();
    render(React.createElement(ResetPasswordPage));

    await user.type(screen.getByLabelText(/new password/i), "NewPass123!");
    await user.click(screen.getByRole("button", { name: /reset password/i }));

    expect(await screen.findByText(/Link expired\./i)).toBeInTheDocument();
    expect(
      screen.getByText(/Reset link is invalid or expired/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /request another reset link/i }),
    ).toHaveAttribute("href", "/forgot-password");
  });

  it("redirects to login with the password-reset banner state after success", async () => {
    const setTimeoutSpy = vi
      .spyOn(globalThis, "setTimeout")
      .mockImplementation((callback: TimerHandler) => {
        if (typeof callback === "function") {
          callback();
        }

        return 0 as unknown as ReturnType<typeof setTimeout>;
      });
    mocks.getToken.mockReturnValue("valid-token");
    mocks.resetPassword.mockResolvedValue({
      success: true,
      signedOutSessions: true,
    });

    const user = userEvent.setup();
    render(React.createElement(ResetPasswordPage));

    await user.type(screen.getByLabelText(/new password/i), "NewPass123!");
    await user.click(screen.getByRole("button", { name: /reset password/i }));

    expect(mocks.resetPassword).toHaveBeenCalledWith({
      token: "valid-token",
      password: "NewPass123!",
    });
    expect(mocks.push).toHaveBeenCalledWith("/login?reason=password-reset");
    setTimeoutSpy.mockRestore();
  });
});
