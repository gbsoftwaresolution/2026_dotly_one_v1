import React from "react";

import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Contact } from "@/types/contact";

const mocks = vi.hoisted(() => ({
  listContacts: vi.fn(),
  refreshContacts: vi.fn(),
  refreshFollowUps: vi.fn(),
  replace: vi.fn(),
  useAppDataSnapshot: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mocks.replace,
  }),
}));

vi.mock("@/lib/api", () => ({
  contactsApi: {
    list: mocks.listContacts,
  },
}));

vi.mock("@/lib/app-data-store", () => ({
  refreshContacts: mocks.refreshContacts,
  refreshFollowUps: mocks.refreshFollowUps,
  useAppDataSnapshot: mocks.useAppDataSnapshot,
}));

import { ContactsScreen } from "./contacts-screen";

function createContact(
  relationshipId: string,
  fullName: string,
  overrides: Partial<Contact> = {},
): Contact {
  return {
    id: relationshipId,
    relationshipId,
    state: "approved",
    createdAt: "2026-03-08T12:00:00.000Z",
    connectedAt: "2026-03-08T12:00:00.000Z",
    metAt: "2026-03-08T12:00:00.000Z",
    connectionSource: "qr",
    contextLabel: null,
    accessEndAt: null,
    lastInteractionAt: "2026-03-21T12:00:00.000Z",
    interactionCount: 2,
    sourceType: "qr",
    targetPersona: {
      id: `${relationshipId}-persona`,
      username: relationshipId,
      publicUrl: relationshipId,
      fullName,
      jobTitle: "Engineer",
      companyName: "Dotly",
      tagline: "Builder",
      profilePhotoUrl: null,
    },
    memory: {
      metAt: "2026-03-08T12:00:00.000Z",
      sourceLabel: null,
      note: null,
    },
    followUpSummary: {
      hasPendingFollowUp: false,
      nextFollowUpAt: null,
      pendingFollowUpCount: 0,
      hasPassiveInactivityFollowUp: false,
      isTriggered: false,
      isOverdue: false,
      isUpcomingSoon: false,
    },
    metadata: {
      lastInteractionAt: "2026-03-21T12:00:00.000Z",
      interactionCount: 2,
      hasInteractions: true,
      isRecentlyActive: false,
      relationshipAgeDays: 14,
    },
    ...overrides,
  };
}

describe("ContactsScreen", () => {
  beforeEach(() => {
    mocks.listContacts.mockReset();
    mocks.refreshContacts.mockReset();
    mocks.replace.mockReset();
    mocks.useAppDataSnapshot.mockReset();

    mocks.refreshContacts.mockResolvedValue([]);
    mocks.listContacts.mockResolvedValue([]);
  });

  it("groups the list into attention, planned, recent, and all contacts with subtle priority labels", () => {
    mocks.useAppDataSnapshot.mockReturnValue({
      contacts: {
        status: "ready",
        data: [
          createContact("overdue-contact", "Avery Followup", {
            followUpSummary: {
              hasPendingFollowUp: true,
              nextFollowUpAt: "2026-03-20T10:00:00.000Z",
              pendingFollowUpCount: 1,
              hasPassiveInactivityFollowUp: false,
              isTriggered: true,
              isOverdue: true,
              isUpcomingSoon: false,
            },
          }),
          createContact("passive-contact", "Jordan Quiet", {
            followUpSummary: {
              hasPendingFollowUp: true,
              nextFollowUpAt: "2026-03-24T10:00:00.000Z",
              pendingFollowUpCount: 1,
              hasPassiveInactivityFollowUp: true,
              isTriggered: false,
              isOverdue: false,
              isUpcomingSoon: false,
            },
          }),
          createContact("planned-contact", "Casey Planned", {
            followUpSummary: {
              hasPendingFollowUp: true,
              nextFollowUpAt: "2026-03-27T10:00:00.000Z",
              pendingFollowUpCount: 1,
              hasPassiveInactivityFollowUp: false,
              isTriggered: false,
              isOverdue: false,
              isUpcomingSoon: false,
            },
          }),
          createContact("recent-contact", "Mina Recent", {
            metadata: {
              lastInteractionAt: "2026-03-23T12:00:00.000Z",
              interactionCount: 3,
              hasInteractions: true,
              isRecentlyActive: true,
              relationshipAgeDays: 8,
            },
          }),
          createContact("steady-contact", "Taylor Steady"),
        ],
        error: null,
      },
    });

    render(React.createElement(ContactsScreen));

    const needsAttention = screen.getByRole("heading", {
      name: "Needs attention",
    }).closest("section");
    const comingUp = screen.getByRole("heading", {
      name: "Coming up",
    }).closest("section");
    const recentConnections = screen.getByRole("heading", {
      name: "Recent connections",
    }).closest("section");
    const allContacts = screen.getByRole("heading", {
      name: "All contacts",
    }).closest("section");

    expect(needsAttention).not.toBeNull();
  expect(comingUp).not.toBeNull();
    expect(recentConnections).not.toBeNull();
    expect(allContacts).not.toBeNull();

    expect(within(needsAttention!).getByText("Avery Followup")).toBeInTheDocument();
    expect(within(needsAttention!).getByText("Jordan Quiet")).toBeInTheDocument();
  expect(within(needsAttention!).getByText("Overdue")).toBeInTheDocument();
    expect(within(needsAttention!).getByText("Reconnect")).toBeInTheDocument();

  expect(within(comingUp!).getByText("Casey Planned")).toBeInTheDocument();
  expect(within(comingUp!).getByText("Planned")).toBeInTheDocument();

    expect(within(recentConnections!).getByText("Mina Recent")).toBeInTheDocument();
    expect(within(recentConnections!).getByText("Recent")).toBeInTheDocument();

    expect(within(allContacts!).getByText("Taylor Steady")).toBeInTheDocument();
    expect(screen.queryByText("You're all caught up")).not.toBeInTheDocument();
    expect(
      screen.queryByText(/you haven't interacted in a while/i),
    ).not.toBeInTheDocument();
  });

  it("shows a caught-up state when no contact needs attention", () => {
    mocks.useAppDataSnapshot.mockReturnValue({
      contacts: {
        status: "ready",
        data: [
          createContact("recent-contact", "Mina Recent", {
            metadata: {
              lastInteractionAt: "2026-03-23T12:00:00.000Z",
              interactionCount: 3,
              hasInteractions: true,
              isRecentlyActive: true,
              relationshipAgeDays: 8,
            },
          }),
          createContact("steady-contact", "Taylor Steady"),
        ],
        error: null,
      },
    });

    render(React.createElement(ContactsScreen));

    expect(screen.getByText("You're all caught up")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Recent connections" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "All contacts" })).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Needs attention" }),
    ).not.toBeInTheDocument();
  });
});