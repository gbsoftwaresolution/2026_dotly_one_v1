import React from "react";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PublicProfileCard } from "./public-profile-card";

describe("PublicProfileCard", () => {
  it("renders controlled mode messaging", () => {
    render(
      React.createElement(PublicProfileCard, {
        profile: {
          username: "jane",
          publicUrl: "https://dotly.id/jane",
          fullName: "Jane Doe",
          jobTitle: "Founder",
          companyName: "Dotly",
          tagline: "Trusted identity",
          profilePhotoUrl: null,
          sharingMode: "controlled",
          smartCard: null,
          trust: {
            isVerified: false,
            isStrongVerified: false,
            isBusinessVerified: false,
          },
        },
      }),
    );

    expect(screen.getByText(/request access/i)).toBeInTheDocument();
    expect(screen.getByText(/you control who can contact you/i)).toBeInTheDocument();
  });

  it("renders smart card mode details and enabled actions", () => {
    render(
      React.createElement(PublicProfileCard, {
        profile: {
          username: "jane",
          publicUrl: "https://dotly.id/jane",
          fullName: "Jane Doe",
          jobTitle: "Founder",
          companyName: "Dotly",
          tagline: "Trusted identity",
          profilePhotoUrl: null,
          sharingMode: "smart_card",
          trust: {
            isVerified: true,
            isStrongVerified: false,
            isBusinessVerified: false,
          },
          smartCard: {
            primaryAction: "instant_connect",
            actionState: {
              requestAccessEnabled: true,
              instantConnectEnabled: true,
              contactMeEnabled: true,
            },
            actionLinks: {
              call: "tel:+15551234567",
              whatsapp: null,
              email: "mailto:jane@dotly.one",
              vcard: null,
            },
          },
        },
      }),
    );

    expect(screen.getByText(/^next step$/i)).toBeInTheDocument();
    expect(screen.getByText(/^connect$/i)).toBeInTheDocument();
    expect(screen.getByText(/choose the next step/i)).toBeInTheDocument();
    expect(screen.getByText(/^verified$/i)).toBeInTheDocument();
    expect(screen.getByText(/^call$/i)).toBeInTheDocument();
    expect(screen.getByText(/^email$/i)).toBeInTheDocument();
  });
});
