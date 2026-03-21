import React from "react";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getRequestTarget: vi.fn(),
  sendRequest: vi.fn(),
}));

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<object>("@/lib/api");

  return {
    ...actual,
    publicApi: {
      getRequestTarget: mocks.getRequestTarget,
    },
    requestApi: {
      send: mocks.sendRequest,
    },
  };
});

import { RequestAccessPanel } from "./request-access-panel";

const profileFixture = {
  username: "target",
  fullName: "Target User",
  jobTitle: "Founder",
  companyName: "Dotly",
  tagline: "Connect intentionally",
} as const;

const personaFixture = {
  id: "persona-1",
  type: "professional",
  fullName: "Sender Persona",
  username: "sender",
  publicUrl: "dotly.id/sender",
  jobTitle: "Founder",
  companyName: "Dotly",
  tagline: "Build trusted networks",
  profilePhotoUrl: null,
  accessMode: "open" as const,
  verifiedOnly: false,
  createdAt: "2026-03-21T10:00:00.000Z",
  updatedAt: "2026-03-21T10:00:00.000Z",
} as const;

describe("RequestAccessPanel", () => {
  beforeEach(() => {
    mocks.getRequestTarget.mockReset();
    mocks.sendRequest.mockReset();
  });

  it("renders a login CTA for signed-out visitors", () => {
    render(
      React.createElement(RequestAccessPanel, {
        profile: profileFixture,
        initialPersonas: [],
        isAuthenticated: false,
      }),
    );

    expect(
      screen.getByRole("link", { name: /login to connect/i }),
    ).toHaveAttribute("href", "/login?next=%2Fu%2Ftarget");
  });

  it("submits a request from the selected persona", async () => {
    mocks.getRequestTarget.mockResolvedValue({ id: "target-persona" });
    mocks.sendRequest.mockResolvedValue({ id: "request-1" });

    const user = userEvent.setup();

    render(
      React.createElement(RequestAccessPanel, {
        profile: profileFixture,
        initialPersonas: [personaFixture],
        isAuthenticated: true,
      }),
    );

    await user.type(
      screen.getByLabelText(/add context/i),
      "We met at a product meetup.",
    );
    await user.click(screen.getByRole("button", { name: /request access/i }));

    await waitFor(() => {
      expect(mocks.sendRequest).toHaveBeenCalledWith({
        fromPersonaId: "persona-1",
        reason: "We met at a product meetup.",
        sourceId: null,
        sourceType: "profile",
        toPersonaId: "target-persona",
      });
    });

    expect(screen.getByText(/request sent/i)).toBeInTheDocument();
  });
});
