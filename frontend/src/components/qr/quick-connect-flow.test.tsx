import React from "react";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  connectQuick: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  qrApi: {
    connectQuick: mocks.connectQuick,
  },
}));

import { QuickConnectFlow } from "./quick-connect-flow";

describe("QuickConnectFlow", () => {
  it("shows host context and one clear next step before the CTA", () => {
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

    expect(
      screen.getByText(/^connect$/i, { selector: "p" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/jane doe/i)).toBeInTheDocument();
    expect(
      screen.getByText(/tap connect to save jane as a contact/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/what connect does/i)).toBeInTheDocument();
    expect(
      screen.getByText(
        /uses the selected profile below and saves this contact instantly/i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^connect$/i }),
    ).toBeInTheDocument();
  });

  it("shows one obvious follow-up action after a successful connect", async () => {
    const user = userEvent.setup();

    mocks.connectQuick.mockResolvedValue({
      relationshipId: "relationship-1",
      status: "connected",
      accessStartAt: "2026-03-24T10:00:00.000Z",
      accessEndAt: "2026-03-31T10:00:00.000Z",
      targetPersona: {
        id: "persona-host-1",
        username: "jane",
        fullName: "Jane Doe",
        jobTitle: "Founder",
        companyName: "Dotly",
        tagline: "Trusted identity.",
      },
    });

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

    await user.click(screen.getByRole("button", { name: /^connect$/i }));

    await waitFor(() => {
      expect(
        screen.getByRole("link", { name: /open contact/i }),
      ).toBeInTheDocument();
    });

    expect(
      screen.queryByRole("link", { name: /get your own dotly/i }),
    ).not.toBeInTheDocument();
  });
});
