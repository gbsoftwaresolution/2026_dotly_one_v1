import React from "react";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listInbox: vi.fn(),
  updateInboxStatus: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  supportApi: {
    listInbox: mocks.listInbox,
    updateInboxStatus: mocks.updateInboxStatus,
  },
}));

import { SupportInboxScreen } from "@/components/support/support-inbox-screen";

describe("SupportInboxScreen", () => {
  beforeEach(() => {
    mocks.listInbox.mockReset();
    mocks.updateInboxStatus.mockReset();
  });

  it("loads and displays support requests", async () => {
    mocks.listInbox.mockResolvedValue({
      requests: [
        {
          id: "support-1",
          referenceId: "ref-1",
          requesterName: "Alex",
          requesterEmailMasked: "al***@example.com",
          topic: "Bug report",
          details: "Something broke",
          status: "open",
          delivery: "sent",
          createdAt: "2026-03-24T10:00:00.000Z",
          resolvedAt: null,
        },
      ],
    });

    render(React.createElement(SupportInboxScreen));

    expect(await screen.findByText(/bug report/i)).toBeInTheDocument();
    expect(screen.getByText(/al\*\*\*@example.com/i)).toBeInTheDocument();
  });

  it("can resolve a support request", async () => {
    mocks.listInbox.mockResolvedValue({
      requests: [
        {
          id: "support-1",
          referenceId: "ref-1",
          requesterName: "Alex",
          requesterEmailMasked: "al***@example.com",
          topic: "Bug report",
          details: "Something broke",
          status: "open",
          delivery: "sent",
          createdAt: "2026-03-24T10:00:00.000Z",
          resolvedAt: null,
        },
      ],
    });
    mocks.updateInboxStatus.mockResolvedValue({
      id: "support-1",
      referenceId: "ref-1",
      requesterName: "Alex",
      requesterEmailMasked: "al***@example.com",
      topic: "Bug report",
      details: "Something broke",
      status: "resolved",
      delivery: "sent",
      createdAt: "2026-03-24T10:00:00.000Z",
      resolvedAt: "2026-03-24T10:05:00.000Z",
    });

    const user = userEvent.setup();
    render(React.createElement(SupportInboxScreen));

    await screen.findByText(/bug report/i);
    await user.click(screen.getByRole("button", { name: /mark resolved/i }));

    await waitFor(() => {
      expect(mocks.updateInboxStatus).toHaveBeenCalledWith(
        "support-1",
        "resolved",
      );
    });

    expect(
      await screen.findByRole("button", { name: /reopen/i }),
    ).toBeInTheDocument();
  });
});
