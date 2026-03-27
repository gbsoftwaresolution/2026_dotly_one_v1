import React from "react";

import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { routes } from "@/lib/constants/routes";
import { IdentityType } from "@/types/identity";
import {
  ConnectionStatus,
  ConnectionType,
  PermissionEffect,
  RelationshipType,
  TrustState,
} from "@/types/connection";

const mocks = vi.hoisted(() => ({
  requireServerSession: vi.fn(),
  getConnection: vi.fn(),
  getResolvedPermissions: vi.fn(),
  listPermissionOverrides: vi.fn(),
  getOrCreateConversationForConnection: vi.fn(),
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mocks.push,
  }),
}));

vi.mock("@/lib/auth/protected-route", () => ({
  requireServerSession: mocks.requireServerSession,
}));

vi.mock("@/lib/api/connections", () => ({
  getConnection: mocks.getConnection,
  getResolvedPermissions: mocks.getResolvedPermissions,
  listPermissionOverrides: mocks.listPermissionOverrides,
}));

vi.mock("@/lib/conversation-routing", () => ({
  getOrCreateConversationForConnection:
    mocks.getOrCreateConversationForConnection,
}));

import ConnectionDetailsPage from "./page";

describe("AppConnectionDetailsPage", () => {
  beforeEach(() => {
    mocks.requireServerSession.mockReset();
    mocks.getConnection.mockReset();
    mocks.getResolvedPermissions.mockReset();
    mocks.listPermissionOverrides.mockReset();
    mocks.getOrCreateConversationForConnection.mockReset();
    mocks.push.mockReset();
    mocks.requireServerSession.mockResolvedValue({ accessToken: "token" });
  });

  it("loads connection details and a human-readable permissions summary", async () => {
    mocks.getConnection.mockResolvedValue({
      id: "connection-1",
      sourceIdentityId: "identity-1",
      targetIdentityId: "identity-2",
      connectionType: ConnectionType.Trusted,
      relationshipType: RelationshipType.Friend,
      trustState: TrustState.TrustedByUser,
      status: ConnectionStatus.Active,
      createdByIdentityId: "identity-1",
      note: "Known through the neighborhood center.",
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
        "msg.text.send": {
          finalEffect: PermissionEffect.Allow,
        },
        "media.export": {
          finalEffect: PermissionEffect.Deny,
        },
      },
    });

    mocks.listPermissionOverrides.mockResolvedValue([]);

    const element = await ConnectionDetailsPage({
      params: Promise.resolve({ connectionId: "connection-1" }),
    });

    await act(async () => {
      render(element);
    });

    expect(mocks.requireServerSession).toHaveBeenCalledWith(
      routes.app.connectionDetail("connection-1"),
    );
    expect(await screen.findByText("Mary Johnson")).toBeInTheDocument();
    expect(
      screen.getByText(/known through the neighborhood center/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Access and Permissions")).toBeInTheDocument();
    expect(screen.getByText("Messaging")).toBeInTheDocument();
    expect(screen.getByText("Send messages")).toBeInTheDocument();
  });

  it("opens a real conversation route from the connection detail page", async () => {
    const user = userEvent.setup();

    mocks.getConnection.mockResolvedValue({
      id: "connection-1",
      sourceIdentityId: "identity-1",
      targetIdentityId: "identity-2",
      connectionType: ConnectionType.Trusted,
      relationshipType: RelationshipType.Friend,
      trustState: TrustState.TrustedByUser,
      status: ConnectionStatus.Active,
      createdByIdentityId: "identity-1",
      note: null,
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
      permissions: {},
    });
    mocks.listPermissionOverrides.mockResolvedValue([]);
    mocks.getOrCreateConversationForConnection.mockResolvedValue({
      conversationId: "conversation-1",
    });

    const element = await ConnectionDetailsPage({
      params: Promise.resolve({ connectionId: "connection-1" }),
    });

    await act(async () => {
      render(element);
    });

    await user.click(
      await screen.findByRole("button", { name: /open conversation/i }),
    );

    expect(mocks.getOrCreateConversationForConnection).toHaveBeenCalledWith({
      connectionId: "connection-1",
      sourceIdentityId: "identity-1",
      targetIdentityId: "identity-2",
      createdByIdentityId: "identity-1",
      connectionType: ConnectionType.Trusted,
      relationshipType: RelationshipType.Friend,
    });
    expect(mocks.push).toHaveBeenCalledWith(
      routes.app.conversationDetail("conversation-1"),
    );
  });
});