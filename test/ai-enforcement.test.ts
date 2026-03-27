import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { NotFoundException } from "@nestjs/common";

import { PermissionEffect } from "../src/common/enums/permission-effect.enum";
import { TrustState } from "../src/common/enums/trust-state.enum";
import {
  AICapability,
  AIExecutionContext,
  AIReasonCode,
  AIRestrictionLevel,
} from "../src/modules/identities/ai-permission";
import { AIEnforcementService } from "../src/modules/identities/ai-enforcement.service";
import {
  ConversationStatus,
  ConversationType,
} from "../src/modules/identities/identity.types";
import { PERMISSION_KEYS } from "../src/modules/identities/permission-keys";
import { RiskSignal } from "../src/modules/identities/risk-engine";

function createResolvedPermissions(
  overrides?: Partial<Record<string, unknown>>,
) {
  return {
    connectionId: "connection-1",
    sourceIdentityId: "identity-source",
    targetIdentityId: "identity-target",
    sourceIdentityType: "PERSONAL",
    relationshipType: "UNKNOWN",
    connectionType: "TRUSTED",
    trustState: "TRUSTED_BY_USER",
    status: "ACTIVE",
    template: {
      templateKey: "personal.trusted",
      policyVersion: 1,
    },
    identityBehaviorSummary: {},
    relationshipBehaviorSummary: {},
    overridesSummary: {
      count: 0,
      overriddenKeys: [],
    },
    riskSummary: {
      appliedSignals: [],
      highestSeverity: null,
      blockedProtectedMode: false,
      blockedPayments: false,
      blockedCalls: false,
      aiRestricted: false,
    },
    permissions: {
      [PERMISSION_KEYS.ai.summaryUse]: { finalEffect: PermissionEffect.Allow },
      [PERMISSION_KEYS.ai.replyUse]: { finalEffect: PermissionEffect.Allow },
      [PERMISSION_KEYS.ai.extractActionsUse]: {
        finalEffect: PermissionEffect.Allow,
      },
      [PERMISSION_KEYS.vault.itemView]: { finalEffect: PermissionEffect.Deny },
    },
    trace: {},
    resolvedAt: new Date("2026-03-26T12:00:00.000Z"),
    ...overrides,
  } as any;
}

function createConversationContext(
  overrides?: Partial<Record<string, unknown>>,
) {
  return {
    conversation: {
      conversationId: "conversation-1",
      connectionId: "connection-1",
      sourceIdentityId: "identity-source",
      targetIdentityId: "identity-target",
      conversationType: ConversationType.Direct,
      conversationStatus: ConversationStatus.Active,
      title: null,
      metadataJson: null,
      lastResolvedAt: null,
      lastPermissionHash: null,
      createdByIdentityId: "identity-source",
      createdAt: new Date("2026-03-26T12:00:00.000Z"),
      updatedAt: new Date("2026-03-26T12:00:00.000Z"),
    },
    resolvedPermissions: createResolvedPermissions(),
    stale: false,
    bindingSummary: {
      storedHash: "hash-1",
      currentHash: "hash-1",
      lastResolvedAt: new Date("2026-03-26T12:00:00.000Z"),
      currentResolvedAt: new Date("2026-03-26T12:00:00.000Z"),
      stale: false,
    },
    traceSummary: {
      templateKey: "personal.trusted",
      policyVersion: 1,
      trustState: "TRUSTED_BY_USER",
      overrideCount: 0,
      riskSignals: [],
    },
    ...overrides,
  } as any;
}

function createContentResolution(overrides?: Partial<Record<string, unknown>>) {
  return {
    connection: {
      id: "connection-1",
      sourceIdentityId: "identity-source",
      targetIdentityId: "identity-target",
      sourceIdentityType: "PERSONAL",
      connectionType: "TRUSTED",
      trustState: "TRUSTED_BY_USER",
      status: "ACTIVE",
      templateKey: "personal.trusted",
      policyVersion: 1,
    },
    contentSummary: {
      contentId: "content-1",
      targetIdentityId: "identity-target",
      rulePresent: true,
      expiryAt: null,
      viewLimit: null,
      currentViewCount: 0,
      watermarkMode: null,
      aiAccessAllowed: true,
    },
    baseConnectionPermissions: {},
    effectiveContentPermissions: {
      "content.ai_access": { effect: PermissionEffect.Allow },
    },
    contentTrace: {
      "content.ai_access": { reasonCode: "CONTENT_INHERITED" },
    },
    restrictionSummary: {
      rulePresent: true,
      expired: false,
      viewLimitReached: false,
      blockedActions: [],
      reasons: [],
    },
    ...overrides,
  } as any;
}

