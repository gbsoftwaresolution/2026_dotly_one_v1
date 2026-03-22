import React from "react";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PublicSmartCard } from "./public-smart-card";

const createObjectUrl = vi.fn(() => "blob:smart-card");
const revokeObjectUrl = vi.fn();

describe("PublicSmartCard", () => {
  beforeEach(() => {
    createObjectUrl.mockClear();
    revokeObjectUrl.mockClear();
    vi.stubGlobal("URL", {
      createObjectURL: createObjectUrl,
      revokeObjectURL: revokeObjectUrl,
    });
  });

  it("renders a request access primary action and direct action links", () => {
    render(
      React.createElement(PublicSmartCard, {
        profile: {
          username: "jane",
          publicUrl: "https://dotly.id/jane",
          name: "Jane Doe",
          fullName: "Jane Doe",
          jobTitle: "Founder",
          companyName: "Dotly",
          tagline: "Trusted identity, zero clutter.",
          profilePhoto: null,
          profilePhotoUrl: null,
          sharingMode: "smart_card",
          channels: {
            phoneNumber: "+1 555 123 4567",
            email: "jane@dotly.one",
          },
          links: [],
          smartCard: {
            primaryAction: "request_access",
            allowCall: true,
            allowWhatsapp: true,
            allowEmail: true,
            allowVcard: true,
          },
          smartCardConfig: {
            primaryAction: "request_access",
            allowCall: true,
            allowWhatsapp: true,
            allowEmail: true,
            allowVcard: true,
          },
        },
      }),
    );

    expect(
      screen.getByRole("link", { name: /request access/i }),
    ).toHaveAttribute("href", "#request-access-panel");
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

  it("reveals the action panel when contact me is the primary action", async () => {
    const user = userEvent.setup();

    render(
      React.createElement(PublicSmartCard, {
        profile: {
          username: "jane",
          publicUrl: "https://dotly.id/jane",
          name: "Jane Doe",
          fullName: "Jane Doe",
          jobTitle: "Founder",
          companyName: "Dotly",
          tagline: "Trusted identity, zero clutter.",
          profilePhoto: null,
          profilePhotoUrl: null,
          sharingMode: "smart_card",
          channels: {
            phoneNumber: "+1 555 123 4567",
            email: null,
          },
          links: [],
          smartCard: {
            primaryAction: "contact_me",
            allowCall: true,
            allowWhatsapp: false,
            allowEmail: false,
            allowVcard: false,
          },
          smartCardConfig: {
            primaryAction: "contact_me",
            allowCall: true,
            allowWhatsapp: false,
            allowEmail: false,
            allowVcard: false,
          },
        },
      }),
    );

    expect(
      screen.queryByRole("link", { name: /call/i }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /contact me/i }));

    expect(screen.getByRole("link", { name: /call/i })).toBeInTheDocument();
  });

  it("downloads a vcard when save contact is pressed", async () => {
    const user = userEvent.setup();

    render(
      React.createElement(PublicSmartCard, {
        profile: {
          username: "jane",
          publicUrl: "https://dotly.id/jane",
          name: "Jane Doe",
          fullName: "Jane Doe",
          jobTitle: "Founder",
          companyName: "Dotly",
          tagline: "Trusted identity, zero clutter.",
          profilePhoto: null,
          profilePhotoUrl: null,
          sharingMode: "smart_card",
          channels: {
            phoneNumber: null,
            email: "jane@dotly.one",
          },
          links: [],
          smartCard: {
            primaryAction: "request_access",
            allowCall: false,
            allowWhatsapp: false,
            allowEmail: false,
            allowVcard: true,
          },
          smartCardConfig: {
            primaryAction: "request_access",
            allowCall: false,
            allowWhatsapp: false,
            allowEmail: false,
            allowVcard: true,
          },
        },
      }),
    );

    await user.click(screen.getByRole("button", { name: /save contact/i }));

    expect(createObjectUrl).toHaveBeenCalledTimes(1);
    expect(revokeObjectUrl).toHaveBeenCalledTimes(1);
  });

  it("shows the empty configuration state", () => {
    render(
      React.createElement(PublicSmartCard, {
        profile: {
          username: "jane",
          publicUrl: "https://dotly.id/jane",
          name: "Jane Doe",
          fullName: "Jane Doe",
          jobTitle: "Founder",
          companyName: "Dotly",
          tagline: "Trusted identity, zero clutter.",
          profilePhoto: null,
          profilePhotoUrl: null,
          sharingMode: "smart_card",
          channels: {
            phoneNumber: null,
            email: null,
          },
          links: [],
          smartCard: null,
          smartCardConfig: null,
        },
      }),
    );

    expect(
      screen.getByText(/missing its public configuration/i),
    ).toBeInTheDocument();
  });
});