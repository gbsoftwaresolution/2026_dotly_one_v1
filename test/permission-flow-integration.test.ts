import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { PermissionEffect } from "../src/common/enums/permission-effect.enum";
import {
  AICapability,
  AIExecutionContext,
  AIRestrictionLevel,
} from "../src/modules/identities/ai-permission";
import { ActionType } from "../src/modules/identities/action-permission";
import {
  CallInitiationMode,
  CallType,
} from "../src/modules/identities/call-permission";
import { AIEnforcementService } from "../src/modules/identities/ai-enforcement.service";
import { ActionEnforcementService } from "../src/modules/identities/action-enforcement.service";
import { CallEnforcementService } from "../src/modules/identities/call-enforcement.service";
import { buildTestPermissionScenario } from "./helpers/permission-flow-scenario";

function createIntegrationServices(scenario = buildTestPermissionScenario()) {
  const identitiesService = {
    resolveConversationContext: async () => ({
      conversation: {
        ...scenario.conversation,
        title: null,
        metadataJson: null,
        lastResolvedAt: null,
        lastPermissionHash: null,
        createdByIdentityId: "identity-source",
        createdAt: new Date("2026-03-26T12:00:00.000Z"),
        updatedAt: new Date("2026-03-26T12:00:00.000Z"),
      },
      resolvedPermissions: scenario.resolvedPermissions,
      stale: false,
      bindingSummary: {
        storedHash: "hash-1",
        currentHash: "hash-1",
        lastResolvedAt: new Date("2026-03-26T12:00:00.000Z"),
        currentResolvedAt: new Date("2026-03-26T12:00:00.000Z"),
        stale: false,
      },
      traceSummary: {
        templateKey: scenario.resolvedPermissions.template.templateKey,
        policyVersion: scenario.resolvedPermissions.template.policyVersion,
        trustState: scenario.resolvedPermissions.trustState,
        overrideCount: 0,
        riskSignals: scenario.resolvedPermissions.riskSummary.appliedSignals,
      },
    }),
    isConversationPermissionBindingStale: async () => ({
      stale: false,
      currentHash: "hash-1",
      storedHash: "hash-1",
      lastResolvedAt: new Date("2026-03-26T12:00:00.000Z"),
      currentResolvedAt: new Date("2026-03-26T12:00:00.000Z"),
    }),
    bindResolvedPermissionsToConversation: async () => ({
      conversationId: scenario.conversation.conversationId,
      connectionId: scenario.conversation.connectionId,
      sourceIdentityId: scenario.conversation.sourceIdentityId,
      targetIdentityId: scenario.conversation.targetIdentityId,
      conversationType: scenario.conversation.conversationType,
      conversationStatus: scenario.conversation.conversationStatus,
      resolvedConnectionPermissions: scenario.resolvedPermissions,
      contentCapabilitySummary: {
        protectedCapable: true,
        vaultCapable: true,
        aiCapable: true,
      },
      bindingSummary: {
        storedHash: "hash-1",
        currentHash: "hash-1",
        lastResolvedAt: new Date("2026-03-26T12:00:00.000Z"),
        currentResolvedAt: new Date("2026-03-26T12:00:00.000Z"),
        stale: false,
      },
      traceSummary: {
        templateKey: scenario.resolvedPermissions.template.templateKey,
        policyVersion: scenario.resolvedPermissions.template.policyVersion,
        trustState: scenario.resolvedPermissions.trustState,
        overrideCount: 0,
        riskSignals: scenario.resolvedPermissions.riskSummary.appliedSignals,
      },
      resolvedAt: scenario.resolvedPermissions.resolvedAt,
      stale: false,
    }),
    getIdentityTypeForIdentity: async () => "personal",
    resolveContentPermissionsForConnection: async () => ({
      connection: {
        id: "connection-1",
        sourceIdentityId: "identity-source",
        targetIdentityId: "identity-target",
      },
      contentSummary: {
        aiAccessAllowed: true,
      },
      effectiveContentPermissions: {
        "content.export": {
          effect:
            scenario.resolvedPermissions.permissions["media.export"]
              ?.finalEffect ?? PermissionEffect.Deny,
        },
        "content.ai_access": { effect: PermissionEffect.Allow },
      },
      restrictionSummary: {
        expired: false,
        viewLimitReached: false,
        blockedActions: [],
        reasons: [],
      },
      contentTrace: {},
    }),
    safeRecordPermissionAuditEvent: async () => undefined,
  } as any;

  return {
    action: new ActionEnforcementService(identitiesService),
    call: new CallEnforcementService(identitiesService),
    ai: new AIEnforcementService(identitiesService),
  };
}

describe("permission flow integration", () => {
  it("couple/protected scenario keeps export blocked, AI limited, and risky calls denied", async () => {
    const scenario = buildTestPermissionScenario({
      conversationType: "PROTECTED_DIRECT" as any,
      exportEffect: PermissionEffect.Deny,
      aiSummaryEffect: PermissionEffect.AllowWithLimits,
      videoCallEffect: PermissionEffect.Allow,
      risk: {
        blockedProtectedMode: true,
      },
    });
    const services = createIntegrationServices(scenario);

    const exportDecision = await services.action.enforceAction({
      conversationId: "conversation-1",
      actorIdentityId: "identity-source",
      actionType: ActionType.ExportMedia,
      contentId: "content-1",
    });
    const aiDecision = await services.ai.enforceAICapability({
      conversationId: "conversation-1",
      actorIdentityId: "identity-source",
      capability: AICapability.Summary,
      contextType: AIExecutionContext.Conversation,
    });
    const callDecision = await services.call.enforceCall({
      conversationId: "conversation-1",
      actorIdentityId: "identity-source",
      callType: CallType.Video,
      initiationMode: CallInitiationMode.Direct,
    });

    assert.equal(exportDecision.allowed, false);
    assert.equal(aiDecision.restrictionLevel, AIRestrictionLevel.Limited);
    assert.equal(callDecision.allowed, false);
  });
});
