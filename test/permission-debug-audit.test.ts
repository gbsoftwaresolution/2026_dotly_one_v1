import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { PermissionEffect } from "../src/common/enums/permission-effect.enum";
import {
  ActionDecisionEffect,
  ActionType,
} from "../src/modules/identities/action-permission";
import { ActionEnforcementService } from "../src/modules/identities/action-enforcement.service";
import { IdentityType } from "../src/common/enums/identity-type.enum";
import { explainActionDecision } from "../src/modules/identities/action-decision-explainer";
import {
  AICapability,
  AIExecutionContext,
  AIReasonCode,
  AIRestrictionLevel,
} from "../src/modules/identities/ai-permission";
import { explainAICapabilityDecision } from "../src/modules/identities/ai-decision-explainer";
import {
  CallDecisionEffect,
  CallInitiationMode,
  CallType,
} from "../src/modules/identities/call-permission";
import { explainCallDecision } from "../src/modules/identities/call-decision-explainer";
import {
  PermissionAuditEventType,
  PermissionAuditService,
} from "../src/modules/identities/permission-audit";
import {
  PermissionDebugVerbosity,
  diffResolvedPermissions,
  explainResolvedPermission,
  explainResolvedPermissions,
} from "../src/modules/identities/permission-debug";
import { IdentitiesService } from "../src/modules/identities/identities.service";
import { PERMISSION_KEYS } from "../src/modules/identities/permission-keys";
import { RiskSignal } from "../src/modules/identities/risk-engine";

function createResolvedPermission(
  effect: PermissionEffect,
  overrides?: Record<string, unknown>,
) {
  return {
    effect,
    finalEffect: effect,
    postTrustEffect: effect,
    manualOverrideEffect: null,
    trace: {
      baseEffect: PermissionEffect.Allow,
      identityBehaviorEffect: PermissionEffect.AllowWithLimits,
      postIdentityBehaviorEffect: PermissionEffect.AllowWithLimits,
      relationshipBehaviorEffect: PermissionEffect.RequestApproval,
      postRelationshipEffect: PermissionEffect.RequestApproval,
      adjustmentEffect: PermissionEffect.Deny,
      postTrustEffect: PermissionEffect.Deny,
      manualOverrideEffect: PermissionEffect.AllowWithLimits,
      preRiskEffect: PermissionEffect.AllowWithLimits,
      riskAdjustmentEffect: PermissionEffect.Deny,
      finalEffect: effect,
      mergeMode: "RESTRICTIVE",
      overrideApplied: true,
      guardrailApplied: true,
      riskApplied: true,
      riskReasons: [RiskSignal.AiSafetyRisk],
      reasonCode: "RISK_BLOCKED",
    },
    ...overrides,
  } as any;
}

function createResolvedConnection(overrides?: Record<string, unknown>) {
  return {
    connectionId: "11111111-1111-4111-8111-111111111111",
    sourceIdentityId: "22222222-2222-4222-8222-222222222222",
    targetIdentityId: "33333333-3333-4333-8333-333333333333",
    sourceIdentityType: "PERSONAL",
    relationshipType: "FRIEND",
    connectionType: "TRUSTED",
    trustState: "TRUSTED_BY_USER",
    status: "ACTIVE",
    template: {
      templateKey: "personal.trusted",
      policyVersion: 2,
    },
    identityBehaviorSummary: {},
    relationshipBehaviorSummary: {},
    overridesSummary: {
      count: 1,
      overriddenKeys: [PERMISSION_KEYS.mediaPrivacy.export],
    },
    riskSummary: {
      appliedSignals: [RiskSignal.AiSafetyRisk],
      highestSeverity: "HIGH",
      blockedProtectedMode: true,
      blockedPayments: false,
      blockedCalls: true,
      aiRestricted: true,
    },
    permissions: {
      [PERMISSION_KEYS.mediaPrivacy.export]: createResolvedPermission(
        PermissionEffect.Deny,
      ),
      [PERMISSION_KEYS.ai.summaryUse]: {
        ...createResolvedPermission(PermissionEffect.AllowWithLimits),
        trace: {
          ...createResolvedPermission(PermissionEffect.AllowWithLimits).trace,
          riskAdjustmentEffect: null,
          riskApplied: false,
          riskReasons: [],
          finalEffect: PermissionEffect.AllowWithLimits,
          reasonCode: "OVERRIDE_APPLIED",
        },
      },
    },
    trace: {},
    resolvedAt: new Date("2026-03-26T12:00:00.000Z"),
    ...overrides,
  } as any;
}

