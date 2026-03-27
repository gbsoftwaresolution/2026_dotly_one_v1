import React from "react";

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { clearShareFastStore } from "@/lib/share-fast-store";

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  getMyFastShare: vi.fn(),
  getCurrent: vi.fn(),
  getCurrentAnalytics: vi.fn(),
}));

vi.mock("@/lib/api/persona-api", () => ({
  personaApi: {
    list: mocks.list,
    getMyFastShare: mocks.getMyFastShare,
  },
}));

vi.mock("@/lib/api/user-api", () => ({
  userApi: {
    getCurrent: mocks.getCurrent,
    getCurrentAnalytics: mocks.getCurrentAnalytics,
  },
}));

vi.mock("@/components/qr/qr-generator-panel", () => ({
  QrGeneratorPanel: () => React.createElement("div", null, "ready"),
}));

import { InstantShareExperience } from "./instant-share-experience";

const userFixture = {
  id: "user-1",
  email: "user@dotly.one",
  isVerified: true,
  security: {
    trustBadge: "verified" as const,
    maskedEmail: "us**@dotly.one",
    mailDeliveryAvailable: true,
    passwordResetAvailable: true,
    smsDeliveryAvailable: true,
    maskedPhoneNumber: null,
    phoneVerificationStatus: "verified" as const,
    mobileOtpEnrollment: null,
    explanation: "",
    unlockedActions: [],
    restrictedActions: [],
    requirements: [],
    trustFactors: [],
  },
};

function createInitialFastShare(
  preferredShareType: "smart_card" | "instant_connect",
) {
  return {
    persona: {
      id: "persona-1",
      publicIdentifier: "sender",
      username: "sender",
      fullName: "Sender Persona",
      profilePhotoUrl: null,
    },
    share: {
      shareUrl:
        preferredShareType === "instant_connect"
          ? "https://dotly.one/q/instant-1"
          : "https://dotly.one/u/sender",
      qrValue:
        preferredShareType === "instant_connect"
          ? "https://dotly.one/q/instant-1"
          : "https://dotly.one/u/sender",
      primaryAction:
        preferredShareType === "instant_connect"
          ? ("instant_connect" as const)
          : ("request_access" as const),
      effectiveActions: {
        canCall: false,
        canWhatsapp: false,
        canEmail: false,
        canSaveContact: false,
      },
      preferredShareType,
    },
  };
}

describe("InstantShareExperience", () => {
  beforeEach(() => {
    mocks.list.mockReset();
    mocks.getMyFastShare.mockReset();
    mocks.getCurrent.mockReset();
    mocks.getCurrentAnalytics.mockReset();
    clearShareFastStore();

    mocks.list.mockImplementation(() => new Promise(() => {}));
  });

  it("shows the profile scan clarity line while bootstrapping the share shell", () => {
    render(
      React.createElement(InstantShareExperience, {
        initialFastShare: createInitialFastShare("smart_card"),
        initialAnalytics: {
          totalConnections: 24,
          connectionsThisMonth: 5,
        },
        initialUser: userFixture,
      }),
    );

    expect(screen.getByText(/^@sender$/i)).toBeInTheDocument();
    expect(screen.getByText(/sender persona/i)).toBeInTheDocument();
    expect(screen.getByText(/scan to view my contact/i)).toBeInTheDocument();
    expect(screen.getByText(/you've connected with/i)).toBeInTheDocument();
    expect(screen.getByText(/\+5 this month/i)).toBeInTheDocument();
    expect(screen.getByText(/verified/i)).toBeInTheDocument();
  });

  it("shows the instant connect scan clarity line while bootstrapping the share shell", () => {
    render(
      React.createElement(InstantShareExperience, {
        initialFastShare: createInitialFastShare("instant_connect"),
        initialAnalytics: {
          totalConnections: 24,
          connectionsThisMonth: 5,
        },
        initialUser: userFixture,
      }),
    );

    expect(screen.getByText(/^@sender$/i)).toBeInTheDocument();
    expect(screen.getByText(/sender persona/i)).toBeInTheDocument();
    expect(screen.getByText(/scan to connect on dotly/i)).toBeInTheDocument();
    expect(screen.getByText(/verified/i)).toBeInTheDocument();
  });

  it("shows the canonical handle from fast-share payloads when username is an alias", () => {
    render(
      React.createElement(InstantShareExperience, {
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
        initialAnalytics: {
          totalConnections: 24,
          connectionsThisMonth: 5,
        },
        initialUser: userFixture,
      }),
    );

    expect(screen.getByText(/^@acme$/i)).toBeInTheDocument();
    expect(screen.queryByText(/^@sender-alias$/i)).not.toBeInTheDocument();
  });
});
