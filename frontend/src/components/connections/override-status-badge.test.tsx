import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { OverrideStatusBadge } from "./override-status-badge";
import type { PermissionControlViewModel } from "@/lib/permissions-view-model";
import { PermissionEffect } from "@/types/connection";

describe("OverrideStatusBadge", () => {
  it("shows system default status when not overridden", () => {
    const vm: PermissionControlViewModel = {
      key: "contact.email",
      category: "Messaging",
      label: "Email",
      description: "Can see your email",
      defaultEffect: PermissionEffect.Allow,
      effectiveEffect: PermissionEffect.Allow,
      isOverridden: false,
      overrideEffect: null,
      hasGuardrailIntervention: false,
    };

    render(<OverrideStatusBadge vm={vm} />);
    expect(screen.getByText("Using system default")).toBeInTheDocument();
    expect(
      screen.queryByText("Custom override active"),
    ).not.toBeInTheDocument();
  });

  it("shows custom override status when overridden", () => {
    const vm: PermissionControlViewModel = {
      key: "contact.email",
      category: "Messaging",
      label: "Email",
      description: "Can see your email",
      defaultEffect: PermissionEffect.Allow,
      effectiveEffect: PermissionEffect.Allow,
      isOverridden: true,
      overrideEffect: PermissionEffect.Allow,
      hasGuardrailIntervention: false,
    };

    render(<OverrideStatusBadge vm={vm} />);
    expect(screen.getByText("Custom override active")).toBeInTheDocument();
  });

  it("shows guardrail message when there is an intervention", () => {
    const vm: PermissionControlViewModel = {
      key: "contact.email",
      category: "Messaging",
      label: "Email",
      description: "Can see your email",
      defaultEffect: PermissionEffect.Allow,
      effectiveEffect: PermissionEffect.Deny,
      isOverridden: true,
      overrideEffect: PermissionEffect.Allow,
      hasGuardrailIntervention: true,
    };

    render(<OverrideStatusBadge vm={vm} />);

    // MS-118.8 messaging check
    expect(
      screen.getByText(/System safeguards prevent fully allowing this setting/),
    ).toBeInTheDocument();
    // It should also state the effective state, e.g. "Not Allowed" (Deny is labeled "Not Allowed")
    expect(screen.getByText("Not Allowed")).toBeInTheDocument();
  });
});