describe("permission debug and audit", () => {
  it("explainResolvedPermission returns stage-by-stage explanation", () => {
    const result = explainResolvedPermission(
      PERMISSION_KEYS.mediaPrivacy.export,
      createResolvedPermission(PermissionEffect.Deny),
      {
        connectionId: "11111111-1111-4111-8111-111111111111",
        verbosity: PermissionDebugVerbosity.Detailed,
      },
    );

    assert.equal(result.initialTemplateEffect, PermissionEffect.Allow);
    assert.equal(result.finalEffect, PermissionEffect.Deny);
    assert.equal(result.stages.length, 7);
    assert.equal(result.stages[3]?.stage, "trust");
    assert.equal(result.notableFlags.includes("RISK_APPLIED"), true);
  });

  it("human-readable explanation reflects actual trace", () => {
    const result = explainResolvedPermission(
      PERMISSION_KEYS.mediaPrivacy.export,
      createResolvedPermission(PermissionEffect.Deny),
    );

    assert.match(result.explanationText, /template=Allow/);
    assert.match(result.explanationText, /trust=Deny/);
    assert.match(result.explanationText, /reason=RISK_BLOCKED/);
  });

  it("explainResolvedPermissions returns effect counts and stage summaries", () => {
    const result = explainResolvedPermissions(createResolvedConnection(), {
      verbosity: PermissionDebugVerbosity.Detailed,
    });

    assert.equal(result.permissionCount, 2);
    assert.equal(result.effectCounts[PermissionEffect.Deny], 1);
    assert.equal(result.effectCounts[PermissionEffect.AllowWithLimits], 1);
    assert.equal(
      result.stageSummaries.some((stage) => stage.stage === "risk"),
      true,
    );
  });

  it("diffResolvedPermissions detects promoted and restricted changes", () => {
    const before = {
      permissions: {
        [PERMISSION_KEYS.ai.summaryUse]: createResolvedPermission(
          PermissionEffect.Deny,
        ),
        [PERMISSION_KEYS.mediaPrivacy.export]: createResolvedPermission(
          PermissionEffect.Allow,
        ),
      },
    } as any;
    const after = {
      permissions: {
        [PERMISSION_KEYS.ai.summaryUse]: createResolvedPermission(
          PermissionEffect.Allow,
        ),
        [PERMISSION_KEYS.mediaPrivacy.export]: createResolvedPermission(
          PermissionEffect.Deny,
        ),
      },
    } as any;

    const diff = diffResolvedPermissions(before, after);

    assert.equal(diff.summary.promoted, 1);
    assert.equal(diff.summary.restricted, 1);
    assert.equal(diff.changedKeys.length, 2);
  });

  it("explainActionDecision reflects decision reason accurately", () => {
    const explanation = explainActionDecision({
      allowed: false,
      effect: ActionDecisionEffect.Deny,
      actionType: ActionType.ExportMedia,
      permissionKey: PERMISSION_KEYS.mediaPrivacy.export,
      conversationId: "conversation-1",
      actorIdentityId: "actor-1",
      reasonCode: "ACTION_DENIED_RISK",
      reasons: ["Risk policy blocks protected mode"],
      trace: {
        staleBinding: false,
        conversationStatus: "ACTIVE" as any,
        conversationType: "PROTECTED_DIRECT" as any,
        baseEffect: PermissionEffect.Allow,
        contentEffect: null,
        contentAction: null,
      },
      evaluatedAt: new Date(),
    });

    assert.match(explanation.explanationText, /risk policy/i);
    assert.equal(explanation.reasonCode, "ACTION_DENIED_RISK");
  });

  it("explainCallDecision reflects protected and risk denial accurately", () => {
    const explanation = explainCallDecision({
      allowed: false,
      effect: CallDecisionEffect.Deny,
      callType: CallType.Video,
      initiationMode: CallInitiationMode.Direct,
      permissionKey: PERMISSION_KEYS.calling.videoStart,
      conversationId: "conversation-1",
      actorIdentityId: "actor-1",
      conversationType: "PROTECTED_DIRECT" as any,
      reasonCode: "CALL_DENIED_PROTECTED_MODE",
      reasons: ["Protected mode restrictions block this call"],
      restrictionSummary: {
        directAllowed: false,
        requestAllowed: true,
        scheduledAllowed: true,
        protectedModeRequired: true,
        protectedModeBlocked: true,
        schedulingRequired: true,
        blockedByRuntimeRisk: true,
      },
      trace: {
        staleBinding: false,
        baseEffect: PermissionEffect.Allow,
        runtimeRestrictions: {
          screenCaptureDetected: true,
          castingDetected: false,
          deviceIntegrityCompromised: false,
          protectedModeBlockedByRisk: true,
          strictExpectationUnknownRuntime: false,
        },
        blockedCallsByRisk: true,
      },
      evaluatedAt: new Date(),
    });

    assert.match(explanation.explanationText, /protected mode/i);
    assert.equal(explanation.reasonCode, "CALL_DENIED_PROTECTED_MODE");
  });

  it("explainAICapabilityDecision reflects vault or protected denial accurately", () => {
    const explanation = explainAICapabilityDecision({
      allowed: false,
      restrictionLevel: AIRestrictionLevel.Denied,
      capability: AICapability.ExtractActions,
      permissionKey: PERMISSION_KEYS.ai.extractActionsUse,
      conversationId: "conversation-1",
      actorIdentityId: "actor-1",
      contextType: AIExecutionContext.VaultItem,
      reasonCode: AIReasonCode.DeniedVault,
      reasons: ["Vault AI access requires explicit vault view permission"],
      trace: {
        staleBinding: false,
        conversationType: "PROTECTED_DIRECT" as any,
        baseEffect: PermissionEffect.Allow,
        contentAiEffect: null,
        vaultViewEffect: PermissionEffect.Deny,
        protectedContextApplied: false,
        vaultContent: true,
        protectedContent: true,
        riskSignals: [],
      },
      evaluatedAt: new Date(),
    });

    assert.match(explanation.explanationText, /vault access is required/i);
    assert.equal(explanation.reasonCode, AIReasonCode.DeniedVault);
  });

  it("audit event record and list works deterministically", async () => {
    const audit = new PermissionAuditService(3);

    await audit.recordEvent({
      eventType: PermissionAuditEventType.ResolutionComputed,
      connectionId: "connection-1",
      summaryText: "first",
      createdAt: new Date("2026-03-26T12:00:00.000Z"),
    });
    await audit.recordEvent({
      eventType: PermissionAuditEventType.ActionEnforced,
      connectionId: "connection-1",
      actorIdentityId: "actor-1",
      summaryText: "second",
      createdAt: new Date("2026-03-26T12:00:01.000Z"),
    });

    const events = await audit.listEvents({
      connectionId: "connection-1",
      limit: 10,
    });

    assert.equal(events.length, 2);
    assert.equal(events[0]?.summaryText, "second");
    assert.equal(events[1]?.summaryText, "first");
  });

  it("diffCurrentPermissionsAgainstSnapshot returns no-snapshot status when absent", async () => {
    const service = new IdentitiesService(
      {
        connectionPermissionSnapshot: {
          findFirst: async () => null,
        },
      } as any,
      new PermissionAuditService(),
    );

    const result = await service.diffCurrentPermissionsAgainstSnapshot({
      connectionId: "11111111-1111-4111-8111-111111111111",
    });

    assert.equal(result.status, "NO_SNAPSHOT");
  });

  it("diffCurrentPermissionsAgainstSnapshot detects change after override or trust update", async () => {
    const service = new IdentitiesService(
      {
        connectionPermissionSnapshot: {
          findFirst: async () => ({
            id: "snapshot-1",
            connectionId: "11111111-1111-4111-8111-111111111111",
            policyVersion: 1,
            permissionsJson: {
              [PERMISSION_KEYS.ai.summaryUse]: {
                effect: PermissionEffect.Deny,
              },
            },
            metadataJson: null,
            computedAt: new Date("2026-03-26T12:00:00.000Z"),
          }),
        },
      } as any,
      new PermissionAuditService(),
    );
    service.resolveConnectionPermissions = async () =>
      ({
        ...createResolvedConnection(),
        permissions: {
          [PERMISSION_KEYS.ai.summaryUse]: createResolvedPermission(
            PermissionEffect.Allow,
          ),
        },
      }) as any;

    const result = await service.diffCurrentPermissionsAgainstSnapshot({
      connectionId: "11111111-1111-4111-8111-111111111111",
    });

    assert.equal(result.status, "DIFF_COMPUTED");
    if (result.status === "DIFF_COMPUTED") {
      assert.equal(result.diff.summary.promoted, 1);
    }
  });

  it("audit logging failure does not fail core permission resolution helper", async () => {
    const service = new IdentitiesService(
      {} as any,
      {
        recordEvent: async () => {
          throw new Error("audit failed");
        },
        listEvents: async () => [],
      } as any,
    );

    await assert.doesNotReject(async () => {
      await service.safeRecordPermissionAuditEvent({
        eventType: PermissionAuditEventType.ResolutionComputed,
        summaryText: "safe",
      });
    });
  });

  it("enforcement audit logging failure does not fail action enforcement", async () => {
    const service = new ActionEnforcementService({
      resolveConversationContext: async () => ({
        conversation: {
          conversationId: "conversation-1",
          connectionId: "connection-1",
          sourceIdentityId: "identity-source",
          targetIdentityId: "identity-target",
          conversationType: "DIRECT",
          conversationStatus: "ACTIVE",
        },
        resolvedPermissions: {
          connectionId: "connection-1",
          targetIdentityId: "identity-target",
          sourceIdentityId: "identity-source",
          riskSummary: {
            appliedSignals: [],
            blockedCalls: false,
            blockedProtectedMode: false,
            aiRestricted: false,
          },
          permissions: {
            [PERMISSION_KEYS.messaging.textSend]: {
              finalEffect: PermissionEffect.Allow,
            },
          },
        },
        stale: false,
      }),
      isConversationPermissionBindingStale: async () => ({
        stale: false,
        currentHash: "hash-1",
        storedHash: "hash-1",
        lastResolvedAt: new Date(),
        currentResolvedAt: new Date(),
      }),
      getIdentityTypeForIdentity: async () => IdentityType.Professional,
      resolveContentPermissionsForConnection: async () => null,
      safeRecordPermissionAuditEvent: async () => {
        throw new Error("audit failed");
      },
    } as any);

    await assert.doesNotReject(async () => {
      await service.enforceAction({
        conversationId: "conversation-1",
        actorIdentityId: "identity-source",
        actionType: ActionType.SendText,
      });
    });
  });

  it("cache invalidation logs audit event", async () => {
    const audit = new PermissionAuditService();
    const service = new IdentitiesService({} as any, audit);

    service.invalidateConnectionPermissionCache(
      "11111111-1111-4111-8111-111111111111",
    );

    const events = await audit.listEvents({
      eventType: PermissionAuditEventType.CacheInvalidated,
      limit: 10,
    });

    assert.equal(events.length, 1);
    assert.equal(
      events[0]?.connectionId,
      "11111111-1111-4111-8111-111111111111",
    );
  });
});
