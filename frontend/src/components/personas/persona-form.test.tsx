import React from "react";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mocks.replace,
    refresh: mocks.refresh,
  }),
}));

vi.mock("@/lib/api", () => ({
  personaApi: {
    create: mocks.create,
  },
}));

import { PersonaForm } from "./persona-form";

describe("PersonaForm", () => {
  beforeEach(() => {
    mocks.create.mockReset();
    mocks.replace.mockReset();
    mocks.refresh.mockReset();
  });

  it("shows a lightweight sharing summary after create succeeds", async () => {
    mocks.create.mockResolvedValue({
      id: "persona-1",
      type: "professional",
      username: "jane-doe",
      publicUrl: "dotly.id/jane-doe",
      fullName: "Jane Doe",
      jobTitle: "Founder",
      companyName: "Dotly",
      tagline: "Trusted identity",
      websiteUrl: "https://dotly.one",
      isVerified: true,
      profilePhotoUrl: null,
      accessMode: "request",
      verifiedOnly: false,
      sharingMode: "controlled",
      sharingConfigSource: "system_default",
      smartCardConfig: null,
      publicPhone: null,
      publicWhatsappNumber: null,
      publicEmail: null,
      createdAt: "2026-03-22T08:00:00.000Z",
      updatedAt: "2026-03-22T08:00:00.000Z",
    });

    const user = userEvent.setup();

    render(React.createElement(PersonaForm));

    await user.type(screen.getByLabelText(/username/i), "jane-doe");
    await user.type(screen.getByLabelText(/full name/i), "Jane Doe");
    await user.type(screen.getByLabelText(/role/i), "Founder");
    await user.type(screen.getByLabelText(/^company$/i), "Dotly");
    await user.type(
      screen.getByLabelText(/what should people remember\?/i),
      "Trusted identity",
    );
    await user.type(screen.getByLabelText(/^website$/i), "https://dotly.one");
    await user.click(screen.getByLabelText(/show verified badge/i));
    await user.click(screen.getByRole("button", { name: /create persona/i }));

    await waitFor(() => {
      expect(mocks.create).toHaveBeenCalledWith({
        type: "professional",
        username: "jane-doe",
        fullName: "Jane Doe",
        jobTitle: "Founder",
        companyName: "Dotly",
        tagline: "Trusted identity",
        websiteUrl: "https://dotly.one",
        accessMode: "request",
        isVerified: true,
      });
    });

    expect(
      await screen.findByText(/your persona is ready to share/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/sharing mode/i)).toBeInTheDocument();
    expect(screen.getByText(/requests only/i)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /edit sharing settings/i }),
    ).toHaveAttribute("href", "/app/personas/settings/persona-1");
    expect(mocks.replace).not.toHaveBeenCalledWith("/app/personas");
  });
});
