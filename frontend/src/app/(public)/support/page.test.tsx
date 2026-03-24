import React from "react";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ToastViewport } from "@/components/shared/toast-viewport";
import { ApiError } from "@/lib/api/client";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
}));

vi.mock("@/lib/api/support-api", () => ({
  supportApi: {
    create: mocks.create,
  },
}));

import SupportPage from "./page";

describe("SupportPage", () => {
  beforeEach(() => {
    mocks.create.mockReset();
  });

  it("restores a saved local draft", () => {
    window.localStorage.setItem(
      "dotly.support-form.draft",
      JSON.stringify({
        name: "Alex",
        email: "alex@example.com",
        topic: "Bug report",
        details: "Saved draft message",
        challengeToken: String(Date.now() - 5000),
        website: "",
      }),
    );

    render(React.createElement(SupportPage));

    expect(screen.getByLabelText(/name/i)).toHaveValue("Alex");
    expect(screen.getByLabelText(/reply email/i)).toHaveValue(
      "alex@example.com",
    );
    expect(screen.getByLabelText(/topic/i)).toHaveValue("Bug report");
    expect(screen.getByLabelText(/details/i)).toHaveValue(
      "Saved draft message",
    );
  });

  it("submits the support form and clears the saved draft", async () => {
    mocks.create.mockResolvedValue({
      accepted: true,
      delivery: "sent",
      referenceId: "support-ref-123",
    });

    const user = userEvent.setup();

    render(
      React.createElement(
        React.Fragment,
        null,
        React.createElement(ToastViewport),
        React.createElement(SupportPage),
      ),
    );

    await user.type(screen.getByLabelText(/name/i), "Alex");
    await user.type(screen.getByLabelText(/reply email/i), "alex@example.com");
    await user.selectOptions(screen.getByLabelText(/topic/i), "Bug report");
    await user.type(screen.getByLabelText(/details/i), "Something broke");
    await user.click(
      screen.getByRole("button", { name: /send support request/i }),
    );

    await waitFor(() => {
      expect(mocks.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Alex",
          email: "alex@example.com",
          topic: "Bug report",
          details: "Something broke",
          website: "",
        }),
      );
      expect(typeof mocks.create.mock.calls[0]?.[0]?.challengeToken).toBe(
        "string",
      );
    });

    expect(
      await screen.findByText(/support request received/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/support-ref-123/i)).toBeInTheDocument();
    expect(window.localStorage.getItem("dotly.support-form.draft")).toBeNull();
  });

  it("shows backend rate limit errors", async () => {
    mocks.create.mockRejectedValue(
      new ApiError(
        "Too many support requests right now. Please try again later.",
        429,
      ),
    );

    const user = userEvent.setup();

    render(React.createElement(SupportPage));

    await user.type(screen.getByLabelText(/reply email/i), "alex@example.com");
    await user.type(screen.getByLabelText(/details/i), "Need help");
    await user.click(
      screen.getByRole("button", { name: /send support request/i }),
    );

    expect(
      await screen.findByText(/too many support requests right now/i),
    ).toBeInTheDocument();
  });
});
