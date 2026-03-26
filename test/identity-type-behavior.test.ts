import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { BadRequestException } from "@nestjs/common";

import { IdentityType } from "../src/common/enums/identity-type.enum";
import { PermissionEffect } from "../src/common/enums/permission-effect.enum";
import { ActionType } from "../src/modules/identities/action-permission";
import { ActionEnforcementService } from "../src/modules/identities/action-enforcement.service";
import {
  CallInitiationMode,
  CallType,
} from "../src/modules/identities/call-permission";
import { CallEnforcementService } from "../src/modules/identities/call-enforcement.service";
import {
  ConversationType,
  ConversationStatus,
} from "../src/modules/identities/identity.types";
import { IdentitiesService } from "../src/modules/identities/identities.service";
import { resolveIdentityTypePairBehavior } from "../src/modules/identities/identity-type-behaviors";
import { CONNECTION_POLICY_TEMPLATE_SEEDS } from "../src/modules/identities/policy-template-seeds";
import { PERMISSION_KEYS } from "../src/modules/identities/permission-keys";

function createTemplateRecord(templateKey: string) {
  const template = CONNECTION_POLICY_TEMPLATE_SEEDS.find(
    (candidate) => candidate.templateKey === templateKey,
  );

  if (!template) {
    throw new Error(`Missing template ${templateKey}`);
  }

  return {
    id: `template-${template.templateKey}`,
    sourceIdentityType: template.sourceIdentityType?.toUpperCase() ?? null,
    connectionType: template.connectionType.toUpperCase(),
    templateKey: template.templateKey,
    displayName: template.displayName,
    description: template.description ?? null,
    policyVersion: template.policyVersion,
    permissionsJson: template.permissions,
    limitsJson: template.limits ?? null,
    isSystem: template.isSystem,
    isActive: template.isActive,
    createdAt: new Date("2026-03-26T12:00:00.000Z"),
    updatedAt: new Date("2026-03-26T12:00:00.000Z"),
  };
}

function createConnectionRecord(overrides?: Partial<Record<string, unknown>>) {
  return {
    id: "connection-1",
    sourceIdentityId: "identity-source",
    targetIdentityId: "identity-target",
    connectionType: "TRUSTED",
    trustState: "TRUSTED_BY_USER",
    status: "ACTIVE",
    createdByIdentityId: "identity-source",
    note: null,
    metadataJson: null,
    createdAt: new Date("2026-03-26T12:00:00.000Z"),
    updatedAt: new Date("2026-03-26T12:00:00.000Z"),
    ...overrides,
  };
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
    resolvedPermissions: {
      connectionId: "connection-1",
      sourceIdentityId: "identity-source",
      targetIdentityId: "identity-target",
      sourceIdentityType: IdentityType.Personal,
      connectionType: "trusted",
      trustState: "trusted_by_user",
      status: "ACTIVE",
      template: {
        templateKey: "personal.trusted",
        policyVersion: 1,
      },
      identityBehaviorSummary: {
        sourceIdentityType: IdentityType.Personal,
        targetIdentityType: IdentityType.Personal,
        restrictionFlags: {
          prefersProtectedConversation: false,
          allowsBusinessConversation: false,
          businessConversationAllowed: false,
          restrictsExport: false,
          exportRestricted: false,
          restrictsReshare: false,
          reshareRestricted: false,
          schedulingPreferredForCalls: false,
          schedulingBiasForCalls: false,
          restrictsDirectVideo: false,
        },
        sourceAppliedKeys: [],
        pairAppliedKeys: [],
        reasonCodes: [],
      },
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
        [PERMISSION_KEYS.mediaPrivacy.export]: {
          finalEffect: PermissionEffect.Allow,
        },
        [PERMISSION_KEYS.mediaPrivacy.forward]: {
          finalEffect: PermissionEffect.Allow,
        },
        [PERMISSION_KEYS.vault.itemReshare]: {
          finalEffect: PermissionEffect.Allow,
        },
        [PERMISSION_KEYS.calling.voiceStart]: {
          finalEffect: PermissionEffect.Allow,
        },
        [PERMISSION_KEYS.calling.videoStart]: {
          finalEffect: PermissionEffect.Allow,
        },
      },
      trace: {},
      resolvedAt: new Date("2026-03-26T12:00:00.000Z"),
    },
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
      trustState: "trusted_by_user",
      overrideCount: 0,
      riskSignals: [],
    },
    ...overrides,
  } as any;
}

