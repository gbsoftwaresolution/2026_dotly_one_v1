import React from "react";

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  refreshFollowUps: vi.fn(),
  useAppDataSnapshot: vi.fn(),
}));

vi.mock("@/lib/app-data-store", () => ({
  refreshFollowUps: mocks.refreshFollowUps,
  useAppDataSnapshot: mocks.useAppDataSnapshot,
}));

import { PassiveReconnectHint } from "./passive-reconnect-hint";

describe("PassiveReconnectHint", () => {
  beforeEach(() => {
    mocks.refreshFollowUps.mockReset();
    mocks.useAppDataSnapshot.mockReset();
    mocks.refreshFollowUps.mockResolvedValue(undefined);
  });

  it("renders a subtle reconnect nudge for passive reminders", () => {
    mocks.useAppDataSnapshot.mockReturnValue({
      followUps: {
        pending: {
          status: "ready",
          data: [
            {
              id: "follow-up-1",
              relationshipId: "relationship-1",
              remindAt: "2026-03-24T10:00:00.000Z",
              status: "pending",
              isSystemGenerated: true,
              type: "inactivity",
              note: null,
              createdAt: "2026-03-24T10:00:00.000Z",
              updatedAt: "2026-03-24T10:00:00.000Z",
              completedAt: null,
              relationship: {
                relationshipId: "relationship-1",
                targetPersona: null,
              },
              metadata: {
                isTriggered: false,
                isOverdue: false,
                isUpcomingSoon: false,
              },
            },
          ],
        },
      },
    });

    render(
      React.createElement(PassiveReconnectHint, {
        relationshipId: "relationship-1",
      }),
    );

    expect(
      screen.getByText(/consider a thoughtful reconnect/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/it has been a little while since your last exchange/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/reconnect after 2 weeks/i)).toBeInTheDocument();
  });

  it("refreshes pending follow-ups when the store is still idle", () => {
    mocks.useAppDataSnapshot.mockReturnValue({
      followUps: {
        pending: {
          status: "idle",
          data: [],
        },
      },
    });

    render(
      React.createElement(PassiveReconnectHint, {
        relationshipId: "relationship-1",
      }),
    );

    expect(mocks.refreshFollowUps).toHaveBeenCalledWith("pending", {
      processDue: false,
    });
  });
});
