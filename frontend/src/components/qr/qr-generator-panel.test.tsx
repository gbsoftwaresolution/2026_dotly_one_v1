import React from "react";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ToastViewport } from "@/components/shared/toast-viewport";
import { routes } from "@/lib/constants/routes";
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
  identityId: "identity-1",
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

function createUnlockedUser() {
  return {
    ...userFixture,
    isVerified: true,
    security: {
      ...userFixture.security,
      trustBadge: "verified" as const,
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
  };
}

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
        user: createUnlockedUser(),
      }),
    );

    await waitFor(() => {
      expect(mocks.getFastShare).toHaveBeenCalledWith("persona-1");
    });
  });

  it("keeps persona switching behind a separate Dotly switcher instead of a visible picker", () => {
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
        user: createUnlockedUser(),
      }),
    );

    expect(screen.getByRole("link", { name: /switch dotly/i })).toHaveAttribute(
      "href",
      routes.app.personas,
    );
    expect(
      screen.queryByRole("button", { name: /quick connect/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", { name: /share persona/i }),
    ).not.toBeInTheDocument();
  });

  it("prefetches other personas while keeping switching behind the Dotly switcher", async () => {
    mocks.getFastShare.mockResolvedValueOnce({
      personaId: "persona-2",
      username: "sender-ops",
      fullName: "Sender Ops",
      profilePhotoUrl: null,
      shareUrl: "https://dotly.one/q/ops",
      qrValue: "https://dotly.one/q/ops",
      primaryAction: "instant_connect",
      effectiveActions: {
        canCall: true,
        canWhatsapp: false,
        canEmail: false,
        canSaveContact: false,
      },
      preferredShareType: "instant_connect",
      hasQuickConnect: true,
      quickConnectUrl: "https://dotly.one/q/ops",
    });

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
            jobTitle: "Operations",
            companyName: "Dotly",
          },
        ],
        user: createUnlockedUser(),
      }),
    );

    await waitFor(() => {
      expect(mocks.getFastShare).toHaveBeenCalledWith("persona-2");
    });

    expect(screen.getByRole("link", { name: /switch dotly/i })).toHaveAttribute(
      "href",
      routes.app.personas,
    );
    expect(
      screen.queryByRole("combobox", { name: /share persona/i }),
    ).not.toBeInTheDocument();

    expect(screen.getByRole("heading", { name: /@sender/i })).toBeInTheDocument();
    expect(screen.getAllByText(/sender persona/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/scan to view my contact/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /@sender-ops/i }),
    ).not.toBeInTheDocument();
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

  it("renders the canonical public handle from fast-share payloads", () => {
    render(
      React.createElement(QrGeneratorPanel, {
        initialFastShare: {
          persona: {
            id: "persona-1",
            publicIdentifier: "acme",
            username: "sender-alias",
            fullName: "Sender Persona",
            profilePhotoUrl: null,
          },
          share: {
            shareUrl: "https://dotly.one/u/acme",
            qrValue: "https://dotly.one/u/acme",
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
        user: createUnlockedUser(),
      }),
    );

    expect(screen.getByRole("heading", { name: /@acme/i })).toBeInTheDocument();
  });

  it("renders the referral invite module on the share surface", () => {
    render(
      React.createElement(QrGeneratorPanel, {
        initialFastShare: {
          persona: {
            id: "persona-1",
            publicIdentifier: "sender",
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
        initialReferral: {
          id: "user-1",
          referralCode: "SHARECODE1",
        },
        personas: [personaFixture],
        user: createUnlockedUser(),
      }),
    );

    expect(screen.getByText(/invite flow/i)).toBeInTheDocument();
    expect(screen.getByText(/invite someone to create their own dotly/i)).toBeInTheDocument();
    expect(screen.getByText("SHARECODE1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /copy code/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /invite someone/i })).toBeInTheDocument();
  });

  it("renders the lightweight share guide and follow-through shortcuts", () => {
    render(
      React.createElement(QrGeneratorPanel, {
        initialFastShare: {
          persona: {
            id: "persona-1",
            publicIdentifier: "sender",
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
        user: createUnlockedUser(),
      }),
    );

    expect(screen.getByText(/share flow/i)).toBeInTheDocument();
    expect(screen.getByText(/use this in the room/i)).toBeInTheDocument();
    expect(screen.getByText(/show qr/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open requests/i })).toHaveAttribute(
      "href",
      routes.app.requests,
    );
    expect(screen.getByRole("link", { name: /open inbox/i })).toHaveAttribute(
      "href",
      routes.app.inbox,
    );
  });

  it("shows post-share follow-through guidance after the first real share success", () => {
    render(
      React.createElement(QrGeneratorPanel, {
        initialFastShare: {
          persona: {
            id: "persona-1",
            publicIdentifier: "sender",
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
          ...createUnlockedUser(),
          activation: {
            milestones: {
              firstPersonaCreatedAt: "2026-03-27T10:00:00.000Z",
              firstQrOpenedAt: "2026-03-27T10:05:00.000Z",
              firstShareCompletedAt: "2026-03-27T10:10:00.000Z",
              firstRequestReceivedAt: null,
            },
            completedCount: 3,
            nextMilestoneKey: "firstRequestReceived",
          },
        },
      }),
    );

    expect(screen.getByText(/share signal/i)).toBeInTheDocument();
    expect(screen.getByText(/your qr is already working/i)).toBeInTheDocument();
    expect(screen.getByText(/signal received/i)).toBeInTheDocument();
    expect(screen.getByText(/follow-through: check requests and inbox/i)).toBeInTheDocument();
  });
});
