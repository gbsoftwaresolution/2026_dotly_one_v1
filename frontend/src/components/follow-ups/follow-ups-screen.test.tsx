import React from "react";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ToastViewport } from "@/components/shared/toast-viewport";
import { routes } from "@/lib/constants/routes";

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  processDue: vi.fn(),
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
    processDue: mocks.processDue,
    complete: mocks.complete,
    cancel: mocks.cancel,
  },
}));

vi.mock("@/lib/utils/auth-errors", () => ({
  isExpiredSessionError: () => false,
}));

import { clearAppDataStore } from "@/lib/app-data-store";
import { FollowUpsScreen } from "./follow-ups-screen";

function createFollowUp(overrides: Record<string, unknown> = {}) {
  return {
    id: "follow-up-1",
    relationshipId: "relationship-1",
    remindAt: "2099-04-10T10:00:00.000Z",
    status: "pending",
    isSystemGenerated: false,
    type: "manual",
    note: "Follow up on partnership discussion",
    createdAt: "2099-04-01T09:00:00.000Z",
    updatedAt: "2099-04-01T09:00:00.000Z",
    completedAt: null,
    relationship: {
      relationshipId: "relationship-1",
      state: "approved",
      sourceType: "event",
      sourceLabel: "Tech Summit",
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
      isTriggered: false,
      isOverdue: false,
      isUpcomingSoon: false,
    },
    ...overrides,
  };
}

