import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { BadRequestException, NotFoundException } from "@nestjs/common";

import { IdentitiesService } from "../src/modules/identities/identities.service";
import { ConversationStatus } from "../src/modules/identities/identity.types";
import { ConversationType } from "../src/modules/identities/identity.types";
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

function createConversationRecord(
  overrides?: Partial<Record<string, unknown>>,
) {
  return {
    id: "conversation-1",
    sourceIdentityId: "identity-source",
    targetIdentityId: "identity-target",
    connectionId: "connection-1",
    personaId: null,
    conversationType: "DIRECT",
    status: "ACTIVE",
    title: null,
    metadataJson: null,
    lastResolvedAt: null,
    lastPermissionHash: null,
    createdByIdentityId: "identity-source",
    createdAt: new Date("2026-03-26T12:00:00.000Z"),
    updatedAt: new Date("2026-03-26T12:00:00.000Z"),
    ...overrides,
  };
}

function createBaseService(overrides?: Partial<Record<string, unknown>>) {
  return new IdentitiesService({
    identityConnection: {
      findUnique: async () => createConnectionRecord(),
    },
    identity: {
      findUnique: async ({ where }: any) => ({
        id: where.id,
        identityType: where.id === "identity-target" ? "PERSONAL" : "PERSONAL",
        displayName: "Identity",
        handle: null,
        verificationLevel: "basic",
        status: "active",
        metadataJson: null,
        createdAt: new Date("2026-03-26T12:00:00.000Z"),
        updatedAt: new Date("2026-03-26T12:00:00.000Z"),
      }),
      findFirst: async ({ where }: any) => ({
        id: where.id,
        personId: where.id === "identity-target" ? "user-1" : null,
        members: [],
        operators: [],
      }),
    },
    persona: {
      findUnique: async ({ where }: any) => ({
        id: where.id,
        identityId:
          where.id === "persona-target" || where.id === "persona-target-default"
            ? "identity-target"
            : "identity-source",
      }),
      findFirst: async ({ where }: any) => {
        if (where.identityId === "identity-target" && where.isDefaultRouting) {
          return {
            id: "persona-target-default",
          };
        }

        return null;
      },
    },
    connectionPolicyTemplate: {
      findFirst: async ({ where }: any) =>
        createTemplateRecord(
          where.sourceIdentityType === "BUSINESS"
            ? "business.client"
            : "personal.trusted",
        ),
    },
    connectionPermissionOverride: {
      findMany: async () => [],
    },
    identityConversation: {
      create: async ({ data }: any) => ({
        ...createConversationRecord(),
        ...data,
      }),
      findUnique: async ({ where }: any) => {
        if (where.id) {
          return null;
        }

        return null;
      },
      findFirst: async () => null,
      findMany: async () => [createConversationRecord()],
      update: async ({ data }: any) => ({
        ...createConversationRecord(),
        ...data,
      }),
    },
    ...overrides,
  } as any);
}

