import type { PermissionEffect } from "../../common/enums/permission-effect.enum";

import type {
  ConversationType,
  IdentityBehaviorRuleSummary,
} from "./identity.types";
import type { PermissionKey } from "./permission-keys";
import { PERMISSION_KEYS } from "./permission-keys";

export enum CallType {
  Voice = "VOICE",
  Video = "VIDEO",
}

export enum CallInitiationMode {
  Direct = "DIRECT",
  Request = "REQUEST",
  Scheduled = "SCHEDULED",
}

export enum CallDecisionEffect {
  Allow = "ALLOW",
  Deny = "DENY",
  RequestApproval = "REQUEST_APPROVAL",
  AllowWithLimits = "ALLOW_WITH_LIMITS",
}

export type CallDecisionReasonCode =
  | "CALL_ALLOWED"
  | "CALL_REQUEST_REQUIRED"
  | "CALL_DENIED_PERMISSION"
  | "CALL_DENIED_RISK"
  | "CALL_DENIED_CONVERSATION_STATE"
  | "CALL_DENIED_PROTECTED_MODE"
  | "CALL_DENIED_INVALID_ACTOR"
  | "CALL_DENIED_SCHEDULE_REQUIRED"
  | "CALL_DENIED_CALL_TYPE_UNSUPPORTED"
  | "CALL_DENIED_IDENTITY_INCOMPATIBLE";

export interface ProtectedCallRestrictionFlags {
  screenCaptureDetected: boolean;
  castingDetected: boolean;
  deviceIntegrityCompromised: boolean;
  protectedModeBlockedByRisk: boolean;
  strictExpectationUnknownRuntime: boolean;
}

export interface CallRestrictionSummary {
  directAllowed: boolean;
  requestAllowed: boolean;
  scheduledAllowed: boolean;
  protectedModeRequired: boolean;
  protectedModeBlocked: boolean;
  schedulingRequired: boolean;
  blockedByRuntimeRisk: boolean;
}

export interface CallPermissionDecision {
  allowed: boolean;
  effect: CallDecisionEffect;
  callType: CallType;
  initiationMode: CallInitiationMode;
  permissionKey: PermissionKey | null;
  conversationId: string;
  actorIdentityId: string;
  conversationType: ConversationType | null;
  reasonCode: CallDecisionReasonCode;
  reasons: string[];
  restrictionSummary: CallRestrictionSummary;
  trace: {
    staleBinding: boolean;
    baseEffect: PermissionEffect | null;
    runtimeRestrictions: ProtectedCallRestrictionFlags;
    blockedCallsByRisk: boolean;
    identityBehaviorApplied?: boolean;
    identityBehaviorReasonCodes?: string[];
    identityBehaviorSummary?: IdentityBehaviorRuleSummary | null;
  };
  evaluatedAt: Date;
}

export interface CallPermissionDefinition {
  callType: CallType;
  initiationMode: CallInitiationMode;
  permissionKey: PermissionKey;
}

export const CALL_PERMISSION_MAP: Record<
  `${CallType}:${CallInitiationMode}`,
  CallPermissionDefinition
> = {
  [`${CallType.Voice}:${CallInitiationMode.Direct}`]: {
    callType: CallType.Voice,
    initiationMode: CallInitiationMode.Direct,
    permissionKey: PERMISSION_KEYS.calling.voiceStart,
  },
  [`${CallType.Video}:${CallInitiationMode.Direct}`]: {
    callType: CallType.Video,
    initiationMode: CallInitiationMode.Direct,
    permissionKey: PERMISSION_KEYS.calling.videoStart,
  },
  [`${CallType.Voice}:${CallInitiationMode.Request}`]: {
    callType: CallType.Voice,
    initiationMode: CallInitiationMode.Request,
    permissionKey: PERMISSION_KEYS.calling.voiceStart,
  },
  [`${CallType.Video}:${CallInitiationMode.Request}`]: {
    callType: CallType.Video,
    initiationMode: CallInitiationMode.Request,
    permissionKey: PERMISSION_KEYS.calling.videoStart,
  },
  [`${CallType.Voice}:${CallInitiationMode.Scheduled}`]: {
    callType: CallType.Voice,
    initiationMode: CallInitiationMode.Scheduled,
    permissionKey: PERMISSION_KEYS.calling.voiceStart,
  },
  [`${CallType.Video}:${CallInitiationMode.Scheduled}`]: {
    callType: CallType.Video,
    initiationMode: CallInitiationMode.Scheduled,
    permissionKey: PERMISSION_KEYS.calling.videoStart,
  },
};

export function getCallPermissionDefinition(
  callType: CallType,
  initiationMode: CallInitiationMode,
): CallPermissionDefinition | null {
  return CALL_PERMISSION_MAP[`${callType}:${initiationMode}`] ?? null;
}
