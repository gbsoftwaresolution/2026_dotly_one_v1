import { PermissionEffect } from "./connection";

export type PermissionCategory =
  | "Messaging"
  | "Calls"
  | "Media & Downloads"
  | "Protected Sharing"
  | "AI Assistance"
  | "Business Actions";

export interface PermissionControlMetadata {
  key: string;
  category: PermissionCategory;
  label: string;
  description: string;
  defaultEffect: PermissionEffect;
}

export type UIState = "Allowed" | "Needs approval" | "Limited" | "Blocked";

export interface PermissionUIState {
  key: string;
  effect: PermissionEffect;
  uiState: UIState;
  isOverridden: boolean;
}

export interface OverrideIntent {
  key: string;
  desiredEffect: PermissionEffect;
}

export interface PermissionOverride {
  key: string;
  effect: PermissionEffect;
  limitsJson?: Record<string, unknown> | null;
  reason?: string | null;
  createdAt: string;
}

export interface ExplainResponse {
  key: string;
  finalEffect: PermissionEffect;
  reason: string;
  trace: string[];
}
