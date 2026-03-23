import React from "react";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resendCurrentUserVerificationEmail: vi.fn(),
  changePassword: vi.fn(),
  requestMobileOtp: vi.fn(),
  verifyMobileOtp: vi.fn(),
  listSessions: vi.fn(),
  revokeSession: vi.fn(),
  revokeOtherSessions: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  authApi: {
    resendCurrentUserVerificationEmail:
      mocks.resendCurrentUserVerificationEmail,
    changePassword: mocks.changePassword,
    requestMobileOtp: mocks.requestMobileOtp,
    verifyMobileOtp: mocks.verifyMobileOtp,
    listSessions: mocks.listSessions,
    revokeSession: mocks.revokeSession,
    revokeOtherSessions: mocks.revokeOtherSessions,
  },
}));

import { ApiError } from "@/lib/api/client";
import type { UserProfile } from "@/types/user";

import { AccountSecuritySettings } from "./account-security-settings";

function createUser(
  isVerified: boolean,
  overrides?: Partial<UserProfile["security"]>,
): UserProfile {
  return {
    id: "user-1",
    email: "user@dotly.one",
    isVerified,
    security: {
      trustBadge: isVerified ? "verified" : "attention",
      maskedEmail: "us**@dotly.one",
      mailDeliveryAvailable: true,
      passwordResetAvailable: true,
      smsDeliveryAvailable: true,
      maskedPhoneNumber: isVerified ? "+14***99" : null,
      phoneVerificationStatus: isVerified ? "verified" : "not_enrolled",
      mobileOtpEnrollment: null,
      explanation:
        "Email verification is the first trust factor for your Dotly identity.",
      unlockedActions: isVerified
        ? ["Send contact requests", "Create trust-based events"]
        : [],
      restrictedActions: isVerified
        ? []
        : ["Send contact requests", "Create trust-based events"],
      requirements: [
        {
          key: "send_contact_request",
          label: "Send contact requests",
          unlocked: isVerified,
        },
      ],
      trustFactors: [
        {
          key: "email_verified",
          label: "Email verified",
          status: isVerified ? "active" : "inactive",
          description:
            "Email verification is the first trust factor for your Dotly identity and unlocks current trust-sensitive actions.",
        },
        {
          key: "mobile_otp_verified",
          label: "Mobile OTP verified",
          status: isVerified ? "active" : "inactive",
          description:
            "Verify a mobile number to add a second live trust factor for step-up account protection and future phone-based sign-in.",
        },
      ],
      ...overrides,
    },
  };
}

