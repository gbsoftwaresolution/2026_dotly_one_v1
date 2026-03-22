import React from "react";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PublicSmartCard } from "./public-smart-card";

const createObjectUrl = vi.fn(() => "blob:smart-card");
const revokeObjectUrl = vi.fn();
const scrollIntoView = vi.fn();
const assignLocation = vi.fn();
const fetchMock = vi.fn();

function createProfile(overrides: Partial<React.ComponentProps<typeof PublicSmartCard>["profile"]> = {}) {
  const baseProfile = {
    username: "jane",
    publicUrl: "https://dotly.id/jane",
    name: "Jane Doe",
    fullName: "Jane Doe",
    jobTitle: "Founder",
    companyName: "Dotly",
    tagline: "Trusted identity, zero clutter.",
    profilePhoto: null,
    profilePhotoUrl: null,
    sharingMode: "smart_card" as const,
    publicActions: {
      phone: null,
      whatsappNumber: null,
      email: null,
    },
    smartCard: {
      primaryAction: "request_access" as const,
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
      primaryAction: "request_access" as const,
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
  };

  return {
    ...baseProfile,
    ...overrides,
    publicActions: {
      ...baseProfile.publicActions,
      ...overrides.publicActions,
    },
    smartCard:
      overrides.smartCard === null
        ? null
        : {
            ...baseProfile.smartCard,
            ...overrides.smartCard,
            actionState: {
              ...baseProfile.smartCard.actionState,
              ...overrides.smartCard?.actionState,
            },
            actions: {
              ...baseProfile.smartCard.actions,
              ...overrides.smartCard?.actions,
            },
            actionLinks: {
              ...baseProfile.smartCard.actionLinks,
              ...overrides.smartCard?.actionLinks,
            },
          },
    smartCardConfig:
      overrides.smartCardConfig === null
        ? null
        : {
            ...baseProfile.smartCardConfig,
            ...overrides.smartCardConfig,
            actionState: {
              ...baseProfile.smartCardConfig.actionState,
              ...overrides.smartCardConfig?.actionState,
            },
          },
  };
}

describe("PublicSmartCard", () => {
  beforeEach(() => {
    createObjectUrl.mockClear();
    revokeObjectUrl.mockClear();
    scrollIntoView.mockClear();
    assignLocation.mockClear();
    fetchMock.mockReset();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectUrl,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectUrl,
    });
    vi.stubGlobal("fetch", fetchMock);
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    });
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        assign: assignLocation,
      },
    });
  });

  it("renders a request access primary button and direct action links", () => {
    render(
      React.createElement(PublicSmartCard, {
        profile: createProfile({
          publicActions: {
            phone: "+1 555 123 4567",
            whatsappNumber: "+1 555 123 4567",
            email: "jane@dotly.one",
          },
          smartCard: {
            primaryAction: "request_access",
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
              call: "tel:+15551234567",
              whatsapp: "https://wa.me/15551234567",
              email: "mailto:jane@dotly.one",
              vcard: "/api/public/jane/vcard",
            },
          },
          smartCardConfig: {
            primaryAction: "request_access",
            allowCall: true,
            allowWhatsapp: true,
            allowEmail: true,
            allowVcard: true,
            actionState: {
              requestAccessEnabled: true,
              instantConnectEnabled: false,
              contactMeEnabled: true,
            },
          },
        }),
      }),
    );

    expect(screen.getByRole("button", { name: /request access/i })).toBeEnabled();
    expect(screen.getByText(/4 actions available/i)).toBeInTheDocument();
    expect(
      screen.getByText(/reach out now or save this contact for later/i),
    ).toBeInTheDocument();
    expect(screen.getByTestId("smart-card-actions-grid")).toHaveAttribute(
      "data-action-count",
      "4",
    );
    expect(screen.getByRole("link", { name: /call/i })).toHaveAttribute(
      "href",
      "tel:+15551234567",
    );
    expect(screen.getByRole("link", { name: /whatsapp/i })).toHaveAttribute(
      "href",
      "https://wa.me/15551234567",
    );
    expect(screen.getByRole("link", { name: /email/i })).toHaveAttribute(
      "href",
      "mailto:jane@dotly.one",
    );
  });

  it("scrolls to the request panel when request access is pressed", async () => {
    const user = userEvent.setup();

    render(
      React.createElement(
        React.Fragment,
        null,
        React.createElement(PublicSmartCard, {
          profile: createProfile(),
        }),
        React.createElement("div", { id: "request-access-panel" }),
      ),
    );

    await user.click(screen.getByRole("button", { name: /request access/i }));

    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(
      screen.getByText(/request access is ready below/i),
    ).toBeInTheDocument();
  });

  it("reveals the action panel when contact me is the primary action", async () => {
    const user = userEvent.setup();

    render(
      React.createElement(PublicSmartCard, {
        profile: createProfile({
          publicActions: {
            phone: "+1 555 123 4567",
            whatsappNumber: null,
            email: null,
          },
          smartCard: {
            primaryAction: "contact_me",
            allowCall: false,
            allowWhatsapp: false,
            allowEmail: false,
            allowVcard: false,
            actionState: {
              requestAccessEnabled: true,
              instantConnectEnabled: false,
              contactMeEnabled: true,
            },
            actions: {
              call: false,
              whatsapp: false,
              email: false,
              vcard: false,
            },
            actionLinks: {
              call: "tel:+15551234567",
              whatsapp: null,
              email: null,
              vcard: null,
            },
          },
          smartCardConfig: {
            primaryAction: "contact_me",
            allowCall: true,
            allowWhatsapp: false,
            allowEmail: false,
            allowVcard: false,
            actionState: {
              requestAccessEnabled: true,
              instantConnectEnabled: false,
              contactMeEnabled: true,
            },
          },
        }),
      }),
    );

    expect(screen.getByRole("link", { name: /call/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^contact$/i }));

    await waitFor(() => {
      expect(scrollIntoView).toHaveBeenCalled();
    });
    expect(
      screen.getByText(/direct contact is ready below/i),
    ).toBeInTheDocument();
  });

  it("navigates into the QR flow when instant connect is the primary action", async () => {
    const user = userEvent.setup();

    render(
      React.createElement(PublicSmartCard, {
        profile: createProfile({
          instantConnectUrl: "https://dotly.id/q/profile-qr-1",
          smartCard: {
            primaryAction: "instant_connect",
            allowCall: false,
            allowWhatsapp: false,
            allowEmail: false,
            allowVcard: false,
            actionState: {
              requestAccessEnabled: true,
              instantConnectEnabled: true,
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
            primaryAction: "instant_connect",
            allowCall: false,
            allowWhatsapp: false,
            allowEmail: false,
            allowVcard: false,
            actionState: {
              requestAccessEnabled: true,
              instantConnectEnabled: true,
              contactMeEnabled: false,
            },
          },
        }),
      }),
    );

    await user.click(screen.getByRole("button", { name: /connect instantly/i }));

    expect(assignLocation).toHaveBeenCalledWith(
      "https://dotly.id/q/profile-qr-1",
    );
  });

  it("downloads a vcard when save contact is pressed", async () => {
    const user = userEvent.setup();
    const blob = new Blob(["BEGIN:VCARD\nEND:VCARD"], {
      type: "text/vcard;charset=utf-8",
    });

    fetchMock.mockResolvedValue({
      ok: true,
      blob: vi.fn().mockResolvedValue(blob),
    });

    render(
      React.createElement(PublicSmartCard, {
        profile: createProfile({
          publicActions: {
            phone: null,
            whatsappNumber: null,
            email: "jane@dotly.one",
          },
          smartCard: {
            primaryAction: "request_access",
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
          smartCardConfig: {
            primaryAction: "request_access",
            allowCall: false,
            allowWhatsapp: false,
            allowEmail: false,
            allowVcard: true,
            actionState: {
              requestAccessEnabled: true,
              instantConnectEnabled: false,
              contactMeEnabled: true,
            },
          },
        }),
      }),
    );

    await user.click(screen.getByRole("button", { name: /save contact/i }));

    expect(fetchMock).toHaveBeenCalledWith("/api/public/jane/vcard", {
      method: "GET",
    });
    expect(createObjectUrl).toHaveBeenCalledTimes(1);
    expect(revokeObjectUrl).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/contact download started/i)).toBeInTheDocument();
  });

  it("shows a lightweight error when the vcard download fails", async () => {
    const user = userEvent.setup();

    fetchMock.mockResolvedValue({
      ok: false,
      blob: vi.fn(),
    });

    render(
      React.createElement(PublicSmartCard, {
        profile: createProfile({
          smartCard: {
            primaryAction: "request_access",
            allowCall: false,
            allowWhatsapp: false,
            allowEmail: false,
            allowVcard: true,
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
            actionState: {
              requestAccessEnabled: true,
              instantConnectEnabled: false,
              contactMeEnabled: true,
            },
          },
          smartCardConfig: {
            primaryAction: "request_access",
            allowCall: false,
            allowWhatsapp: false,
            allowEmail: false,
            allowVcard: true,
          },
        }),
      }),
    );

    await user.click(screen.getByRole("button", { name: /save contact/i }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      /unable to download contact/i,
    );
  });

  it("keeps save contact available for retry after a failed download", async () => {
    const user = userEvent.setup();
    const blob = new Blob(["BEGIN:VCARD\nEND:VCARD"], {
      type: "text/vcard;charset=utf-8",
    });

    fetchMock
      .mockResolvedValueOnce({
        ok: false,
        blob: vi.fn(),
      })
      .mockResolvedValueOnce({
        ok: true,
        blob: vi.fn().mockResolvedValue(blob),
      });

    render(
      React.createElement(PublicSmartCard, {
        profile: createProfile({
          smartCard: {
            primaryAction: "request_access",
            allowCall: false,
            allowWhatsapp: false,
            allowEmail: false,
            allowVcard: true,
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
            actionState: {
              requestAccessEnabled: true,
              instantConnectEnabled: false,
              contactMeEnabled: true,
            },
          },
          smartCardConfig: {
            primaryAction: "request_access",
            allowCall: false,
            allowWhatsapp: false,
            allowEmail: false,
            allowVcard: true,
          },
        }),
      }),
    );

    const saveContactButton = screen.getByRole("button", {
      name: /save contact/i,
    });

    await user.click(saveContactButton);

    expect(screen.getByRole("alert")).toHaveTextContent(
      /unable to download contact/i,
    );
    expect(saveContactButton).toBeEnabled();

    await user.click(saveContactButton);

    await waitFor(() => {
      expect(screen.getByText(/contact download started/i)).toBeInTheDocument();
    });
  });

  it("hides save contact when the vcard link is malformed", () => {
    render(
      React.createElement(PublicSmartCard, {
        profile: createProfile({
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
          smartCardConfig: {
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
          },
        }),
      }),
    );

    expect(
      screen.queryByRole("button", { name: /save contact/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/^quick actions$/i),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /request access/i })).toBeEnabled();
  });

  it("falls back to request access when instant connect has no public QR target", () => {
    render(
      React.createElement(PublicSmartCard, {
        profile: createProfile({
          instantConnectUrl: null,
          smartCard: {
            primaryAction: "instant_connect",
            allowCall: false,
            allowWhatsapp: false,
            allowEmail: false,
            allowVcard: false,
            actionState: {
              requestAccessEnabled: true,
              instantConnectEnabled: true,
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
            primaryAction: "instant_connect",
            allowCall: false,
            allowWhatsapp: false,
            allowEmail: false,
            allowVcard: false,
            actionState: {
              requestAccessEnabled: true,
              instantConnectEnabled: true,
              contactMeEnabled: false,
            },
          },
        }),
      }),
    );

    expect(screen.getByRole("button", { name: /request access/i })).toBeInTheDocument();
    expect(screen.getByText(/fallback shown/i)).toBeInTheDocument();
  });

  it("falls back to request access when contact me is unavailable but requests are enabled", () => {
    render(
      React.createElement(PublicSmartCard, {
        profile: createProfile({
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
        }),
      }),
    );

    expect(screen.getByRole("button", { name: /request access/i })).toBeEnabled();
    expect(screen.getByText(/contact me is unavailable/i)).toBeInTheDocument();
  });

  it("shows a disabled CTA with helper text when no fallback is available", () => {
    render(
      React.createElement(PublicSmartCard, {
        profile: createProfile({
          smartCard: {
            primaryAction: "contact_me",
            allowCall: false,
            allowWhatsapp: false,
            allowEmail: false,
            allowVcard: false,
            actionState: {
              requestAccessEnabled: false,
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
              requestAccessEnabled: false,
              instantConnectEnabled: false,
              contactMeEnabled: false,
            },
          },
        }),
      }),
    );

    expect(screen.getByRole("button", { name: /^contact$/i })).toBeDisabled();
    expect(screen.getAllByText(/direct contact unavailable/i)).toHaveLength(2);
    expect(
      screen.queryByText(/^quick actions$/i),
    ).not.toBeInTheDocument();
  });

  it("keeps the panel clean when save contact is the only available action", () => {
    render(
      React.createElement(PublicSmartCard, {
        profile: createProfile({
          smartCard: {
            primaryAction: "request_access",
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
          smartCardConfig: {
            primaryAction: "request_access",
            allowCall: false,
            allowWhatsapp: false,
            allowEmail: false,
            allowVcard: true,
            actionState: {
              requestAccessEnabled: true,
              instantConnectEnabled: false,
              contactMeEnabled: true,
            },
          },
        }),
      }),
    );

    expect(screen.getByText(/1 action available/i)).toBeInTheDocument();
    expect(
      screen.getByText(/save this contact to your device for later/i),
    ).toBeInTheDocument();
    expect(screen.getByTestId("smart-card-actions-grid")).toHaveAttribute(
      "data-action-count",
      "1",
    );
    expect(screen.getByRole("button", { name: /save contact/i })).toBeEnabled();
  });

  it("shows the empty configuration state", () => {
    render(
      React.createElement(PublicSmartCard, {
        profile: createProfile({
          smartCard: null,
          smartCardConfig: null,
        }),
      }),
    );

    expect(
      screen.getByText(/missing its public configuration/i),
    ).toBeInTheDocument();
  });

  it("uses safe public actions even when channels are redacted", () => {
    render(
      React.createElement(PublicSmartCard, {
        profile: createProfile({
          smartCard: {
            primaryAction: "contact_me",
            allowCall: false,
            allowWhatsapp: false,
            allowEmail: false,
            allowVcard: false,
            actionState: {
              requestAccessEnabled: true,
              instantConnectEnabled: false,
              contactMeEnabled: true,
            },
            actions: {
              call: false,
              whatsapp: false,
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
        }),
      }),
    );

    expect(screen.getByRole("link", { name: /whatsapp/i })).toHaveAttribute(
      "href",
      "https://wa.me/15551234567",
    );
  });

  it("hides the actions panel when every action link is null", () => {
    render(
      React.createElement(PublicSmartCard, {
        profile: createProfile({
          smartCard: {
            primaryAction: "contact_me",
            allowCall: true,
            allowWhatsapp: true,
            allowEmail: true,
            allowVcard: true,
            actionState: {
              requestAccessEnabled: true,
              instantConnectEnabled: false,
              contactMeEnabled: true,
            },
            actions: {
              call: true,
              whatsapp: true,
              email: true,
              vcard: true,
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
            allowCall: true,
            allowWhatsapp: true,
            allowEmail: true,
            allowVcard: true,
            actionState: {
              requestAccessEnabled: true,
              instantConnectEnabled: false,
              contactMeEnabled: true,
            },
          },
        }),
      }),
    );

    expect(
      screen.queryByText(/^quick actions$/i),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /request access/i })).toBeEnabled();
  });

  it("fails closed when action links are missing from a partial smart card payload", () => {
    const profile = createProfile({
      smartCard: {
        primaryAction: "contact_me",
        allowCall: true,
        allowWhatsapp: false,
        allowEmail: false,
        allowVcard: false,
        actionState: {
          requestAccessEnabled: true,
          instantConnectEnabled: false,
          contactMeEnabled: true,
        },
        actions: {
          call: true,
          whatsapp: false,
          email: false,
          vcard: false,
        },
        actionLinks: {
          call: "tel:+15551234567",
          whatsapp: null,
          email: null,
          vcard: null,
        },
      },
    });

    delete (profile.smartCard as { actionLinks?: unknown }).actionLinks;

    render(
      React.createElement(PublicSmartCard, {
        profile,
      }),
    );

    expect(screen.queryByText(/^quick actions$/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /call/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /request access/i })).toBeEnabled();
  });
});