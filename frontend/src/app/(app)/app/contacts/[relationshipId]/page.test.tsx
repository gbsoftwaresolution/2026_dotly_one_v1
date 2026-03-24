import React from "react";

import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ContactDetail } from "@/types/contact";

const mocks = vi.hoisted(() => ({
  apiRequest: vi.fn(),
  requireServerSession: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
}));

vi.mock("@/lib/auth/protected-route", () => ({
  requireServerSession: mocks.requireServerSession,
}));

vi.mock("@/lib/api/client", () => ({
  ApiError: class ApiError extends Error {
    status: number;

    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  },
  apiRequest: mocks.apiRequest,
}));

vi.mock("@/components/shared/page-header", () => ({
  PageHeader: ({
    title,
    description,
  }: {
    title: string;
    description?: string;
  }) =>
    React.createElement(
      "header",
      null,
      React.createElement("h1", null, title),
      description ? React.createElement("p", null, description) : null,
    ),
}));

vi.mock("@/components/contacts/note-editor", () => ({
  NoteEditor: ({ initialNote }: { initialNote: string | null }) =>
    React.createElement(
      "div",
      { "data-testid": "note-editor" },
      initialNote ?? "empty-note",
    ),
}));

vi.mock("@/components/follow-ups/contact-follow-up-form", () => ({
  ContactFollowUpForm: ({
    contactName,
    initialFollowUpSummary,
  }: {
    contactName: string;
    initialFollowUpSummary?: {
      hasPendingFollowUp: boolean;
      pendingFollowUpCount: number;
      isTriggered?: boolean;
      isOverdue?: boolean;
    };
  }) =>
    React.createElement(
      "div",
      { "data-testid": "follow-up-form" },
      `Remind ${contactName}`,
      initialFollowUpSummary?.hasPendingFollowUp
        ? ` Pending ${initialFollowUpSummary.pendingFollowUpCount}` +
            (initialFollowUpSummary.isOverdue
              ? " Overdue"
              : initialFollowUpSummary.isTriggered
                ? " Due"
                : "")
        : "",
    ),
}));

vi.mock("@/components/contacts/relationship-actions", () => ({
  RelationshipActions: ({ displayName }: { displayName: string }) =>
    React.createElement(
      "div",
      { "data-testid": "relationship-actions" },
      displayName,
    ),
}));

import ContactDetailPage from "./page";

function createContactDetail(
  overrides: Partial<ContactDetail> = {},
): ContactDetail {
  return {
    relationshipId: "relationship-id",
    state: "approved",
    createdAt: "2026-03-08T12:00:00.000Z",
    connectedAt: "2026-03-08T12:00:00.000Z",
    metAt: "2026-03-08T12:00:00.000Z",
    connectionSource: "event",
    contextLabel: "Launch Week",
    accessStartAt: null,
    accessEndAt: null,
    lastInteractionAt: "2026-03-21T12:00:00.000Z",
    interactionCount: 5,
    isExpired: false,
    sourceType: "event",
    targetPersona: {
      id: "persona-id",
      username: "alex",
      publicUrl: "alex",
      fullName: "Alex Parker",
      jobTitle: "Engineer",
      companyName: "Dotly",
      tagline: "Builder",
      profilePhotoUrl: null,
      accessMode: "open",
    },
    memory: {
      metAt: "2026-03-08T12:00:00.000Z",
      sourceLabel: "Event",
      note: null,
    },
    followUpSummary: {
      hasPendingFollowUp: false,
      nextFollowUpAt: null,
      pendingFollowUpCount: 0,
      hasPassiveInactivityFollowUp: false,
    },
    metadata: {
      lastInteractionAt: "2026-03-21T12:00:00.000Z",
      interactionCount: 5,
      hasInteractions: true,
      isRecentlyActive: true,
      relationshipAgeDays: 14,
    },
    ...overrides,
  };
}

