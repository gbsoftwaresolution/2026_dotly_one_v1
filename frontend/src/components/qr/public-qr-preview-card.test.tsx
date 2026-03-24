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

    expect(screen.getByText(/^contact$/i)).toBeInTheDocument();
    expect(screen.getByText(/contact preview/i)).toBeInTheDocument();
    expect(screen.getByText(/scan to view my contact/i)).toBeInTheDocument();
    expect(
      screen.getByText(/open this person's contact and choose the next step/i),
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

    expect(screen.getByText(/^connect$/i)).toBeInTheDocument();
    expect(screen.getByText(/^who shared this$/i)).toBeInTheDocument();
    expect(screen.getByText(/scan to connect on dotly/i)).toBeInTheDocument();
    expect(
      screen.getByText(/about to connect with this person\. confirm the name/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/connect from this qr/i)).toBeInTheDocument();
  });
});
