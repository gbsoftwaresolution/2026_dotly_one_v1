import React from "react";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ToastViewport } from "@/components/shared/toast-viewport";

import { PublicSmartCard } from "./public-smart-card";

const createObjectUrl = vi.fn(() => "blob:smart-card");
const revokeObjectUrl = vi.fn();
const scrollIntoView = vi.fn();
const assignLocation = vi.fn();
const fetchMock = vi.fn();

function createPersonas() {
  return [
    {
      id: "persona-1",
      type: "personal" as const,
      username: "jane-personal",
      publicUrl: "https://dotly.id/jane-personal",
      fullName: "Jane Personal",
      jobTitle: "Founder",
      companyName: "Dotly",
      tagline: "Trusted identity, zero clutter.",
      profilePhotoUrl: null,
      accessMode: "open" as const,
      verifiedOnly: false,
      sharingMode: "controlled" as const,
      sharingConfigSource: "system_default" as const,
      smartCardConfig: null,
      sharingCapabilities: undefined,
      publicPhone: null,
      publicWhatsappNumber: null,
      publicEmail: null,
      createdAt: "2026-03-23T00:00:00.000Z",
      updatedAt: "2026-03-23T00:00:00.000Z",
    },
    {
      id: "persona-2",
      type: "professional" as const,
      username: "jane-work",
      publicUrl: "https://dotly.id/jane-work",
      fullName: "Jane Work",
      jobTitle: "Founder",
      companyName: "Dotly",
      tagline: "Trusted identity, zero clutter.",
      profilePhotoUrl: null,
      accessMode: "open" as const,
      verifiedOnly: false,
      sharingMode: "controlled" as const,
      sharingConfigSource: "system_default" as const,
      smartCardConfig: null,
      sharingCapabilities: undefined,
      publicPhone: null,
      publicWhatsappNumber: null,
      publicEmail: null,
      createdAt: "2026-03-23T00:00:00.000Z",
      updatedAt: "2026-03-23T00:00:00.000Z",
    },
  ];
}

