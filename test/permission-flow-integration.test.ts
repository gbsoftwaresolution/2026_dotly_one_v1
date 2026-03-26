import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { IdentityType } from "../src/common/enums/identity-type.enum";
import { PermissionEffect } from "../src/common/enums/permission-effect.enum";
import { TrustState } from "../src/common/enums/trust-state.enum";
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
    getIdentityTypeForIdentity: async (identityId: string) =>
      identityId === scenario.conversation.sourceIdentityId
        ? scenario.identityTypes.source
        : scenario.identityTypes.target,
    resolveContentPermissionsForConnection: async () => ({
      connection: {
        id: "connection-1",
        sourceIdentityId: "identity-source",
        targetIdentityId: "identity-target",
      },
      contentSummary: {
        aiAccessAllowed:
          scenario.content.aiAccessEffect !== PermissionEffect.Deny,
      },
      effectiveContentPermissions: {
        "content.export": {
          effect: scenario.content.exportEffect,
        },
        "content.ai_access": { effect: scenario.content.aiAccessEffect },
      },
      restrictionSummary: {
        expired: scenario.content.expired,
        viewLimitReached: scenario.content.viewLimitReached,
        blockedActions:
          scenario.content.expired || scenario.content.viewLimitReached
            ? (["content.export", "content.ai_access"] as string[])
            : [],
        reasons: scenario.content.expired
          ? ["CONTENT_EXPIRED"]
          : scenario.content.viewLimitReached
            ? ["CONTENT_VIEW_LIMIT_REACHED"]
            : [],
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
  it("trusted personal scenario allows standard actions across layers", async () => {
    const scenario = buildTestPermissionScenario({
      sourceIdentityType: IdentityType.Personal,
      targetIdentityType: IdentityType.Personal,
      trustState: TrustState.TrustedByUser,
      conversationType: "DIRECT" as any,
      exportEffect: PermissionEffect.Allow,
      aiSummaryEffect: PermissionEffect.Allow,
      videoCallEffect: PermissionEffect.Allow,
      vaultViewEffect: PermissionEffect.Allow,
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

    assert.equal(exportDecision.allowed, true);
    assert.equal(aiDecision.allowed, true);
    assert.equal(aiDecision.restrictionLevel, AIRestrictionLevel.Full);
    assert.equal(callDecision.allowed, true);
  });

  it("couple/protected scenario keeps export blocked, AI limited, and risky calls denied", async () => {
    const scenario = buildTestPermissionScenario({
      sourceIdentityType: IdentityType.Couple,
      targetIdentityType: IdentityType.Personal,
      conversationType: "PROTECTED_DIRECT" as any,
      trustState: TrustState.TrustedByUser,
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

  it("business/client scenario preserves business compatibility without opening protected-only constraints", async () => {
    const scenario = buildTestPermissionScenario({
      sourceIdentityType: IdentityType.Business,
      targetIdentityType: IdentityType.Professional,
      trustState: TrustState.BasicVerified,
      conversationType: "BUSINESS_DIRECT" as any,
      exportEffect: PermissionEffect.Allow,
      aiSummaryEffect: PermissionEffect.Allow,
      videoCallEffect: PermissionEffect.Allow,
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

    assert.equal(exportDecision.allowed, true);
    assert.equal(aiDecision.allowed, true);
    assert.equal(callDecision.allowed, true);
  });

  it("family scenario keeps vault-friendly access while limiting AI and preserving call safety", async () => {
    const scenario = buildTestPermissionScenario({
      sourceIdentityType: IdentityType.Family,
      targetIdentityType: IdentityType.Family,
      trustState: TrustState.BasicVerified,
      conversationType: "DIRECT" as any,
      aiSummaryEffect: PermissionEffect.AllowWithLimits,
      videoCallEffect: PermissionEffect.AllowWithLimits,
      vaultViewEffect: PermissionEffect.Allow,
    });
    const services = createIntegrationServices(scenario);

    const vaultAiDecision = await services.ai.enforceAICapability({
      conversationId: "conversation-1",
      actorIdentityId: "identity-source",
      capability: AICapability.Summary,
      contextType: AIExecutionContext.VaultItem,
      isVaultContent: true,
      contentId: "content-1",
    });
    const callDecision = await services.call.enforceCall({
      conversationId: "conversation-1",
      actorIdentityId: "identity-source",
      callType: CallType.Video,
      initiationMode: CallInitiationMode.Scheduled,
    });

    assert.equal(vaultAiDecision.allowed, true);
    assert.equal(vaultAiDecision.restrictionLevel, AIRestrictionLevel.Limited);
    assert.equal(callDecision.allowed, true);
  });

  it("high-risk scenario fails closed across action, call, and AI paths", async () => {
    const scenario = buildTestPermissionScenario({
      sourceIdentityType: IdentityType.Personal,
      targetIdentityType: IdentityType.Personal,
      trustState: TrustState.HighRisk,
      conversationType: "DIRECT" as any,
      exportEffect: PermissionEffect.Allow,
      aiSummaryEffect: PermissionEffect.Allow,
      videoCallEffect: PermissionEffect.Allow,
      risk: {
        appliedSignals: ["DEVICE_COMPROMISED"],
        highestSeverity: "HIGH",
        blockedProtectedMode: true,
        blockedCalls: true,
        aiRestricted: true,
      },
    });
    const services = createIntegrationServices(scenario);

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
    const exportDecision = await services.action.enforceAction({
      conversationId: "conversation-1",
      actorIdentityId: "identity-source",
      actionType: ActionType.StartVideoCall,
    });

    assert.equal(aiDecision.allowed, false);
    assert.equal(callDecision.allowed, false);
    assert.equal(exportDecision.allowed, false);
  });

  it("content expiry and view-limit scenario fails closed for content-bound action and AI access", async () => {
    const scenario = buildTestPermissionScenario({
      sourceIdentityType: IdentityType.Personal,
      targetIdentityType: IdentityType.Personal,
      trustState: TrustState.TrustedByUser,
      conversationType: "DIRECT" as any,
      exportEffect: PermissionEffect.Allow,
      aiSummaryEffect: PermissionEffect.Allow,
      contentAiAccessEffect: PermissionEffect.Deny,
      contentExportEffect: PermissionEffect.Deny,
      content: {
        expired: true,
        viewLimitReached: true,
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
      contextType: AIExecutionContext.Content,
      contentId: "content-1",
    });

    assert.equal(exportDecision.allowed, false);
    assert.equal(aiDecision.allowed, false);
  });

  it("snapshot/cache scenario rebinds stale context before enforcing", async () => {
    const scenario = buildTestPermissionScenario({
      sourceIdentityType: IdentityType.Business,
      targetIdentityType: IdentityType.Personal,
      trustState: TrustState.BasicVerified,
    });
    let bindCalls = 0;
    const services = createIntegrationServices(scenario);
    const staleIdentitiesService = {
      ...(services.action as any).identitiesService,
      isConversationPermissionBindingStale: async () => ({
        stale: true,
        currentHash: "hash-2",
        storedHash: "hash-1",
        lastResolvedAt: new Date("2026-03-26T12:00:00.000Z"),
        currentResolvedAt: new Date("2026-03-26T12:01:00.000Z"),
      }),
      bindResolvedPermissionsToConversation: async () => {
        bindCalls += 1;
        return (
          services.action as any
        ).identitiesService.bindResolvedPermissionsToConversation();
      },
    };
    const actionService = new ActionEnforcementService(staleIdentitiesService);

    const decision = await actionService.enforceAction({
      conversationId: "conversation-1",
      actorIdentityId: "identity-source",
      actionType: ActionType.SendText,
    });

    assert.equal(bindCalls, 1);
    assert.equal(decision.allowed, true);
  });

  it("API sanity scenario preserves explicit enum-driven request shapes used by integrations", async () => {
    const scenario = buildTestPermissionScenario({
      sourceIdentityType: IdentityType.Business,
      targetIdentityType: IdentityType.Professional,
      trustState: TrustState.BasicVerified,
    });
    const services = createIntegrationServices(scenario);

    const actionDecision = await services.action.enforceAction({
      conversationId: "conversation-1",
      actorIdentityId: "identity-source",
      actionType: ActionType.SendText,
    });
    const callDecision = await services.call.enforceCall({
      conversationId: "conversation-1",
      actorIdentityId: "identity-source",
      callType: CallType.Voice,
      initiationMode: CallInitiationMode.Request,
    });
    const aiDecision = await services.ai.enforceAICapability({
      conversationId: "conversation-1",
      actorIdentityId: "identity-source",
      capability: AICapability.Summary,
      contextType: AIExecutionContext.Conversation,
    });

    assert.equal(typeof actionDecision.reasonCode, "string");
    assert.equal(typeof callDecision.reasonCode, "string");
    assert.equal(typeof aiDecision.reasonCode, "string");
  });
});
