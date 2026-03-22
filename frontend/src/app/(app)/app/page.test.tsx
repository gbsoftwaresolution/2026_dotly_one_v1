import React from "react";

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireServerSession: vi.fn(),
  listPersonas: vi.fn(),
  apiRequest: vi.fn(),
}));

vi.mock("@/lib/auth/protected-route", () => ({
  requireServerSession: mocks.requireServerSession,
}));

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<object>("@/lib/api");

  return {
    ...actual,
    personaApi: {
      list: mocks.listPersonas,
    },
  };
});

vi.mock("@/lib/api/client", async () => {
  const actual = await vi.importActual<object>("@/lib/api/client");

  return {
    ...actual,
    apiRequest: mocks.apiRequest,
  };
});

vi.mock("@/components/shared/page-header", () => ({
  PageHeader: ({ title, description }: { title: string; description?: string }) =>
    React.createElement(
      "div",
      null,
      React.createElement("h1", null, title),
      description ? React.createElement("p", null, description) : null,
    ),
}));

vi.mock("@/components/shared/primary-button", () => ({
  PrimaryButton: ({ children }: { children: React.ReactNode }) =>
    React.createElement("button", null, children),
}));

import AppHomePage from "./page";

describe("AppHomePage", () => {
  beforeEach(() => {
    mocks.requireServerSession.mockReset();
    mocks.listPersonas.mockReset();
    mocks.apiRequest.mockReset();

    mocks.requireServerSession.mockResolvedValue({
      accessToken: "token",
      user: {
        id: "user-1",
        email: "user@dotly.one",
        isVerified: true,
      },
    });
  });

  it("prioritizes persona creation when the user has none", async () => {
    mocks.listPersonas.mockResolvedValue([]);
    mocks.apiRequest
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const element = await AppHomePage();
    render(element);

    expect(
      screen.getByRole("heading", { name: /create your first dotly identity/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /create persona/i }),
    ).toHaveAttribute("href", "/app/personas/create");
  });

  it("prioritizes incoming requests ahead of sharing", async () => {
    mocks.listPersonas.mockResolvedValue([
      {
        id: "persona-1",
        type: "professional",
        username: "alex",
        publicUrl: "https://dotly.one/alex",
        fullName: "Alex Example",
        jobTitle: "Founder",
        companyName: "Dotly",
        tagline: "Ready to share",
        accessMode: "request",
        verifiedOnly: false,
        sharingMode: "controlled",
        smartCardConfig: null,
        publicPhone: null,
        publicWhatsappNumber: null,
        publicEmail: null,
        createdAt: "2026-03-23T00:00:00.000Z",
        updatedAt: "2026-03-23T00:00:00.000Z",
      },
    ]);
    mocks.apiRequest
      .mockResolvedValueOnce([
        {
          id: "request-1",
          createdAt: "2026-03-23T00:00:00.000Z",
          sourceType: "profile",
          fromPersona: {
            id: "persona-2",
            username: "jamie",
            fullName: "Jamie Sender",
            jobTitle: "Designer",
            companyName: "Studio",
            profilePhotoUrl: null,
          },
        },
      ])
      .mockResolvedValueOnce([]);

    const element = await AppHomePage();
    render(element);

    expect(screen.getByText(/review pending requests/i)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /review requests/i }),
    ).toHaveAttribute("href", "/app/requests");
  });

  it("prioritizes QR generation when personas exist and requests are clear", async () => {
    mocks.listPersonas.mockResolvedValue([
      {
        id: "persona-1",
        type: "professional",
        username: "alex",
        publicUrl: "https://dotly.one/alex",
        fullName: "Alex Example",
        jobTitle: "Founder",
        companyName: "Dotly",
        tagline: "Ready to share",
        accessMode: "request",
        verifiedOnly: false,
        sharingMode: "controlled",
        smartCardConfig: null,
        publicPhone: null,
        publicWhatsappNumber: null,
        publicEmail: null,
        createdAt: "2026-03-23T00:00:00.000Z",
        updatedAt: "2026-03-23T00:00:00.000Z",
      },
    ]);
    mocks.apiRequest
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const element = await AppHomePage();
    render(element);

    expect(screen.getByText(/share your next introduction/i)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /generate qr/i }),
    ).toHaveAttribute("href", "/app/qr");
  });
});