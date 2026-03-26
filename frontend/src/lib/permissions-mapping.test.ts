import { describe, expect, it } from "vitest";
import { PermissionEffect } from "../types/connection";
import {
  effectToUIState,
  PERMISSION_CONTROLS,
  getGroupedPermissionControls,
  getControlMetadata,
} from "./permissions-mapping";

describe("permissions-mapping", () => {
  describe("effectToUIState", () => {
    it("maps Allow to 'Allowed'", () => {
      expect(effectToUIState(PermissionEffect.Allow)).toBe("Allowed");
    });
    it("maps RequestApproval to 'Needs approval'", () => {
      expect(effectToUIState(PermissionEffect.RequestApproval)).toBe("Needs approval");
    });
    it("maps AllowWithLimits to 'Limited'", () => {
      expect(effectToUIState(PermissionEffect.AllowWithLimits)).toBe("Limited");
    });
    it("maps Deny to 'Blocked'", () => {
      expect(effectToUIState(PermissionEffect.Deny)).toBe("Blocked");
    });
    it("falls back to 'Blocked' for unknown effects", () => {
      expect(effectToUIState("unknown_effect" as PermissionEffect)).toBe("Blocked");
    });
  });

  describe("PERMISSION_CONTROLS", () => {
    it("should have unique keys", () => {
      const keys = PERMISSION_CONTROLS.map((c) => c.key);
      const uniqueKeys = new Set(keys);
      expect(keys.length).toBe(uniqueKeys.size);
    });

    it("should have human readable labels", () => {
      const allHaveLabels = PERMISSION_CONTROLS.every((c) => c.label.length > 0);
      expect(allHaveLabels).toBe(true);
    });
  });

  describe("getGroupedPermissionControls", () => {
    it("groups controls by their category", () => {
      const grouped = getGroupedPermissionControls();
      
      // Check that at least Messaging exists and has some controls
      expect(grouped["Messaging"]).toBeDefined();
      expect(grouped["Messaging"].length).toBeGreaterThan(0);
      
      // Ensure all grouped items match the key
      for (const [category, controls] of Object.entries(grouped)) {
        for (const control of controls) {
          expect(control.category).toBe(category);
        }
      }
    });
  });

  describe("getControlMetadata", () => {
    it("returns metadata for a known key", () => {
      const metadata = getControlMetadata("msg.text.send");
      expect(metadata).toBeDefined();
      expect(metadata?.label).toBe("Send messages");
      expect(metadata?.category).toBe("Messaging");
    });

    it("returns undefined for an unknown key", () => {
      const metadata = getControlMetadata("unknown.key");
      expect(metadata).toBeUndefined();
    });
  });
});
