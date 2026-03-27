import React from "react";

import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  ContactDetail,
  RelationshipActivityTimelineEvent,
} from "@/types/contact";
import { routes } from "@/lib/constants/routes";

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

vi.mock("@/components/contacts/quick-interaction-panel", () => ({
  QuickInteractionPanel: ({ disabled }: { disabled?: boolean }) =>
    React.createElement(
      "div",
      { "data-testid": "quick-interaction-panel" },
      disabled ? "quick-interactions-disabled" : "quick-interactions-active",
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
    recentInteractions: [
      {
        id: "interaction-1",
        type: "GREETING",
        createdAt: "2026-03-21T12:00:00.000Z",
        direction: "sent",
      },
    ],
    ...overrides,
  };
}

function createTimelineEvent(
  overrides: Partial<RelationshipActivityTimelineEvent> = {},
): RelationshipActivityTimelineEvent {
  return {
    id: "interaction-1",
    type: "INTERACTION",
    label: "You said hi",
    timestamp: "2026-03-21T12:00:00.000Z",
    ...overrides,
  };
}

function createActivityTimeline(
  overrides: RelationshipActivityTimelineEvent[] = [],
): RelationshipActivityTimelineEvent[] {
  if (overrides.length > 0) {
    return overrides;
  }

  return [
    createTimelineEvent(),
    createTimelineEvent({
      id: "connected-relationship-id",
      type: "CONNECTED",
      label: "Connected",
      timestamp: "2026-03-08T12:00:00.000Z",
    }),
  ];
}

function mockPageRequests({
  contact = createContactDetail(),
  timeline = createActivityTimeline(),
  timelineError,
}: {
  contact?: ContactDetail;
  timeline?: RelationshipActivityTimelineEvent[];
  timelineError?: Error;
} = {}) {
  mocks.apiRequest.mockResolvedValueOnce(contact);

  if (timelineError) {
    mocks.apiRequest.mockRejectedValueOnce(timelineError);
    return;
  }

  mocks.apiRequest.mockResolvedValueOnce(timeline);
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
    mockPageRequests();

    const element = await ContactDetailPage({
      params: Promise.resolve({ relationshipId: "relationship-id" }),
    });

    render(element);

    expect(mocks.requireServerSession).toHaveBeenCalledWith(
      "/app-old/contacts/relationship-id",
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
    expect(screen.getByTestId("quick-interaction-panel")).toHaveTextContent(
      "quick-interactions-active",
    );
    expect(mocks.apiRequest).toHaveBeenNthCalledWith(
      1,
      "/contacts/relationship-id",
      {
        token: "token",
      },
    );
    expect(mocks.apiRequest).toHaveBeenNthCalledWith(
      2,
      "/relationships/relationship-id/timeline",
      {
        token: "token",
      },
    );
    expect(screen.getByText("Recently active")).toBeInTheDocument();
    expect(screen.getByText("Last interaction 1 day ago")).toBeInTheDocument();
    expect(screen.getByText("Connected on Mar 8")).toBeInTheDocument();
    expect(screen.getByText("Met at Launch Week")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /^activity$/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("You said hi")).toBeInTheDocument();
    expect(screen.getByText("yesterday")).toBeInTheDocument();
    expect(screen.getAllByText(/^Connected$/).length).toBeGreaterThan(0);
    expect(screen.queryByText("Touchpoints")).not.toBeInTheDocument();
    expect(screen.queryByText("Source")).not.toBeInTheDocument();
  });

  it("limits the activity list to the five most recent events", async () => {
    mockPageRequests({
      timeline: createActivityTimeline([
        createTimelineEvent({
          id: "interaction-1",
          label: "You said hi",
          timestamp: "2026-03-22T11:00:00.000Z",
        }),
        createTimelineEvent({
          id: "interaction-2",
          label: "They said hi",
          timestamp: "2026-03-22T10:00:00.000Z",
        }),
        createTimelineEvent({
          id: "interaction-3",
          label: "You followed up",
          timestamp: "2026-03-22T09:00:00.000Z",
        }),
        createTimelineEvent({
          id: "interaction-4",
          label: "They followed up",
          timestamp: "2026-03-22T08:00:00.000Z",
        }),
        createTimelineEvent({
          id: "interaction-5",
          label: "You sent thanks",
          timestamp: "2026-03-22T07:00:00.000Z",
        }),
        createTimelineEvent({
          id: "connected-relationship-id",
          type: "CONNECTED",
          label: "Connected",
          timestamp: "2026-03-10T12:00:00.000Z",
        }),
      ]),
    });

    const element = await ContactDetailPage({
      params: Promise.resolve({ relationshipId: "relationship-id" }),
    });

    render(element);

    expect(screen.getByText("You said hi")).toBeInTheDocument();
    expect(screen.getByText("They said hi")).toBeInTheDocument();
    expect(screen.getByText("You followed up")).toBeInTheDocument();
    expect(screen.getByText("They followed up")).toBeInTheDocument();
    expect(screen.getByText("You sent thanks")).toBeInTheDocument();
    expect(screen.getAllByText(/^Connected$/)).toHaveLength(1);
  });

  it("renders an empty activity state when no valid events are available", async () => {
    mockPageRequests({
      contact: createContactDetail({
        connectedAt: "not-a-date",
        recentInteractions: [],
      }),
      timeline: createActivityTimeline([
        createTimelineEvent({
          id: "invalid-event",
          timestamp: "not-a-date",
        }),
      ]),
    });

    const element = await ContactDetailPage({
      params: Promise.resolve({ relationshipId: "relationship-id" }),
    });

    render(element);

    expect(screen.getByText("No activity yet")).toBeInTheDocument();
  });

  it("handles sparse interaction metadata without showing the empty state incorrectly", async () => {
    mockPageRequests({
      contact: createContactDetail({
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
    });

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
    mockPageRequests({
      contact: createContactDetail({
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
    });

    const element = await ContactDetailPage({
      params: Promise.resolve({ relationshipId: "relationship-id" }),
    });

    render(element);

    expect(screen.getByText("Met at an event")).toBeInTheDocument();
    expect(screen.getByText("Connected on Mar 8")).toBeInTheDocument();
    expect(screen.queryByText(/Last interaction/i)).not.toBeInTheDocument();
  });

  it("falls back to a neutral connection label for unknown sources", async () => {
    mockPageRequests({
      contact: createContactDetail({
        connectionSource: "unknown",
        contextLabel: null,
        memory: {
          metAt: "2026-03-08T12:00:00.000Z",
          sourceLabel: null,
          note: null,
        },
      }),
    });

    const element = await ContactDetailPage({
      params: Promise.resolve({ relationshipId: "relationship-id" }),
    });

    render(element);

    expect(screen.getAllByText("Connected")).toHaveLength(3);
  });

  it("passes follow-up summary context to the reminder block", async () => {
    mockPageRequests({
      contact: createContactDetail({
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
    });

    const element = await ContactDetailPage({
      params: Promise.resolve({ relationshipId: "relationship-id" }),
    });

    render(element);

    expect(screen.getByTestId("follow-up-form")).toHaveTextContent(
      "Pending 2 Due",
    );
  });

  it("disables quick interactions when the connection is expired", async () => {
    mockPageRequests({
      contact: createContactDetail({
        state: "expired",
        isExpired: true,
      }),
    });

    const element = await ContactDetailPage({
      params: Promise.resolve({ relationshipId: "relationship-id" }),
    });

    render(element);

    expect(screen.getByTestId("quick-interaction-panel")).toHaveTextContent(
      "quick-interactions-disabled",
    );
  });

  it("keeps the contact detail page usable when the timeline cannot be loaded", async () => {
    mockPageRequests({
      timelineError: new Error("timeline down"),
    });

    const element = await ContactDetailPage({
      params: Promise.resolve({ relationshipId: "relationship-id" }),
    });

    render(element);

    expect(
      screen.getByText("We could not load the latest story right now."),
    ).toBeInTheDocument();
    expect(screen.getByText("Connected on Mar 8")).toBeInTheDocument();
  });
});
