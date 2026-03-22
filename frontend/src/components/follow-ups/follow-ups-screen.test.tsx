import React from "react";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  complete: vi.fn(),
  cancel: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => mocks,
}));

vi.mock("@/lib/api/follow-ups-api", () => ({
  followUpsApi: {
    list: mocks.list,
    complete: mocks.complete,
    cancel: mocks.cancel,
  },
}));

vi.mock("@/lib/utils/auth-errors", () => ({
  isExpiredSessionError: () => false,
}));

import { FollowUpsScreen } from "./follow-ups-screen";

function createFollowUp(overrides: Record<string, unknown> = {}) {
  return {
    id: "follow-up-1",
    relationshipId: "relationship-1",
    remindAt: "2099-04-10T10:00:00.000Z",
    status: "pending",
    note: "Follow up on partnership discussion",
    createdAt: "2099-04-01T09:00:00.000Z",
    updatedAt: "2099-04-01T09:00:00.000Z",
    completedAt: null,
    relationship: {
      relationshipId: "relationship-1",
      state: "approved",
      targetPersona: {
        id: "persona-1",
        username: "alice",
        fullName: "Alice Demo",
        jobTitle: "Founder",
        companyName: "Dotly",
        profilePhotoUrl: null,
      },
    },
    metadata: {
      isOverdue: false,
      isUpcomingSoon: false,
    },
    ...overrides,
  };
}

describe("FollowUpsScreen", () => {
  beforeEach(() => {
    mocks.list.mockReset();
    mocks.complete.mockReset();
    mocks.cancel.mockReset();
    mocks.replace.mockReset();
    mocks.refresh.mockReset();
  });

  it("renders the empty state when no follow-ups exist", async () => {
    mocks.list.mockResolvedValue([]);

    render(React.createElement(FollowUpsScreen));

    expect(mocks.list).toHaveBeenCalledWith({ status: "pending" });
    expect(await screen.findByText(/no follow-ups scheduled/i)).toBeInTheDocument();
  });

  it("renders the load error state and retry action", async () => {
    mocks.list.mockRejectedValueOnce(new Error("network down"));

    render(React.createElement(FollowUpsScreen));

    expect(await screen.findByText(/follow-ups unavailable/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });

  it("completes a follow-up and refreshes the rendered sections", async () => {
    mocks.list.mockResolvedValue([
      createFollowUp(),
    ]);
    mocks.complete.mockResolvedValue(
      createFollowUp({
        status: "completed",
        completedAt: "2099-04-12T10:00:00.000Z",
        updatedAt: "2099-04-12T10:00:00.000Z",
      }),
    );
    const user = userEvent.setup();

    render(React.createElement(FollowUpsScreen));

    expect(
      await screen.findByRole("heading", { name: /pending/i }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^complete$/i }));

    await waitFor(() => {
      expect(mocks.complete).toHaveBeenCalledWith("follow-up-1");
    });

    expect(await screen.findByText(/reminder completed/i)).toBeInTheDocument();
    expect(screen.queryByText("Alice Demo")).not.toBeInTheDocument();
  });

  it("shows action errors without breaking the current list", async () => {
    mocks.list.mockResolvedValue([createFollowUp()]);
    mocks.cancel.mockRejectedValueOnce(new Error("boom"));
    const user = userEvent.setup();

    render(React.createElement(FollowUpsScreen));

    expect(await screen.findByText("Alice Demo")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^cancel$/i }));

    expect(await screen.findByText(/could not cancel this follow-up right now/i)).toBeInTheDocument();
    expect(screen.getByText("Alice Demo")).toBeInTheDocument();
  });

  it("loads a different status when a filter is selected", async () => {
    mocks.list
      .mockResolvedValueOnce([createFollowUp()])
      .mockResolvedValueOnce([
        createFollowUp({
          id: "follow-up-2",
          status: "completed",
          completedAt: "2099-04-11T10:00:00.000Z",
          updatedAt: "2099-04-11T10:00:00.000Z",
        }),
      ]);
    const user = userEvent.setup();

    render(React.createElement(FollowUpsScreen));

    expect(await screen.findByText("Alice Demo")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /completed/i }));

    await waitFor(() => {
      expect(mocks.list).toHaveBeenLastCalledWith({ status: "completed" });
    });

    expect(await screen.findByText(/completed apr/i)).toBeInTheDocument();
  });

  it("degrades safely when relationship summary data is partial", async () => {
    mocks.list.mockResolvedValue([
      createFollowUp({
        relationship: {
          relationshipId: "relationship-1",
          state: null,
          targetPersona: null,
        },
      }),
    ]);

    render(React.createElement(FollowUpsScreen));

    expect(await screen.findByText("Contact unavailable")).toBeInTheDocument();
    expect(screen.queryByText("Alice Demo")).not.toBeInTheDocument();
  });
});