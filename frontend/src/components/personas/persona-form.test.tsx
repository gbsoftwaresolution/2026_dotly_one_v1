import React from "react";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { routes } from "@/lib/constants/routes";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  checkUsernameAvailability: vi.fn(),
  getFastShare: vi.fn(),
  upsertPersonaFastShare: vi.fn(),
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
    checkUsernameAvailability: mocks.checkUsernameAvailability,
    getFastShare: mocks.getFastShare,
  },
}));

vi.mock("@/lib/share-fast-store", () => ({
  upsertPersonaFastShare: mocks.upsertPersonaFastShare,
}));

import { PersonaForm } from "./persona-form";

describe("PersonaForm", () => {
  beforeEach(() => {
    mocks.create.mockReset();
    mocks.checkUsernameAvailability.mockReset();
    mocks.getFastShare.mockReset();
    mocks.upsertPersonaFastShare.mockReset();
    mocks.replace.mockReset();
    mocks.refresh.mockReset();
    mocks.checkUsernameAvailability.mockImplementation(
      async (username: string) => ({
        username,
        available: username.length >= 6,
        code: username.length >= 6 ? "available" : "premium_short",
        message:
          username.length >= 6
            ? "Username is available."
            : "Usernames under 6 characters are reserved for premium claims.",
        requiresClaim: username.length < 6,
      }),
    );
    mocks.getFastShare.mockResolvedValue({
      personaId: "persona-1",
      publicIdentifier: "jane-doe",
      username: "jane-doe",
      fullName: "Jane Doe",
      profilePhotoUrl: null,
      shareUrl: "https://dotly.one/u/jane-doe",
      qrValue: "https://dotly.one/u/jane-doe",
      primaryAction: "request_access",
      effectiveActions: {
        canCall: false,
        canWhatsapp: false,
        canEmail: false,
        canSaveContact: false,
      },
      preferredShareType: "smart_card",
      hasQuickConnect: false,
      quickConnectUrl: null,
    });
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
    await waitFor(() => {
      expect(
        screen.getAllByText(/username is available/i)[0],
      ).toBeInTheDocument();
    });

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
    expect(mocks.getFastShare).toHaveBeenCalledWith("persona-1");
    expect(mocks.upsertPersonaFastShare).toHaveBeenCalledWith(
      expect.objectContaining({ personaId: "persona-1" }),
      { selected: true },
    );
    expect(screen.getByText(/sharing mode/i)).toBeInTheDocument();
    expect(screen.getByText(/requests only/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open share qr/i })).toHaveAttribute(
      "href",
      routes.app.qr,
    );
    expect(
      screen.getByRole("link", { name: /edit sharing settings/i }),
    ).toHaveAttribute("href", routes.app.personaSettings("persona-1"));
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it("blocks premium short usernames and shows claim guidance", async () => {
    mocks.checkUsernameAvailability.mockResolvedValue({
      username: "jane",
      available: false,
      code: "premium_short",
      message: "Usernames under 6 characters are reserved for premium claims.",
      requiresClaim: true,
    });

    const user = userEvent.setup();

    render(React.createElement(PersonaForm));

    await user.type(screen.getByLabelText(/username/i), "jane");

    await waitFor(() => {
      expect(
        screen.getAllByText(/reserved for premium claims/i)[0],
      ).toBeInTheDocument();
    });

    expect(screen.getAllByText(/support@dotly.one/i)[0]).toBeInTheDocument();
  });
});