describe("conversation context binding", () => {
  it("creates direct conversation successfully", async () => {
    const service = createBaseService({
      identityConversation: {
        create: async ({ data }: any) => ({
          ...createConversationRecord(),
          ...data,
        }),
      },
    });

    const result = await service.createConversation({
      sourceIdentityId: "identity-source",
      targetIdentityId: "identity-target",
      connectionId: "connection-1",
      conversationType: ConversationType.Direct,
      createdByIdentityId: "identity-source",
    });

    assert.equal(result.conversationType, ConversationType.Direct);
    assert.equal(result.connectionId, "connection-1");
  });

  it("rejects conversation creation when connection direction mismatches", async () => {
    const service = createBaseService();

    await assert.rejects(
      service.createConversation({
        sourceIdentityId: "identity-target",
        targetIdentityId: "identity-source",
        connectionId: "connection-1",
        conversationType: ConversationType.Direct,
        createdByIdentityId: "identity-source",
      }),
      (error: unknown) => {
        assert.ok(error instanceof BadRequestException);
        return true;
      },
    );
  });

  it("rejects direct conversation when connection is blocked", async () => {
    const service = createBaseService({
      identityConnection: {
        findUnique: async () =>
          createConnectionRecord({
            trustState: "BLOCKED",
            status: "BLOCKED",
          }),
      },
    });

    await assert.rejects(
      service.createConversation({
        sourceIdentityId: "identity-source",
        targetIdentityId: "identity-target",
        connectionId: "connection-1",
        conversationType: ConversationType.Direct,
        createdByIdentityId: "identity-source",
      }),
      /Conversation cannot be created for blocked or archived connections/,
    );
  });

  it("getOrCreateDirectConversation is deterministic", async () => {
    let createCalls = 0;
    const service = createBaseService({
      identityConversation: {
        findFirst: async () => createConversationRecord(),
        create: async () => {
          createCalls += 1;
          return createConversationRecord();
        },
      },
    });

    const result = await service.getOrCreateDirectConversation({
      sourceIdentityId: "identity-source",
      targetIdentityId: "identity-target",
      connectionId: "connection-1",
      createdByIdentityId: "identity-source",
      conversationType: ConversationType.Direct,
    });

    assert.equal(result.conversationId, "conversation-1");
    assert.equal(createCalls, 0);
  });

  it("uses the target default routing persona when personaId is omitted", async () => {
    let createdPersonaId: string | null = null;
    const service = createBaseService({
      identityConversation: {
        findFirst: async () => null,
        create: async ({ data }: any) => {
          createdPersonaId = data.personaId;
          return createConversationRecord({
            personaId: data.personaId,
          });
        },
      },
    });

    const result = await service.getOrCreateDirectConversation({
      sourceIdentityId: "identity-source",
      targetIdentityId: "identity-target",
      connectionId: "connection-1",
      createdByIdentityId: "identity-source",
      conversationType: ConversationType.Direct,
    });

    assert.equal(result.personaId, "persona-target-default");
    assert.equal(createdPersonaId, "persona-target-default");
  });

  it("rejects conversation persona when it does not belong to target identity", async () => {
    const service = createBaseService({
      persona: {
        findUnique: async () => ({
          id: "persona-source",
          identityId: "identity-source",
        }),
      },
    });

    await assert.rejects(
      service.createConversation({
        sourceIdentityId: "identity-source",
        targetIdentityId: "identity-target",
        connectionId: "connection-1",
        personaId: "persona-source",
        conversationType: ConversationType.Direct,
        createdByIdentityId: "identity-source",
      }),
      /Conversation persona must belong to the target identity/,
    );
  });

  it("getOrCreateDirectConversation is deterministic per persona thread", async () => {
    let receivedWhere: Record<string, unknown> | null = null;
    const service = createBaseService({
      identityConversation: {
        findFirst: async ({ where }: any) => {
          receivedWhere = where;
          return createConversationRecord({ personaId: "persona-target" });
        },
        create: async () =>
          createConversationRecord({ personaId: "persona-target" }),
      },
    });

    const result = await service.getOrCreateDirectConversation({
      sourceIdentityId: "identity-source",
      targetIdentityId: "identity-target",
      connectionId: "connection-1",
      personaId: "persona-target",
      createdByIdentityId: "identity-source",
      conversationType: ConversationType.Direct,
    });

    assert.equal(result.personaId, "persona-target");
    assert.deepEqual(receivedWhere, {
      sourceIdentityId: "identity-source",
      targetIdentityId: "identity-target",
      connectionId: "connection-1",
      personaId: "persona-target",
    });
  });

  it("listConversationsForIdentity filters by persona inbox", async () => {
    let receivedWhere: Record<string, unknown> | null = null;
    const service = createBaseService({
      identityConversation: {
        findMany: async ({ where }: any) => {
          receivedWhere = where;
          return [createConversationRecord({ personaId: "persona-target" })];
        },
      },
    });

    const result = await service.listConversationsForIdentity({
      identityId: "identity-target",
      personaId: "persona-target",
    });

    assert.equal(result.length, 1);
    assert.equal(result[0]?.personaId, "persona-target");
    assert.deepEqual(receivedWhere, {
      OR: [
        {
          sourceIdentityId: "identity-target",
        },
        {
          targetIdentityId: "identity-target",
        },
      ],
      personaId: "persona-target",
    });
  });

  it("listAccessibleConversationsForUser narrows member access to assigned personas", async () => {
    const service = createBaseService({
      identity: {
        findFirst: async () => ({
          id: "identity-target",
          personId: null,
          members: [
            {
              id: "member-1",
              personaAssignments: [{ personaId: "persona-target" }],
            },
          ],
          operators: [],
        }),
      },
      identityConversation: {
        findMany: async () => [
          createConversationRecord({ personaId: "persona-target" }),
          createConversationRecord({
            id: "conversation-2",
            personaId: "persona-other",
          }),
          createConversationRecord({
            id: "conversation-3",
            personaId: null,
          }),
        ],
      },
    });

    const result = await service.listAccessibleConversationsForUser({
      userId: "user-member",
      identityId: "identity-target",
    });

    assert.deepEqual(
      result.map((conversation) => conversation.personaId),
      ["persona-target"],
    );
  });

  it("listAccessibleConversationsForUser preserves full member access when no assignments exist", async () => {
    const service = createBaseService({
      identity: {
        findFirst: async () => ({
          id: "identity-target",
          personId: null,
          members: [
            {
              id: "member-1",
              personaAssignments: [],
            },
          ],
          operators: [],
        }),
      },
      identityConversation: {
        findMany: async () => [
          createConversationRecord({ personaId: "persona-target" }),
          createConversationRecord({
            id: "conversation-2",
            personaId: null,
          }),
        ],
      },
    });

    const result = await service.listAccessibleConversationsForUser({
      userId: "user-member",
      identityId: "identity-target",
    });

    assert.equal(result.length, 2);
  });

  it("updateConversationStatus rejects scoped members outside assigned persona threads", async () => {
    let updateCalls = 0;
    const service = createBaseService({
      identity: {
        findFirst: async ({ where }: any) =>
          where.id === "identity-target"
            ? {
                id: where.id,
                personId: null,
                members: [
                  {
                    id: "member-1",
                    personaAssignments: [{ personaId: "persona-target" }],
                  },
                ],
                operators: [],
              }
            : null,
      },
      identityConversation: {
        findUnique: async () =>
          createConversationRecord({ personaId: "persona-other" }),
        update: async () => {
          updateCalls += 1;
          return createConversationRecord({
            personaId: "persona-other",
            status: ConversationStatus.Archived,
          });
        },
      },
    });

    await assert.rejects(
      service.updateConversationStatus({
        conversationId: "conversation-1",
        currentUserId: "user-member",
        status: ConversationStatus.Archived,
      }),
      (error: unknown) => error instanceof NotFoundException,
    );

    assert.equal(updateCalls, 0);
  });

  it("updateConversationStatus allows scoped members inside assigned persona threads", async () => {
    const service = createBaseService({
      identity: {
        findFirst: async ({ where }: any) =>
          where.id === "identity-target"
            ? {
                id: where.id,
                personId: null,
                members: [
                  {
                    id: "member-1",
                    personaAssignments: [{ personaId: "persona-target" }],
                  },
                ],
                operators: [],
              }
            : null,
      },
      identityConversation: {
        findUnique: async () =>
          createConversationRecord({ personaId: "persona-target" }),
        update: async ({ data }: any) =>
          createConversationRecord({
            personaId: "persona-target",
            status: data.status,
          }),
      },
    });

    const result = await service.updateConversationStatus({
      conversationId: "conversation-1",
      currentUserId: "user-member",
      status: ConversationStatus.Archived,
    });

    assert.equal(result.personaId, "persona-target");
    assert.equal(result.conversationStatus, ConversationStatus.Archived);
  });

  it("protected conversation requires protected-capable permissions", async () => {
    const service = createBaseService({
      identityConversation: {
        create: async ({ data }: any) => ({
          ...createConversationRecord(),
          ...data,
        }),
      },
      connectionPermissionOverride: {
        findMany: async () => [
          {
            permissionKey: PERMISSION_KEYS.mediaPrivacy.protectedSend,
            effect: "DENY",
            limitsJson: null,
            reason: null,
            createdAt: new Date("2026-03-26T12:00:00.000Z"),
            createdByIdentityId: "identity-source",
          },
          {
            permissionKey: PERMISSION_KEYS.vault.itemView,
            effect: "DENY",
            limitsJson: null,
            reason: null,
            createdAt: new Date("2026-03-26T12:00:00.000Z"),
            createdByIdentityId: "identity-source",
          },
          {
            permissionKey: PERMISSION_KEYS.vault.itemAttach,
            effect: "DENY",
            limitsJson: null,
            reason: null,
            createdAt: new Date("2026-03-26T12:00:00.000Z"),
            createdByIdentityId: "identity-source",
          },
        ],
      },
    });

    await assert.rejects(
      service.createConversation({
        sourceIdentityId: "identity-source",
        targetIdentityId: "identity-target",
        connectionId: "connection-1",
        conversationType: ConversationType.ProtectedDirect,
        createdByIdentityId: "identity-source",
      }),
      /Protected direct conversations require protected-capable permissions/,
    );
  });

  it("business conversation requires business or professional compatibility", async () => {
    const service = createBaseService({
      identityConversation: {
        create: async ({ data }: any) => ({
          ...createConversationRecord(),
          ...data,
        }),
      },
    });

    await assert.rejects(
      service.createConversation({
        sourceIdentityId: "identity-source",
        targetIdentityId: "identity-target",
        connectionId: "connection-1",
        conversationType: ConversationType.BusinessDirect,
        createdByIdentityId: "identity-source",
      }),
      /Business direct conversations require business or professional identities/,
    );
  });

  it("bindResolvedPermissionsToConversation stores lastResolvedAt and lastPermissionHash", async () => {
    let updatedConversation: {
      lastPermissionHash?: string;
      lastResolvedAt?: Date;
    } | null = null;
    const service = createBaseService({
      identityConversation: {
        findUnique: async () => createConversationRecord(),
        update: async ({ data }: any) => {
          updatedConversation = data;
          return {
            ...createConversationRecord(),
            ...data,
          };
        },
      },
    });

    const result = await service.bindResolvedPermissionsToConversation({
      conversationId: "1fcf18a1-fcd6-4ae7-a760-2941821cb6dc",
    });

    assert.ok(updatedConversation !== null);
    assert.equal(typeof result.bindingSummary.currentHash, "string");
    assert.ok(result.bindingSummary.currentResolvedAt instanceof Date);
    assert.equal(result.stale, false);
  });

  it("isConversationPermissionBindingStale returns true when never bound", async () => {
    const service = createBaseService({
      identityConversation: {
        findUnique: async () => createConversationRecord(),
      },
    });

    const result = await service.isConversationPermissionBindingStale(
      "b1089cbe-f3bd-4cb2-af70-97c71e86a931",
    );

    assert.equal(result.stale, true);
    assert.equal(result.storedHash, null);
  });

  it("isConversationPermissionBindingStale returns false immediately after bind", async () => {
    let boundHash = "";
    let boundAt: Date | null = null;
    const service = createBaseService({
      identityConversation: {
        findUnique: async ({ where }: any) => {
          if (where.id === "conversation-1" && boundHash) {
            return createConversationRecord({
              lastPermissionHash: boundHash,
              lastResolvedAt: boundAt,
            });
          }

          return createConversationRecord();
        },
        update: async ({ data }: any) => {
          boundHash = data.lastPermissionHash;
          boundAt = data.lastResolvedAt;
          return createConversationRecord({
            lastPermissionHash: boundHash,
            lastResolvedAt: boundAt,
          });
        },
      },
    });

    await service.bindResolvedPermissionsToConversation({
      conversationId: "conversation-1",
    });
    const result =
      await service.isConversationPermissionBindingStale("conversation-1");

    assert.equal(result.stale, false);
  });

  it("stale becomes true after underlying permission-affecting change", async () => {
    let boundHash = "";
    let boundAt: Date | null = null;
    let denyAi = false;
    const service = createBaseService({
      identityConversation: {
        findUnique: async () =>
          createConversationRecord({
            lastPermissionHash: boundHash || null,
            lastResolvedAt: boundAt,
          }),
        update: async ({ data }: any) => {
          boundHash = data.lastPermissionHash;
          boundAt = data.lastResolvedAt;
          return createConversationRecord({
            lastPermissionHash: boundHash,
            lastResolvedAt: boundAt,
          });
        },
      },
      connectionPermissionOverride: {
        findMany: async () =>
          denyAi
            ? [
                {
                  permissionKey: PERMISSION_KEYS.ai.summaryUse,
                  effect: "DENY",
                  limitsJson: null,
                  reason: null,
                  createdAt: new Date("2026-03-26T12:00:00.000Z"),
                  createdByIdentityId: "identity-source",
                },
              ]
            : [],
      },
    });

    await service.bindResolvedPermissionsToConversation({
      conversationId: "conversation-1",
    });
    denyAi = true;

    const result =
      await service.isConversationPermissionBindingStale("conversation-1");

    assert.equal(result.stale, true);
  });

  it("resolveConversationContext returns summary resolved permissions and stale flag", async () => {
    const service = createBaseService({
      identityConversation: {
        findUnique: async () => createConversationRecord(),
      },
    });

    const result = await service.resolveConversationContext({
      conversationId: "conversation-1",
    });

    assert.equal(result.conversation.conversationId, "conversation-1");
    assert.equal(result.resolvedPermissions.connectionId, "connection-1");
    assert.equal(result.stale, true);
    assert.equal(result.traceSummary.templateKey, "personal.trusted");
  });

  it("resolveConversationContext uses conversation cache when fresh", async () => {
    let conversationLookups = 0;
    const service = createBaseService({
      identityConversation: {
        findUnique: async () => {
          conversationLookups += 1;
          return createConversationRecord({
            lastResolvedAt: new Date("2026-03-26T12:00:00.000Z"),
            lastPermissionHash: null,
          });
        },
        findMany: async () => [createConversationRecord()],
        update: async ({ data }: any) => ({
          ...createConversationRecord(),
          ...data,
        }),
      },
    });

    await service.resolveConversationContext({
      conversationId: "conversation-1",
    });
    await service.resolveConversationContext({
      conversationId: "conversation-1",
    });

    assert.equal(conversationLookups, 2);
  });

  it("conversation cache invalidates when binding becomes stale", async () => {
    let denyAi = false;
    const service = createBaseService({
      identityConversation: {
        findUnique: async () =>
          createConversationRecord({
            lastResolvedAt: new Date("2026-03-26T12:00:00.000Z"),
            lastPermissionHash: null,
          }),
        findMany: async () => [createConversationRecord()],
        update: async ({ data }: any) => ({
          ...createConversationRecord(),
          ...data,
        }),
      },
      connectionPermissionOverride: {
        findMany: async () =>
          denyAi
            ? [
                {
                  permissionKey: PERMISSION_KEYS.ai.summaryUse,
                  effect: "DENY",
                  limitsJson: null,
                  reason: null,
                  createdAt: new Date("2026-03-26T12:30:00.000Z"),
                  createdByIdentityId: "identity-source",
                },
              ]
            : [],
      },
    });

    await service.resolveConversationContext({
      conversationId: "conversation-1",
    });
    denyAi = true;
    await service.bindResolvedPermissionsToConversation({
      conversationId: "conversation-1",
    });
    const refreshed = await service.resolveConversationContext({
      conversationId: "conversation-1",
    });

    assert.equal(typeof refreshed.bindingSummary.currentHash, "string");
  });
});
