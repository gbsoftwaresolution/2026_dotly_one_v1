import React from "react";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { IdentityProvider } from "@/context/IdentityContext";
import {
  ConnectionStatus,
  ConnectionType,
  RelationshipType,
  TrustState,
  type IdentityConnection,
} from "@/types/connection";
import { IdentityType, type Identity } from "@/types/identity";

const mocks = vi.hoisted(() => ({
  getIdentityConnections: vi.fn(),
}));

vi.mock("@/lib/api/identities", () => ({
  getIdentityConnections: mocks.getIdentityConnections,
}));

import ConnectionsPage from "./page";

const identities: Identity[] = [
  {
    id: "identity-1",
    personId: "person-1",
    identityType: IdentityType.Personal,
    displayName: "Grandpa Joe",
    handle: "grandpa-joe",
    verificationLevel: "basic_verified",
    status: "active",
  },
  {
    id: "identity-2",
    personId: "person-1",
    identityType: IdentityType.Business,
    displayName: "Repair Shop",
    handle: "repair-shop",
    verificationLevel: "strong_verified",
    status: "active",
  },
];

function createConnection(
  overrides: Partial<IdentityConnection> = {},
): IdentityConnection {
  return {
    id: "connection-1",
    sourceIdentityId: "identity-1",
    targetIdentityId: "identity-2",
    connectionType: ConnectionType.Trusted,
    relationshipType: RelationshipType.Friend,
    trustState: TrustState.TrustedByUser,
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
    sourceIdentity: {
      id: "identity-1",
      displayName: "Grandpa Joe",
      handle: "grandpa-joe",
      identityType: IdentityType.Personal,
      verificationLevel: "basic_verified",
      status: "active",
    },
    ...overrides,
  };
}

function renderPage() {
  return render(
    <IdentityProvider initialIdentities={identities}>
      <ConnectionsPage />
    </IdentityProvider>,
  );
}

describe("ConnectionsPage", () => {
  beforeEach(() => {
    mocks.getIdentityConnections.mockReset();
  });

  it("renders the connections list from the API", async () => {
    mocks.getIdentityConnections.mockResolvedValue([
      createConnection(),
      createConnection({
        id: "connection-2",
        targetIdentity: {
          id: "identity-3",
          displayName: "Repair Desk",
          handle: "repair-desk",
          identityType: IdentityType.Business,
          verificationLevel: "strong_verified",
          status: "active",
        },
      }),
    ]);

    renderPage();

    expect(await screen.findByText("Mary Johnson")).toBeInTheDocument();
    expect(screen.getByText("Repair Desk")).toBeInTheDocument();
  });

  it("supports status, connection type, trust, and relationship filters", async () => {
    const user = userEvent.setup();

    mocks.getIdentityConnections.mockResolvedValue([
      createConnection(),
      createConnection({
        id: "connection-2",
        targetIdentity: {
          id: "identity-4",
          displayName: "Blocked Vendor",
          handle: "blocked-vendor",
          identityType: IdentityType.Business,
          verificationLevel: "basic_verified",
          status: "active",
        },
        status: ConnectionStatus.Blocked,
        connectionType: ConnectionType.Vendor,
        trustState: TrustState.HighRisk,
        relationshipType: RelationshipType.Vendor,
      }),
    ]);

    renderPage();

    expect(await screen.findByText("Mary Johnson")).toBeInTheDocument();

    await user.selectOptions(
      screen.getByLabelText(/filter by status/i),
      ConnectionStatus.Blocked,
    );
    expect(screen.getByText("Blocked Vendor")).toBeInTheDocument();
    expect(screen.queryByText("Mary Johnson")).not.toBeInTheDocument();

    await user.selectOptions(
      screen.getByLabelText(/filter by connection type/i),
      ConnectionType.Vendor,
    );
    await user.selectOptions(
      screen.getByLabelText(/filter by trust state/i),
      TrustState.HighRisk,
    );
    await user.selectOptions(
      screen.getByLabelText(/filter by relationship type/i),
      RelationshipType.Vendor,
    );

    expect(screen.getByText("Blocked Vendor")).toBeInTheDocument();
  });

  it("renders an empty state when no connections exist", async () => {
    mocks.getIdentityConnections.mockResolvedValue([]);

    renderPage();

    expect(
      await screen.findByText(/no connections found/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/does not have any connections yet/i),
    ).toBeInTheDocument();
  });

  it("reloads list data when the active identity changes", async () => {
    const user = userEvent.setup();

    mocks.getIdentityConnections
      .mockResolvedValueOnce([createConnection()])
      .mockResolvedValueOnce([
        createConnection({
          id: "connection-3",
          targetIdentity: {
            id: "identity-5",
            displayName: "Shop Team",
            handle: "shop-team",
            identityType: IdentityType.Business,
            verificationLevel: "strong_verified",
            status: "active",
          },
        }),
      ]);

    renderPage();

    expect(await screen.findByText("Mary Johnson")).toBeInTheDocument();

    await user.selectOptions(
      screen.getByLabelText(/switch identity/i),
      "identity-2",
    );

    await waitFor(() => {
      expect(mocks.getIdentityConnections).toHaveBeenLastCalledWith(
        "identity-2",
      );
    });
  });
});
