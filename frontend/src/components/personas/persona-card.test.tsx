import React from "react";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PersonaCard } from "./persona-card";

describe("PersonaCard", () => {
  it("renders premium identity cues without clutter", () => {
    render(
      React.createElement(PersonaCard, {
        persona: {
          id: "persona-1",
          type: "professional",
          username: "jane-doe",
          publicUrl: "https://dotly.id/jane-doe",
          fullName: "Jane Doe",
          jobTitle: "Founder",
          companyName: "Dotly",
          tagline: "Trusted identity with calm signal.",
          websiteUrl: "https://dotly.one",
          isVerified: true,
          profilePhotoUrl: null,
          accessMode: "open",
          verifiedOnly: false,
          sharingMode: "controlled",
          smartCardConfig: null,
          publicPhone: null,
          publicWhatsappNumber: null,
          publicEmail: null,
          createdAt: "2026-03-24T00:00:00.000Z",
          updatedAt: "2026-03-24T00:00:00.000Z",
        },
      }),
    );

    expect(
      screen.getByText(/trusted identity with calm signal/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/^verified$/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /dotly\.one/i })).toHaveAttribute(
      "href",
      "https://dotly.one",
    );
  });

  it("hides optional identity rows when values are empty", () => {
    render(
      React.createElement(PersonaCard, {
        persona: {
          id: "persona-2",
          type: "professional",
          username: "jane-doe",
          publicUrl: "https://dotly.id/jane-doe",
          fullName: "Jane Doe",
          jobTitle: "Founder",
          companyName: null,
          tagline: null,
          websiteUrl: null,
          isVerified: false,
          profilePhotoUrl: null,
          accessMode: "request",
          verifiedOnly: false,
          sharingMode: "controlled",
          smartCardConfig: null,
          publicPhone: null,
          publicWhatsappNumber: null,
          publicEmail: null,
          createdAt: "2026-03-24T00:00:00.000Z",
          updatedAt: "2026-03-24T00:00:00.000Z",
        },
      }),
    );

    expect(screen.queryByText(/^verified$/i)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/trusted identity with calm signal/i),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/^company$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^website$/i)).not.toBeInTheDocument();
  });
});
