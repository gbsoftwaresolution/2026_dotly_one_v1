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
          fullName: "Jane Doe",
          jobTitle: "Founder",
          companyName: "Dotly",
          tagline: "Trusted identity",
          profilePhotoUrl: null,
          sharingMode: "controlled",
          smartCardConfig: null,
        },
      }),
    );

    expect(screen.getByText(/controlled mode/i)).toBeInTheDocument();
    expect(screen.getByText(/approval-based flow/i)).toBeInTheDocument();
  });

  it("renders smart card mode details and enabled actions", () => {
    render(
      React.createElement(PublicProfileCard, {
        profile: {
          username: "jane",
          fullName: "Jane Doe",
          jobTitle: "Founder",
          companyName: "Dotly",
          tagline: "Trusted identity",
          profilePhotoUrl: null,
          sharingMode: "smart_card",
          smartCardConfig: {
            primaryAction: "instant_connect",
            allowCall: true,
            allowWhatsapp: false,
            allowEmail: true,
            allowVcard: false,
          },
        },
      }),
    );

    expect(screen.getByText(/smart card mode/i)).toBeInTheDocument();
    expect(screen.getByText(/instant connect/i)).toBeInTheDocument();
    expect(screen.getByText(/^call$/i)).toBeInTheDocument();
    expect(screen.getByText(/^email$/i)).toBeInTheDocument();
  });
});