describe("AccountSecuritySettings", () => {
  beforeEach(() => {
    mocks.resendCurrentUserVerificationEmail.mockReset();
    mocks.changePassword.mockReset();
    mocks.requestMobileOtp.mockReset();
    mocks.verifyMobileOtp.mockReset();
    mocks.listSessions.mockReset();
    mocks.revokeSession.mockReset();
    mocks.revokeOtherSessions.mockReset();
    mocks.listSessions.mockResolvedValue({
      sessions: [
        {
          id: "session-1",
          deviceLabel: "MacBook Pro · Chrome",
          platformLabel: "macOS",
          createdAt: new Date().toISOString(),
          lastActiveAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 3600_000).toISOString(),
          isCurrent: true,
        },
        {
          id: "session-2",
          deviceLabel: "iPhone · Safari",
          platformLabel: "iPhone",
          createdAt: new Date().toISOString(),
          lastActiveAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 3600_000).toISOString(),
          isCurrent: false,
        },
      ],
    });
  });

  it("renders the security center sections", async () => {
    render(
      React.createElement(AccountSecuritySettings, { user: createUser(false) }),
    );

    expect(screen.getByText(/dotly security center/i)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /^change password$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /^add mobile verification$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/active sessions and devices/i),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/macbook pro/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/email trust status/i)).toBeInTheDocument();
    expect(screen.getByText(/mobile otp status/i)).toBeInTheDocument();
    expect(
      screen.getAllByText(/verification requirements/i).length,
    ).toBeGreaterThan(0);
  });

  it("shows verified email and planned mobile otp states in the overview", async () => {
    render(
      React.createElement(AccountSecuritySettings, { user: createUser(true) }),
    );

    expect(screen.getByText(/verified email on file/i)).toBeInTheDocument();
    expect(screen.getByText(/email trust status/i)).toBeInTheDocument();
    expect(screen.getByText(/mobile otp status/i)).toBeInTheDocument();
    expect(screen.getAllByText(/^verified$/i).length).toBeGreaterThan(0);
  });

  it("shows planned mobile otp messaging before enrollment starts", async () => {
    render(
      React.createElement(AccountSecuritySettings, { user: createUser(false) }),
    );

    expect(
      screen.getByText(/mobile verification is the next step you can add/i),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/coming soon/i).length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/send contact requests/i).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText(/^restricted$/i).length).toBeGreaterThan(0);
  });

  it("shows loading and success feedback when resend succeeds", async () => {
    mocks.resendCurrentUserVerificationEmail.mockResolvedValue({
      accepted: true,
      verificationPending: true,
      verificationEmailSent: true,
      mailDeliveryAvailable: true,
    });

    const user = userEvent.setup();
    render(
      React.createElement(AccountSecuritySettings, { user: createUser(false) }),
    );

    await user.click(
      screen.getByRole("button", { name: /resend verification email/i }),
    );

    await waitFor(() => {
      expect(
        screen.getByText(/a fresh verification email is on the way/i),
      ).toBeInTheDocument();
    });
  });

  it("submits a password change", async () => {
    mocks.changePassword.mockResolvedValue({
      success: true,
      signedOutSessions: true,
    });

    const user = userEvent.setup();
    render(
      React.createElement(AccountSecuritySettings, { user: createUser(true) }),
    );

    await user.type(screen.getByLabelText(/current password/i), "OldPass123!");
    await user.type(screen.getByLabelText(/new password/i), "NewPass123!");
    await user.click(screen.getByRole("button", { name: /update password/i }));

    await waitFor(() => {
      expect(mocks.changePassword).toHaveBeenCalledWith({
        currentPassword: "OldPass123!",
        newPassword: "NewPass123!",
      });
    });

    expect(
      await screen.findAllByText(
        /password updated\. dotly signed your other devices out/i,
      ),
    ).toHaveLength(1);
  });

  it("shows password change errors from the backend", async () => {
    mocks.changePassword.mockRejectedValue(
      new ApiError("Current password is incorrect.", 400),
    );

    const user = userEvent.setup();
    render(
      React.createElement(AccountSecuritySettings, { user: createUser(true) }),
    );

    await user.type(
      screen.getByLabelText(/current password/i),
      "WrongPass123!",
    );
    await user.type(screen.getByLabelText(/new password/i), "NewPass123!");
    await user.click(screen.getByRole("button", { name: /update password/i }));

    expect(
      await screen.findByText(/current password is incorrect\./i),
    ).toBeInTheDocument();
  });

  it("handles mobile otp enrollment and verification", async () => {
    mocks.requestMobileOtp.mockResolvedValue({
      status: "sent",
      challengeId: "challenge-1",
      purpose: "ENROLLMENT",
      phoneNumber: "+14***99",
      resendAvailableAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 600_000).toISOString(),
      deliveryAvailable: true,
    });
    mocks.verifyMobileOtp.mockResolvedValue({
      verified: true,
      phoneNumber: "+14***99",
      verifiedAt: new Date().toISOString(),
    });

    const user = userEvent.setup();
    render(
      React.createElement(AccountSecuritySettings, { user: createUser(false) }),
    );

    await user.type(screen.getByLabelText(/mobile number/i), "+14155550199");
    await user.click(
      screen.getByRole("button", { name: /send verification code/i }),
    );

    await waitFor(() => {
      expect(mocks.requestMobileOtp).toHaveBeenCalledWith({
        phoneNumber: "+14155550199",
      });
    });

    expect(screen.getByText(/state: code sent/i)).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText(/123456/i), "123456");
    await user.click(screen.getByRole("button", { name: /verify mobile/i }));

    await waitFor(() => {
      expect(mocks.verifyMobileOtp).toHaveBeenCalledWith({
        challengeId: "challenge-1",
        code: "123456",
      });
    });
  });

  it("shows resend blocked when a pending enrollment is still cooling down", async () => {
    render(
      React.createElement(AccountSecuritySettings, {
        user: createUser(false, {
          maskedPhoneNumber: "+14***99",
          phoneVerificationStatus: "pending",
          mobileOtpEnrollment: {
            challengeId: "challenge-1",
            purpose: "ENROLLMENT",
            maskedPhoneNumber: "+14***99",
            resendAvailableAt: new Date(Date.now() + 60_000).toISOString(),
            expiresAt: new Date(Date.now() + 600_000).toISOString(),
            canResend: false,
          },
        }),
      }),
    );

    expect(screen.getByText(/state: resend blocked/i)).toBeInTheDocument();
    expect(screen.getByText(/resend blocked until/i)).toBeInTheDocument();
  });

  it("shows the verifying state while a code check is in flight", async () => {
    let resolveVerify:
      | ((value: {
          verified: boolean;
          phoneNumber: string;
          verifiedAt: string;
        }) => void)
      | undefined;

    mocks.verifyMobileOtp.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveVerify = resolve;
        }),
    );

    const user = userEvent.setup();
    render(
      React.createElement(AccountSecuritySettings, {
        user: createUser(false, {
          maskedPhoneNumber: "+14***99",
          phoneVerificationStatus: "pending",
          mobileOtpEnrollment: {
            challengeId: "challenge-1",
            purpose: "ENROLLMENT",
            maskedPhoneNumber: "+14***99",
            resendAvailableAt: new Date(Date.now() - 1_000).toISOString(),
            expiresAt: new Date(Date.now() + 600_000).toISOString(),
            canResend: true,
          },
        }),
      }),
    );

    await user.type(screen.getByPlaceholderText(/123456/i), "123456");
    await user.click(screen.getByRole("button", { name: /verify mobile/i }));

    await waitFor(() => {
      expect(screen.getByText(/state: verifying/i)).toBeInTheDocument();
      expect(screen.getByText(/verifying code/i)).toBeInTheDocument();
    });

    resolveVerify?.({
      verified: true,
      phoneNumber: "+14***99",
      verifiedAt: new Date().toISOString(),
    });

    await waitFor(() => {
      expect(mocks.verifyMobileOtp).toHaveBeenCalledWith({
        challengeId: "challenge-1",
        code: "123456",
      });
    });
  });

  it("handles remote sign-out", async () => {
    mocks.revokeSession.mockResolvedValue({ success: true });

    const user = userEvent.setup();
    render(
      React.createElement(AccountSecuritySettings, { user: createUser(true) }),
    );

    await waitFor(() => {
      expect(screen.getByText(/iphone · safari/i)).toBeInTheDocument();
    });

    const buttons = screen.getAllByRole("button", { name: /^sign out$/i });
    await user.click(buttons[0]!);

    await waitFor(() => {
      expect(mocks.revokeSession).toHaveBeenCalledWith({
        sessionId: "session-2",
      });
    });
  });

  it("shows cooldown feedback when resend is rate limited", async () => {
    mocks.resendCurrentUserVerificationEmail.mockRejectedValue(
      new ApiError(
        "Please wait before requesting another verification email",
        429,
      ),
    );

    const user = userEvent.setup();
    render(
      React.createElement(AccountSecuritySettings, { user: createUser(false) }),
    );

    await user.click(
      screen.getByRole("button", { name: /resend verification email/i }),
    );

    await waitFor(() => {
      expect(
        screen.getByText(
          /wait about a minute before requesting another verification email/i,
        ),
      ).toBeInTheDocument();
    });
  });

  it("explains when password recovery delivery is unavailable", async () => {
    render(
      React.createElement(AccountSecuritySettings, {
        user: createUser(false, {
          passwordResetAvailable: false,
        }),
      }),
    );

    expect(
      screen.getByText(
        /reset email delivery is unavailable in this environment/i,
      ),
    ).toBeInTheDocument();
  });
});
