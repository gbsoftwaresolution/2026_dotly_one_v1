import React from "react";

import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  usePathname: vi.fn(),
  clearFirstResponseNudge: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: mocks.usePathname,
}));

vi.mock("@/lib/api/user-api", () => ({
  userApi: {
    clearFirstResponseNudge: mocks.clearFirstResponseNudge,
  },
}));

import { ActivationNudgeProvider } from "@/context/ActivationNudgeContext";

import { BottomNav } from "./bottom-nav";

describe("BottomNav", () => {
  beforeEach(() => {
    mocks.usePathname.mockReset();
    mocks.clearFirstResponseNudge.mockReset();
    mocks.clearFirstResponseNudge.mockResolvedValue({
      cleared: true,
      queue: "requests",
    });
  });

  it("shows a quiet dot on the nudged queue", () => {
    mocks.usePathname.mockReturnValue("/app");

    render(
      <ActivationNudgeProvider
        initialFirstResponseNudge={{
          queue: "requests",
          triggeredAt: "2026-03-27T12:00:00.000Z",
          clearedAt: null,
        }}
      >
        <BottomNav />
      </ActivationNudgeProvider>,
    );

    expect(screen.getByText("New activity in Requests")).toBeInTheDocument();
  });

  it("marks the active destination with stronger shell state", () => {
    mocks.usePathname.mockReturnValue("/app/requests");

    render(
      <ActivationNudgeProvider initialFirstResponseNudge={null}>
        <BottomNav />
      </ActivationNudgeProvider>,
    );

    expect(screen.getByRole("link", { name: "Requests" })).toHaveAttribute(
      "data-active",
      "true",
    );
  });

  it("clears the nudge once the queue route is opened", async () => {
    mocks.usePathname.mockReturnValue("/app/requests");

    render(
      <ActivationNudgeProvider
        initialFirstResponseNudge={{
          queue: "requests",
          triggeredAt: "2026-03-27T12:00:00.000Z",
          clearedAt: null,
        }}
      >
        <BottomNav />
      </ActivationNudgeProvider>,
    );

    await waitFor(() => {
      expect(mocks.clearFirstResponseNudge).toHaveBeenCalledWith("requests");
    });
  });
});
