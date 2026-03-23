import React from "react";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ToastViewport } from "@/components/shared/toast-viewport";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
}));

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function formatLocalDefaults(value: Date) {
  const nextHour = new Date(value);
  nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);

  return {
    date: `${nextHour.getFullYear()}-${pad(nextHour.getMonth() + 1)}-${pad(nextHour.getDate())}`,
    time: `${pad(nextHour.getHours())}:${pad(nextHour.getMinutes())}`,
  };
}

function createFollowUp(overrides: Record<string, unknown> = {}) {
  return {
    id: "follow-up-1",
    relationshipId: "relationship-id",
    remindAt: "2026-03-23T14:00:00.000Z",
    status: "pending",
    note: null,
    createdAt: "2026-03-22T12:00:00.000Z",
    updatedAt: "2026-03-22T12:00:00.000Z",
    completedAt: null,
    relationship: {
      relationshipId: "relationship-id",
      targetPersona: {
        id: "persona-id",
        username: "alex",
        fullName: "Alex Parker",
        jobTitle: "Engineer",
        companyName: "Dotly",
        profilePhotoUrl: null,
      },
    },
    metadata: {
      isTriggered: false,
      isOverdue: false,
      isUpcomingSoon: false,
    },
    ...overrides,
  };
}

vi.mock("@/lib/api/follow-ups-api", () => ({
  followUpsApi: {
    create: mocks.create,
  },
}));

import { clearAppDataStore } from "@/lib/app-data-store";
import { ContactFollowUpForm } from "./contact-follow-up-form";

describe("ContactFollowUpForm", () => {
  beforeEach(() => {
    clearAppDataStore();
    mocks.create.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("refreshes the default reminder when the form is opened later", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-22T10:15:00.000Z"));

    render(
      React.createElement(
        React.Fragment,
        null,
        React.createElement(ToastViewport),
        React.createElement(ContactFollowUpForm, {
          relationshipId: "relationship-id",
          contactName: "Alex Parker",
        }),
      ),
    );

    vi.setSystemTime(new Date("2026-03-22T13:20:00.000Z"));
    fireEvent.click(screen.getByRole("button", { name: /add follow-up/i }));

    const expected = formatLocalDefaults(new Date("2026-03-22T13:20:00.000Z"));

    expect(screen.getByLabelText(/date/i)).toHaveValue(expected.date);
    expect(screen.getByLabelText(/time/i)).toHaveValue(expected.time);
  });

  it("blocks long notes before submitting", async () => {
    const user = userEvent.setup();

    render(
      React.createElement(
        React.Fragment,
        null,
        React.createElement(ToastViewport),
        React.createElement(ContactFollowUpForm, {
          relationshipId: "relationship-id",
          contactName: "Alex Parker",
        }),
      ),
    );

    await user.click(screen.getByRole("button", { name: /add follow-up/i }));
    await user.type(screen.getByLabelText(/note/i), "a".repeat(1001));
    await user.click(screen.getByRole("button", { name: /save follow-up/i }));

    expect(screen.getByText(/keep the note under 1000 characters/i)).toBeInTheDocument();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("submits a trimmed note and shows success state", async () => {
    mocks.create.mockResolvedValue(createFollowUp({ note: "Follow up after demo" }));
    const user = userEvent.setup();

    render(
      React.createElement(
        React.Fragment,
        null,
        React.createElement(ToastViewport),
        React.createElement(ContactFollowUpForm, {
          relationshipId: "relationship-id",
          contactName: "Alex Parker",
        }),
      ),
    );

    await user.click(screen.getByRole("button", { name: /add follow-up/i }));
    await user.type(screen.getByLabelText(/note/i), "  Follow up after demo  ");
    await user.click(screen.getByRole("button", { name: /save follow-up/i }));

    await waitFor(() => {
      expect(mocks.create).toHaveBeenCalledTimes(1);
    });

    expect(mocks.create.mock.calls[0]?.[0]).toMatchObject({
      relationshipId: "relationship-id",
      note: "Follow up after demo",
    });
    expect(await screen.findByRole("status")).toHaveTextContent(/reminder set/i);
    expect(screen.getByRole("link", { name: /view follow-ups/i })).toHaveAttribute(
      "href",
      "/app/follow-ups",
    );
    expect(screen.getByText(/next touchpoint/i)).toBeInTheDocument();
  });

  it("shows the current pending reminder summary when one exists", () => {
    render(
      React.createElement(ContactFollowUpForm, {
        relationshipId: "relationship-id",
        contactName: "Alex Parker",
        initialFollowUpSummary: {
          hasPendingFollowUp: true,
          nextFollowUpAt: "2026-03-23T14:00:00.000Z",
          pendingFollowUpCount: 2,
        },
      }),
    );

    expect(screen.getByText(/next touchpoint/i)).toBeInTheDocument();
    expect(screen.getByText(/keep the next conversation in view/i)).toBeInTheDocument();
    expect(screen.getByText(/2 follow-ups waiting/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add follow-up/i })).toBeInTheDocument();
  });

  it("surfaces overdue reminders without turning the contact view into a task list", () => {
    render(
      React.createElement(ContactFollowUpForm, {
        relationshipId: "relationship-id",
        contactName: "Alex Parker",
        initialFollowUpSummary: {
          hasPendingFollowUp: true,
          nextFollowUpAt: "2026-03-21T14:00:00.000Z",
          pendingFollowUpCount: 1,
          isTriggered: false,
          isOverdue: true,
          isUpcomingSoon: false,
        },
      }),
    );

    expect(screen.getByText(/pick this back up/i)).toBeInTheDocument();
    expect(screen.getByText(/this conversation is waiting on you/i)).toBeInTheDocument();
    expect(screen.getByText(/^overdue$/i)).toBeInTheDocument();
  });
});