import React from "react";

import { describe, expect, it, vi } from "vitest";

import { routes } from "@/lib/constants/routes";

const mocks = vi.hoisted(() => ({
  requireServerSession: vi.fn(),
  list: vi.fn(),
}));

vi.mock("@/lib/auth/protected-route", () => ({
  requireServerSession: mocks.requireServerSession,
}));

vi.mock("@/lib/api", () => ({
  personaApi: {
    list: mocks.list,
  },
}));

vi.mock("@/components/personas/persona-list", () => ({
  PersonaList: () => React.createElement("div", null, "PersonaList"),
}));

vi.mock("@/components/shared/page-header", () => ({
  PageHeader: ({ title }: { title: string }) =>
    React.createElement("div", null, title),
}));

import PersonasPage from "./page";

describe("PersonasPage", () => {
  it("requires the protected session before rendering the app personas route", async () => {
    mocks.requireServerSession.mockResolvedValue({ accessToken: "token" });
    mocks.list.mockResolvedValue([]);

    const element = await PersonasPage();

    expect(mocks.requireServerSession).toHaveBeenCalledWith(routes.app.personas);
    expect(mocks.list).toHaveBeenCalledWith("token");
    expect(element).toBeTruthy();
  });
});