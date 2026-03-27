import React from "react";

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";

const mocks = vi.hoisted(() => ({
  getIdentityTeamAccess: vi.fn(),
  updateIdentityMemberPersonaAssignments: vi.fn(),
  updateIdentityOperatorPersonaAssignments: vi.fn(),
  showToast: vi.fn(),
}));

vi.mock("@/lib/api/identities", () => ({
  getIdentityTeamAccess: mocks.getIdentityTeamAccess,
  updateIdentityMemberPersonaAssignments:
    mocks.updateIdentityMemberPersonaAssignments,
  updateIdentityOperatorPersonaAssignments:
    mocks.updateIdentityOperatorPersonaAssignments,
}));

vi.mock("@/components/shared/toast-viewport", () => ({
  showToast: mocks.showToast,
}));

vi.mock("@/components/identities/identity-switcher", () => ({
  IdentitySwitcher: () => React.createElement("div", null, "identity-switcher"),
}));

import { IdentityProvider } from "@/context/IdentityContext";
import { IdentityType } from "@/types/identity";

import { TeamAccessManager } from "./team-access-manager";

function renderSubject() {
  return render(
    React.createElement(
      IdentityProvider,
      {
        initialIdentities: [
          {
            id: "identity-1",
            personId: "user-1",
            identityType: IdentityType.Personal,
            displayName: "Grandpa Joe",
            handle: "grandpa-joe",
            verificationLevel: "basic_verified",
            status: "active",
          },
        ],
      },
      React.createElement(TeamAccessManager),
    ),
  );
}

describe("TeamAccessManager", () => {
  beforeEach(() => {
    mocks.getIdentityTeamAccess.mockReset();
    mocks.updateIdentityMemberPersonaAssignments.mockReset();
    mocks.updateIdentityOperatorPersonaAssignments.mockReset();
    mocks.showToast.mockReset();
    mocks.getIdentityTeamAccess.mockResolvedValue({
      identity: {
        id: "identity-1",
        displayName: "Grandpa Joe",
        handle: "grandpa-joe",
      },
      personas: [
        {
          id: "persona-1",
          username: "alpha",
          fullName: "Alpha Persona",
          routingKey: "alpha",
          routingDisplayName: "Alpha",
          isDefaultRouting: true,
        },
        {
          id: "persona-2",
          username: "beta",
          fullName: "Beta Persona",
          routingKey: "beta",
          routingDisplayName: "Beta",
          isDefaultRouting: false,
        },
      ],
      members: [
        {
          id: "member-1",
          personId: "member-user",
          email: "member@dotly.one",
          role: "OWNER",
          status: "ACTIVE",
          assignedPersonaIds: [],
          assignedPersonas: [],
          accessMode: "full",
        },
      ],
      operators: [
        {
          id: "operator-1",
          personId: "operator-user",
          email: "operator@dotly.one",
          role: "ADMIN",
          status: "ACTIVE",
          assignedPersonaIds: ["persona-1"],
          assignedPersonas: [
            {
              id: "persona-1",
              username: "alpha",
              fullName: "Alpha Persona",
              routingKey: "alpha",
              routingDisplayName: "Alpha",
              isDefaultRouting: true,
            },
          ],
          accessMode: "restricted",
        },
      ],
    });
    mocks.updateIdentityMemberPersonaAssignments.mockResolvedValue({
      id: "member-1",
      personId: "member-user",
      email: "member@dotly.one",
      role: "OWNER",
      status: "ACTIVE",
      assignedPersonaIds: ["persona-2"],
      assignedPersonas: [
        {
          id: "persona-2",
          username: "beta",
          fullName: "Beta Persona",
          routingKey: "beta",
          routingDisplayName: "Beta",
          isDefaultRouting: false,
        },
      ],
      accessMode: "restricted",
    });
  });

  it("renders the legacy vs restricted access contract", async () => {
    renderSubject();

    await waitFor(() => {
      expect(mocks.getIdentityTeamAccess).toHaveBeenCalledWith("identity-1");
    });

    expect(
      screen.getByText(/No persona assignments = full inbox access/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Assigned personas only = restricted inbox access/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Owner and admin management only/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/member@dotly.one/i)).toBeInTheDocument();
    expect(screen.getByText(/operator@dotly.one/i)).toBeInTheDocument();
  });

  it("saves member persona selections", async () => {
    const user = userEvent.setup();
    renderSubject();

    await waitFor(() => {
      expect(screen.getByText(/member@dotly.one/i)).toBeInTheDocument();
    });

    const memberCard = screen
      .getByText(/member@dotly.one/i)
      .closest("article") as HTMLElement;

    await user.click(within(memberCard).getAllByRole("checkbox")[1]);
    await user.click(
      within(memberCard).getByRole("button", { name: /save member access/i }),
    );

    await waitFor(() => {
      expect(mocks.updateIdentityMemberPersonaAssignments).toHaveBeenCalledWith(
        "identity-1",
        "member-1",
        ["persona-2"],
      );
    });

    expect(
      screen.getByText(/Inbox access is now persona-restricted/i),
    ).toBeInTheDocument();
    expect(mocks.showToast).toHaveBeenCalled();
  });

  it("shows a locked state when the viewer lacks owner admin access", async () => {
    mocks.getIdentityTeamAccess.mockRejectedValue(
      new ApiError(
        "You do not have permission to manage persona inbox assignments for this identity",
        403,
      ),
    );

    renderSubject();

    expect(
      await screen.findByText(/Owner or admin access required/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Only the identity owner, owner-members, and admin operators can manage persona inbox assignments/i,
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Return to inbox/i })).toHaveAttribute(
      "href",
      "/app/inbox",
    );
  });
});