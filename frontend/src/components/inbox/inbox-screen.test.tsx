import React from "react";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";

const mocks = vi.hoisted(() => ({
  getIdentityInbox: vi.fn(),
  getIdentityTeamAccess: vi.fn(),
  personaList: vi.fn(),
  useShareFastSnapshot: vi.fn(),
}));

vi.mock("@/lib/api/identities", () => ({
  getIdentityInbox: mocks.getIdentityInbox,
  getIdentityTeamAccess: mocks.getIdentityTeamAccess,
}));

vi.mock("@/lib/api/persona-api", () => ({
  personaApi: {
    list: mocks.personaList,
  },
}));

vi.mock("@/lib/share-fast-store", () => ({
  useShareFastSnapshot: mocks.useShareFastSnapshot,
}));

vi.mock("@/components/identities/identity-switcher", () => ({
  IdentitySwitcher: () => React.createElement("div", null, "identity-switcher"),
}));

import { IdentityProvider } from "@/context/IdentityContext";
import { ConversationStatus, ConversationType } from "@/types/conversation";
import { IdentityType } from "@/types/identity";

import { InboxScreen } from "./inbox-screen";

function renderSubject() {
  return render(
    React.createElement(
      IdentityProvider,
      {
        initialIdentities: [
          {
            id: "identity-1",
            personId: "person-1",
            identityType: IdentityType.Personal,
            displayName: "Grandpa Joe",
            handle: "grandpa-joe",
            verificationLevel: "basic_verified",
            status: "active",
          },
        ],
      },
      React.createElement(InboxScreen),
    ),
  );
}

const personas = [
  {
    id: "persona-1",
    identityId: "identity-1",
    username: "alpha",
    fullName: "Alpha Persona",
    bio: null,
    avatarUrl: null,
    createdAt: "2026-03-20T10:00:00.000Z",
    updatedAt: "2026-03-20T10:00:00.000Z",
    isPrimary: true,
    isDefaultRouting: true,
    accessMode: "open" as const,
    profileId: null,
    metadataJson: null,
    routingKey: "alpha",
    routingDisplayName: "Alpha",
  },
  {
    id: "persona-2",
    identityId: "identity-1",
    username: "beta",
    fullName: "Beta Persona",
    bio: null,
    avatarUrl: null,
    createdAt: "2026-03-21T10:00:00.000Z",
    updatedAt: "2026-03-21T10:00:00.000Z",
    isPrimary: false,
    isDefaultRouting: false,
    accessMode: "open" as const,
    profileId: null,
    metadataJson: null,
    routingKey: "beta",
    routingDisplayName: "Beta",
  },
];

const conversations = [
  {
    conversationId: "conversation-1",
    connectionId: "connection-1",
    personaId: "persona-1",
    sourceIdentityId: "identity-1",
    targetIdentityId: "identity-2",
    conversationType: ConversationType.Direct,
    conversationStatus: ConversationStatus.Active,
    title: "Alpha check-in",
    metadataJson: null,
    lastResolvedAt: null,
    lastPermissionHash: null,
    createdByIdentityId: "identity-1",
    createdAt: "2026-03-24T08:00:00.000Z",
    updatedAt: "2026-03-27T08:00:00.000Z",
  },
  {
    conversationId: "conversation-2",
    connectionId: "connection-2",
    personaId: "persona-1",
    sourceIdentityId: "identity-1",
    targetIdentityId: "identity-3",
    conversationType: ConversationType.BusinessDirect,
    conversationStatus: ConversationStatus.Active,
    title: "Alpha launch prep",
    metadataJson: null,
    lastResolvedAt: null,
    lastPermissionHash: null,
    createdByIdentityId: "identity-1",
    createdAt: "2026-03-24T09:00:00.000Z",
    updatedAt: "2026-03-27T09:00:00.000Z",
  },
  {
    conversationId: "conversation-3",
    connectionId: "connection-3",
    personaId: "persona-2",
    sourceIdentityId: "identity-1",
    targetIdentityId: "identity-4",
    conversationType: ConversationType.Direct,
    conversationStatus: ConversationStatus.Archived,
    title: "Beta archive",
    metadataJson: null,
    lastResolvedAt: null,
    lastPermissionHash: null,
    createdByIdentityId: "identity-1",
    createdAt: "2026-03-22T09:00:00.000Z",
    updatedAt: "2026-03-25T09:00:00.000Z",
  },
  {
    conversationId: "conversation-4",
    connectionId: "connection-4",
    personaId: null,
    sourceIdentityId: "identity-1",
    targetIdentityId: "identity-5",
    conversationType: ConversationType.ProtectedDirect,
    conversationStatus: ConversationStatus.Locked,
    title: "Default follow-up",
    metadataJson: null,
    lastResolvedAt: null,
    lastPermissionHash: null,
    createdByIdentityId: "identity-1",
    createdAt: "2026-03-20T09:00:00.000Z",
    updatedAt: "2026-03-26T09:00:00.000Z",
  },
];

