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

    expect(screen.getByText(/^quick connect$/i)).toBeInTheDocument();
    expect(screen.getByText(/jane doe/i)).toBeInTheDocument();
    expect(
      screen.getByText(/start a temporary connection while this introduction is still fresh/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/what happens next/i)).toBeInTheDocument();
    expect(screen.getByText(/choose the persona that matches how you met/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /start temporary access/i }),
    ).toBeInTheDocument();
  });
});