describe("ContactDetailPage", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-22T12:00:00.000Z"));
    mocks.apiRequest.mockReset();
    mocks.requireServerSession.mockReset();
    mocks.notFound.mockClear();
    mocks.requireServerSession.mockResolvedValue({ accessToken: "token" });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders relationship metadata clearly for an active contact", async () => {
    mocks.apiRequest.mockResolvedValue(createContactDetail());

    const element = await ContactDetailPage({
      params: Promise.resolve({ relationshipId: "relationship-id" }),
    });

    render(element);

    expect(mocks.requireServerSession).toHaveBeenCalledWith(
      "/app/contacts/relationship-id",
    );
    expect(
      screen.getByRole("heading", { name: /^connection$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /^follow-up$/i }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("follow-up-form")).toHaveTextContent(
      "Remind Alex Parker",
    );
    expect(screen.getByText("Recently active")).toBeInTheDocument();
    expect(screen.getByText("Last interaction 1 day ago")).toBeInTheDocument();
    expect(screen.getByText("Connected on Mar 8")).toBeInTheDocument();
    expect(screen.getByText("Met at Launch Week")).toBeInTheDocument();
    expect(screen.queryByText("Touchpoints")).not.toBeInTheDocument();
    expect(screen.queryByText("Source")).not.toBeInTheDocument();
  });

  it("handles sparse interaction metadata without showing the empty state incorrectly", async () => {
    mocks.apiRequest.mockResolvedValue(
      createContactDetail({
        sourceType: "profile",
        connectionSource: "manual",
        contextLabel: null,
        lastInteractionAt: "2026-03-21T12:00:00.000Z",
        interactionCount: 0,
        memory: {
          metAt: "2026-03-08T12:00:00.000Z",
          sourceLabel: null,
          note: null,
        },
        metadata: {
          lastInteractionAt: null,
          interactionCount: 0,
          hasInteractions: false,
          isRecentlyActive: false,
          relationshipAgeDays: 120,
        },
      }),
    );

    const element = await ContactDetailPage({
      params: Promise.resolve({ relationshipId: "relationship-id" }),
    });

    render(element);

    expect(screen.getByText("Last interaction 1 day ago")).toBeInTheDocument();
    expect(screen.getByText("Connected manually")).toBeInTheDocument();
    expect(screen.getByText("Connected on Mar 8")).toBeInTheDocument();
    expect(screen.queryByText("Recently active")).not.toBeInTheDocument();
  });

  it("hides the last interaction line when no interaction timestamp is available", async () => {
    mocks.apiRequest.mockResolvedValue(
      createContactDetail({
        sourceType: "event",
        connectionSource: "event",
        contextLabel: null,
        memory: {
          metAt: "2026-03-08T12:00:00.000Z",
          sourceLabel: null,
          note: null,
        },
        lastInteractionAt: null,
        metadata: {
          lastInteractionAt: null,
          interactionCount: 0,
          hasInteractions: false,
          isRecentlyActive: false,
          relationshipAgeDays: 14,
        },
      }),
    );

    const element = await ContactDetailPage({
      params: Promise.resolve({ relationshipId: "relationship-id" }),
    });

    render(element);

    expect(screen.getByText("Met at an event")).toBeInTheDocument();
    expect(screen.getByText("Connected on Mar 8")).toBeInTheDocument();
    expect(screen.queryByText(/Last interaction/i)).not.toBeInTheDocument();
  });

  it("falls back to a neutral connection label for unknown sources", async () => {
    mocks.apiRequest.mockResolvedValue(
      createContactDetail({
        connectionSource: "unknown",
        contextLabel: null,
        memory: {
          metAt: "2026-03-08T12:00:00.000Z",
          sourceLabel: null,
          note: null,
        },
      }),
    );

    const element = await ContactDetailPage({
      params: Promise.resolve({ relationshipId: "relationship-id" }),
    });

    render(element);

    expect(screen.getByText("Connected")).toBeInTheDocument();
  });

  it("passes follow-up summary context to the reminder block", async () => {
    mocks.apiRequest.mockResolvedValue(
      createContactDetail({
        followUpSummary: {
          hasPendingFollowUp: true,
          nextFollowUpAt: "2026-03-24T09:30:00.000Z",
          pendingFollowUpCount: 2,
          hasPassiveInactivityFollowUp: false,
          isTriggered: true,
          isOverdue: false,
          isUpcomingSoon: false,
        },
      }),
    );

    const element = await ContactDetailPage({
      params: Promise.resolve({ relationshipId: "relationship-id" }),
    });

    render(element);

    expect(screen.getByTestId("follow-up-form")).toHaveTextContent(
      "Pending 2 Due",
    );
  });
});
