import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { PermissionEffect } from "../src/common/enums/permission-effect.enum";
import { IdentityType } from "../src/common/enums/identity-type.enum";
import {
  CallDecisionEffect,
  CallInitiationMode,
  CallType,
} from "../src/modules/identities/call-permission";
import { CallEnforcementService } from "../src/modules/identities/call-enforcement.service";
import {
  ConversationStatus,
  ConversationType,
} from "../src/modules/identities/identity.types";
import { PERMISSION_KEYS } from "../src/modules/identities/permission-keys";

function createResolvedPermissions(
  overrides?: Partial<Record<string, unknown>>,
) {
  return {
    connectionId: "connection-1",
    sourceIdentityId: "identity-source",
    targetIdentityId: "identity-target",
    sourceIdentityType: "PERSONAL",
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
      blockedProtectedMode: false,
      blockedPayments: false,
      blockedCalls: false,
      aiRestricted: false,
    },
    permissions: {
      [PERMISSION_KEYS.calling.voiceStart]: {
        finalEffect: PermissionEffect.Allow,
      },
      [PERMISSION_KEYS.calling.videoStart]: {
        finalEffect: PermissionEffect.Allow,
      },
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
    stale: true,
    bindingSummary: {
      storedHash: null,
      currentHash: "hash-1",
      lastResolvedAt: null,
      currentResolvedAt: new Date("2026-03-26T12:00:00.000Z"),
      stale: true,
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

function createService(overrides?: Partial<Record<string, unknown>>) {
  const identitiesService = {
    resolveConversationContext: async () => createConversationContext(),
    isConversationPermissionBindingStale: async () => ({
      stale: false,
      currentHash: "hash-1",
      storedHash: "hash-1",
      lastResolvedAt: new Date("2026-03-26T12:00:00.000Z"),
      currentResolvedAt: new Date("2026-03-26T12:00:00.000Z"),
    }),
    bindResolvedPermissionsToConversation: async () => ({
      conversationId: "conversation-1",
      connectionId: "connection-1",
      sourceIdentityId: "identity-source",
      targetIdentityId: "identity-target",
      conversationType: ConversationType.Direct,
      conversationStatus: ConversationStatus.Active,
      resolvedConnectionPermissions: createResolvedPermissions(),
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
        templateKey: "personal.trusted",
        policyVersion: 1,
        trustState: "TRUSTED_BY_USER",
        overrideCount: 0,
        riskSignals: [],
      },
      resolvedAt: new Date("2026-03-26T12:00:00.000Z"),
      stale: false,
    }),
    getIdentityTypeForIdentity: async (identityId: string) =>
      identityId === "identity-source"
        ? IdentityType.Personal
        : IdentityType.Personal,
    safeRecordPermissionAuditEvent: async () => undefined,
    ...overrides,
  } as any;

  return new CallEnforcementService(identitiesService);
}

describe("call enforcement", () => {
  it("allows direct voice call when permitted", async () => {
    const service = createService();

    const result = await service.enforceCall({
      conversationId: "conversation-1",
      actorIdentityId: "identity-source",
      callType: CallType.Voice,
      initiationMode: CallInitiationMode.Direct,
    });

    assert.equal(result.allowed, true);
    assert.equal(result.effect, CallDecisionEffect.Allow);
  });

  it("denies direct video call when permission denied", async () => {
    const service = createService({
      resolveConversationContext: async () =>
        createConversationContext({
          resolvedPermissions: createResolvedPermissions({
            permissions: {
              [PERMISSION_KEYS.calling.voiceStart]: {
                finalEffect: PermissionEffect.Allow,
              },
              [PERMISSION_KEYS.calling.videoStart]: {
                finalEffect: PermissionEffect.Deny,
              },
            },
          }),
        }),
    });

    const result = await service.enforceCall({
      conversationId: "conversation-1",
      actorIdentityId: "identity-source",
      callType: CallType.Video,
      initiationMode: CallInitiationMode.Direct,
    });

    assert.equal(result.reasonCode, "CALL_DENIED_PERMISSION");
  });

  it("request mode returns request-required when base effect is request approval", async () => {
    const service = createService({
      resolveConversationContext: async () =>
        createConversationContext({
          resolvedPermissions: createResolvedPermissions({
            permissions: {
              [PERMISSION_KEYS.calling.voiceStart]: {
                finalEffect: PermissionEffect.RequestApproval,
              },
              [PERMISSION_KEYS.calling.videoStart]: {
                finalEffect: PermissionEffect.Allow,
              },
            },
          }),
        }),
    });

    const result = await service.enforceCall({
      conversationId: "conversation-1",
      actorIdentityId: "identity-source",
      callType: CallType.Voice,
      initiationMode: CallInitiationMode.Request,
    });

    assert.equal(result.effect, CallDecisionEffect.RequestApproval);
    assert.equal(result.reasonCode, "CALL_REQUEST_REQUIRED");
  });

  it("scheduled mode allowed when schedulingRequired is true and other rules permit", async () => {
    const service = createService({
      resolveConversationContext: async () =>
        createConversationContext({
          conversation: {
            ...createConversationContext().conversation,
            conversationType: ConversationType.ProtectedDirect,
          },
          resolvedPermissions: createResolvedPermissions({
            permissions: {
              [PERMISSION_KEYS.calling.voiceStart]: {
                finalEffect: PermissionEffect.AllowWithLimits,
              },
              [PERMISSION_KEYS.calling.videoStart]: {
                finalEffect: PermissionEffect.Allow,
              },
            },
          }),
        }),
    });

    const result = await service.enforceCall({
      conversationId: "conversation-1",
      actorIdentityId: "identity-source",
      callType: CallType.Voice,
      initiationMode: CallInitiationMode.Scheduled,
      currentProtectedModeExpectation: false,
    } as any);

    assert.equal(result.allowed, true);
    assert.equal(result.restrictionSummary.schedulingRequired, true);
  });

  it("direct mode denied when schedulingRequired is true", async () => {
    const service = createService({
      resolveConversationContext: async () =>
        createConversationContext({
          resolvedPermissions: createResolvedPermissions({
            permissions: {
              [PERMISSION_KEYS.calling.voiceStart]: {
                finalEffect: PermissionEffect.AllowWithLimits,
              },
              [PERMISSION_KEYS.calling.videoStart]: {
                finalEffect: PermissionEffect.Allow,
              },
            },
          }),
        }),
    });

    const result = await service.enforceCall({
      conversationId: "conversation-1",
      actorIdentityId: "identity-source",
      callType: CallType.Voice,
      initiationMode: CallInitiationMode.Direct,
    });

    assert.equal(result.reasonCode, "CALL_DENIED_SCHEDULE_REQUIRED");
  });

  it("protected direct video call denied on screenCaptureDetected", async () => {
    const service = createService({
      resolveConversationContext: async () =>
        createConversationContext({
          conversation: {
            ...createConversationContext().conversation,
            conversationType: ConversationType.ProtectedDirect,
          },
        }),
    });

    const result = await service.enforceCall({
      conversationId: "conversation-1",
      actorIdentityId: "identity-source",
      callType: CallType.Video,
      initiationMode: CallInitiationMode.Direct,
      screenCaptureDetected: true,
    });

    assert.equal(result.reasonCode, "CALL_DENIED_PROTECTED_MODE");
  });

  it("protected direct video call denied on castingDetected", async () => {
    const service = createService({
      resolveConversationContext: async () =>
        createConversationContext({
          conversation: {
            ...createConversationContext().conversation,
            conversationType: ConversationType.ProtectedDirect,
          },
        }),
    });

    const result = await service.enforceCall({
      conversationId: "conversation-1",
      actorIdentityId: "identity-source",
      callType: CallType.Video,
      initiationMode: CallInitiationMode.Direct,
      castingDetected: true,
    });

    assert.equal(result.reasonCode, "CALL_DENIED_PROTECTED_MODE");
  });

  it("protected call denied on deviceIntegrityCompromised", async () => {
    const service = createService({
      resolveConversationContext: async () =>
        createConversationContext({
          conversation: {
            ...createConversationContext().conversation,
            conversationType: ConversationType.ProtectedDirect,
          },
        }),
    });

    const result = await service.enforceCall({
      conversationId: "conversation-1",
      actorIdentityId: "identity-source",
      callType: CallType.Voice,
      initiationMode: CallInitiationMode.Direct,
      deviceIntegrityCompromised: true,
    });

    assert.equal(result.reasonCode, "CALL_DENIED_PROTECTED_MODE");
  });

  it("blocked conversation denies all call modes", async () => {
    const service = createService({
      resolveConversationContext: async () =>
        createConversationContext({
          conversation: {
            ...createConversationContext().conversation,
            conversationStatus: ConversationStatus.Blocked,
          },
        }),
    });

    const result = await service.enforceCall({
      conversationId: "conversation-1",
      actorIdentityId: "identity-source",
      callType: CallType.Voice,
      initiationMode: CallInitiationMode.Request,
    });

    assert.equal(result.reasonCode, "CALL_DENIED_CONVERSATION_STATE");
  });

  it("invalid actor denied", async () => {
    const service = createService();

    const result = await service.enforceCall({
      conversationId: "conversation-1",
      actorIdentityId: "identity-other",
      callType: CallType.Voice,
      initiationMode: CallInitiationMode.Direct,
    });

    assert.equal(result.reasonCode, "CALL_DENIED_INVALID_ACTOR");
  });

  it("business conversation returns identity incompatible", async () => {
    const service = createService({
      resolveConversationContext: async () =>
        createConversationContext({
          conversation: {
            ...createConversationContext().conversation,
            conversationType: ConversationType.BusinessDirect,
          },
        }),
    });

    const result = await service.enforceCall({
      conversationId: "conversation-1",
      actorIdentityId: "identity-source",
      callType: CallType.Voice,
      initiationMode: CallInitiationMode.Direct,
    });

    assert.equal(result.reasonCode, "CALL_DENIED_IDENTITY_INCOMPATIBLE");
  });

  it("risk summary blockedCalls denies calls", async () => {
    const service = createService({
      resolveConversationContext: async () =>
        createConversationContext({
          resolvedPermissions: createResolvedPermissions({
            riskSummary: {
              appliedSignals: ["DEVICE_COMPROMISED"],
              highestSeverity: "HIGH",
              blockedProtectedMode: false,
              blockedPayments: false,
              blockedCalls: true,
              aiRestricted: false,
            },
          }),
        }),
    });

    const result = await service.enforceCall({
      conversationId: "conversation-1",
      actorIdentityId: "identity-source",
      callType: CallType.Voice,
      initiationMode: CallInitiationMode.Direct,
    });

    assert.equal(result.reasonCode, "CALL_DENIED_RISK");
  });

  it("runtime flags cannot bypass safer deny", async () => {
    const service = createService({
      resolveConversationContext: async () =>
        createConversationContext({
          conversation: {
            ...createConversationContext().conversation,
            conversationType: ConversationType.ProtectedDirect,
          },
          resolvedPermissions: createResolvedPermissions({
            riskSummary: {
              appliedSignals: ["SCREEN_CAPTURE_RISK"],
              highestSeverity: "HIGH",
              blockedProtectedMode: true,
              blockedPayments: false,
              blockedCalls: false,
              aiRestricted: false,
            },
          }),
        }),
    });

    const result = await service.enforceCall({
      conversationId: "conversation-1",
      actorIdentityId: "identity-source",
      callType: CallType.Video,
      initiationMode: CallInitiationMode.Scheduled,
      screenCaptureDetected: false,
      castingDetected: false,
      deviceIntegrityCompromised: false,
    });

    assert.equal(result.reasonCode, "CALL_DENIED_PROTECTED_MODE");
  });

  it("decision includes restrictionSummary and reasonCode", async () => {
    const service = createService();

    const result = await service.enforceCall({
      conversationId: "conversation-1",
      actorIdentityId: "identity-source",
      callType: CallType.Voice,
      initiationMode: CallInitiationMode.Direct,
    });

    assert.ok(result.restrictionSummary);
    assert.equal(typeof result.reasonCode, "string");
  });

  it("unsupported call type fails closed", async () => {
    const service = createService();

    const result = await service.enforceCall({
      conversationId: "conversation-1",
      actorIdentityId: "identity-source",
      callType: "UNKNOWN" as CallType,
      initiationMode: CallInitiationMode.Direct,
    });

    assert.equal(result.allowed, false);
    assert.equal(result.reasonCode, "CALL_DENIED_CALL_TYPE_UNSUPPORTED");
  });

  it("missing call permission resolution fails closed", async () => {
    const service = createService({
      resolveConversationContext: async () =>
        createConversationContext({
          resolvedPermissions: createResolvedPermissions({ permissions: {} }),
        }),
    });

    const result = await service.enforceCall({
      conversationId: "conversation-1",
      actorIdentityId: "identity-source",
      callType: CallType.Video,
      initiationMode: CallInitiationMode.Direct,
    });

    assert.equal(result.allowed, false);
    assert.equal(result.reasonCode, "CALL_DENIED_PERMISSION");
  });
});
