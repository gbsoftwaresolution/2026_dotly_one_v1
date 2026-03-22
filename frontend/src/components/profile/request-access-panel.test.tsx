import React from "react";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getRequestTarget: vi.fn(),
  sendRequest: vi.fn(),
}));

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<object>("@/lib/api");

  return {
    ...actual,
    publicApi: {
      getRequestTarget: mocks.getRequestTarget,
    },
    requestApi: {
      send: mocks.sendRequest,
    },
  };
});

import { RequestAccessPanel } from "./request-access-panel";

const profileFixture = {
  username: "target",
  publicUrl: "https://dotly.id/target",
  name: "Target User",
  fullName: "Target User",
  jobTitle: "Founder",
  companyName: "Dotly",
  tagline: "Connect intentionally",
  profilePhoto: null,
  profilePhotoUrl: null,
  sharingMode: "controlled" as const,
  channels: {
    phoneNumber: null,
    email: null,
  },
  publicActions: {
    phone: null,
    whatsappNumber: null,
    email: null,
  },
  links: [],
  smartCard: null,
  smartCardConfig: null,
} as const;

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

describe("RequestAccessPanel", () => {
  beforeEach(() => {
    mocks.getRequestTarget.mockReset();
    mocks.sendRequest.mockReset();
  });

  it("renders a login CTA for signed-out visitors", () => {
    render(
      React.createElement(RequestAccessPanel, {
        profile: profileFixture,
        initialPersonas: [],
        isAuthenticated: false,
      }),
    );

    expect(
      screen.getByRole("link", { name: /login to connect/i }),
    ).toHaveAttribute("href", "/login?next=%2Fu%2Ftarget");
  });

  it("shows the unavailable state for signed-out visitors when smart card config is missing", () => {
    render(
      React.createElement(RequestAccessPanel, {
        profile: {
          ...profileFixture,
          sharingMode: "smart_card",
          smartCard: null,
          smartCardConfig: null,
        },
        initialPersonas: [],
        isAuthenticated: false,
      }),
    );

    expect(
      screen.getByText(/this card is missing its action configuration/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /login to connect/i }),
    ).not.toBeInTheDocument();
  });

  it("submits a request from the selected persona", async () => {
    mocks.getRequestTarget.mockResolvedValue({ id: "target-persona" });
    mocks.sendRequest.mockResolvedValue({ id: "request-1" });

    const user = userEvent.setup();

    render(
      React.createElement(RequestAccessPanel, {
        profile: profileFixture,
        initialPersonas: [personaFixture],
        isAuthenticated: true,
        currentUser: {
          id: "user-1",
          email: "user@dotly.one",
          isVerified: true,
          security: {
            trustBadge: "verified",
            maskedEmail: "us**@dotly.one",
            mailDeliveryAvailable: true,
            passwordResetAvailable: true,
            smsDeliveryAvailable: true,
            maskedPhoneNumber: null,
            phoneVerificationStatus: "not_enrolled",
            mobileOtpEnrollment: null,
            explanation:
              "Email verification is the first trust factor for your Dotly identity.",
            unlockedActions: ["Send contact requests"],
            restrictedActions: [],
            requirements: [],
            trustFactors: [],
          },
        },
      }),
    );

    await user.type(
      screen.getByLabelText(/add context/i),
      "We met at a product meetup.",
    );
    await user.click(screen.getByRole("button", { name: /request access/i }));

    await waitFor(() => {
      expect(mocks.sendRequest).toHaveBeenCalledWith({
        fromPersonaId: "persona-1",
        reason: "We met at a product meetup.",
        sourceId: null,
        sourceType: "profile",
        toPersonaId: "target-persona",
      });
    });

    expect(screen.getByText(/request sent/i)).toBeInTheDocument();
  });

  it("keeps request access available when smart card mode uses request_access", async () => {
    mocks.getRequestTarget.mockResolvedValue({ id: "target-persona" });
    mocks.sendRequest.mockResolvedValue({ id: "request-1" });

    const user = userEvent.setup();

    render(
      React.createElement(RequestAccessPanel, {
        profile: {
          ...profileFixture,
          sharingMode: "smart_card",
          smartCard: {
            primaryAction: "request_access",
            allowCall: false,
            allowWhatsapp: true,
            allowEmail: false,
            allowVcard: false,
            actionState: {
              requestAccessEnabled: true,
              instantConnectEnabled: false,
              contactMeEnabled: true,
            },
            actions: {
              call: false,
              whatsapp: true,
              email: false,
              vcard: false,
            },
            actionLinks: {
              call: null,
              whatsapp: "https://wa.me/15551234567",
              email: null,
              vcard: null,
            },
          },
          smartCardConfig: {
            primaryAction: "request_access",
            allowCall: false,
            allowWhatsapp: true,
            allowEmail: false,
            allowVcard: false,
            actionState: {
              requestAccessEnabled: true,
              instantConnectEnabled: false,
              contactMeEnabled: true,
            },
          },
        },
        initialPersonas: [personaFixture],
        isAuthenticated: true,
        currentUser: {
          id: "user-1",
          email: "user@dotly.one",
          isVerified: true,
          security: {
            trustBadge: "verified",
            maskedEmail: "us**@dotly.one",
            mailDeliveryAvailable: true,
            passwordResetAvailable: true,
            smsDeliveryAvailable: true,
            maskedPhoneNumber: null,
            phoneVerificationStatus: "not_enrolled",
            mobileOtpEnrollment: null,
            explanation:
              "Email verification is the first trust factor for your Dotly identity.",
            unlockedActions: ["Send contact requests"],
            restrictedActions: [],
            requirements: [],
            trustFactors: [],
          },
        },
      }),
    );

    expect(
      screen.getByText(/request access from this smart card/i),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /request access/i }));

    await waitFor(() => {
      expect(mocks.sendRequest).toHaveBeenCalled();
    });
  });

  it("hides the approval flow when a smart card uses a non-request action", () => {
    render(
      React.createElement(RequestAccessPanel, {
        profile: {
          ...profileFixture,
          sharingMode: "smart_card",
          instantConnectUrl: "https://dotly.id/q/profile-qr-1",
          smartCard: {
            primaryAction: "instant_connect",
            allowCall: false,
            allowWhatsapp: true,
            allowEmail: false,
            allowVcard: true,
            actionState: {
              requestAccessEnabled: true,
              instantConnectEnabled: true,
              contactMeEnabled: true,
            },
            actions: {
              call: false,
              whatsapp: true,
              email: false,
              vcard: true,
            },
            actionLinks: {
              call: null,
              whatsapp: "https://wa.me/15551234567",
              email: null,
              vcard: "/v1/public/personas/target/vcard",
            },
          },
          smartCardConfig: {
            primaryAction: "instant_connect",
            allowCall: false,
            allowWhatsapp: true,
            allowEmail: false,
            allowVcard: true,
            actionState: {
              requestAccessEnabled: true,
              instantConnectEnabled: true,
              contactMeEnabled: true,
            },
          },
        },
        initialPersonas: [personaFixture],
        isAuthenticated: true,
      }),
    );

    expect(
      screen.getByText(/instant connect is the primary card action/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /request access/i }),
    ).not.toBeInTheDocument();
  });

  it("keeps the request flow available when smart card falls back to request access", () => {
    render(
      React.createElement(RequestAccessPanel, {
        profile: {
          ...profileFixture,
          sharingMode: "smart_card",
          smartCard: {
            primaryAction: "contact_me",
            allowCall: false,
            allowWhatsapp: false,
            allowEmail: false,
            allowVcard: false,
            actionState: {
              requestAccessEnabled: true,
              instantConnectEnabled: false,
              contactMeEnabled: false,
            },
            actions: {
              call: false,
              whatsapp: false,
              email: false,
              vcard: false,
            },
            actionLinks: {
              call: null,
              whatsapp: null,
              email: null,
              vcard: null,
            },
          },
          smartCardConfig: {
            primaryAction: "contact_me",
            allowCall: false,
            allowWhatsapp: false,
            allowEmail: false,
            allowVcard: false,
            actionState: {
              requestAccessEnabled: true,
              instantConnectEnabled: false,
              contactMeEnabled: false,
            },
          },
        },
        initialPersonas: [personaFixture],
        isAuthenticated: true,
        currentUser: {
          id: "user-1",
          email: "user@dotly.one",
          isVerified: true,
          security: {
            trustBadge: "verified",
            maskedEmail: "us**@dotly.one",
            mailDeliveryAvailable: true,
            passwordResetAvailable: true,
            smsDeliveryAvailable: true,
            maskedPhoneNumber: null,
            phoneVerificationStatus: "not_enrolled",
            mobileOtpEnrollment: null,
            explanation:
              "Email verification is the first trust factor for your Dotly identity.",
            unlockedActions: ["Send contact requests"],
            restrictedActions: [],
            requirements: [],
            trustFactors: [],
          },
        },
      }),
    );

    expect(
      screen.getByText(/request access from this smart card/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /request access/i })).toBeEnabled();
  });

  it("shows a clear unavailable state when smart card config is missing", () => {
    render(
      React.createElement(RequestAccessPanel, {
        profile: {
          ...profileFixture,
          sharingMode: "smart_card",
          smartCard: null,
          smartCardConfig: null,
        },
        initialPersonas: [personaFixture],
        isAuthenticated: true,
      }),
    );

    expect(
      screen.getByText(/this card is missing its action configuration/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /request access/i }),
    ).not.toBeInTheDocument();
  });

  it("shows verification guidance instead of the request form for unverified users", () => {
    render(
      React.createElement(RequestAccessPanel, {
        profile: profileFixture,
        initialPersonas: [personaFixture],
        isAuthenticated: true,
        currentUser: {
          id: "user-1",
          email: "user@dotly.one",
          isVerified: false,
          security: {
            trustBadge: "attention",
            maskedEmail: "us**@dotly.one",
            mailDeliveryAvailable: true,
            passwordResetAvailable: true,
            smsDeliveryAvailable: true,
            maskedPhoneNumber: null,
            phoneVerificationStatus: "not_enrolled",
            mobileOtpEnrollment: null,
            explanation:
              "Email verification is the first trust factor for your Dotly identity.",
            unlockedActions: [],
            restrictedActions: ["Send contact requests"],
            requirements: [],
            trustFactors: [],
          },
        },
      }),
    );

    expect(
      screen.getByText(/verify your email before sending requests/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /request access/i }),
    ).not.toBeInTheDocument();
  });
});