describe("FollowUpsScreen", () => {
  beforeEach(() => {
    clearAppDataStore();
    mocks.list.mockReset();
    mocks.processDue.mockReset();
    mocks.complete.mockReset();
    mocks.cancel.mockReset();
    mocks.replace.mockReset();
    mocks.refresh.mockReset();
    mocks.processDue.mockResolvedValue({ processedCount: 0 });
  });

  it("renders the empty state when no follow-ups exist", async () => {
    mocks.list.mockResolvedValue([]);

    render(React.createElement(FollowUpsScreen));

    await waitFor(() => {
      expect(mocks.processDue).toHaveBeenCalledTimes(1);
      expect(mocks.list).toHaveBeenCalledWith({ status: "pending" });
    });
    expect(
      await screen.findByText(/nothing to follow up right now/i),
    ).toBeInTheDocument();
  });

  it("renders the load error state and retry action", async () => {
    mocks.list.mockRejectedValueOnce(new Error("network down"));

    render(React.createElement(FollowUpsScreen));

    expect(
      await screen.findByText(/follow-ups unavailable/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /try again/i }),
    ).toBeInTheDocument();
  });

  it("completes a follow-up and refreshes the rendered sections", async () => {
    mocks.list.mockResolvedValue([createFollowUp()]);
    mocks.complete.mockResolvedValue(
      createFollowUp({
        status: "completed",
        completedAt: "2099-04-12T10:00:00.000Z",
        updatedAt: "2099-04-12T10:00:00.000Z",
      }),
    );
    const user = userEvent.setup();

    render(
      React.createElement(
        React.Fragment,
        null,
        React.createElement(ToastViewport),
        React.createElement(FollowUpsScreen),
      ),
    );

    expect(
      await screen.findByRole("heading", { name: /^next up$/i }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^mark done$/i }));

    await waitFor(() => {
      expect(mocks.complete).toHaveBeenCalledWith("follow-up-1");
    });

    expect(await screen.findByRole("status")).toHaveTextContent(
      /marked complete/i,
    );
    expect(screen.queryByText("Alice Demo")).not.toBeInTheDocument();
  });

  it("shows action errors without breaking the current list", async () => {
    mocks.list.mockResolvedValue([createFollowUp()]);
    mocks.cancel.mockRejectedValueOnce(new Error("boom"));
    const user = userEvent.setup();

    render(React.createElement(FollowUpsScreen));

    expect(await screen.findByText("Alice Demo")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^dismiss$/i }));

    expect(
      await screen.findByText(/could not cancel this follow-up right now/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Alice Demo")).toBeInTheDocument();
  });

  it("loads a different status when a filter is selected", async () => {
    mocks.list.mockResolvedValueOnce([createFollowUp()]).mockResolvedValueOnce([
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
    await user.click(screen.getByRole("button", { name: /^done$/i }));

    await waitFor(() => {
      expect(mocks.list).toHaveBeenLastCalledWith({ status: "completed" });
    });

    expect(mocks.processDue).toHaveBeenCalledTimes(1);

    expect(await screen.findByText(/finished apr/i)).toBeInTheDocument();
  });

  it("groups pending reminders by urgency so due work stays near the top", async () => {
    mocks.list.mockResolvedValue([
      createFollowUp({
        id: "follow-up-overdue",
        relationshipId: "relationship-overdue",
        remindAt: "2026-03-20T08:00:00.000Z",
        relationship: {
          relationshipId: "relationship-overdue",
          state: "approved",
          sourceType: "event",
          sourceLabel: "Tech Summit",
          targetPersona: {
            id: "persona-overdue",
            username: "olivia",
            fullName: "Olivia Overdue",
            jobTitle: "Founder",
            companyName: "North Star",
            profilePhotoUrl: null,
          },
        },
        metadata: {
          isTriggered: false,
          isOverdue: true,
          isUpcomingSoon: false,
        },
      }),
      createFollowUp({
        id: "follow-up-due",
        relationshipId: "relationship-due",
        remindAt: "2026-03-22T12:00:00.000Z",
        relationship: {
          relationshipId: "relationship-due",
          state: "approved",
          sourceType: "event",
          sourceLabel: "Tech Summit",
          targetPersona: {
            id: "persona-due",
            username: "dylan",
            fullName: "Dylan Due",
            jobTitle: "Operator",
            companyName: "Harbor",
            profilePhotoUrl: null,
          },
        },
        metadata: {
          isTriggered: true,
          isOverdue: false,
          isUpcomingSoon: false,
        },
      }),
      createFollowUp({
        id: "follow-up-soon",
        relationshipId: "relationship-soon",
        remindAt: "2026-03-23T10:00:00.000Z",
        relationship: {
          relationshipId: "relationship-soon",
          state: "approved",
          sourceType: "event",
          sourceLabel: "Tech Summit",
          targetPersona: {
            id: "persona-soon",
            username: "sasha",
            fullName: "Sasha Soon",
            jobTitle: "Designer",
            companyName: "Orbit",
            profilePhotoUrl: null,
          },
        },
        metadata: {
          isTriggered: false,
          isOverdue: false,
          isUpcomingSoon: true,
        },
      }),
      createFollowUp({
        id: "follow-up-later",
        relationshipId: "relationship-later",
        remindAt: "2026-03-29T10:00:00.000Z",
        relationship: {
          relationshipId: "relationship-later",
          state: "approved",
          sourceType: "event",
          sourceLabel: "Tech Summit",
          targetPersona: {
            id: "persona-later",
            username: "liam",
            fullName: "Liam Later",
            jobTitle: "Engineer",
            companyName: "Atlas",
            profilePhotoUrl: null,
          },
        },
      }),
    ]);

    render(React.createElement(FollowUpsScreen));

    expect(
      await screen.findByRole("heading", { name: /overdue/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /ready now/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /coming up/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /later/i })).toBeInTheDocument();
    expect(screen.getByText("Olivia Overdue")).toBeInTheDocument();
    expect(screen.getByText("Dylan Due")).toBeInTheDocument();
    expect(screen.getByText("Sasha Soon")).toBeInTheDocument();
    expect(screen.getByText("Liam Later")).toBeInTheDocument();
    expect(screen.getAllByText("Met at Tech Summit").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link").map((item) => item.textContent)).toEqual(
      ["Olivia Overdue", "Dylan Due", "Sasha Soon", "Liam Later"],
    );
  });

  it("degrades safely when relationship summary data is partial", async () => {
    mocks.list.mockResolvedValue([
      createFollowUp({
        relationship: {
          relationshipId: "relationship-1",
          state: null,
          sourceType: "event",
          sourceLabel: "Tech Summit",
          targetPersona: null,
        },
      }),
    ]);

    render(React.createElement(FollowUpsScreen));

    expect(await screen.findByText("Contact unavailable")).toBeInTheDocument();
    expect(screen.getByText("Met at Tech Summit")).toBeInTheDocument();
    expect(screen.queryByText("Alice Demo")).not.toBeInTheDocument();
  });

  it("renders fallback connection context for qr relationships", async () => {
    mocks.list.mockResolvedValue([
      createFollowUp({
        relationship: {
          relationshipId: "relationship-1",
          state: "approved",
          sourceType: "qr",
          sourceLabel: null,
          targetPersona: {
            id: "persona-1",
            username: "alice",
            fullName: "Alice Demo",
            jobTitle: "Founder",
            companyName: "Dotly",
            profilePhotoUrl: null,
          },
        },
      }),
    ]);

    render(React.createElement(FollowUpsScreen));

    expect(await screen.findByText("Connected via QR")).toBeInTheDocument();
  });

  it("renders system-generated follow-ups with softer copy and a set-follow-up action", async () => {
    mocks.list.mockResolvedValue([
      createFollowUp({
        isSystemGenerated: true,
        type: "inactivity",
        note: null,
      }),
    ]);

    render(React.createElement(FollowUpsScreen));

    expect(await screen.findByText(/reach out again/i)).toBeInTheDocument();
    expect(screen.getByText(/stay in touch/i)).toBeInTheDocument();
    expect(screen.getByText(/reconnect after 2 weeks/i)).toBeInTheDocument();
    expect(
      screen.getByText(/you haven't interacted in a while/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /set follow-up/i }),
    ).toHaveAttribute("href", routes.app.contactDetail("relationship-1"));
    expect(screen.getAllByRole("button", { name: /^done$/i })).toHaveLength(2);
  });
});
