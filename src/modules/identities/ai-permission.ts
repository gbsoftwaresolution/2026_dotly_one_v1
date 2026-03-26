import type { PermissionEffect } from "../../common/enums/permission-effect.enum";

import { ConversationType } from "./identity.types";
import { RiskSignal } from "./risk-engine";
import type { PermissionKey } from "./permission-keys";
import { PERMISSION_KEYS } from "./permission-keys";

export enum AICapability {
  Summary = "SUMMARY",
  Reply = "REPLY",
  ExtractActions = "EXTRACT_ACTIONS",
  AutoReply = "AUTO_REPLY",
  DraftMessage = "DRAFT_MESSAGE",
  Classify = "CLASSIFY",
  Translate = "TRANSLATE",
}

export enum AIExecutionContext {
  Message = "MESSAGE",
  Content = "CONTENT",
  Conversation = "CONVERSATION",
  VaultItem = "VAULT_ITEM",
}

export enum AIRestrictionLevel {
  Full = "FULL",
  Limited = "LIMITED",
  Denied = "DENIED",
}

export enum AIReasonCode {
  Allowed = "AI_ALLOWED",
  DeniedPermission = "AI_DENIED_PERMISSION",
  DeniedContentRule = "AI_DENIED_CONTENT_RULE",
  DeniedRisk = "AI_DENIED_RISK",
  DeniedVault = "AI_DENIED_VAULT",
  DeniedContext = "AI_DENIED_CONTEXT",
  Limited = "AI_LIMITED",
  ExplicitlyDisabled = "AI_EXPLICITLY_DISABLED",
}

export interface AICapabilityDecision {
  allowed: boolean;
  restrictionLevel: AIRestrictionLevel;
  capability: AICapability | string;
  permissionKey: PermissionKey | null;
  conversationId: string;
  actorIdentityId: string;
  contextType: AIExecutionContext;
  reasonCode: AIReasonCode;
  reasons: string[];
  trace: {
    staleBinding: boolean;
    conversationType: ConversationType | null;
    baseEffect: PermissionEffect | null;
    contentAiEffect: PermissionEffect | null;
    vaultViewEffect: PermissionEffect | null;
    protectedContextApplied: boolean;
    vaultContent: boolean;
    protectedContent: boolean;
    riskSignals: RiskSignal[];
  };
  evaluatedAt: Date;
}

export const AI_CAPABILITY_PERMISSION_MAP: Record<AICapability, PermissionKey> =
  {
    [AICapability.Summary]: PERMISSION_KEYS.ai.summaryUse,
    [AICapability.Reply]: PERMISSION_KEYS.ai.replyUse,
    [AICapability.ExtractActions]: PERMISSION_KEYS.ai.extractActionsUse,
    [AICapability.AutoReply]: PERMISSION_KEYS.ai.replyUse,
    [AICapability.DraftMessage]: PERMISSION_KEYS.ai.replyUse,
    [AICapability.Classify]: PERMISSION_KEYS.ai.summaryUse,
    [AICapability.Translate]: PERMISSION_KEYS.ai.summaryUse,
  };

export function mapAICapabilityToPermissionKey(
  capability: AICapability | string,
): PermissionKey | null {
  return AI_CAPABILITY_PERMISSION_MAP[capability as AICapability] ?? null;
}
