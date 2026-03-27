import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { NotFoundException } from "@nestjs/common";

import { PermissionEffect } from "../src/common/enums/permission-effect.enum";
import { IdentityType } from "../src/common/enums/identity-type.enum";
import {
  ActionDecisionEffect,
  ActionType,
} from "../src/modules/identities/action-permission";
import { ActionEnforcementService } from "../src/modules/identities/action-enforcement.service";
import {
  ConversationStatus,
  ConversationType,
} from "../src/modules/identities/identity.types";
import { PERMISSION_KEYS } from "../src/modules/identities/permission-keys";
import { buildTestPermissionScenario } from "./helpers/permission-flow-scenario";

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
      [PERMISSION_KEYS.messaging.textSend]: {
        finalEffect: PermissionEffect.Allow,
      },
      [PERMISSION_KEYS.calling.voiceStart]: {
        finalEffect: PermissionEffect.Allow,
      },
      [PERMISSION_KEYS.mediaPrivacy.protectedSend]: {
        finalEffect: PermissionEffect.Allow,
      },
      [PERMISSION_KEYS.mediaPrivacy.export]: {
        finalEffect: PermissionEffect.Allow,
      },
      [PERMISSION_KEYS.mediaPrivacy.forward]: {
        finalEffect: PermissionEffect.Allow,
      },
      [PERMISSION_KEYS.vault.itemView]: {
        finalEffect: PermissionEffect.Allow,
      },
      [PERMISSION_KEYS.vault.itemDownload]: {
        finalEffect: PermissionEffect.Allow,
      },
      [PERMISSION_KEYS.vault.itemReshare]: {
        finalEffect: PermissionEffect.Allow,
      },
      [PERMISSION_KEYS.ai.summaryUse]: {
        finalEffect: PermissionEffect.Allow,
      },
      [PERMISSION_KEYS.ai.replyUse]: {
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

function createContentResolution(
  effect: PermissionEffect,
  reason = "CONTENT_RULE_APPLIED",
) {
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
      aiAccessAllowed: null,
    },
    baseConnectionPermissions: {},
    effectiveContentPermissions: {
      "content.view": { effect },
      "content.download": { effect },
      "content.forward": { effect },
      "content.export": { effect },
    },
    contentTrace: {
      "content.view": { reasonCode: reason },
      "content.download": { reasonCode: reason },
      "content.forward": { reasonCode: reason },
      "content.export": { reasonCode: reason },
    },
    restrictionSummary: {
      rulePresent: true,
      expired: false,
      viewLimitReached: false,
      blockedActions: [],
      reasons: [reason],
    },
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
    resolveContentPermissionsForConnection: async () =>
      createContentResolution(PermissionEffect.Allow),
    ...overrides,
  } as any;

  return new ActionEnforcementService(identitiesService);
}

