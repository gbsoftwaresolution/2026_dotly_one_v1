import React from "react";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createProfileQr: vi.fn(),
  createQuickConnectQr: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mocks.replace,
    refresh: mocks.refresh,
  }),
}));

vi.mock("@/lib/api/qr-api", () => ({
  qrApi: {
    createProfileQr: mocks.createProfileQr,
    createQuickConnectQr: mocks.createQuickConnectQr,
  },
}));

import { QrGeneratorPanel } from "./qr-generator-panel";

const personaFixture = {
  id: "persona-1",
  type: "professional",
  fullName: "Sender Persona",
  username: "sender",
  publicUrl: "dotly.id/sender",
  jobTitle: "Founder",
  companyName: "Dotly",
  tagline: "Build trusted networks",
  profilePhotoUrl: null,
  accessMode: "open" as const,
  verifiedOnly: false,
  sharingMode: "controlled" as const,
  smartCardConfig: null,
  publicPhone: null,
  publicWhatsappNumber: null,
  publicEmail: null,
  createdAt: "2026-03-21T10:00:00.000Z",
  updatedAt: "2026-03-21T10:00:00.000Z",
} as const;

const userFixture = {
  id: "user-1",
  email: "user@dotly.one",
  isVerified: false,
  security: {
    trustBadge: "attention" as const,
    maskedEmail: "us**@dotly.one",
    mailDeliveryAvailable: true,
    passwordResetAvailable: true,
    smsDeliveryAvailable: true,
    maskedPhoneNumber: null,
    phoneVerificationStatus: "not_enrolled" as const,
    mobileOtpEnrollment: null,
    explanation: "Add a verified email or mobile OTP to unlock trust-sensitive actions.",
    unlockedActions: [],
    restrictedActions: ["Create profile QR codes", "Create Quick Connect QR codes"],
    requirements: [
      {
        key: "create_profile_qr" as const,
        label: "Create profile QR codes",
        unlocked: false,
      },
      {
        key: "create_quick_connect_qr" as const,
        label: "Create Quick Connect QR codes",
        unlocked: false,
      },
    ],
    trustFactors: [],
  },
};

describe("QrGeneratorPanel", () => {
  beforeEach(() => {
    mocks.createProfileQr.mockReset();
    mocks.createQuickConnectQr.mockReset();
    mocks.replace.mockReset();
    mocks.refresh.mockReset();
  });

  it("creates a quick-connect QR with numeric payload values", async () => {
    mocks.createQuickConnectQr.mockResolvedValue({
      id: "qr-1",
      url: "https://dotly.id/q/abc",
      code: "abc",
      type: "quick_connect",
      expiresAt: new Date().toISOString(),
      maxUses: 3,
    });

    const user = userEvent.setup();

    render(
      React.createElement(QrGeneratorPanel, {
        personas: [personaFixture],
        user: {
          ...userFixture,
          isVerified: true,
          security: {
            ...userFixture.security,
            trustBadge: "verified",
            unlockedActions: [
              "Create profile QR codes",
              "Create Quick Connect QR codes",
            ],
            restrictedActions: [],
            requirements: userFixture.security.requirements.map((requirement) => ({
              ...requirement,
              unlocked: true,
            })),
          },
        },
      }),
    );

    await user.click(screen.getByRole("button", { name: /quick connect/i }));
    await user.clear(screen.getByLabelText(/duration/i));
    await user.type(screen.getByLabelText(/duration/i), "12");
    await user.clear(screen.getByLabelText(/max uses/i));
    await user.type(screen.getByLabelText(/max uses/i), "3");
    await user.click(screen.getByRole("button", { name: /generate qr/i }));

    await waitFor(() => {
      expect(mocks.createQuickConnectQr).toHaveBeenCalledWith("persona-1", {
        durationHours: 12,
        maxUses: 3,
      });
    });
  });

  it("shows trust guidance and disables generation when QR requirements are locked", () => {
    render(
      React.createElement(QrGeneratorPanel, {
        personas: [personaFixture],
        user: userFixture,
      }),
    );

    expect(
      screen.getByText(/qr sharing is waiting on verification/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /generate qr/i })).toBeDisabled();
  });
});