describe("InboxScreen", () => {
  beforeEach(() => {
    mocks.getIdentityInbox.mockReset();
    mocks.getIdentityTeamAccess.mockReset();
    mocks.personaList.mockReset();
    mocks.useShareFastSnapshot.mockReset();

    mocks.personaList.mockResolvedValue(personas);
    mocks.getIdentityInbox.mockResolvedValue(conversations);
    mocks.getIdentityTeamAccess.mockResolvedValue({
      identity: {
        id: "identity-1",
        displayName: "Grandpa Joe",
        handle: "grandpa-joe",
      },
      personas: personas.map((persona) => ({
        id: persona.id,
        username: persona.username,
        fullName: persona.fullName,
        routingKey: persona.routingKey,
        routingDisplayName: persona.routingDisplayName,
        isDefaultRouting: persona.isDefaultRouting,
      })),
      members: [
        {
          id: "member-1",
          personId: "person-1",
          email: "member@dotly.one",
          role: "OWNER",
          status: "ACTIVE",
          assignedPersonaIds: [],
          assignedPersonas: [],
          accessMode: "full",
        },
      ],
      operators: [
        {
          id: "operator-1",
          personId: "person-2",
          email: "operator@dotly.one",
          role: "ADMIN",
          status: "ACTIVE",
          assignedPersonaIds: ["persona-1"],
          assignedPersonas: [
            {
              id: "persona-1",
              username: "alpha",
              fullName: "Alpha Persona",
              routingKey: "alpha",
              routingDisplayName: "Alpha",
              isDefaultRouting: true,
            },
          ],
          accessMode: "restricted",
        },
      ],
    });
    mocks.useShareFastSnapshot.mockReturnValue({
      selectedPersonaId: "persona-1",
    });
  });

  it("renders grouped inbox summaries and assignment scope metadata", async () => {
    renderSubject();

    await waitFor(() => {
      expect(mocks.getIdentityInbox).toHaveBeenCalledWith({
        identityId: "identity-1",
      });
    });

    expect(screen.getByText(/visible threads/i)).toBeInTheDocument();
    expect(screen.getByText(/1 restricted seat/i)).toBeInTheDocument();
    expect(screen.getByText(/1 full seat/i)).toBeInTheDocument();
    expect(screen.getAllByText("@alpha")).toHaveLength(2);
    expect(screen.getByText("@beta")).toBeInTheDocument();
    expect(screen.getByText(/identity default thread/i)).toBeInTheDocument();
    expect(screen.getByText(/alpha launch prep/i)).toBeInTheDocument();
    expect(screen.getByText(/default follow-up/i)).toBeInTheDocument();
  });

  it("filters by status and persona group", async () => {
    const user = userEvent.setup();
    renderSubject();

    await waitFor(() => {
      expect(screen.getByText(/alpha check-in/i)).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /archived · 1/i }));

    expect(screen.getByText(/beta archive/i)).toBeInTheDocument();
    expect(screen.queryByText(/alpha check-in/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /all · 4/i }));
    await user.click(screen.getByRole("button", { name: /@alpha · 2/i }));

    expect(screen.getByText(/alpha check-in/i)).toBeInTheDocument();
    expect(screen.getByText(/alpha launch prep/i)).toBeInTheDocument();
    expect(screen.queryByText(/beta archive/i)).not.toBeInTheDocument();
  });

  it("shows an error state and retries the inbox load", async () => {
    const user = userEvent.setup();
    mocks.getIdentityInbox
      .mockRejectedValueOnce(new Error("Unable to load inbox."))
      .mockResolvedValueOnce(conversations.slice(0, 1));

    renderSubject();

    expect(await screen.findByText(/could not load inbox/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /try again/i }));

    await waitFor(() => {
      expect(mocks.getIdentityInbox).toHaveBeenCalledTimes(2);
    });

    expect(screen.getByText(/alpha check-in/i)).toBeInTheDocument();
  });

  it("falls back to locked assignment copy when team access is not manageable", async () => {
    mocks.getIdentityTeamAccess.mockRejectedValue(
      new ApiError(
        "You do not have permission to manage persona inbox assignments for this identity",
        403,
      ),
    );

    renderSubject();

    await waitFor(() => {
      expect(
        screen.getByText(
          /persona coverage is managed by identity owners and admin operators/i,
        ),
      ).toBeInTheDocument();
    });

    expect(
      screen.getByRole("link", { name: /review assignment scope/i }),
    ).toHaveAttribute("href", "/app/inbox/assignments");
  });
});