import { PermissionEffect } from "../../src/common/enums/permission-effect.enum";
import {
  ConversationStatus,
  ConversationType,
} from "../../src/modules/identities/identity.types";

export function buildTestPermissionScenario(overrides?: {
  conversationType?: ConversationType;
  conversationStatus?: ConversationStatus;
  exportEffect?: PermissionEffect;
  aiSummaryEffect?: PermissionEffect;
  videoCallEffect?: PermissionEffect;
  risk?: {
    blockedProtectedMode?: boolean;
    blockedCalls?: boolean;
    blockedPayments?: boolean;
    aiRestricted?: boolean;
  };
}) {
  return {
    conversation: {
      conversationId: "conversation-1",
      connectionId: "connection-1",
      sourceIdentityId: "identity-source",
      targetIdentityId: "identity-target",
      conversationType: overrides?.conversationType ?? ConversationType.Direct,
      conversationStatus:
        overrides?.conversationStatus ?? ConversationStatus.Active,
    },
    resolvedPermissions: {
      connectionId: "connection-1",
      sourceIdentityId: "identity-source",
      targetIdentityId: "identity-target",
      sourceIdentityType: "PERSONAL",
      relationshipType: "FRIEND",
      connectionType: "TRUSTED",
      trustState: "TRUSTED_BY_USER",
      status: "ACTIVE",
      template: {
        templateKey: "personal.trusted",
        policyVersion: 1,
      },
      overridesSummary: {
        count: 0,
        overriddenKeys: [],
      },
      riskSummary: {
        appliedSignals: [],
        highestSeverity: null,
        blockedProtectedMode: overrides?.risk?.blockedProtectedMode ?? false,
        blockedPayments: overrides?.risk?.blockedPayments ?? false,
        blockedCalls: overrides?.risk?.blockedCalls ?? false,
        aiRestricted: overrides?.risk?.aiRestricted ?? false,
      },
      permissions: {
        "msg.text.send": { finalEffect: PermissionEffect.Allow },
        "media.export": {
          finalEffect: overrides?.exportEffect ?? PermissionEffect.Allow,
        },
        "ai.summary.use": {
          finalEffect:
            overrides?.aiSummaryEffect ?? PermissionEffect.AllowWithLimits,
        },
        "call.video.start": {
          finalEffect: overrides?.videoCallEffect ?? PermissionEffect.Allow,
        },
        "vault.item.view": { finalEffect: PermissionEffect.Allow },
        "media.protected.send": {
          finalEffect: PermissionEffect.AllowWithLimits,
        },
      },
      trace: {},
      resolvedAt: new Date("2026-03-26T12:00:00.000Z"),
    },
  } as const;
}
