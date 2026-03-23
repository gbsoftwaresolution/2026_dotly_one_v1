import React from "react";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PublicQrPreviewCard } from "./public-qr-preview-card";

describe("PublicQrPreviewCard", () => {
  it("uses profile access language for standard public QR previews", () => {
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

    expect(screen.getByText(/^profile access$/i)).toBeInTheDocument();
    expect(screen.getByText(/profile preview/i)).toBeInTheDocument();
    expect(
      screen.getByText(/this profile gives context before access/i),
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
    expect(screen.getByText(/shared context/i)).toBeInTheDocument();
    expect(
      screen.getByText(
        /review who you are meeting before you choose the right persona/i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/temporary, permissioned access/i),
    ).toBeInTheDocument();
  });
});