function createService(overrides?: Partial<Record<string, unknown>>) {
  const identitiesService = {
    resolveConversationContext: async () => createConversationContext(),
    assertConversationActionAccessibleToUser: async () => undefined,
    isConversationPermissionBindingStale: async () => ({
      stale: false,
      currentHash: "hash-1",
      storedHash: "hash-1",
      lastResolvedAt: new Date("2026-03-26T12:00:00.000Z"),
      currentResolvedAt: new Date("2026-03-26T12:00:00.000Z"),
    }),
    bindResolvedPermissionsToConversation: async () => ({
      resolvedConnectionPermissions: createResolvedPermissions(),
    }),
    safeRecordPermissionAuditEvent: async () => undefined,
    resolveContentPermissionsForConnection: async () =>
      createContentResolution(),
    ...overrides,
  } as any;

  return new AIEnforcementService(identitiesService);
}

describe("ai enforcement", () => {
  it("allows SUMMARY when allowed", async () => {
    const service = createService();

    const result = await service.enforceAICapability({
      conversationId: "conversation-1",
      actorIdentityId: "identity-source",
      capability: AICapability.Summary,
      contextType: AIExecutionContext.Conversation,
    });

    assert.equal(result.allowed, true);
    assert.equal(result.restrictionLevel, AIRestrictionLevel.Full);
    assert.equal(result.reasonCode, AIReasonCode.Allowed);
  });

  it("denies when permission DENY", async () => {
    const service = createService({
      resolveConversationContext: async () =>
        createConversationContext({
          resolvedPermissions: createResolvedPermissions({
            permissions: {
              [PERMISSION_KEYS.ai.summaryUse]: {
                finalEffect: PermissionEffect.Deny,
              },
            },
          }),
        }),
    });

    const result = await service.enforceAICapability({
      conversationId: "conversation-1",
      actorIdentityId: "identity-source",
      capability: AICapability.Summary,
      contextType: AIExecutionContext.Conversation,
    });

    assert.equal(result.allowed, false);
    assert.equal(result.restrictionLevel, AIRestrictionLevel.Denied);
  });

  it("limited when ALLOW_WITH_LIMITS", async () => {
    const service = createService({
      resolveConversationContext: async () =>
        createConversationContext({
          resolvedPermissions: createResolvedPermissions({
            permissions: {
              [PERMISSION_KEYS.ai.summaryUse]: {
                finalEffect: PermissionEffect.AllowWithLimits,
              },
            },
          }),
        }),
    });

    const result = await service.enforceAICapability({
      conversationId: "conversation-1",
      actorIdentityId: "identity-source",
      capability: AICapability.Summary,
      contextType: AIExecutionContext.Conversation,
    });

    assert.equal(result.allowed, true);
    assert.equal(result.restrictionLevel, AIRestrictionLevel.Limited);
  });

  it("deny when aiAccessAllowed=false", async () => {
    const service = createService({
      resolveContentPermissionsForConnection: async () =>
        createContentResolution({
          contentSummary: {
            contentId: "content-1",
            targetIdentityId: "identity-target",
            rulePresent: true,
            expiryAt: null,
            viewLimit: null,
            currentViewCount: 0,
            watermarkMode: null,
            aiAccessAllowed: false,
          },
          effectiveContentPermissions: {
            "content.ai_access": { effect: PermissionEffect.Deny },
          },
        }),
    });

    const result = await service.enforceAICapability({
      conversationId: "conversation-1",
      actorIdentityId: "identity-source",
      capability: AICapability.Summary,
      contextType: AIExecutionContext.Content,
      contentId: "content-1",
    });

    assert.equal(result.allowed, false);
    assert.equal(result.reasonCode, AIReasonCode.ExplicitlyDisabled);
  });

  it("deny expired content", async () => {
    const service = createService({
      resolveContentPermissionsForConnection: async () =>
        createContentResolution({
          restrictionSummary: {
            rulePresent: true,
            expired: true,
            viewLimitReached: false,
            blockedActions: ["content.ai_access"],
            reasons: ["CONTENT_EXPIRED"],
          },
        }),
    });

    const result = await service.enforceAICapability({
      conversationId: "conversation-1",
      actorIdentityId: "identity-source",
      capability: AICapability.Summary,
      contextType: AIExecutionContext.Content,
      contentId: "content-1",
    });

    assert.equal(result.allowed, false);
    assert.equal(result.reasonCode, AIReasonCode.DeniedContentRule);
  });

  it("deny vault access without explicit permission", async () => {
    const service = createService();

    const result = await service.enforceAICapability({
      conversationId: "conversation-1",
      actorIdentityId: "identity-source",
      capability: AICapability.Summary,
      contextType: AIExecutionContext.VaultItem,
      isVaultContent: true,
    });

    assert.equal(result.allowed, false);
    assert.equal(result.reasonCode, AIReasonCode.DeniedVault);
  });

  it("allow vault access only when explicitly permitted", async () => {
    const service = createService({
      resolveConversationContext: async () =>
        createConversationContext({
          resolvedPermissions: createResolvedPermissions({
            permissions: {
              [PERMISSION_KEYS.ai.summaryUse]: {
                finalEffect: PermissionEffect.Allow,
              },
              [PERMISSION_KEYS.vault.itemView]: {
                finalEffect: PermissionEffect.Allow,
              },
            },
          }),
        }),
      resolveContentPermissionsForConnection: async () =>
        createContentResolution(),
    });

    const result = await service.enforceAICapability({
      conversationId: "conversation-1",
      actorIdentityId: "identity-source",
      capability: AICapability.Summary,
      contextType: AIExecutionContext.VaultItem,
      isVaultContent: true,
      contentId: "content-1",
    });

    assert.equal(result.allowed, true);
    assert.equal(result.restrictionLevel, AIRestrictionLevel.Full);
  });

  it("AI_SAFETY_RISK denies", async () => {
    const service = createService({
      resolveConversationContext: async () =>
        createConversationContext({
          resolvedPermissions: createResolvedPermissions({
            riskSummary: {
              appliedSignals: [RiskSignal.AiSafetyRisk],
              highestSeverity: "HIGH",
              blockedProtectedMode: false,
              blockedPayments: false,
              blockedCalls: false,
              aiRestricted: true,
            },
          }),
        }),
    });

    const result = await service.enforceAICapability({
      conversationId: "conversation-1",
      actorIdentityId: "identity-source",
      capability: AICapability.Summary,
      contextType: AIExecutionContext.Conversation,
    });

    assert.equal(result.allowed, false);
    assert.equal(result.reasonCode, AIReasonCode.DeniedRisk);
  });

  it("HIGH_RISK via device compromised denies", async () => {
    const service = createService({
      resolveConversationContext: async () =>
        createConversationContext({
          resolvedPermissions: createResolvedPermissions({
            riskSummary: {
              appliedSignals: [RiskSignal.DeviceCompromised],
              highestSeverity: "HIGH",
              blockedProtectedMode: true,
              blockedPayments: false,
              blockedCalls: true,
              aiRestricted: true,
            },
          }),
        }),
    });

    const result = await service.enforceAICapability({
      conversationId: "conversation-1",
      actorIdentityId: "identity-source",
      capability: AICapability.Summary,
      contextType: AIExecutionContext.Conversation,
    });

    assert.equal(result.allowed, false);
  });

  it("HIGH_RISK trust state denies AI capabilities", async () => {
    const service = createService({
      resolveConversationContext: async () =>
        createConversationContext({
          resolvedPermissions: createResolvedPermissions({
            trustState: TrustState.HighRisk,
            riskSummary: {
              appliedSignals: [RiskSignal.HighFraudProbability],
              highestSeverity: "HIGH",
              blockedProtectedMode: false,
              blockedPayments: true,
              blockedCalls: false,
              aiRestricted: false,
            },
          }),
        }),
    });

    const result = await service.enforceAICapability({
      conversationId: "conversation-1",
      actorIdentityId: "identity-source",
      capability: AICapability.Summary,
      contextType: AIExecutionContext.Conversation,
    });

    assert.equal(result.allowed, false);
    assert.equal(result.reasonCode, AIReasonCode.DeniedRisk);
  });

  it("RATE_LIMITED becomes LIMITED", async () => {
    const service = createService({
      resolveConversationContext: async () =>
        createConversationContext({
          resolvedPermissions: createResolvedPermissions({
            riskSummary: {
              appliedSignals: [RiskSignal.RateLimited],
              highestSeverity: "MEDIUM",
              blockedProtectedMode: false,
              blockedPayments: false,
              blockedCalls: true,
              aiRestricted: false,
            },
          }),
        }),
    });

    const result = await service.enforceAICapability({
      conversationId: "conversation-1",
      actorIdentityId: "identity-source",
      capability: AICapability.Summary,
      contextType: AIExecutionContext.Conversation,
    });

    assert.equal(result.allowed, true);
    assert.equal(result.restrictionLevel, AIRestrictionLevel.Limited);
  });

  it("protected conversation limits AI", async () => {
    const service = createService({
      resolveConversationContext: async () =>
        createConversationContext({
          conversation: {
            ...createConversationContext().conversation,
            conversationType: ConversationType.ProtectedDirect,
          },
        }),
    });

    const result = await service.enforceAICapability({
      conversationId: "conversation-1",
      actorIdentityId: "identity-source",
      capability: AICapability.Summary,
      contextType: AIExecutionContext.Conversation,
    });

    assert.equal(result.allowed, true);
    assert.equal(result.restrictionLevel, AIRestrictionLevel.Limited);
  });

  it("extract_actions denied in protected", async () => {
    const service = createService({
      resolveConversationContext: async () =>
        createConversationContext({
          conversation: {
            ...createConversationContext().conversation,
            conversationType: ConversationType.ProtectedDirect,
          },
        }),
    });

    const result = await service.enforceAICapability({
      conversationId: "conversation-1",
      actorIdentityId: "identity-source",
      capability: AICapability.ExtractActions,
      contextType: AIExecutionContext.Conversation,
    });

    assert.equal(result.allowed, false);
    assert.equal(result.reasonCode, AIReasonCode.DeniedContext);
  });

  it("unknown capability denies fail-closed", async () => {
    const service = createService();

    const result = await service.enforceAICapability({
      conversationId: "conversation-1",
      actorIdentityId: "identity-source",
      capability: "UNKNOWN_CAPABILITY" as AICapability,
      contextType: AIExecutionContext.Conversation,
    });

    assert.equal(result.allowed, false);
    assert.equal(result.reasonCode, AIReasonCode.DeniedPermission);
  });

  it("invalid actor denies", async () => {
    const service = createService();

    const result = await service.enforceAICapability({
      conversationId: "conversation-1",
      actorIdentityId: "outsider",
      capability: AICapability.Summary,
      contextType: AIExecutionContext.Conversation,
    });

    assert.equal(result.allowed, false);
    assert.equal(result.reasonCode, AIReasonCode.DeniedContext);
  });

  it("rejects when the authenticated user lacks persona-scoped AI access", async () => {
    const service = createService({
      assertConversationActionAccessibleToUser: async () => {
        throw new NotFoundException("Identity not found");
      },
    });

    await assert.rejects(
      service.enforceAICapability({
        conversationId: "conversation-1",
        currentUserId: "user-member",
        actorIdentityId: "identity-target",
        capability: AICapability.Summary,
        contextType: AIExecutionContext.Conversation,
      }),
      (error: unknown) => error instanceof NotFoundException,
    );
  });

  it("missing AI permission resolution denies fail-closed", async () => {
    const service = createService({
      resolveConversationContext: async () =>
        createConversationContext({
          resolvedPermissions: createResolvedPermissions({ permissions: {} }),
        }),
    });

    const result = await service.enforceAICapability({
      conversationId: "conversation-1",
      actorIdentityId: "identity-source",
      capability: AICapability.Summary,
      contextType: AIExecutionContext.Conversation,
    });

    assert.equal(result.allowed, false);
    assert.equal(result.reasonCode, AIReasonCode.DeniedPermission);
  });
});
