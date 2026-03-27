import React from "react";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ToastViewport } from "@/components/shared/toast-viewport";

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
  fullName: "Target User",
  jobTitle: "Founder",
  companyName: "Dotly",
  tagline: "Connect intentionally",
  profilePhotoUrl: null,
  sharingMode: "controlled" as const,
  smartCard: null,
  trust: {
    isVerified: false,
    isStrongVerified: false,
    isBusinessVerified: false,
  },
} as const;

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
      screen.getByRole("link", { name: /log in to continue/i }),
    ).toHaveAttribute("href", "/login?next=%2Fu%2Ftarget");
  });

  it("uses the canonical handle from publicUrl for request routing when username is an alias", async () => {
    mocks.getRequestTarget.mockResolvedValue({ username: "target-alias" });
    mocks.sendRequest.mockResolvedValue({ id: "request-1" });

    const user = userEvent.setup();

    render(
      React.createElement(RequestAccessPanel, {
        profile: {
          ...profileFixture,
          username: "target-alias",
          publicUrl: "https://dotly.id/acme",
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
            explanation: "",
            unlockedActions: ["Send contact requests"],
            restrictedActions: [],
            requirements: [
              {
                key: "send_contact_request",
                label: "Send contact requests",
                unlocked: true,
              },
            ],
            trustFactors: [],
          },
        },
      }),
    );

    await user.click(
      screen.getByRole("button", { name: /request to connect/i }),
    );

    await waitFor(() => {
      expect(mocks.getRequestTarget).toHaveBeenCalledWith("acme");
      expect(mocks.sendRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          toUsername: "target-alias",
        }),
        expect.objectContaining({
          requestKey: expect.stringContaining("request-access:acme:persona-1"),
        }),
      );
    });
  });

  it("shows the unavailable state for signed-out visitors when smart card config is missing", () => {
    render(
      React.createElement(RequestAccessPanel, {
        profile: {
          ...profileFixture,
          sharingMode: "smart_card",
          smartCard: null,
        },
        initialPersonas: [],
        isAuthenticated: false,
      }),
    );

    expect(
      screen.getByText(/this profile isn't ready right now/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /log in to continue/i }),
    ).not.toBeInTheDocument();
  });

  it("submits a request from the selected persona", async () => {
    mocks.getRequestTarget.mockResolvedValue({ username: "target" });
    mocks.sendRequest.mockResolvedValue({ id: "request-1" });

    const user = userEvent.setup();

    render(
      React.createElement(
        React.Fragment,
        null,
        React.createElement(ToastViewport),
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
              requirements: [
                {
                  key: "send_contact_request",
                  label: "Send contact requests",
                  unlocked: true,
                },
              ],
              trustFactors: [],
            },
          },
        }),
      ),
    );

    await user.click(
      screen.getByRole("button", { name: /request to connect/i }),
    );

    await waitFor(() => {
      expect(mocks.sendRequest).toHaveBeenCalledWith(
        {
          fromPersonaId: "persona-1",
          reason: undefined,
          sourceId: null,
          sourceType: "profile",
          toUsername: "target",
        },
        expect.objectContaining({
          requestKey: expect.stringContaining(
            "request-access:target:persona-1",
          ),
        }),
      );
    });

    expect(
      screen.getByRole("button", { name: /request sent/i }),
    ).toBeDisabled();
    expect(await screen.findByRole("status")).toHaveTextContent(
      /request sent/i,
    );
  });

  it("blocks sending while offline", async () => {
    const user = userEvent.setup();
    const onlineGetter = vi.spyOn(window.navigator, "onLine", "get");
    onlineGetter.mockReturnValue(false);

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
            explanation: "",
            unlockedActions: ["Send contact requests"],
            restrictedActions: [],
            requirements: [
              {
                key: "send_contact_request",
                label: "Send contact requests",
                unlocked: true,
              },
            ],
            trustFactors: [],
          },
        },
      }),
    );

    window.dispatchEvent(new Event("offline"));
    await user.click(
      screen.getByRole("button", { name: /request to connect/i }),
    );

    expect(mocks.sendRequest).not.toHaveBeenCalled();
    expect(
      screen.getByText(/reconnect to send this request/i),
    ).toBeInTheDocument();

    onlineGetter.mockRestore();
  });

  it("keeps persona and note customization out of the default request flow", async () => {
    const user = userEvent.setup();

    render(
      React.createElement(RequestAccessPanel, {
        profile: profileFixture,
        initialPersonas: [
          personaFixture,
          {
            ...personaFixture,
            id: "persona-2",
            username: "sender-ops",
            fullName: "Sender Ops",
          },
        ],
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
            requirements: [
              {
                key: "send_contact_request",
                label: "Send contact requests",
                unlocked: true,
              },
            ],
            trustFactors: [],
          },
        },
      }),
    );

    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/add a note/i)).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: /use another dotly|keep this dotly|use another profile|choose profile/i,
      }),
    );

    expect(screen.getByRole("button", { name: /send from/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/add a note/i)).toBeInTheDocument();
  });

  it("keeps request-to-connect available when smart card mode uses request_access", async () => {
    mocks.getRequestTarget.mockResolvedValue({ username: "target" });
    mocks.sendRequest.mockResolvedValue({ id: "request-1" });

    const user = userEvent.setup();

    render(
      React.createElement(RequestAccessPanel, {
        profile: {
          ...profileFixture,
          sharingMode: "smart_card",
          smartCard: {
            primaryAction: "request_access",
            actionState: {
              requestAccessEnabled: true,
              instantConnectEnabled: false,
              contactMeEnabled: true,
            },
            actionLinks: {
              call: null,
              whatsapp: "https://wa.me/15551234567",
              email: null,
              vcard: null,
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
            requirements: [
              {
                key: "send_contact_request",
                label: "Send contact requests",
                unlocked: true,
              },
            ],
            trustFactors: [],
          },
        },
      }),
    );

    expect(
      screen.getByRole("heading", { name: /^request to connect with @target$/i }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /request to connect/i }),
    );

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
            actionState: {
              requestAccessEnabled: true,
              instantConnectEnabled: true,
              contactMeEnabled: true,
            },
            actionLinks: {
              call: null,
              whatsapp: "https://wa.me/15551234567",
              email: null,
              vcard: "/v1/public/personas/target/vcard",
            },
          },
        },
        initialPersonas: [personaFixture],
        isAuthenticated: true,
      }),
    );

    expect(screen.getByText(/^connect is the next step$/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /request to connect/i }),
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
            actionState: {
              requestAccessEnabled: true,
              instantConnectEnabled: false,
              contactMeEnabled: false,
            },
            actionLinks: {
              call: null,
              whatsapp: null,
              email: null,
              vcard: null,
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
            requirements: [
              {
                key: "send_contact_request",
                label: "Send contact requests",
                unlocked: true,
              },
            ],
            trustFactors: [],
          },
        },
      }),
    );

    expect(
      screen.getByRole("heading", { name: /^request to connect with @target$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /request to connect/i }),
    ).toBeEnabled();
  });

  it("shows a clear unavailable state when smart card config is missing", () => {
    render(
      React.createElement(RequestAccessPanel, {
        profile: {
          ...profileFixture,
          sharingMode: "smart_card",
          smartCard: null,
        },
        initialPersonas: [personaFixture],
        isAuthenticated: true,
      }),
    );

    expect(
      screen.getByText(/this profile isn't ready right now/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /request to connect/i }),
    ).not.toBeInTheDocument();
  });

  it("shows trust-factor guidance instead of the request form when requests are still gated", () => {
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
      screen.getByText(/verify your account before sending a request/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /request to connect/i }),
    ).not.toBeInTheDocument();
  });
});
