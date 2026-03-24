import React from "react";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  updateNote: vi.fn(),
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
  it("autosaves the private note after typing pauses", async () => {
    mocks.updateNote.mockReset();
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

    await user.clear(screen.getByLabelText(/private note/i));
    await user.type(screen.getByLabelText(/private note/i), "Updated note");

    await waitFor(() => {
      expect(mocks.updateNote).toHaveBeenCalledWith("relationship-id", {
        note: "Updated note",
      });
    });

    expect(await screen.findByRole("status")).toHaveTextContent(/^saved$/i);
  });

  it("removes the note when the field is cleared on blur", async () => {
    mocks.updateNote.mockReset();
    mocks.updateNote.mockResolvedValue({
      relationshipId: "relationship-id",
      note: null,
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

    await user.clear(screen.getByLabelText(/private note/i));
    await user.tab();

    await waitFor(() => {
      expect(mocks.updateNote).toHaveBeenCalledWith("relationship-id", {
        note: null,
      });
    });
  });
});
