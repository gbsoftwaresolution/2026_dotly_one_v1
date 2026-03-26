import { describe, expect, it } from "vitest";
import { buildPermissionViewModels } from "./permissions-view-model";
import { PermissionEffect } from "../types/connection";
import { PERMISSION_CONTROLS } from "./permissions-mapping";
import type { ResolvedPermissionsMap } from "../types/connection";
import type { PermissionOverride } from "../types/permissions";

describe("buildPermissionViewModels", () => {
  const getMockControl = (key: string) => PERMISSION_CONTROLS.find((c) => c.key === key)!;

  it("builds models with system defaults when no resolved map or overrides exist", () => {
    const viewModels = buildPermissionViewModels(null, []);
    
    // Check messaging category
    const msgModels = viewModels["Messaging"];
    expect(msgModels).toBeDefined();
    
    const sendMsg = msgModels.find((m) => m.key === "msg.text.send")!;
    expect(sendMsg.isOverridden).toBe(false);
    expect(sendMsg.overrideEffect).toBeNull();
    expect(sendMsg.effectiveEffect).toBe(getMockControl("msg.text.send").defaultEffect);
    expect(sendMsg.hasGuardrailIntervention).toBe(false);
  });

  it("uses resolved permissions when no overrides exist", () => {
    const resolvedMap: ResolvedPermissionsMap = {
      connectionId: "c1",
      sourceIdentityId: "s1",
      targetIdentityId: "t1",
      permissions: {
        "msg.text.send": { finalEffect: PermissionEffect.AllowWithLimits },
      },
    };

    const viewModels = buildPermissionViewModels(resolvedMap, []);
    const sendMsg = viewModels["Messaging"].find((m) => m.key === "msg.text.send")!;
    
    expect(sendMsg.isOverridden).toBe(false);
    expect(sendMsg.effectiveEffect).toBe(PermissionEffect.AllowWithLimits);
    expect(sendMsg.hasGuardrailIntervention).toBe(false);
  });

  it("detects when a permission is overridden and perfectly matches effective state", () => {
    const resolvedMap: ResolvedPermissionsMap = {
      connectionId: "c1",
      sourceIdentityId: "s1",
      targetIdentityId: "t1",
      permissions: {
        "msg.text.send": { finalEffect: PermissionEffect.Deny },
      },
    };
    const overrides: PermissionOverride[] = [
      { key: "msg.text.send", effect: PermissionEffect.Deny, createdAt: "2026-01-01T00:00:00Z" }
    ];

    const viewModels = buildPermissionViewModels(resolvedMap, overrides);
    const sendMsg = viewModels["Messaging"].find((m) => m.key === "msg.text.send")!;
    
    expect(sendMsg.isOverridden).toBe(true);
    expect(sendMsg.overrideEffect).toBe(PermissionEffect.Deny);
    expect(sendMsg.effectiveEffect).toBe(PermissionEffect.Deny);
    expect(sendMsg.hasGuardrailIntervention).toBe(false);
  });

  it("detects guardrail interventions when override differs from effective state", () => {
    const resolvedMap: ResolvedPermissionsMap = {
      connectionId: "c1",
      sourceIdentityId: "s1",
      targetIdentityId: "t1",
      permissions: {
        // Effective state is blocked
        "msg.text.send": { finalEffect: PermissionEffect.Deny },
      },
    };
    const overrides: PermissionOverride[] = [
      // But user requested allow
      { key: "msg.text.send", effect: PermissionEffect.Allow, createdAt: "2026-01-01T00:00:00Z" }
    ];

    const viewModels = buildPermissionViewModels(resolvedMap, overrides);
    const sendMsg = viewModels["Messaging"].find((m) => m.key === "msg.text.send")!;
    
    expect(sendMsg.isOverridden).toBe(true);
    expect(sendMsg.overrideEffect).toBe(PermissionEffect.Allow);
    expect(sendMsg.effectiveEffect).toBe(PermissionEffect.Deny);
    // User wants Allow, but system says Deny -> intervention occurred!
    expect(sendMsg.hasGuardrailIntervention).toBe(true);
  });
});
