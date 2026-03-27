import React from "react";

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { routes } from "@/lib/constants/routes";

const mocks = vi.hoisted(() => ({
  requireServerSession: vi.fn(),
  personaList: vi.fn(),
  userApi: {
    meAnalytics: vi.fn(),
  },
}));

vi.mock("@/lib/auth/protected-route", () => ({
  requireServerSession: mocks.requireServerSession,
}));

vi.mock("@/lib/api/user-api", () => ({
  userApi: mocks.userApi,
}));

vi.mock("@/lib/api", () => ({
  personaApi: {
    list: mocks.personaList,
  },
}));

vi.mock("@/components/identities/identity-switcher", () => ({
  IdentitySwitcher: () => React.createElement("div", null, "IdentitySwitcher"),
}));

vi.mock("@/components/dashboard/persona-inbox-preview", () => ({
  PersonaInboxPreview: () =>
    React.createElement("div", null, "PersonaInboxPreview"),
}));

vi.mock("@/components/app-shell/theme-switcher", () => ({
  ThemeSwitcher: () => React.createElement("div", null, "ThemeSwitcher"),
}));

import AppHomePage from "./page";

describe("AppHomePage", () => {
  beforeEach(() => {
    mocks.requireServerSession.mockReset();
    mocks.personaList.mockReset();
    mocks.userApi.meAnalytics.mockReset();

    mocks.requireServerSession.mockResolvedValue({
      accessToken: "token",
      user: {
        id: "user-1",
        email: "user@dotly.one",
        isVerified: true,
      },
    });

    mocks.userApi.meAnalytics.mockResolvedValue({
      totalConnections: 10,
      connectionsThisMonth: 2,
    });
    mocks.personaList.mockResolvedValue([]);
  });

  it("loads the dashboard with user analytics from the /app home route", async () => {
    const result = await AppHomePage();

    expect(mocks.requireServerSession).toHaveBeenCalledWith(routes.app.home);
    expect(mocks.userApi.meAnalytics).toHaveBeenCalledWith("token");
    expect(mocks.personaList).toHaveBeenCalledWith("token");
    expect(result).toBeTruthy();
  });

  it("shows the first-run activation state when no personas exist yet", async () => {
    const result = await AppHomePage();

    render(result);

    expect(
      screen.getByRole("heading", {
        name: /build your first premium contact identity, user/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /create first persona/i }),
    ).toHaveAttribute("href", routes.app.createPersona);
    expect(
      screen.getByText(/create an identity worth sharing/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/open your share qr/i)).toBeInTheDocument();
  });

  it("shifts the nudge to follow-through after the first share lands", async () => {
    mocks.requireServerSession.mockResolvedValue({
      accessToken: "token",
      user: {
        id: "user-1",
        email: "user@dotly.one",
        isVerified: true,
        activation: {
          milestones: {
            firstPersonaCreatedAt: "2026-03-27T10:00:00.000Z",
            firstQrOpenedAt: "2026-03-27T10:05:00.000Z",
            firstShareCompletedAt: "2026-03-27T10:10:00.000Z",
            firstRequestReceivedAt: null,
          },
          completedCount: 3,
          nextMilestoneKey: "firstRequestReceived",
        },
      },
    });
    mocks.personaList.mockResolvedValue([
      {
        id: "persona-1",
        username: "user",
        fullName: "User Persona",
        isPrimary: true,
      },
    ]);

    const result = await AppHomePage();

    render(result);

    expect(
      screen.getByRole("heading", {
        name: /your first premium intro landed, user/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/your first premium share landed/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /review requests/i }),
    ).toHaveAttribute("href", routes.app.requests);
  });
});
