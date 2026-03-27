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

import LegacyAppHomePage from "./page";

describe("LegacyAppHomePage", () => {
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

  it("loads the dashboard from the /app-legacy preview route", async () => {
    const result = await LegacyAppHomePage();

    expect(mocks.requireServerSession).toHaveBeenCalledWith(
      routes.legacyApp.home,
    );
    expect(mocks.userApi.meAnalytics).toHaveBeenCalledWith("token");
    expect(mocks.personaList).toHaveBeenCalledWith("token");
    expect(result).toBeTruthy();
  });

  it("shows the old first-run activation copy", async () => {
    const result = await LegacyAppHomePage();

    render(result);

    expect(
      screen.getByRole("heading", {
        name: /let’s get your first dotly ready, user/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/create a profile worth sharing/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/first useful moment/i)).toBeInTheDocument();
  });

  it("shows the historical post-share follow-through state", async () => {
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

    const result = await LegacyAppHomePage();

    render(result);

    expect(
      screen.getByRole("heading", {
        name: /your first intro landed, user/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/your first share landed/i)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /review requests/i }),
    ).toHaveAttribute("href", routes.app.requests);
  });
});
