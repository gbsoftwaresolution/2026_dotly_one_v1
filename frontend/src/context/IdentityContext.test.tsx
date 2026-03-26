import React from "react";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { IdentitySwitcher } from "@/components/identities/identity-switcher";
import {
  IdentityProvider,
  useIdentityContext,
} from "@/context/IdentityContext";
import { IdentityType, type Identity } from "@/types/identity";

const identities: Identity[] = [
  {
    id: "identity-1",
    personId: "person-1",
    identityType: IdentityType.Personal,
    displayName: "Grandpa Joe",
    handle: "grandpa-joe",
    verificationLevel: "basic_verified",
    status: "active",
  },
  {
    id: "identity-2",
    personId: "person-1",
    identityType: IdentityType.Business,
    displayName: "Joe's Repair Shop",
    handle: "joes-repair-shop",
    verificationLevel: "strong_verified",
    status: "active",
  },
];

function ActiveIdentityProbe() {
  const { activeIdentity } = useIdentityContext();

  return <p>{activeIdentity?.displayName}</p>;
}

describe("IdentityContext", () => {
  it("switches the active identity from the switcher", async () => {
    const user = userEvent.setup();

    render(
      <IdentityProvider initialIdentities={identities}>
        <IdentitySwitcher />
        <ActiveIdentityProbe />
      </IdentityProvider>,
    );

    const switcher = screen.getByLabelText(/switch identity/i).closest("label");
    expect(switcher).not.toBeNull();
    expect(
      within(switcher as HTMLElement).getAllByText("Grandpa Joe").length,
    ).toBeGreaterThan(0);

    await user.selectOptions(
      screen.getByLabelText(/switch identity/i),
      "identity-2",
    );

    expect(screen.getAllByText(/^Joe's Repair Shop$/).length).toBeGreaterThan(
      0,
    );
  });
});
