import React from "react";

import { act, render, screen } from "@testing-library/react";
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
}));

vi.mock("@/lib/api/connections", () => ({
  getConnection: mocks.getConnection,
  getResolvedPermissions: mocks.getResolvedPermissions,
}));

import ConnectionDetailsPage from "./page";

describe("ConnectionDetailsPage", () => {
  beforeEach(() => {
    mocks.getConnection.mockReset();
    mocks.getResolvedPermissions.mockReset();
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

    await act(async () => {
      render(
        <ConnectionDetailsPage
          params={Promise.resolve({ connectionId: "connection-1" })}
        />,
      );
    });

    expect(await screen.findByText("Mary Johnson")).toBeInTheDocument();
    expect(
      screen.getByText(/known through the neighborhood center/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Permissions Summary")).toBeInTheDocument();
    expect(screen.getByText("Send text messages")).toBeInTheDocument();
    expect(screen.getByText("Not Allowed")).toBeInTheDocument();
  });
});
