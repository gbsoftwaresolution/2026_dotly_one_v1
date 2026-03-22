import { describe, expect, it } from "vitest";

import {
  hasPublicSmartCardDirectActions,
  normalizeSmartCardPrimaryAction,
  resolvePublicSmartCardPrimaryAction,
  resolvePublicSmartCardPrimaryCta,
} from "./smart-card";

describe("smart-card primary action helpers", () => {
  it("normalizes invalid public primary actions to request access", () => {
    expect(normalizeSmartCardPrimaryAction("invalid_action")).toBe(
      "request_access",
    );
  });

  it("degrades instant connect to request access when no public QR target exists", () => {
    expect(
      resolvePublicSmartCardPrimaryAction("instant_connect", {
        instantConnectUrl: null,
      }),
    ).toBe("request_access");
  });

  it("keeps instant connect when a public QR target exists", () => {
    expect(
      resolvePublicSmartCardPrimaryAction("instant_connect", {
        instantConnectUrl: "https://dotly.id/q/profile-qr-1",
      }),
    ).toBe("instant_connect");
  });

  it("falls back to request access when the chosen action is disabled but requests remain available", () => {
    expect(
      resolvePublicSmartCardPrimaryCta("contact_me", {
        actionState: {
          requestAccessEnabled: true,
          instantConnectEnabled: false,
          contactMeEnabled: false,
        },
        hasDirectActions: false,
      }),
    ).toMatchObject({
      requestedAction: "contact_me",
      action: "request_access",
      helperText: "Request required",
      isFallback: true,
      isDisabled: false,
    });
  });

  it("falls back to request access when no public direct actions are renderable", () => {
    expect(
      resolvePublicSmartCardPrimaryCta("contact_me", {
        actionState: {
          requestAccessEnabled: true,
          instantConnectEnabled: false,
          contactMeEnabled: true,
        },
        hasDirectActions: false,
      }),
    ).toMatchObject({
      requestedAction: "contact_me",
      action: "request_access",
      isFallback: true,
      isDisabled: false,
    });
  });

  it("keeps the chosen action disabled when no fallback is available", () => {
    expect(
      resolvePublicSmartCardPrimaryCta("contact_me", {
        actionState: {
          requestAccessEnabled: false,
          instantConnectEnabled: false,
          contactMeEnabled: false,
        },
        hasDirectActions: false,
      }),
    ).toMatchObject({
      requestedAction: "contact_me",
      action: "contact_me",
      helperText: "Direct contact unavailable",
      isFallback: false,
      isDisabled: true,
    });
  });

  it("treats only non-null action links as renderable direct actions", () => {
    expect(
      hasPublicSmartCardDirectActions({
        channels: {
          phoneNumber: null,
          email: null,
        },
        publicActions: {
          phone: null,
          whatsappNumber: null,
          email: null,
        },
        smartCard: {
          primaryAction: "contact_me",
          allowCall: true,
          allowWhatsapp: true,
          allowEmail: true,
          allowVcard: false,
          actionState: {
            requestAccessEnabled: true,
            instantConnectEnabled: false,
            contactMeEnabled: true,
          },
          actions: {
            call: true,
            whatsapp: true,
            email: true,
            vcard: false,
          },
          actionLinks: {
            call: null,
            whatsapp: null,
            email: null,
            vcard: null,
          },
        },
      }),
    ).toBe(false);

    expect(
      hasPublicSmartCardDirectActions({
        channels: {
          phoneNumber: null,
          email: null,
        },
        publicActions: {
          phone: null,
          whatsappNumber: null,
          email: null,
        },
        smartCard: {
          primaryAction: "contact_me",
          allowCall: false,
          allowWhatsapp: false,
          allowEmail: false,
          allowVcard: true,
          actionState: {
            requestAccessEnabled: true,
            instantConnectEnabled: false,
            contactMeEnabled: true,
          },
          actions: {
            call: false,
            whatsapp: false,
            email: false,
            vcard: true,
          },
          actionLinks: {
            call: null,
            whatsapp: null,
            email: null,
            vcard: "javascript:alert('xss')",
          },
        },
      }),
    ).toBe(false);

    expect(
      hasPublicSmartCardDirectActions({
        channels: {
          phoneNumber: null,
          email: null,
        },
        publicActions: {
          phone: null,
          whatsappNumber: null,
          email: null,
        },
        smartCard: {
          primaryAction: "contact_me",
          allowCall: false,
          allowWhatsapp: false,
          allowEmail: false,
          allowVcard: true,
          actionState: {
            requestAccessEnabled: true,
            instantConnectEnabled: false,
            contactMeEnabled: true,
          },
          actions: {
            call: false,
            whatsapp: false,
            email: false,
            vcard: true,
          },
          actionLinks: {
            call: null,
            whatsapp: null,
            email: null,
            vcard: "/api/public/jane/vcard",
          },
        },
      }),
    ).toBe(true);
  });
});