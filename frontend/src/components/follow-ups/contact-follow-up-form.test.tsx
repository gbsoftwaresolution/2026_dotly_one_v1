import React from "react";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

vi.mock("@/lib/api/follow-ups-api", () => ({
  followUpsApi: {
    create: mocks.create,
  },
}));

import { ContactFollowUpForm } from "./contact-follow-up-form";

describe("ContactFollowUpForm", () => {
  beforeEach(() => {
    mocks.create.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("refreshes the default reminder when the form is opened later", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-22T10:15:00.000Z"));

    render(
      React.createElement(ContactFollowUpForm, {
        relationshipId: "relationship-id",
        contactName: "Alex Parker",
      }),
    );

    vi.setSystemTime(new Date("2026-03-22T13:20:00.000Z"));
    fireEvent.click(screen.getByRole("button", { name: /remind me/i }));

    const expected = formatLocalDefaults(new Date("2026-03-22T13:20:00.000Z"));

    expect(screen.getByLabelText(/date/i)).toHaveValue(expected.date);
    expect(screen.getByLabelText(/time/i)).toHaveValue(expected.time);
  });

  it("blocks long notes before submitting", async () => {
    const user = userEvent.setup();

    render(
      React.createElement(ContactFollowUpForm, {
        relationshipId: "relationship-id",
        contactName: "Alex Parker",
      }),
    );

    await user.click(screen.getByRole("button", { name: /remind me/i }));
    await user.type(screen.getByLabelText(/note/i), "a".repeat(1001));
    await user.click(screen.getByRole("button", { name: /save reminder/i }));

    expect(screen.getByText(/keep the note under 1000 characters/i)).toBeInTheDocument();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("submits a trimmed note and shows success state", async () => {
    mocks.create.mockResolvedValue({ id: "follow-up-1" });
    const user = userEvent.setup();

    render(
      React.createElement(ContactFollowUpForm, {
        relationshipId: "relationship-id",
        contactName: "Alex Parker",
      }),
    );

    await user.click(screen.getByRole("button", { name: /remind me/i }));
    await user.type(screen.getByLabelText(/note/i), "  Follow up after demo  ");
    await user.click(screen.getByRole("button", { name: /save reminder/i }));

    await waitFor(() => {
      expect(mocks.create).toHaveBeenCalledTimes(1);
    });

    expect(mocks.create.mock.calls[0]?.[0]).toMatchObject({
      relationshipId: "relationship-id",
      note: "Follow up after demo",
    });
    expect(screen.getByText(/reminder saved for alex parker/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /view follow-ups/i })).toHaveAttribute(
      "href",
      "/app/follow-ups",
    );
  });
});