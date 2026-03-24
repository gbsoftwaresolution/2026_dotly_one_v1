import React from "react";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { QuickConnectFlow } from "./quick-connect-flow";

describe("QuickConnectFlow", () => {
  it("shows host context and flow guidance before the CTA", () => {
    render(
      React.createElement(QuickConnectFlow, {
        code: "qr-123",
        hostName: "Jane Doe",
        hostJobTitle: "Founder",
        hostCompany: "Dotly",
        personas: [
          {
            id: "persona-1",
            type: "professional",
            fullName: "Alex Sender",
            username: "alex",
            publicUrl: "https://dotly.id/alex",
            jobTitle: "Operator",
            companyName: "Dotly",
            tagline: "Keeps relationships warm.",
            profilePhotoUrl: null,
            accessMode: "open",
            verifiedOnly: false,
            sharingMode: "controlled",
            smartCardConfig: null,
            publicPhone: null,
            publicWhatsappNumber: null,
            publicEmail: null,
            createdAt: "2026-03-20T00:00:00.000Z",
            updatedAt: "2026-03-20T00:00:00.000Z",
          },
        ],
      }),
    );

    expect(screen.getByText(/^connect$/i, { selector: "p" })).toBeInTheDocument();
    expect(screen.getByText(/jane doe/i)).toBeInTheDocument();
    expect(
      screen.getByText(/you are ready to connect with jane/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/what happens next/i)).toBeInTheDocument();
    expect(
      screen.getByText(/we will connect using your selected profile/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^connect$/i })).toBeInTheDocument();
  });
});
