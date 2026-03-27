import React from "react";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ToastViewport } from "@/components/shared/toast-viewport";
import type { ContactFollowUpSummary } from "@/types/contact";
import { routes } from "@/lib/constants/routes";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
}));

function createRelativeIsoDate(dayOffset: number) {
  const value = new Date();
  value.setDate(value.getDate() + dayOffset);
  value.setHours(12, 0, 0, 0);
  return value.toISOString();
}

function createFollowUpSummary(
  overrides: Partial<ContactFollowUpSummary> = {},
): ContactFollowUpSummary {
  return {
    hasPendingFollowUp: true,
    nextFollowUpAt: createRelativeIsoDate(1),
    pendingFollowUpCount: 1,
    hasPassiveInactivityFollowUp: false,
    isTriggered: false,
    isOverdue: false,
    isUpcomingSoon: true,
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

  it("shows one-tap preset buttons with the empty follow-up state", async () => {
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

    expect(
      screen.getByRole("button", { name: /tomorrow/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /next week/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /1 month/i }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(
        /keep the next conversation easy to pick back up/i,
      ),
    ).toBeInTheDocument();
  });

  it("creates a follow-up in one tap with the tomorrow preset", async () => {
    mocks.create.mockResolvedValue({
      id: "follow-up-1",
      relationshipId: "relationship-id",
      remindAt: createRelativeIsoDate(1),
      status: "pending",
    });

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

    fireEvent.click(screen.getByRole("button", { name: /tomorrow/i }));

    await waitFor(() => {
      expect(mocks.create).toHaveBeenCalledWith(
        {
          relationshipId: "relationship-id",
          preset: "TOMORROW",
          customDate: undefined,
        },
        expect.objectContaining({
          requestKey: expect.any(String),
        }),
      );
    });

    expect(await screen.findByRole("status")).toHaveTextContent(
      /reminder set for/i,
    );
    expect(
      await screen.findByText(/keep the next conversation in view/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/1 reminder in view/i)).toBeInTheDocument();
  });

  it("reveals a small custom date-time flow only when requested", async () => {
    const user = userEvent.setup();

    mocks.create.mockResolvedValue({
      id: "follow-up-2",
      relationshipId: "relationship-id",
      remindAt: "2026-04-15T12:00:00.000Z",
      status: "pending",
    });

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

    expect(
      screen.queryByLabelText(/when should this come back up\?/i),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /pick date and time/i }),
    );
    expect(
      screen.getByLabelText(/when should this come back up\?/i),
    ).toBeInTheDocument();

    fireEvent.change(
      screen.getByLabelText(/when should this come back up\?/i),
      {
        target: { value: "2099-04-15T14:30" },
      },
    );
    fireEvent.click(screen.getByRole("button", { name: /schedule reminder/i }));

    await waitFor(() => {
      expect(mocks.create).toHaveBeenCalledTimes(1);
    });

    expect(mocks.create.mock.calls[0]?.[0]).toMatchObject({
      relationshipId: "relationship-id",
      customDate: expect.any(String),
    });
    expect(
      Number.isNaN(Date.parse(mocks.create.mock.calls[0]?.[0].customDate)),
    ).toBe(false);
  });

  it("shows a lightweight summary for existing reminders without loading the full list", async () => {
    render(
      React.createElement(ContactFollowUpForm, {
        relationshipId: "relationship-id",
        contactName: "Alex Parker",
        initialFollowUpSummary: createFollowUpSummary({
          nextFollowUpAt: createRelativeIsoDate(7),
          pendingFollowUpCount: 2,
          isUpcomingSoon: false,
        }),
      }),
    );

    expect(
      screen.getByText(/keep the next conversation in view/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/2 reminders in view/i)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /open follow-ups/i }),
    ).toHaveAttribute("href", routes.app.followUps);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("surfaces overdue reminders with direct copy", async () => {
    render(
      React.createElement(ContactFollowUpForm, {
        relationshipId: "relationship-id",
        contactName: "Alex Parker",
        initialFollowUpSummary: createFollowUpSummary({
          nextFollowUpAt: createRelativeIsoDate(-1),
          isTriggered: false,
          isOverdue: true,
          isUpcomingSoon: false,
        }),
      }),
    );

    expect(
      screen.getByText(/this conversation is waiting on you/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/^overdue$/i)).toBeInTheDocument();
  });

  it("uses softer passive reminder copy when the pending follow-up is system generated", () => {
    render(
      React.createElement(ContactFollowUpForm, {
        relationshipId: "relationship-id",
        contactName: "Alex Parker",
        initialFollowUpSummary: createFollowUpSummary({
          hasPassiveInactivityFollowUp: true,
          isTriggered: true,
          isOverdue: false,
          isUpcomingSoon: false,
        }),
      }),
    );

    expect(screen.getByText(/reach out again/i)).toBeInTheDocument();
    expect(
      screen.getByText(/you haven't interacted in a while/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/^gentle$/i)).toBeInTheDocument();
  });
});
