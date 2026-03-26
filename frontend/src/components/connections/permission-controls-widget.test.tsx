import React from "react";
import { render, screen, act, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { PermissionControlsWidget } from "./permission-controls-widget";
import {
  updatePermissionOverride,
  refreshResolvedPermissions,
} from "@/lib/api/connections";
import { PermissionEffect } from "@/types/connection";

vi.mock("@/lib/api/connections", () => ({
  updatePermissionOverride: vi.fn(),
  refreshResolvedPermissions: vi.fn(),
}));

describe("PermissionControlsWidget", () => {
  const mockConnectionId = "conn-1";
  const categoryNames = [
    "Messaging",
    "Calls",
    "Media & Downloads",
    "Protected Sharing",
    "AI Assistance",
    "Business Actions",
  ] as const;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders all permission groups from the centralized mapping", () => {
    render(
      <PermissionControlsWidget
        connectionId={mockConnectionId}
        initialPermissions={null}
        initialOverrides={[]}
      />,
    );

    for (const categoryName of categoryNames) {
      expect(
        screen.getByRole("button", { name: categoryName }),
      ).toBeInTheDocument();
    }
  });

  it("renders categories and handles changing an override with success state", async () => {
    const user = userEvent.setup();

    vi.mocked(updatePermissionOverride).mockResolvedValue({
      key: "msg.text.send",
      effect: PermissionEffect.Deny,
      createdAt: "2026-03-26T12:00:00Z",
    });

    vi.mocked(refreshResolvedPermissions).mockResolvedValue({
      connectionId: mockConnectionId,
      sourceIdentityId: "1",
      targetIdentityId: "2",
      permissions: {
        "msg.text.send": { finalEffect: PermissionEffect.Deny },
      },
    });

    render(
      <PermissionControlsWidget
        connectionId={mockConnectionId}
        initialPermissions={null}
        initialOverrides={[]}
      />,
    );

    // Expand Messaging category if not already open
    const messagingToggle = screen.getByRole("button", { name: /Messaging/i });
    if (messagingToggle.getAttribute("aria-expanded") === "false") {
      await user.click(messagingToggle);
    }

    // Find the segmented control for "Send messages"
    const radioBlock = screen
      .getAllByLabelText("Block")
      .find((r) => r.getAttribute("name") === "permission-msg.text.send");
    expect(radioBlock).toBeDefined();

    // Change setting
    await act(async () => {
      if (radioBlock) {
        fireEvent.click(radioBlock);
      }
    });

    // Check API calls
    expect(updatePermissionOverride).toHaveBeenCalledWith(
      mockConnectionId,
      "msg.text.send",
      PermissionEffect.Deny,
    );
    expect(refreshResolvedPermissions).toHaveBeenCalledWith(mockConnectionId);

    // Look for success messaging
    expect(
      await screen.findByText("Changes saved securely."),
    ).toBeInTheDocument();
  });

  it("handles and displays api errors during update", async () => {
    const user = userEvent.setup();

    vi.mocked(updatePermissionOverride).mockRejectedValue(
      new Error("Server timeout"),
    );

    render(
      <PermissionControlsWidget
        connectionId={mockConnectionId}
        initialPermissions={null}
        initialOverrides={[]}
      />,
    );

    const messagingToggle = screen.getByRole("button", { name: /Messaging/i });
    if (messagingToggle.getAttribute("aria-expanded") === "false") {
      await user.click(messagingToggle);
    }

    const radioBlock = screen
      .getAllByLabelText("Block")
      .find((r) => r.getAttribute("name") === "permission-msg.text.send");

    await act(async () => {
      if (radioBlock) {
        fireEvent.click(radioBlock);
      }
    });

    // Check error messaging appears
    expect(await screen.findByText("Server timeout")).toBeInTheDocument();
    expect(refreshResolvedPermissions).not.toHaveBeenCalled();
  });
});
