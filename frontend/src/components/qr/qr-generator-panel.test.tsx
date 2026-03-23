import React from "react";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastViewport } from "@/components/shared/toast-viewport";
import { clearShareFastStore } from "@/lib/share-fast-store";

const mocks = vi.hoisted(() => ({
  getFastShare: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  writeText: vi.fn(),
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
    explanation:
      "Add a verified email or mobile OTP to unlock trust-sensitive actions.",
    unlockedActions: [],
    restrictedActions: [
      "Create profile QR codes",
      "Create Quick Connect QR codes",
    ],
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
    mocks.replace.mockReset();
    mocks.refresh.mockReset();
    mocks.writeText.mockReset();
    mocks.writeText.mockResolvedValue(undefined);
    clearShareFastStore();

    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: mocks.writeText,
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
      primaryAction: "request_access",
      effectiveActions: {
        canCall: false,
        canWhatsapp: false,
        canEmail: false,
        canSaveContact: false,
      },
      preferredShareType: "smart_card",
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
            requirements: userFixture.security.requirements.map(
              (requirement) => ({
                ...requirement,
                unlocked: true,
              }),
            ),
          },
        },
      }),
    );

    await waitFor(() => {
      expect(mocks.getFastShare).toHaveBeenCalledWith("persona-1");
    });
  });

  it("removes persona and mode selection from the primary flow", () => {
    render(
      React.createElement(QrGeneratorPanel, {
        initialFastShare: {
          persona: {
            id: "persona-1",
            username: "sender",
            fullName: "Sender Persona",
            profilePhotoUrl: null,
          },
          share: {
            shareUrl: "https://dotly.one/u/sender",
            qrValue: "https://dotly.one/u/sender",
            primaryAction: "request_access",
            effectiveActions: {
              canCall: false,
              canWhatsapp: false,
              canEmail: false,
              canSaveContact: false,
            },
            preferredShareType: "smart_card",
          },
        },
        personas: [
          personaFixture,
          {
            ...personaFixture,
            id: "persona-2",
            username: "sender-ops",
            fullName: "Sender Ops",
            publicUrl: "dotly.id/sender-ops",
          },
        ],
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
            requirements: userFixture.security.requirements.map(
              (requirement) => ({
                ...requirement,
                unlocked: true,
              }),
            ),
          },
        },
      }),
    );

    expect(screen.queryByLabelText(/persona/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /quick connect/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/switch persona/i)).toBeInTheDocument();
  });

  it("uses an initial profile QR without refetching on first paint", () => {
    render(
      React.createElement(QrGeneratorPanel, {
        initialFastShare: {
          persona: {
            id: "persona-1",
            username: "sender",
            fullName: "Sender Persona",
            profilePhotoUrl: null,
          },
          share: {
            shareUrl: "https://dotly.one/u/sender",
            qrValue: "https://dotly.one/u/sender",
            primaryAction: "request_access",
            effectiveActions: {
              canCall: false,
              canWhatsapp: false,
              canEmail: false,
              canSaveContact: false,
            },
            preferredShareType: "smart_card",
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
            requirements: userFixture.security.requirements.map(
              (requirement) => ({
                ...requirement,
                unlocked: true,
              }),
            ),
          },
        },
      }),
    );

    expect(mocks.getFastShare).not.toHaveBeenCalled();
    expect(screen.getByText(/scan to open my profile/i)).toBeInTheDocument();
    expect(screen.getByText(/scan to view my dotly/i)).toBeInTheDocument();
  });

  it("renders the backend-selected primary and secondary actions directly", () => {
    render(
      React.createElement(QrGeneratorPanel, {
        initialFastShare: {
          persona: {
            id: "persona-1",
            username: "sender",
            fullName: "Sender Persona",
            profilePhotoUrl: null,
          },
          share: {
            shareUrl: "https://dotly.one/q/instant-1",
            qrValue: "https://dotly.one/q/instant-1",
            primaryAction: "instant_connect",
            effectiveActions: {
              canCall: true,
              canWhatsapp: false,
              canEmail: true,
              canSaveContact: false,
            },
            preferredShareType: "instant_connect",
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
            requirements: userFixture.security.requirements.map(
              (requirement) => ({
                ...requirement,
                unlocked: true,
              }),
            ),
          },
        },
      }),
    );

    expect(screen.getByText(/first step: connect/i)).toBeInTheDocument();
    expect(screen.getByText(/^Call$/)).toBeInTheDocument();
    expect(screen.getByText(/^Email$/)).toBeInTheDocument();
    expect(screen.queryByText(/^WhatsApp$/)).not.toBeInTheDocument();
    expect(screen.getByText(/scan to connect instantly/i)).toBeInTheDocument();
    expect(screen.getByText(/scan to connect on dotly/i)).toBeInTheDocument();
  });

  it("enables the share actions once the QR is ready", async () => {
    mocks.getFastShare.mockResolvedValue({
      personaId: "persona-1",
      username: "sender",
      fullName: "Sender Persona",
      profilePhotoUrl: null,
      shareUrl: "https://dotly.one/u/sender",
      qrValue: "https://dotly.one/u/sender",
      primaryAction: "request_access",
      effectiveActions: {
        canCall: false,
        canWhatsapp: false,
        canEmail: false,
        canSaveContact: false,
      },
      preferredShareType: "smart_card",
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
            requirements: userFixture.security.requirements.map(
              (requirement) => ({
                ...requirement,
                unlocked: true,
              }),
            ),
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

    expect(screen.getByText(/scan to view my dotly/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(copyButton).toBeEnabled();
      expect(shareButton).toBeEnabled();
    });
  });

  it("shows a bottom toast when the share link is copied", async () => {
    mocks.getFastShare.mockResolvedValue({
      personaId: "persona-1",
      username: "sender",
      fullName: "Sender Persona",
      profilePhotoUrl: null,
      shareUrl: "https://dotly.one/u/sender",
      qrValue: "https://dotly.one/u/sender",
      primaryAction: "request_access",
      effectiveActions: {
        canCall: false,
        canWhatsapp: false,
        canEmail: false,
        canSaveContact: false,
      },
      preferredShareType: "smart_card",
      hasQuickConnect: false,
      quickConnectUrl: null,
    });

    const user = userEvent.setup();

    render(
      React.createElement(
        React.Fragment,
        null,
        React.createElement(ToastViewport),
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
              requirements: userFixture.security.requirements.map(
                (requirement) => ({
                  ...requirement,
                  unlocked: true,
                }),
              ),
            },
          },
        }),
      ),
    );

    const copyButton = await screen.findByRole("button", {
      name: /copy link/i,
    });

    await waitFor(() => {
      expect(copyButton).toBeEnabled();
    });

    await user.click(copyButton);

    expect(await screen.findByRole("status")).toHaveTextContent(/link copied/i);
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
