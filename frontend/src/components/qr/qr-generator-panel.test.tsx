import React from "react";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getFastShare: vi.fn(),
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

vi.mock("@/lib/api/persona-api", () => ({
  personaApi: {
    getFastShare: mocks.getFastShare,
  },
}));

vi.mock("@/lib/api/qr-api", () => ({
  qrApi: {
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
  sharingCapabilities: {
    hasActiveProfileQr: true,
    primaryActions: {
      requestAccess: true,
      instantConnect: true,
      contactMe: true,
    },
  },
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
    mocks.getFastShare.mockReset();
    mocks.createQuickConnectQr.mockReset();
    mocks.replace.mockReset();
    mocks.refresh.mockReset();

    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });

    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: undefined,
    });
  });

  it("loads a profile QR immediately on open", async () => {
    mocks.getFastShare.mockResolvedValue({
      personaId: "persona-1",
      username: "sender",
      fullName: "Sender Persona",
      profilePhotoUrl: null,
      shareUrl: "https://dotly.one/u/sender",
      qrValue: "https://dotly.one/u/sender",
      primaryAction: null,
      hasQuickConnect: false,
      quickConnectUrl: null,
    });

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

    await waitFor(() => {
      expect(mocks.getFastShare).toHaveBeenCalledWith("persona-1");
    });
  });

  it("uses an initial profile QR without refetching on first paint", () => {
    render(
      React.createElement(QrGeneratorPanel, {
        initialFastShare: {
          selectedPersonaId: "persona-1",
          sharePayload: {
            personaId: "persona-1",
            username: "sender",
            fullName: "Sender Persona",
            profilePhotoUrl: null,
            shareUrl: "https://dotly.one/u/sender",
            qrValue: "https://dotly.one/u/sender",
            primaryAction: null,
            hasQuickConnect: false,
            quickConnectUrl: null,
          },
        },
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

    expect(mocks.getFastShare).not.toHaveBeenCalled();
    expect(screen.getByText(/scan to open my profile/i)).toBeInTheDocument();
  });

  it("creates a quick-connect QR with the share-mode defaults", async () => {
    mocks.getFastShare.mockResolvedValue({
      personaId: "persona-1",
      username: "sender",
      fullName: "Sender Persona",
      profilePhotoUrl: null,
      shareUrl: "https://dotly.one/u/sender",
      qrValue: "https://dotly.one/u/sender",
      primaryAction: null,
      hasQuickConnect: false,
      quickConnectUrl: null,
    });
    mocks.createQuickConnectQr.mockResolvedValue({
      id: "qr-1",
      url: "https://dotly.id/q/abc",
      code: "abc",
      type: "quick_connect",
      startsAt: new Date().toISOString(),
      endsAt: new Date().toISOString(),
      maxUses: 25,
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

    await waitFor(() => {
      expect(mocks.createQuickConnectQr).toHaveBeenCalledWith("persona-1", {
        durationHours: 12,
        maxUses: 25,
      });
    });
  });

  it("enables the share actions once the QR is ready", async () => {
    mocks.getFastShare.mockResolvedValue({
      personaId: "persona-1",
      username: "sender",
      fullName: "Sender Persona",
      profilePhotoUrl: null,
      shareUrl: "https://dotly.one/u/sender",
      qrValue: "https://dotly.one/u/sender",
      primaryAction: null,
      hasQuickConnect: false,
      quickConnectUrl: null,
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

    await waitFor(() => {
      expect(mocks.getFastShare).toHaveBeenCalledWith("persona-1");
    });

    const copyButton = screen.getByRole("button", { name: /copy link/i });
    const shareButton = screen.getByRole("button", { name: /share link/i });

    await waitFor(() => {
      expect(screen.getByText(/scan to open my profile/i)).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(copyButton).toBeEnabled();
      expect(shareButton).toBeEnabled();
    });
  });

  it("shows trust guidance and does not generate when QR requirements are locked", () => {
    render(
      React.createElement(QrGeneratorPanel, {
        personas: [personaFixture],
        user: userFixture,
      }),
    );

    expect(
      screen.getByText(/qr sharing is waiting on verification/i),
    ).toBeInTheDocument();
    expect(mocks.getFastShare).not.toHaveBeenCalled();
  });
});