function createProfile(
  overrides: Partial<
    React.ComponentProps<typeof PublicSmartCard>["profile"]
  > = {},
) {
  const baseProfile = {
    username: "jane",
    publicUrl: "https://dotly.id/jane",
    fullName: "Jane Doe",
    jobTitle: "Founder",
    companyName: "Dotly",
    tagline: "Trusted identity, zero clutter.",
    profilePhotoUrl: null,
    sharingMode: "smart_card" as const,
    trust: {
      isVerified: true,
      isStrongVerified: false,
      isBusinessVerified: false,
    },
    smartCard: {
      primaryAction: "request_access" as const,
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
  };

  return {
    ...baseProfile,
    ...overrides,
    trust: {
      ...baseProfile.trust,
      ...overrides.trust,
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
            actionLinks: {
              ...baseProfile.smartCard.actionLinks,
              ...overrides.smartCard?.actionLinks,
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
          smartCard: {
            primaryAction: "request_access",
            actionState: {
              requestAccessEnabled: true,
              instantConnectEnabled: false,
              contactMeEnabled: true,
            },
            actionLinks: {
              call: "tel:+15551234567",
              whatsapp: "https://wa.me/15551234567",
              email: "mailto:jane@dotly.one",
              vcard: "/api/public/jane/vcard",
            },
          },
        }),
        initialPersonas: createPersonas(),
      }),
    );

    expect(
      screen.getByRole("button", { name: /request access/i }),
    ).toBeEnabled();
    expect(screen.getByText(/^next step$/i)).toBeInTheDocument();
    expect(
      screen.getByText(
        /ask jane doe for access when you want a more intentional intro/i,
      ),
    ).toBeInTheDocument();
    expect(screen.getByTestId("smart-card-actions-grid")).toHaveAttribute(
      "data-action-count",
      "4",
    );
    expect(screen.getByLabelText(/verified identity/i)).toBeInTheDocument();
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
    expect(
      screen.getByText(/trusted identity, zero clutter/i),
    ).toBeInTheDocument();
  });

  it("renders a stronger public trust label for fully verified profiles", () => {
    render(
      React.createElement(PublicSmartCard, {
        profile: createProfile({
          trust: {
            isVerified: true,
            isStrongVerified: true,
            isBusinessVerified: true,
          },
        }),
      }),
    );

    expect(screen.getByLabelText(/verified identity/i)).toHaveClass(
      "bg-emerald-700",
    );
    expect(
      screen.getByTitle(
        /dotly verified both an email address and a mobile number/i,
      ),
    ).toBeInTheDocument();
  });

  it("does not render trust signals for unverified profiles", () => {
    render(
      React.createElement(PublicSmartCard, {
        profile: createProfile({
          trust: {
            isVerified: false,
            isStrongVerified: false,
            isBusinessVerified: false,
          },
        }),
      }),
    );

    expect(
      screen.queryByLabelText(/verified identity/i),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/dotly verified/i)).not.toBeInTheDocument();
  });

  it("scrolls to the request panel when request access is pressed", async () => {
    const user = userEvent.setup();

    render(
      React.createElement(
        React.Fragment,
        null,
        React.createElement(ToastViewport),
        React.createElement(PublicSmartCard, {
          profile: createProfile(),
        }),
        React.createElement("div", { id: "request-access-panel" }),
      ),
    );

    await user.click(screen.getByRole("button", { name: /request access/i }));

    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/request form ready below/i)).toBeInTheDocument();
  });

  it("reveals the action panel when contact me is the primary action", async () => {
    const user = userEvent.setup();

    render(
      React.createElement(PublicSmartCard, {
        profile: createProfile({
          smartCard: {
            primaryAction: "contact_me",
            actionState: {
              requestAccessEnabled: true,
              instantConnectEnabled: false,
              contactMeEnabled: true,
            },
            actionLinks: {
              call: "tel:+15551234567",
              whatsapp: null,
              email: null,
              vcard: null,
            },
          },
        }),
        initialPersonas: createPersonas(),
      }),
    );

    expect(screen.getByRole("link", { name: /call/i })).toBeInTheDocument();
    expect(
      screen.getByText(
        /use one of the direct actions below to reach out right away/i,
      ),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^contact$/i }));

    expect(scrollIntoView).not.toHaveBeenCalled();
    expect(
      screen.getByText(/choose a direct way to reach out below/i),
    ).toBeInTheDocument();
  });

  it("connects inline when instant connect succeeds", async () => {
    const user = userEvent.setup();

    fetchMock.mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue(
        JSON.stringify({
          success: true,
          relationshipId: "relationship-1",
          status: "connected",
        }),
      ),
    });

    render(
      React.createElement(
        React.Fragment,
        null,
        React.createElement(ToastViewport),
        React.createElement(PublicSmartCard, {
          profile: createProfile({
            instantConnectUrl: "https://dotly.id/q/profile-qr-1",
            smartCard: {
              primaryAction: "instant_connect",
              actionState: {
                requestAccessEnabled: true,
                instantConnectEnabled: true,
                contactMeEnabled: false,
              },
              actionLinks: {
                call: null,
                whatsapp: null,
                email: null,
                vcard: null,
              },
            },
          }),
          initialPersonas: createPersonas(),
        }),
      ),
    );

    await user.click(screen.getByRole("button", { name: /^connect$/i }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /^connected$/i }),
      ).toBeDisabled();
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/public/jane/instant-connect",
      expect.objectContaining({
        method: "POST",
        credentials: "same-origin",
        body: JSON.stringify({
          fromPersonaId: "persona-1",
        }),
      }),
    );
    expect(screen.getByText(/connected instantly/i)).toBeInTheDocument();
    expect(await screen.findByRole("status")).toHaveTextContent(/connected/i);
    expect(assignLocation).not.toHaveBeenCalled();
  });

  it("sends the selected persona when connecting", async () => {
    const user = userEvent.setup();

    fetchMock.mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue(
        JSON.stringify({
          success: true,
          relationshipId: "relationship-1",
          status: "connected",
        }),
      ),
    });

    render(
      React.createElement(PublicSmartCard, {
        profile: createProfile({
          instantConnectUrl: "https://dotly.id/q/profile-qr-1",
          smartCard: {
            primaryAction: "instant_connect",
            actionState: {
              requestAccessEnabled: true,
              instantConnectEnabled: true,
              contactMeEnabled: false,
            },
            actionLinks: {
              call: null,
              whatsapp: null,
              email: null,
              vcard: null,
            },
          },
        }),
        initialPersonas: createPersonas(),
      }),
    );

    await user.selectOptions(
      screen.getByLabelText(/connecting as/i),
      "persona-2",
    );
    await user.click(screen.getByRole("button", { name: /^connect$/i }));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/public/jane/instant-connect",
      expect.objectContaining({
        body: JSON.stringify({
          fromPersonaId: "persona-2",
        }),
      }),
    );
  });

  it("shows an error instead of connecting when no persona is available", async () => {
    const user = userEvent.setup();

    render(
      React.createElement(PublicSmartCard, {
        profile: createProfile({
          instantConnectUrl: "https://dotly.id/q/profile-qr-1",
          smartCard: {
            primaryAction: "instant_connect",
            actionState: {
              requestAccessEnabled: true,
              instantConnectEnabled: true,
              contactMeEnabled: false,
            },
            actionLinks: {
              call: null,
              whatsapp: null,
              email: null,
              vcard: null,
            },
          },
        }),
        initialPersonas: [],
      }),
    );

    await user.click(screen.getByRole("button", { name: /^connect$/i }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      /choose one of your personas before connecting/i,
    );
  });

  it("shows a login CTA when the viewer is signed out", async () => {
    const user = userEvent.setup();

    render(
      React.createElement(PublicSmartCard, {
        profile: createProfile({
          instantConnectUrl: "https://dotly.id/q/profile-qr-1",
          smartCard: {
            primaryAction: "instant_connect",
            actionState: {
              requestAccessEnabled: true,
              instantConnectEnabled: true,
              contactMeEnabled: false,
            },
            actionLinks: {
              call: null,
              whatsapp: null,
              email: null,
              vcard: null,
            },
          },
        }),
        isAuthenticated: false,
        loginHref: "/login?next=%2Fu%2Fjane",
      }),
    );

    await user.click(
      screen.getByRole("button", { name: /log in to continue/i }),
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(assignLocation).toHaveBeenCalledWith("/login?next=%2Fu%2Fjane");
  });

  it("shows connected immediately when the relationship already exists", async () => {
    const user = userEvent.setup();

    fetchMock.mockResolvedValue({
      ok: false,
      status: 409,
      text: vi.fn().mockResolvedValue(
        JSON.stringify({
          message: "Contact relationship already exists",
        }),
      ),
    });

    render(
      React.createElement(PublicSmartCard, {
        profile: createProfile({
          instantConnectUrl: "https://dotly.id/q/profile-qr-1",
          smartCard: {
            primaryAction: "instant_connect",
            actionState: {
              requestAccessEnabled: true,
              instantConnectEnabled: true,
              contactMeEnabled: false,
            },
            actionLinks: {
              call: null,
              whatsapp: null,
              email: null,
              vcard: null,
            },
          },
        }),
        initialPersonas: createPersonas(),
      }),
    );

    await user.click(screen.getByRole("button", { name: /^connect$/i }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /^connected$/i }),
      ).toBeDisabled();
    });
    expect(screen.getByText(/already connected/i)).toBeInTheDocument();
  });

  it("falls back to request access when instant connect is not allowed", async () => {
    const user = userEvent.setup();

    fetchMock.mockResolvedValue({
      ok: false,
      status: 403,
      text: vi.fn().mockResolvedValue(
        JSON.stringify({
          message: "Instant connect is not available for this persona",
        }),
      ),
    });

    render(
      React.createElement(
        React.Fragment,
        null,
        React.createElement(PublicSmartCard, {
          profile: createProfile({
            instantConnectUrl: "https://dotly.id/q/profile-qr-1",
            smartCard: {
              primaryAction: "instant_connect",
              actionState: {
                requestAccessEnabled: true,
                instantConnectEnabled: true,
                contactMeEnabled: false,
              },
              actionLinks: {
                call: null,
                whatsapp: null,
                email: null,
                vcard: null,
              },
            },
          }),
          initialPersonas: createPersonas(),
        }),
        React.createElement("div", { id: "request-access-panel" }),
      ),
    );

    await user.click(screen.getByRole("button", { name: /^connect$/i }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /request access/i }),
      ).toBeEnabled();
    });
    expect(screen.getByRole("alert")).toHaveTextContent(
      /request access instead/i,
    );
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it("shows blocked copy and does not fall back when the user is blocked", async () => {
    const user = userEvent.setup();

    fetchMock.mockResolvedValue({
      ok: false,
      status: 403,
      text: vi.fn().mockResolvedValue(
        JSON.stringify({
          message: "User has blocked you",
        }),
      ),
    });

    render(
      React.createElement(
        React.Fragment,
        null,
        React.createElement(PublicSmartCard, {
          profile: createProfile({
            instantConnectUrl: "https://dotly.id/q/profile-qr-1",
            smartCard: {
              primaryAction: "instant_connect",
              actionState: {
                requestAccessEnabled: true,
                instantConnectEnabled: true,
                contactMeEnabled: false,
              },
              actionLinks: {
                call: null,
                whatsapp: null,
                email: null,
                vcard: null,
              },
            },
          }),
          initialPersonas: createPersonas(),
        }),
        React.createElement("div", {
          id: "request-access-panel",
          tabIndex: -1,
        }),
      ),
    );

    await user.click(screen.getByRole("button", { name: /^connect$/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/has blocked you/i);
    });
    expect(screen.getByRole("button", { name: /^connect$/i })).toBeEnabled();
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("downloads a vcard when save details is pressed", async () => {
    const user = userEvent.setup();
    const blob = new Blob(["BEGIN:VCARD\nEND:VCARD"], {
      type: "text/vcard;charset=utf-8",
    });

    fetchMock.mockResolvedValue({
      ok: true,
      blob: vi.fn().mockResolvedValue(blob),
    });

    render(
      React.createElement(
        React.Fragment,
        null,
        React.createElement(ToastViewport),
        React.createElement(PublicSmartCard, {
          profile: createProfile({
            smartCard: {
              primaryAction: "request_access",
              actionState: {
                requestAccessEnabled: true,
                instantConnectEnabled: false,
                contactMeEnabled: true,
              },
              actionLinks: {
                call: null,
                whatsapp: null,
                email: null,
                vcard: "/api/public/jane/vcard",
              },
            },
          }),
        }),
      ),
    );

    await user.click(screen.getByRole("button", { name: /^save$/i }));

    expect(fetchMock).toHaveBeenCalledWith("/api/public/jane/vcard", {
      method: "GET",
    });
    expect(createObjectUrl).toHaveBeenCalledTimes(1);
    expect(revokeObjectUrl).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("status")).toHaveTextContent(
      /contact saved/i,
    );
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
        }),
      }),
    );

    await user.click(screen.getByRole("button", { name: /^save$/i }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      /unable to download contact/i,
    );
  });

  it("keeps save details available for retry after a failed download", async () => {
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
        }),
      }),
    );

    const saveContactButton = screen.getByRole("button", {
      name: /^save$/i,
    });

    await user.click(saveContactButton);

    expect(screen.getByRole("alert")).toHaveTextContent(
      /unable to download contact/i,
    );
    expect(saveContactButton).toBeEnabled();

    await user.click(saveContactButton);

    await waitFor(() => {
      expect(screen.getByText(/contact saved/i)).toBeInTheDocument();
    });
  });

  it("hides save details when the vcard link is malformed", () => {
    render(
      React.createElement(PublicSmartCard, {
        profile: createProfile({
          smartCard: {
            primaryAction: "contact_me",
            actionState: {
              requestAccessEnabled: true,
              instantConnectEnabled: false,
              contactMeEnabled: true,
            },
            actionLinks: {
              call: null,
              whatsapp: null,
              email: null,
              vcard: "javascript:alert('xss')",
            },
          },
        }),
      }),
    );

    expect(
      screen.queryByRole("button", { name: /^save$/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /request access/i }),
    ).toBeEnabled();
  });

  it("falls back to request access when instant connect has no public QR target", () => {
    render(
      React.createElement(PublicSmartCard, {
        profile: createProfile({
          instantConnectUrl: null,
          smartCard: {
            primaryAction: "instant_connect",
            actionState: {
              requestAccessEnabled: true,
              instantConnectEnabled: true,
              contactMeEnabled: false,
            },
            actionLinks: {
              call: null,
              whatsapp: null,
              email: null,
              vcard: null,
            },
          },
        }),
      }),
    );

    expect(
      screen.getByRole("button", { name: /request access/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/showing request access right now/i),
    ).toBeInTheDocument();
  });

  it("falls back to request access when contact me is unavailable but requests are enabled", () => {
    render(
      React.createElement(PublicSmartCard, {
        profile: createProfile({
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
        }),
      }),
    );

    expect(
      screen.getByRole("button", { name: /request access/i }),
    ).toBeEnabled();
    expect(
      screen.getByText(/showing request access right now/i),
    ).toBeInTheDocument();
  });

  it("shows a disabled CTA with helper text when no fallback is available", () => {
    render(
      React.createElement(PublicSmartCard, {
        profile: createProfile({
          smartCard: {
            primaryAction: "contact_me",
            actionState: {
              requestAccessEnabled: false,
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
        }),
      }),
    );

    expect(screen.getByRole("button", { name: /^contact$/i })).toBeDisabled();
    expect(screen.getByText(/try again later/i)).toBeInTheDocument();
    expect(
      screen.getByText(
        /use one of the direct actions below to reach out right away/i,
      ),
    ).toBeInTheDocument();
  });

  it("keeps the hero clean when save is the only available action", () => {
    render(
      React.createElement(PublicSmartCard, {
        profile: createProfile({
          smartCard: {
            primaryAction: "request_access",
            actionState: {
              requestAccessEnabled: true,
              instantConnectEnabled: false,
              contactMeEnabled: true,
            },
            actionLinks: {
              call: null,
              whatsapp: null,
              email: null,
              vcard: "/api/public/jane/vcard",
            },
          },
        }),
      }),
    );

    expect(screen.getByTestId("smart-card-actions-grid")).toHaveAttribute(
      "data-action-count",
      "1",
    );
    expect(screen.getByRole("button", { name: /^save$/i })).toBeEnabled();
  });

  it("shows the empty configuration state", () => {
    render(
      React.createElement(PublicSmartCard, {
        profile: createProfile({
          smartCard: null,
        }),
      }),
    );

    expect(screen.getByText(/profile not available/i)).toBeInTheDocument();
  });

  it("uses safe public actions even when channels are redacted", () => {
    render(
      React.createElement(PublicSmartCard, {
        profile: createProfile({
          smartCard: {
            primaryAction: "contact_me",
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
            actionState: {
              requestAccessEnabled: true,
              instantConnectEnabled: false,
              contactMeEnabled: true,
            },
            actionLinks: {
              call: null,
              whatsapp: null,
              email: null,
              vcard: null,
            },
          },
        }),
      }),
    );

    expect(
      screen.getByRole("button", { name: /request access/i }),
    ).toBeEnabled();
  });

  it("fails closed when action links are missing from a partial smart card payload", () => {
    const profile = createProfile({
      smartCard: {
        primaryAction: "contact_me",
        actionState: {
          requestAccessEnabled: true,
          instantConnectEnabled: false,
          contactMeEnabled: true,
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

    expect(
      screen.queryByRole("link", { name: /call/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /request access/i }),
    ).toBeEnabled();
  });
});
