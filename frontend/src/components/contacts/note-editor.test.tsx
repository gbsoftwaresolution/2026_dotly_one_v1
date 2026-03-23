import React from "react";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  updateNote: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: mocks.refresh,
  }),
}));

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<object>("@/lib/api");

  return {
    ...actual,
    contactsApi: {
      updateNote: mocks.updateNote,
    },
  };
});

import { NoteEditor } from "./note-editor";

describe("NoteEditor", () => {
  beforeEach(() => {
    mocks.refresh.mockReset();
    mocks.updateNote.mockReset();
  });

  it("refreshes the contact detail after a successful save", async () => {
    mocks.updateNote.mockResolvedValue({
      relationshipId: "relationship-id",
      note: "Updated note",
      lastInteractionAt: "2026-03-22T11:00:00.000Z",
      interactionCount: 3,
    });

    const user = userEvent.setup();

    render(
      React.createElement(NoteEditor, {
        relationshipId: "relationship-id",
        initialNote: "Original note",
      }),
    );

    await user.clear(screen.getByLabelText(/connection note/i));
    await user.type(screen.getByLabelText(/connection note/i), "Updated note");
    await user.click(screen.getByRole("button", { name: /save note/i }));

    await waitFor(() => {
      expect(mocks.updateNote).toHaveBeenCalledWith("relationship-id", {
        note: "Updated note",
      });
    });

    expect(mocks.refresh).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/note saved/i)).toBeInTheDocument();
  });
});