function createIdentityRecord(identityType: string, id: string) {
  return {
    id,
    identityType,
    displayName: "Identity",
    handle: null,
    verificationLevel: "basic",
    status: "active",
    metadataJson: null,
    createdAt: new Date("2026-03-26T12:00:00.000Z"),
    updatedAt: new Date("2026-03-26T12:00:00.000Z"),
  };
}

function createIdentitiesService(identityTypes: {
  source: string;
  target: string;
}) {
  return new IdentitiesService({
    identityConnection: {
      findUnique: async () => createConnectionRecord(),
    },
    identity: {
      findUnique: async ({ where }: any) =>
        where.id === "identity-source"
          ? createIdentityRecord(identityTypes.source, "identity-source")
          : createIdentityRecord(identityTypes.target, "identity-target"),
    },
    connectionPolicyTemplate: {
      findFirst: async () => createTemplateRecord("personal.trusted"),
    },
    connectionPermissionOverride: {
      findMany: async () => [],
    },
    identityConversation: {
      create: async ({ data }: any) => ({
        id: "conversation-1",
        sourceIdentityId: data.sourceIdentityId,
        targetIdentityId: data.targetIdentityId,
        connectionId: data.connectionId,
        conversationType: data.conversationType,
        status: data.status,
        title: data.title ?? null,
        metadataJson: data.metadataJson ?? null,
        lastResolvedAt: null,
        lastPermissionHash: null,
        createdByIdentityId: data.createdByIdentityId,
        createdAt: new Date("2026-03-26T12:00:00.000Z"),
        updatedAt: new Date("2026-03-26T12:00:00.000Z"),
      }),
    },
  } as any);
}

function createActionService(identityTypes: {
  source: IdentityType;
  target: IdentityType;
}) {
  return new ActionEnforcementService({
    resolveConversationContext: async () => createConversationContext(),
    isConversationPermissionBindingStale: async () => ({
      stale: false,
      currentHash: "hash-1",
      storedHash: "hash-1",
      lastResolvedAt: new Date("2026-03-26T12:00:00.000Z"),
      currentResolvedAt: new Date("2026-03-26T12:00:00.000Z"),
    }),
    bindResolvedPermissionsToConversation: async () => {
      throw new Error("not expected");
    },
    resolveContentPermissionsForConnection: async () => ({
      effectiveContentPermissions: {},
    }),
    getIdentityTypeForIdentity: async (identityId: string) =>
      identityId === "identity-source"
        ? identityTypes.source
        : identityTypes.target,
  } as any);
}

function createCallService(identityTypes: {
  source: IdentityType;
  target: IdentityType;
}) {
  return new CallEnforcementService({
    resolveConversationContext: async () => createConversationContext(),
    isConversationPermissionBindingStale: async () => ({
      stale: false,
      currentHash: "hash-1",
      storedHash: "hash-1",
      lastResolvedAt: new Date("2026-03-26T12:00:00.000Z"),
      currentResolvedAt: new Date("2026-03-26T12:00:00.000Z"),
    }),
    bindResolvedPermissionsToConversation: async () => {
      throw new Error("not expected");
    },
    getIdentityTypeForIdentity: async (identityId: string) =>
      identityId === "identity-source"
        ? identityTypes.source
        : identityTypes.target,
  } as any);
}

