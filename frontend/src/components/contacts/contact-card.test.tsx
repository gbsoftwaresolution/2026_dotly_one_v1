import React from "react";

import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Contact } from "@/types/contact";

import { ContactCard } from "./contact-card";

function createContact(overrides: Partial<Contact> = {}): Contact {
  return {
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
});