import React from "react";

import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ConnectionStatus,
  ConnectionType,
  PermissionEffect,
  RelationshipType,
  TrustState,
} from "@/types/connection";
import { IdentityType } from "@/types/identity";

const mocks = vi.hoisted(() => ({
  getConnection: vi.fn(),
  getResolvedPermissions: vi.fn(),
  explainResolvedPermissions: vi.fn(),
}));

vi.mock("@/lib/api/connections", () => ({
  getConnection: mocks.getConnection,
  getResolvedPermissions: mocks.getResolvedPermissions,
  explainResolvedPermissions: mocks.explainResolvedPermissions,
}));

import { ProtectedConversationScreen } from "./protected-conversation-screen";

describe("ProtectedConversationScreen", () => {
  beforeEach(() => {
    mocks.getConnection.mockReset();
    mocks.getResolvedPermissions.mockReset();
    mocks.explainResolvedPermissions.mockReset();
  });

  it("uses backend explanation text for protected-mode messaging", async () => {
    const user = userEvent.setup();

    mocks.getConnection.mockResolvedValue({
      id: "connection-1",
      sourceIdentityId: "identity-1",
      targetIdentityId: "identity-2",
      connectionType: ConnectionType.Trusted,
      relationshipType: RelationshipType.Friend,
      trustState: TrustState.Restricted,
      status: ConnectionStatus.Active,
      createdByIdentityId: "identity-1",
      createdAt: "2026-03-26T10:00:00.000Z",
      updatedAt: "2026-03-26T10:00:00.000Z",
      targetIdentity: {
        id: "identity-2",
        displayName: "Mary Johnson",
        handle: "mary-johnson",
        identityType: IdentityType.Personal,
        verificationLevel: "basic_verified",
        status: "active",
      },
    });

    mocks.getResolvedPermissions.mockResolvedValue({
      connectionId: "connection-1",
      sourceIdentityId: "identity-1",
      targetIdentityId: "identity-2",
      permissions: {
        "share.location.view": { finalEffect: PermissionEffect.Deny },
        "media.document.send": {
          finalEffect: PermissionEffect.AllowWithLimits,
        },
        "ai.summary.generate": {
          finalEffect: PermissionEffect.RequestApproval,
        },
        "call.video.initiate": { finalEffect: PermissionEffect.Deny },
      },
    });

    mocks.explainResolvedPermissions.mockResolvedValue({
      summaryText:
        "Protected permissions are restricted by backend policy resolution.",
      blockedPermissionKeys: ["share.location.view", "call.video.initiate"],
      protectedPermissionKeys: [
        "share.location.view",
        "media.document.send",
        "ai.summary.generate",
        "call.video.initiate",
      ],
      permissions: [
        {
          key: "media.document.send",
          finalEffect: PermissionEffect.AllowWithLimits,
          reasonCode: "RISK_BLOCKED",
          explanationText:
            "Exports are blocked while safety conditions remain unresolved.",
        },
        {
          key: "call.video.initiate",
          finalEffect: PermissionEffect.Deny,
          reasonCode: "CALL_DENIED_PROTECTED_MODE",
          explanationText:
            "Video calls stay blocked until protected conditions are satisfied.",
        },
      ],
    });

    await act(async () => {
      render(<ProtectedConversationScreen connectionId="connection-1" />);
    });

    expect(
      await screen.findByText("Chat with Mary Johnson"),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(/restricted by backend policy resolution/i),
    ).toHaveLength(2);
    expect(screen.getByText("Protected conversation")).toBeInTheDocument();

    await user.click(
      screen.getByLabelText("Action restricted: Export document"),
    );

    expect(
      screen.getByText(
        /exports are blocked while safety conditions remain unresolved/i,
      ),
    ).toBeInTheDocument();
  });

  it("shows error state and allows retry on failure", async () => {
    const user = userEvent.setup();

    // Initial failure
    mocks.getConnection.mockRejectedValue(new Error("API Timeout"));
    mocks.getResolvedPermissions.mockRejectedValue(new Error("API Timeout"));
    mocks.explainResolvedPermissions.mockRejectedValue(
      new Error("API Timeout"),
    );

    await act(async () => {
      render(<ProtectedConversationScreen connectionId="connection-1" />);
    });

    expect(
      await screen.findByText("Failed to load environment"),
    ).toBeInTheDocument();
    expect(screen.getByText("API Timeout")).toBeInTheDocument();

    // Setup success for retry
    mocks.getConnection.mockResolvedValue({
      id: "connection-1",
      targetIdentity: { displayName: "Mary Johnson" },
    });
    mocks.getResolvedPermissions.mockResolvedValue({
      permissions: {},
    });
    mocks.explainResolvedPermissions.mockResolvedValue({
      summaryText: "Ok",
      permissions: [],
    });

    const retryBtn = screen.getByRole("button", { name: /try again/i });
    await user.click(retryBtn);

    expect(
      await screen.findByText("Chat with Mary Johnson"),
    ).toBeInTheDocument();
    expect(mocks.getConnection).toHaveBeenCalledTimes(2);
  });
});