describe("identity-type behavior", () => {
  it("COUPLE + BUSINESS rejects BUSINESS_DIRECT", async () => {
    const service = createIdentitiesService({
      source: "COUPLE",
      target: "BUSINESS",
    });

    await assert.rejects(
      service.createConversation({
        sourceIdentityId: "identity-source",
        targetIdentityId: "identity-target",
        connectionId: "connection-1",
        conversationType: ConversationType.BusinessDirect,
        createdByIdentityId: "identity-source",
      }),
      (error: unknown) => error instanceof BadRequestException,
    );
  });

  it("COUPLE + PERSONAL allows PROTECTED_DIRECT", async () => {
    const service = createIdentitiesService({
      source: "COUPLE",
      target: "PERSONAL",
    });

    const result = await service.createConversation({
      sourceIdentityId: "identity-source",
      targetIdentityId: "identity-target",
      connectionId: "connection-1",
      conversationType: ConversationType.ProtectedDirect,
      createdByIdentityId: "identity-source",
    });

    assert.equal(result.conversationType, ConversationType.ProtectedDirect);
  });

  it("BUSINESS + PROFESSIONAL allows BUSINESS_DIRECT", async () => {
    const service = createIdentitiesService({
      source: "BUSINESS",
      target: "PROFESSIONAL",
    });

    const result = await service.createConversation({
      sourceIdentityId: "identity-source",
      targetIdentityId: "identity-target",
      connectionId: "connection-1",
      conversationType: ConversationType.BusinessDirect,
      createdByIdentityId: "identity-source",
    });

    assert.equal(result.conversationType, ConversationType.BusinessDirect);
  });

  it("FAMILY + FAMILY allows PROTECTED_DIRECT", async () => {
    const service = createIdentitiesService({
      source: "FAMILY",
      target: "FAMILY",
    });

    const result = await service.createConversation({
      sourceIdentityId: "identity-source",
      targetIdentityId: "identity-target",
      connectionId: "connection-1",
      conversationType: ConversationType.ProtectedDirect,
      createdByIdentityId: "identity-source",
    });

    assert.equal(result.conversationType, ConversationType.ProtectedDirect);
  });

  it("pair behavior resolver returns deterministic result", () => {
    const first = resolveIdentityTypePairBehavior(
      IdentityType.Couple,
      IdentityType.Business,
    );
    const second = resolveIdentityTypePairBehavior(
      IdentityType.Couple,
      IdentityType.Business,
    );

    assert.deepEqual(first, second);
  });

  it("identity behavior restricts export and forward in COUPLE context", async () => {
    const service = createActionService({
      source: IdentityType.Couple,
      target: IdentityType.Personal,
    });

    const exportDecision = await service.enforceAction({
      conversationId: "conversation-1",
      actorIdentityId: "identity-source",
      actionType: ActionType.ExportMedia,
    });
    const forwardDecision = await service.enforceAction({
      conversationId: "conversation-1",
      actorIdentityId: "identity-source",
      actionType: ActionType.ForwardMedia,
    });

    assert.equal(exportDecision.allowed, false);
    assert.equal(forwardDecision.effect, "ALLOW_WITH_LIMITS");
  });

  it("identity behavior does not promote denied action", async () => {
    const service = new ActionEnforcementService({
      resolveConversationContext: async () =>
        createConversationContext({
          resolvedPermissions: {
            ...createConversationContext().resolvedPermissions,
            permissions: {
              [PERMISSION_KEYS.mediaPrivacy.export]: {
                finalEffect: PermissionEffect.Deny,
              },
            },
          },
        }),
      isConversationPermissionBindingStale: async () => ({
        stale: false,
        currentHash: "hash-1",
        storedHash: "hash-1",
        lastResolvedAt: new Date("2026-03-26T12:00:00.000Z"),
        currentResolvedAt: new Date("2026-03-26T12:00:00.000Z"),
      }),
      bindResolvedPermissionsToConversation: async () => {
        throw new Error("not expected");
      },
      resolveContentPermissionsForConnection: async () => ({
        effectiveContentPermissions: {},
      }),
      getIdentityTypeForIdentity: async (identityId: string) =>
        identityId === "identity-source"
          ? IdentityType.Couple
          : IdentityType.Personal,
    } as any);

    const result = await service.enforceAction({
      conversationId: "conversation-1",
      actorIdentityId: "identity-source",
      actionType: ActionType.ExportMedia,
    });

    assert.equal(result.allowed, false);
    assert.equal(result.reasonCode, "ACTION_DENIED_PERMISSION");
  });

  it("professional scheduling bias affects direct call decision", async () => {
    const service = createCallService({
      source: IdentityType.Professional,
      target: IdentityType.Professional,
    });

    const result = await service.enforceCall({
      conversationId: "conversation-1",
      actorIdentityId: "identity-source",
      callType: CallType.Voice,
      initiationMode: CallInitiationMode.Direct,
    });

    assert.equal(result.reasonCode, "CALL_DENIED_SCHEDULE_REQUIRED");
  });

  it("identity behavior summary appears in decisions where applied", async () => {
    const service = createActionService({
      source: IdentityType.Couple,
      target: IdentityType.Personal,
    });

    const result = await service.enforceAction({
      conversationId: "conversation-1",
      actorIdentityId: "identity-source",
      actionType: ActionType.ExportMedia,
    });

    assert.equal(result.trace?.identityBehaviorApplied, true);
    assert.ok(result.trace?.identityBehaviorSummary);
  });
});
