import React from "react";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { PermissionExplainWidget } from "./permission-explain-widget";
import { explainPermission } from "@/lib/api/connections";
import { PermissionEffect } from "@/types/connection";

vi.mock("@/lib/api/connections", () => ({
  explainPermission: vi.fn(),
}));

describe("PermissionExplainWidget", () => {
  const mockVm = {
    key: "msg.text.send",
    category: "Messaging" as const,
    label: "Send Messages",
    description: "desc",
    defaultEffect: PermissionEffect.Allow,
    effectiveEffect: PermissionEffect.Deny,
    overrideEffect: null,
    isOverridden: false,
    hasGuardrailIntervention: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches and renders explanation on click", async () => {
    const user = userEvent.setup();
    
    vi.mocked(explainPermission).mockResolvedValueOnce({
      key: "msg.text.send",
      finalEffect: PermissionEffect.Deny,
      reason: "Blocked by active risk flags.",
      trace: ["Base policy (template)", "Risk overlay applied (risk)"],
    });

    render(<PermissionExplainWidget connectionId="conn-1" vm={mockVm} />);

    // Click the affordance
    const toggle = screen.getByRole("button", { name: /Why this setting/i });
    await user.click(toggle);

    expect(explainPermission).toHaveBeenCalledWith("conn-1", "msg.text.send");
    
    // Check human text
    expect(await screen.findByText("Blocked by active risk flags.")).toBeInTheDocument();
    
    // Technical trace is hidden by default
    expect(screen.queryByText("Base policy (template)")).not.toBeInTheDocument();
    
    // Show technical trace
    const technicalToggle = screen.getByRole("button", { name: /View exact system trace/i });
    await user.click(technicalToggle);
    
    expect(await screen.findByText("Base policy (template)")).toBeInTheDocument();
    expect(screen.getByText("Risk overlay applied (risk)")).toBeInTheDocument();
  });
});
