import { describe, expect, it } from "vitest";
import { generatePermissionSummary } from "./permissions-summary";
import { PermissionEffect } from "../types/connection";
import type { PermissionCategory } from "../types/permissions";
import type { PermissionControlViewModel } from "./permissions-view-model";

describe("generatePermissionSummary", () => {
  const createMockVM = (category: PermissionCategory, effect: PermissionEffect): PermissionControlViewModel => ({
    key: `mock.${category}`,
    category,
    label: "Mock Label",
    description: "Mock Desc",
    defaultEffect: PermissionEffect.Allow,
    effectiveEffect: effect,
    overrideEffect: null,
    isOverridden: false,
    hasGuardrailIntervention: false,
  });

  it("handles empty input", () => {
    expect(generatePermissionSummary({} as any)).toEqual(["No permission details available."]);
  });

  it("reports when all are allowed", () => {
    const data = {
      "Messaging": [createMockVM("Messaging", PermissionEffect.Allow)],
      "Calls": [createMockVM("Calls", PermissionEffect.Allow)],
    } as Record<PermissionCategory, PermissionControlViewModel[]>;

    const summary = generatePermissionSummary(data);
    expect(summary).toContain("All interactions are allowed.");
  });

  it("reports when most are allowed and some require approval", () => {
    const data = {
      "Messaging": [
        createMockVM("Messaging", PermissionEffect.Allow),
        createMockVM("Messaging", PermissionEffect.Allow),
        createMockVM("Messaging", PermissionEffect.Allow),
      ],
      "Calls": [createMockVM("Calls", PermissionEffect.RequestApproval)],
    } as Record<PermissionCategory, PermissionControlViewModel[]>;

    const summary = generatePermissionSummary(data);
    expect(summary).toContain("Most interactions are allowed.");
    expect(summary).toContain("Some actions will ask for your approval first.");
  });

  it("reports protected sharing restrictions", () => {
    const data = {
      "Messaging": [createMockVM("Messaging", PermissionEffect.Allow)],
      "Protected Sharing": [createMockVM("Protected Sharing", PermissionEffect.Deny)],
    } as Record<PermissionCategory, PermissionControlViewModel[]>;

    const summary = generatePermissionSummary(data);
    expect(summary).toContain("Sharing of your protected data (like location or health) is restricted.");
  });

  it("reports AI restrictions", () => {
    const data = {
      "Messaging": [createMockVM("Messaging", PermissionEffect.Allow)],
      "AI Assistance": [createMockVM("AI Assistance", PermissionEffect.AllowWithLimits)],
    } as Record<PermissionCategory, PermissionControlViewModel[]>;

    const summary = generatePermissionSummary(data);
    expect(summary).toContain("AI agent assistance is limited or disabled.");
  });
});
