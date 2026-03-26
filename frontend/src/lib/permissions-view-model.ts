import { PermissionEffect } from "../types/connection";
import type { ResolvedPermissionsMap } from "../types/connection";
import type {
  PermissionCategory,
  PermissionControlMetadata,
  PermissionOverride,
} from "../types/permissions";
import { PERMISSION_CONTROLS } from "./permissions-mapping";

export interface PermissionControlViewModel extends PermissionControlMetadata {
  /** The final actual effect determined by the backend */
  effectiveEffect: PermissionEffect;
  /** The user's explicit override, if any exists */
  overrideEffect: PermissionEffect | null;
  /** True if the user has set an override for this control */
  isOverridden: boolean;
  /** 
   * True if an override exists, but system guardrails (risk, trust, etc.)
   * forced the effective state to be different from the requested override.
   */
  hasGuardrailIntervention: boolean;
}

export function buildPermissionViewModels(
  resolvedMap: ResolvedPermissionsMap | null,
  overrides: PermissionOverride[]
): Record<PermissionCategory, PermissionControlViewModel[]> {
  const grouped = {} as Record<PermissionCategory, PermissionControlViewModel[]>;

  // Initialize all categories defined in the metadata
  const categories = Array.from(new Set(PERMISSION_CONTROLS.map((c) => c.category))) as PermissionCategory[];
  categories.forEach((cat) => {
    grouped[cat] = [];
  });

  const overrideMap = new Map<string, PermissionEffect>();
  for (const o of overrides) {
    overrideMap.set(o.key, o.effect);
  }

  const resolvedPermissions = resolvedMap?.permissions || {};

  for (const control of PERMISSION_CONTROLS) {
    const overrideEffect = overrideMap.get(control.key) || null;
    const resolved = resolvedPermissions[control.key];
    
    // Fall back to the control's safe default if the backend map is missing this key
    const effectiveEffect = resolved?.finalEffect ?? control.defaultEffect;
    
    const isOverridden = overrideEffect !== null;
    
    // A mismatch occurs if the user requested a specific state but the system
    // resolved it to something else (e.g., requested "Allow", but system says "Blocked")
    const hasGuardrailIntervention = isOverridden && overrideEffect !== effectiveEffect;

    grouped[control.category].push({
      ...control,
      effectiveEffect,
      overrideEffect,
      isOverridden,
      hasGuardrailIntervention,
    });
  }

  return grouped;
}
