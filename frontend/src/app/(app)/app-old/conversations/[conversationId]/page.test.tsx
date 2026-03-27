import React from "react";

import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getConversationContext: vi.fn(),
  getConnection: vi.fn(),
  getResolvedPermissions: vi.fn(),
  explainResolvedPermissions: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mocks.replace,
  }),
}));

vi.mock("@/lib/api/connections", () => ({
  getConversationContext: mocks.getConversationContext,
  getConnection: mocks.getConnection,
  getResolvedPermissions: mocks.getResolvedPermissions,
  explainResolvedPermissions: mocks.explainResolvedPermissions,
}));

import ConversationDetailsPage from "./page";

describe("ConversationDetailsPage", () => {
  beforeEach(() => {
    mocks.getConversationContext.mockReset();
    mocks.getConnection.mockReset();
    mocks.getResolvedPermissions.mockReset();
    mocks.explainResolvedPermissions.mockReset();
    mocks.replace.mockReset();
  });

  it("loads via conversation id and hands off to the protected conversation screen", async () => {
    mocks.getConversationContext.mockResolvedValue({
      conversationId: "conversation-1",
      connectionId: "connection-1",
      sourceIdentityId: "source-1",
      targetIdentityId: "target-1",
      conversationType: "PROTECTED_DIRECT",
      conversationStatus: "ACTIVE",
      title: null,
      metadataJson: null,
      lastResolvedAt: null,
      lastPermissionHash: null,
      createdByIdentityId: "source-1",
      createdAt: "2026-03-26T12:00:00Z",
      updatedAt: "2026-03-26T12:00:00Z",
    });
    mocks.getConnection.mockResolvedValue({
      id: "connection-1",
      sourceIdentityId: "identity-1",
      targetIdentityId: "identity-2",
      connectionType: "trusted",
      relationshipType: "friend",
      trustState: "restricted",
      status: "active",
      createdByIdentityId: "identity-1",
      createdAt: "2026-03-26T10:00:00.000Z",
      updatedAt: "2026-03-26T10:00:00.000Z",
      targetIdentity: {
        id: "identity-2",
        displayName: "Mary Johnson",
        handle: "mary-johnson",
        identityType: "personal",
        verificationLevel: "basic_verified",
        status: "active",
      },
    });
    mocks.getResolvedPermissions.mockResolvedValue({
      connectionId: "connection-1",
      sourceIdentityId: "identity-1",
      targetIdentityId: "identity-2",
      permissions: {
        "share.location.view": { finalEffect: "deny" },
        "media.document.send": { finalEffect: "allow_with_limits" },
        "ai.summary.generate": { finalEffect: "request_approval" },
        "call.video.initiate": { finalEffect: "deny" },
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
      permissions: [],
    });

    await act(async () => {
      render(
        <ConversationDetailsPage
          params={Promise.resolve({ conversationId: "conversation-1" })}
        />,
      );
    });

    expect(
      await screen.findByText("Chat with Mary Johnson"),
    ).toBeInTheDocument();
    expect(mocks.getConversationContext).toHaveBeenCalledWith("conversation-1");
    expect(mocks.getConnection).toHaveBeenCalledWith("connection-1");
  });
});