describe("action enforcement", () => {
  it("allows SEND_TEXT when allowed", async () => {
    const service = createService();

    const result = await service.enforceAction({
      conversationId: "conversation-1",
      actorIdentityId: "identity-source",
      actionType: ActionType.SendText,
    });

    assert.equal(result.allowed, true);
    assert.equal(result.effect, ActionDecisionEffect.Allow);
  });

  it("denies SEND_TEXT when permission denies", async () => {
    const service = createService({
      resolveConversationContext: async () =>
        createConversationContext({
          resolvedPermissions: createResolvedPermissions({
            permissions: {
              [PERMISSION_KEYS.messaging.textSend]: {
                finalEffect: PermissionEffect.Deny,
              },
            },
          }),
        }),
    });

    const result = await service.enforceAction({
      conversationId: "conversation-1",
      actorIdentityId: "identity-source",
      actionType: ActionType.SendText,
    });

    assert.equal(result.allowed, false);
    assert.equal(result.reasonCode, "ACTION_DENIED_PERMISSION");
  });

  it("returns request approval when permission requires approval", async () => {
    const service = createService({
      resolveConversationContext: async () =>
        createConversationContext({
          resolvedPermissions: createResolvedPermissions({
            permissions: {
              [PERMISSION_KEYS.messaging.textSend]: {
                finalEffect: PermissionEffect.RequestApproval,
              },
            },
          }),
        }),
    });

    const result = await service.enforceAction({
      conversationId: "conversation-1",
      actorIdentityId: "identity-source",
      actionType: ActionType.SendText,
    });

    assert.equal(result.effect, ActionDecisionEffect.RequestApproval);
  });

  it("supports allow_with_limits flow", async () => {
    const service = createService({
      resolveConversationContext: async () =>
        createConversationContext({
          resolvedPermissions: createResolvedPermissions({
            permissions: {
              [PERMISSION_KEYS.messaging.textSend]: {
                finalEffect: PermissionEffect.AllowWithLimits,
              },
            },
          }),
        }),
    });

    const result = await service.enforceAction({
      conversationId: "conversation-1",
      actorIdentityId: "identity-source",
      actionType: ActionType.SendText,
    });

    assert.equal(result.effect, ActionDecisionEffect.AllowWithLimits);
  });

  it("denies when actor is not part of conversation", async () => {
    const service = createService();

    const result = await service.enforceAction({
      conversationId: "conversation-1",
      actorIdentityId: "identity-other",
      actionType: ActionType.SendText,
    });

    assert.equal(result.reasonCode, "ACTION_INVALID_ACTOR");
  });

  it("rejects when the authenticated user lacks persona-scoped action access", async () => {
    const service = createService({
      assertConversationActionAccessibleToUser: async () => {
        throw new NotFoundException("Identity not found");
      },
    });

    await assert.rejects(
      service.enforceAction({
        conversationId: "conversation-1",
        currentUserId: "user-member",
        actorIdentityId: "identity-target",
        actionType: ActionType.SendText,
      }),
      (error: unknown) => error instanceof NotFoundException,
    );
  });

  it("denies when conversation is blocked", async () => {
    const service = createService({
      resolveConversationContext: async () =>
        createConversationContext({
          conversation: {
            ...createConversationContext().conversation,
            conversationStatus: ConversationStatus.Blocked,
          },
        }),
    });

    const result = await service.enforceAction({
      conversationId: "conversation-1",
      actorIdentityId: "identity-source",
      actionType: ActionType.SendText,
    });

    assert.equal(result.reasonCode, "ACTION_DENIED_CONVERSATION_STATE");
  });

  it("denies when conversation is locked", async () => {
    const service = createService({
      resolveConversationContext: async () =>
        createConversationContext({
          conversation: {
            ...createConversationContext().conversation,
            conversationStatus: ConversationStatus.Locked,
          },
        }),
    });

    const result = await service.enforceAction({
      conversationId: "conversation-1",
      actorIdentityId: "identity-source",
      actionType: ActionType.SendText,
    });

    assert.equal(result.reasonCode, "ACTION_DENIED_CONVERSATION_STATE");
  });

  it("denies content download when content rule denies", async () => {
    const service = createService({
      resolveContentPermissionsForConnection: async () =>
        createContentResolution(PermissionEffect.Deny),
    });

    const result = await service.enforceAction({
      conversationId: "conversation-1",
      actorIdentityId: "identity-source",
      actionType: ActionType.DownloadContent,
      contentId: "content-1",
    });

    assert.equal(result.reasonCode, "ACTION_DENIED_CONTENT_RULE");
  });

  it("denies expired content", async () => {
    const service = createService({
      resolveContentPermissionsForConnection: async () =>
        createContentResolution(PermissionEffect.Deny, "CONTENT_EXPIRED"),
    });

    const result = await service.enforceAction({
      conversationId: "conversation-1",
      actorIdentityId: "identity-source",
      actionType: ActionType.ViewContent,
      contentId: "content-1",
    });

    assert.equal(result.reasonCode, "ACTION_DENIED_CONTENT_RULE");
  });

  it("denies when content viewLimit is exceeded", async () => {
    const service = createService({
      resolveContentPermissionsForConnection: async () =>
        createContentResolution(
          PermissionEffect.Deny,
          "CONTENT_VIEW_LIMIT_REACHED",
        ),
    });

    const result = await service.enforceAction({
      conversationId: "conversation-1",
      actorIdentityId: "identity-source",
      actionType: ActionType.ViewContent,
      contentId: "content-1",
      currentViewCount: 3,
    });

    assert.equal(result.reasonCode, "ACTION_DENIED_CONTENT_RULE");
  });

  it("denies action blocked by risk", async () => {
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

    const result = await service.enforceAction({
      conversationId: "conversation-1",
      actorIdentityId: "identity-source",
      actionType: ActionType.StartVoiceCall,
    });

    assert.equal(result.reasonCode, "ACTION_DENIED_RISK");
  });

  it("risk cannot be bypassed", async () => {
    const service = createService({
      resolveConversationContext: async () =>
        createConversationContext({
          resolvedPermissions: createResolvedPermissions({
            riskSummary: {
              appliedSignals: ["AI_SAFETY_RISK"],
              highestSeverity: "HIGH",
              blockedProtectedMode: false,
              blockedPayments: false,
              blockedCalls: false,
              aiRestricted: true,
            },
            permissions: {
              [PERMISSION_KEYS.ai.summaryUse]: {
                finalEffect: PermissionEffect.Allow,
              },
            },
          }),
        }),
    });

    const result = await service.enforceAction({
      conversationId: "conversation-1",
      actorIdentityId: "identity-source",
      actionType: ActionType.AiSummary,
    });

    assert.equal(result.reasonCode, "ACTION_DENIED_RISK");
  });

  it("protected conversation blocks export", async () => {
    const service = createService({
      resolveConversationContext: async () =>
        createConversationContext({
          conversation: {
            ...createConversationContext().conversation,
            conversationType: ConversationType.ProtectedDirect,
          },
        }),
    });

    const result = await service.enforceAction({
      conversationId: "conversation-1",
      actorIdentityId: "identity-source",
      actionType: ActionType.ExportMedia,
    });

    assert.equal(result.allowed, false);
  });

  it("stale binding triggers re-resolution", async () => {
    let bindCalls = 0;
    const service = createService({
      isConversationPermissionBindingStale: async () => ({
        stale: true,
        currentHash: "hash-2",
        storedHash: "hash-1",
        lastResolvedAt: new Date("2026-03-26T12:00:00.000Z"),
        currentResolvedAt: new Date("2026-03-26T12:01:00.000Z"),
      }),
      bindResolvedPermissionsToConversation: async () => {
        bindCalls += 1;
        return {
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
            currentHash: "hash-2",
            lastResolvedAt: new Date("2026-03-26T12:00:00.000Z"),
            currentResolvedAt: new Date("2026-03-26T12:01:00.000Z"),
            stale: false,
          },
          traceSummary: {
            templateKey: "personal.trusted",
            policyVersion: 1,
            trustState: "TRUSTED_BY_USER",
            overrideCount: 0,
            riskSignals: [],
          },
          resolvedAt: new Date("2026-03-26T12:01:00.000Z"),
          stale: false,
        } as any;
      },
    });

    await service.enforceAction({
      conversationId: "conversation-1",
      actorIdentityId: "identity-source",
      actionType: ActionType.SendText,
    });

    assert.equal(bindCalls, 1);
  });

  it("denies unknown action fail-closed", async () => {
    const service = createService();

    const result = await service.enforceAction({
      conversationId: "conversation-1",
      actorIdentityId: "identity-source",
      actionType: "UNKNOWN_ACTION" as ActionType,
    });

    assert.equal(result.allowed, false);
  });

  it("fails closed when content permission resolution is missing", async () => {
    const scenario = buildTestPermissionScenario();
    const service = createService({
      resolveConversationContext: async () => ({
        ...createConversationContext(),
        conversation: {
          ...createConversationContext().conversation,
          conversationType: scenario.conversation.conversationType,
        },
        resolvedPermissions: {
          ...createResolvedPermissions(),
          permissions: {
            ...createResolvedPermissions().permissions,
            [PERMISSION_KEYS.mediaPrivacy.export]: {
              finalEffect:
                scenario.resolvedPermissions.permissions["media.export"]
                  .finalEffect,
            },
          },
        },
      }),
      resolveContentPermissionsForConnection: async () => ({
        ...createContentResolution(PermissionEffect.Allow),
        effectiveContentPermissions: {},
      }),
    });

    const result = await service.enforceAction({
      conversationId: "conversation-1",
      actorIdentityId: "identity-source",
      actionType: ActionType.ExportMedia,
      contentId: "content-1",
    });

    assert.equal(result.allowed, false);
    assert.equal(result.reasonCode, "ACTION_DENIED_CONTENT_RULE");
  });
});
