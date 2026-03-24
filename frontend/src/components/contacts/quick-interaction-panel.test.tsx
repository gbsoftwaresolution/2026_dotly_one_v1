import React from "react";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  sendQuickInteraction: vi.fn(),
  refresh: vi.fn(),
  showToast: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: mocks.refresh,
  }),
}));

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<object>("@/lib/api");

  return {
    ...actual,
    contactsApi: {
      sendQuickInteraction: mocks.sendQuickInteraction,
    },
  };
});

vi.mock("@/components/shared/toast-viewport", () => ({
  showToast: mocks.showToast,
}));

import { QuickInteractionPanel } from "./quick-interaction-panel";

describe("QuickInteractionPanel", () => {
  beforeEach(() => {
    mocks.sendQuickInteraction.mockReset();
    mocks.refresh.mockReset();
    mocks.showToast.mockReset();
  });

  it("sends a greeting in one tap and shows recent activity", async () => {
    mocks.sendQuickInteraction.mockResolvedValue({ success: true });

    const user = userEvent.setup();

    render(
      React.createElement(QuickInteractionPanel, {
        relationshipId: "relationship-id",
        recentInteractions: [
          {
            id: "interaction-1",
            type: "THANK_YOU",
            direction: "received",
            createdAt: "2026-03-24T10:00:00.000Z",
          },
        ],
      }),
    );

    await user.click(screen.getByRole("button", { name: /say hi/i }));

    await waitFor(() => {
      expect(mocks.sendQuickInteraction).toHaveBeenCalledWith(
        "relationship-id",
        { type: "GREETING" },
      );
    });

    expect(await screen.findByRole("status")).toHaveTextContent(
      /hi logged to this connection/i,
    );
    expect(screen.getByText("Recent signals")).toBeInTheDocument();
    expect(screen.getByText("They sent thanks")).toBeInTheDocument();
    expect(mocks.showToast).toHaveBeenCalledWith(
      "Hi logged to this connection.",
    );
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });

  it("renders disabled quick actions without any input affordance", () => {
    render(
      React.createElement(QuickInteractionPanel, {
        relationshipId: "relationship-id",
        disabled: true,
      }),
    );

    expect(screen.getByRole("button", { name: /say hi/i })).toBeDisabled();
    expect(
      screen.getByText(/quick interactions are unavailable/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("shows an inline error when sending fails", async () => {
    mocks.sendQuickInteraction.mockRejectedValue(new Error("Network down"));

    const user = userEvent.setup();

    render(
      React.createElement(QuickInteractionPanel, {
        relationshipId: "relationship-id",
      }),
    );

    await user.click(screen.getByRole("button", { name: /thank them/i }));

    expect(
      await screen.findByRole("status"),
    ).toHaveTextContent(/could not send that right now/i);
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("explains that quick signals do not start a chat", () => {
    render(
      React.createElement(QuickInteractionPanel, {
        relationshipId: "relationship-id",
      }),
    );

    expect(
      screen.getByText(/without starting a chat/i),
    ).toBeInTheDocument();
  });
});