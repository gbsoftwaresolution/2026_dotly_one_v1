import React from "react";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PublicQrPreviewCard } from "./public-qr-preview-card";

describe("PublicQrPreviewCard", () => {
  it("uses profile language for standard public QR previews", () => {
    render(
      React.createElement(PublicQrPreviewCard, {
        qr: {
          type: "profile",
          code: "abc",
          persona: {
            username: "jane",
            fullName: "Jane Doe",
            jobTitle: "Founder",
            companyName: "Dotly",
            tagline: "Context first.",
            profilePhotoUrl: null,
          },
        },
      }),
    );

    expect(screen.getByText(/^profile$/i)).toBeInTheDocument();
    expect(screen.getByText(/profile preview/i)).toBeInTheDocument();
    expect(
      screen.getByText(/scan to view this dotly profile/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /scanning this qr opens the public profile so they can choose the next step/i,
      ),
    ).toBeInTheDocument();
  });

  it("keeps quick connect previews focused on shared context", () => {
    render(
      React.createElement(PublicQrPreviewCard, {
        qr: {
          type: "quick_connect",
          code: "connect",
          persona: {
            username: "jane",
            fullName: "Jane Doe",
            jobTitle: "Founder",
            companyName: "Dotly",
            tagline: "Context first.",
            profilePhotoUrl: null,
          },
        },
      }),
    );

    expect(screen.getByText(/^quick connect$/i)).toBeInTheDocument();
    expect(screen.getByText(/^who shared this qr$/i)).toBeInTheDocument();
    expect(screen.getByText(/scan to connect on dotly/i)).toBeInTheDocument();
    expect(
      screen.getByText(
        /confirm who shared this qr, then connect from the persona/i,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/temporary intro/i)).toBeInTheDocument();
  });
});
