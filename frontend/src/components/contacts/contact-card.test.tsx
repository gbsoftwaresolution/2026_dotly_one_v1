import React from "react";

import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Contact } from "@/types/contact";

import { ContactCard } from "./contact-card";

function createContact(overrides: Partial<Contact> = {}): Contact {
  return {
    id: "relationship-id",
    relationshipId: "relationship-id",
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
      id: "persona-id",
      username: "alex",
      publicUrl: "alex",
      fullName: "Alex Parker",
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
      isRecentlyActive: true,
      relationshipAgeDays: 14,
    },
    ...overrides,
  };
}

describe("ContactCard", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-22T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders recent activity and source fallback without cluttering the card", () => {
    render(React.createElement(ContactCard, { contact: createContact() }));

    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/app/contacts/relationship-id",
    );
    expect(screen.getByText("Connected via QR")).toBeInTheDocument();
    expect(screen.getByText("1d")).toBeInTheDocument();
    expect(screen.getByText("Connected 2w")).toBeInTheDocument();
    expect(screen.queryByText(/interactions:/i)).not.toBeInTheDocument();
  });

  it("uses backend relationship age metadata consistently when present", () => {
    render(
      React.createElement(ContactCard, {
        contact: createContact({
          createdAt: "2026-03-21T12:00:00.000Z",
          connectedAt: "2026-02-20T12:00:00.000Z",
          metAt: "2026-02-20T12:00:00.000Z",
          sourceType: "profile",
          connectionSource: "manual",
          lastInteractionAt: null,
          metadata: {
            lastInteractionAt: null,
            interactionCount: 0,
            hasInteractions: false,
            isRecentlyActive: false,
            relationshipAgeDays: 30,
          },
        }),
      }),
    );

    expect(screen.getByText("Connected manually")).toBeInTheDocument();
    expect(screen.getByText("Connected 1mo")).toBeInTheDocument();
    expect(screen.queryByText("Recently active")).not.toBeInTheDocument();
  });

  it("shows a subtle passive reconnect hint when a system reminder exists", () => {
    render(
      React.createElement(ContactCard, {
        contact: createContact({
          followUpSummary: {
            hasPendingFollowUp: true,
            nextFollowUpAt: "2026-03-25T12:00:00.000Z",
            pendingFollowUpCount: 1,
            hasPassiveInactivityFollowUp: true,
            isTriggered: false,
            isOverdue: false,
            isUpcomingSoon: false,
          },
          metadata: {
            lastInteractionAt: "2026-03-01T12:00:00.000Z",
            interactionCount: 0,
            hasInteractions: false,
            isRecentlyActive: false,
            relationshipAgeDays: 30,
          },
        }),
        hasPassiveReminder: true,
        priorityLabel: "Reconnect",
        priorityTone: "attention",
      }),
    );

    expect(screen.getByText("Reconnect")).toBeInTheDocument();
    expect(screen.queryByText(/stay in touch/i)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/you haven't interacted in a while/i),
    ).not.toBeInTheDocument();
  });

  it("renders scheduled follow-ups with a lighter planned label", () => {
    render(
      React.createElement(ContactCard, {
        contact: createContact({
          followUpSummary: {
            hasPendingFollowUp: true,
            nextFollowUpAt: "2026-03-28T12:00:00.000Z",
            pendingFollowUpCount: 1,
            hasPassiveInactivityFollowUp: false,
            isTriggered: false,
            isOverdue: false,
            isUpcomingSoon: false,
          },
          metadata: {
            lastInteractionAt: "2026-03-10T12:00:00.000Z",
            interactionCount: 1,
            hasInteractions: true,
            isRecentlyActive: false,
            relationshipAgeDays: 12,
          },
        }),
        priorityLabel: "Planned",
        priorityTone: "planned",
      }),
    );

    expect(screen.getByText("Planned")).toBeInTheDocument();
  });

  it("surfaces a private note preview when one exists", () => {
    render(
      React.createElement(ContactCard, {
        contact: createContact({
          memory: {
            metAt: "2026-03-08T12:00:00.000Z",
            sourceLabel: "Event",
            note: "Met after the launch panel and wants a follow-up on pricing next month.",
          },
        }),
      }),
    );

    expect(screen.getByText("Private note")).toBeInTheDocument();
    expect(
      screen.getByText(/Met after the launch panel and wants a follow-up/i),
    ).toBeInTheDocument();
  });
});