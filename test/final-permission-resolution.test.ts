import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { ConnectionType } from "../src/common/enums/connection-type.enum";
import { IdentityType } from "../src/common/enums/identity-type.enum";
import { PermissionEffect } from "../src/common/enums/permission-effect.enum";
import { RelationshipType } from "../src/common/enums/relationship-type.enum";
import { TrustState } from "../src/common/enums/trust-state.enum";
import { IdentitiesService } from "../src/modules/identities/identities.service";
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
    relationshipType: null,
    trustState: "BLOCKED",
    status: "BLOCKED",
    createdByIdentityId: "identity-source",
    note: null,
    metadataJson: null,
    createdAt: new Date("2026-03-26T12:00:00.000Z"),
    updatedAt: new Date("2026-03-26T12:00:00.000Z"),
    ...overrides,
  };
}

describe("canonical permission resolver", () => {
  it("resolveConnectionPermissions returns full final structure", async () => {
    const service = new IdentitiesService({
      identityConnection: {
        findUnique: async () => createConnectionRecord(),
      },
      identity: {
        findUnique: async () => ({
          id: "identity-source",
          identityType: "COUPLE",
        }),
      },
      connectionPolicyTemplate: {
        findFirst: async ({ where }: any) =>
          createTemplateRecord(
            where.sourceIdentityType === "COUPLE"
              ? "couple.partner"
              : "generic.partner",
          ),
      },
      connectionPermissionOverride: {
        findMany: async () => [
          {
            permissionKey: PERMISSION_KEYS.mediaPrivacy.export,
            effect: "ALLOW",
            limitsJson: null,
            reason: "attempted export allow",
            createdAt: new Date("2026-03-26T12:00:00.000Z"),
            createdByIdentityId: "identity-source",
          },
        ],
      },
      connectionPermissionSnapshot: {
        create: async () => {
          throw new Error("should not persist snapshot");
        },
      },
    } as any);

    const result = await service.resolveConnectionPermissions({
      connectionId: "0f1ca5e6-6a79-4325-9431-09d23545c9a1",
    });

    assert.equal(result.connectionId, "connection-1");
    assert.equal(result.sourceIdentityType, IdentityType.Couple);
    assert.equal(result.template.templateKey, "couple.partner");
    assert.equal(
      result.permissions[PERMISSION_KEYS.mediaPrivacy.export]?.finalEffect,
      PermissionEffect.Deny,
    );
    assert.equal(
      result.trace[PERMISSION_KEYS.mediaPrivacy.export]?.guardrailApplied,
      true,
    );
  });

  it("final permissions reflect template trust and overrides together", async () => {
    const service = new IdentitiesService({
      identityConnection: {
        findUnique: async () =>
          createConnectionRecord({ trustState: "UNVERIFIED" }),
      },
      identity: {
        findUnique: async () => ({
          id: "identity-source",
          identityType: "BUSINESS",
        }),
      },
      connectionPolicyTemplate: {
        findFirst: async ({ where }: any) =>
          createTemplateRecord(
            where.sourceIdentityType === "BUSINESS"
              ? "business.client"
              : "generic.client",
          ),
      },
      connectionPermissionOverride: {
        findMany: async () => [
          {
            permissionKey: PERMISSION_KEYS.ai.summaryUse,
            effect: "ALLOW",
            limitsJson: null,
            reason: "manual allow",
            createdAt: new Date("2026-03-26T12:00:00.000Z"),
            createdByIdentityId: "identity-source",
          },
        ],
      },
    } as any);

    const result = await service.resolveConnectionPermissions({
      connectionId: "f216f05f-c37b-4f8b-8d69-f42927201e6a",
    });

    assert.equal(
      result.permissions[PERMISSION_KEYS.ai.summaryUse]?.finalEffect,
      PermissionEffect.Allow,
    );
    assert.equal(
      result.trace[PERMISSION_KEYS.ai.summaryUse]?.overrideApplied,
      true,
    );
  });

  it("source identity type is used in template selection", async () => {
    const queries: Array<Record<string, unknown>> = [];
    const service = new IdentitiesService({
      identityConnection: {
        findUnique: async () =>
          createConnectionRecord({
            trustState: "UNVERIFIED",
            connectionType: "CLIENT",
          }),
      },
      identity: {
        findUnique: async () => ({
          id: "identity-source",
          identityType: "BUSINESS",
        }),
      },
      connectionPolicyTemplate: {
        findFirst: async ({ where }: any) => {
          queries.push(where);
          return createTemplateRecord("business.client");
        },
      },
      connectionPermissionOverride: {
        findMany: async () => [],
      },
    } as any);

    await service.resolveConnectionPermissions({
      connectionId: "4b88aef1-b70f-4f76-a1c5-cd4c4b55e47e",
    });

    assert.equal(queries[0]?.sourceIdentityType, "BUSINESS");
  });

  it("resolved overridesSummary is correct and sorted", async () => {
    const service = new IdentitiesService({
      identityConnection: {
        findUnique: async () =>
          createConnectionRecord({ trustState: "UNVERIFIED" }),
      },
      identity: {
        findUnique: async () => ({
          id: "identity-source",
          identityType: "BUSINESS",
        }),
      },
      connectionPolicyTemplate: {
        findFirst: async () => createTemplateRecord("business.client"),
      },
      connectionPermissionOverride: {
        findMany: async () => [
          {
            permissionKey: PERMISSION_KEYS.vault.itemView,
            effect: "ALLOW",
            limitsJson: null,
            reason: "z",
            createdAt: new Date("2026-03-26T12:00:01.000Z"),
            createdByIdentityId: "identity-source",
          },
          {
            permissionKey: PERMISSION_KEYS.ai.summaryUse,
            effect: "DENY",
            limitsJson: null,
            reason: "a",
            createdAt: new Date("2026-03-26T12:00:00.000Z"),
            createdByIdentityId: "identity-source",
          },
        ],
      },
    } as any);

    const result = await service.resolveConnectionPermissions({
      connectionId: "cbca393c-a403-4ce4-9b9c-756403b7f1d2",
    });

    assert.equal(result.overridesSummary.count, 2);
    assert.deepEqual(result.overridesSummary.overriddenKeys, [
      PERMISSION_KEYS.ai.summaryUse,
      PERMISSION_KEYS.vault.itemView,
    ]);
  });

  it("persistSnapshot option false does not write snapshot", async () => {
    let snapshotCreateCalls = 0;
    const service = new IdentitiesService({
      identityConnection: {
        findUnique: async () =>
          createConnectionRecord({ trustState: "UNVERIFIED" }),
      },
      identity: {
        findUnique: async () => ({
          id: "identity-source",
          identityType: "BUSINESS",
        }),
      },
      connectionPolicyTemplate: {
        findFirst: async () => createTemplateRecord("business.client"),
      },
      connectionPermissionOverride: {
        findMany: async () => [],
      },
      connectionPermissionSnapshot: {
        create: async () => {
          snapshotCreateCalls += 1;
          return null;
        },
      },
    } as any);

    await service.resolveConnectionPermissions({
      connectionId: "ba7e7b8b-fafc-4e3b-b2dd-e14334f1b2d0",
      persistSnapshot: false,
    });

    assert.equal(snapshotCreateCalls, 0);
  });

  it("persistSnapshot option true writes snapshot", async () => {
    let snapshotCreateCalls = 0;
    let persistedPayload: Record<string, unknown> | null = null;
    const service = new IdentitiesService({
      identityConnection: {
        findUnique: async () =>
          createConnectionRecord({ trustState: "UNVERIFIED" }),
      },
      identity: {
        findUnique: async () => ({
          id: "identity-source",
          identityType: "BUSINESS",
        }),
      },
      connectionPolicyTemplate: {
        findFirst: async () => createTemplateRecord("business.client"),
      },
      connectionPermissionOverride: {
        findMany: async () => [],
      },
      connectionPermissionSnapshot: {
        create: async ({ data }: any) => {
          snapshotCreateCalls += 1;
          persistedPayload = data;
          return {
            id: "snapshot-1",
            connectionId: data.connectionId,
            policyVersion: data.policyVersion,
            permissionsJson: data.permissionsJson,
            metadataJson: data.metadataJson,
            computedAt: data.computedAt,
          };
        },
      },
    } as any);

    await service.resolveConnectionPermissions({
      connectionId: "404ef7b4-49d3-460c-b1ab-1c78c89d75c6",
      persistSnapshot: true,
    });

    assert.equal(snapshotCreateCalls, 1);
    assert.equal(
      typeof (persistedPayload as Record<string, unknown> | null)?.metadataJson,
      "object",
    );
  });

  it("getLatestPermissionSnapshot returns most recent snapshot deterministically", async () => {
    const service = new IdentitiesService({
      connectionPermissionSnapshot: {
        findFirst: async () => ({
          id: "snapshot-2",
          connectionId: "connection-1",
          policyVersion: 2,
          permissionsJson:
            createTemplateRecord("generic.trusted").permissionsJson,
          metadataJson: null,
          computedAt: new Date("2026-03-27T12:00:00.000Z"),
        }),
      },
    } as any);

    const result = await service.getLatestPermissionSnapshot({
      connectionId: "b4cb658d-3edf-4d39-9c34-b4734f2e5dc1",
    });

    assert.equal(result?.id, "snapshot-2");
    assert.equal(result?.policyVersion, 2);
  });

  it("resolveConnectionPermissions uses cache on repeat call when fresh", async () => {
    let connectionLookups = 0;
    const service = new IdentitiesService({
      identityConnection: {
        findUnique: async () => {
          connectionLookups += 1;
          return createConnectionRecord({ trustState: "UNVERIFIED" });
        },
      },
      identity: {
        findUnique: async ({ where }: any) => ({
          id: where.id,
          identityType: "BUSINESS",
          updatedAt: new Date("2026-03-26T12:00:00.000Z"),
        }),
      },
      connectionPolicyTemplate: {
        findFirst: async () => createTemplateRecord("business.client"),
      },
      connectionPermissionOverride: {
        findMany: async () => [],
      },
      connectionPermissionSnapshot: {
        findFirst: async () => null,
      },
    } as any);

    await service.resolveConnectionPermissions({
      connectionId: "cache-repeat-1",
    });
    await service.resolveConnectionPermissions({
      connectionId: "cache-repeat-1",
    });

    assert.equal(connectionLookups, 3);
  });

  it("forceRefresh bypasses cache", async () => {
    let connectionLookups = 0;
    const service = new IdentitiesService({
      identityConnection: {
        findUnique: async () => {
          connectionLookups += 1;
          return createConnectionRecord({ trustState: "UNVERIFIED" });
        },
      },
      identity: {
        findUnique: async ({ where }: any) => ({
          id: where.id,
          identityType: "BUSINESS",
          updatedAt: new Date("2026-03-26T12:00:00.000Z"),
        }),
      },
      connectionPolicyTemplate: {
        findFirst: async () => createTemplateRecord("business.client"),
      },
      connectionPermissionOverride: {
        findMany: async () => [],
      },
      connectionPermissionSnapshot: {
        findFirst: async () => null,
      },
    } as any);

    await service.resolveConnectionPermissions({
      connectionId: "cache-force-1",
    });
    await service.resolveConnectionPermissions({
      connectionId: "cache-force-1",
      forceRefresh: true,
    });

    assert.ok(connectionLookups > 3);
  });

  it("stale snapshot is not reused", async () => {
    let snapshotReads = 0;
    const service = new IdentitiesService({
      identityConnection: {
        findUnique: async () =>
          createConnectionRecord({
            trustState: "UNVERIFIED",
            connectionType: "CLIENT",
            updatedAt: new Date("2026-03-26T12:30:00.000Z"),
          }),
      },
      identity: {
        findUnique: async ({ where }: any) => ({
          id: where.id,
          identityType: "BUSINESS",
          updatedAt: new Date("2026-03-26T12:30:00.000Z"),
        }),
      },
      connectionPolicyTemplate: {
        findFirst: async () => createTemplateRecord("business.client"),
      },
      connectionPermissionOverride: {
        findMany: async () => [],
      },
      connectionPermissionSnapshot: {
        findFirst: async () => {
          snapshotReads += 1;
          return {
            id: "snapshot-1",
            connectionId: "connection-1",
            policyVersion: 1,
            permissionsJson:
              createTemplateRecord("business.client").permissionsJson,
            metadataJson: {
              resolverVersion: "2026-03-26.prompt-114",
              templateKey: "business.client",
              templatePolicyVersion: 1,
              trustState: TrustState.Unverified,
              connectionType: ConnectionType.Client,
              relationshipType: RelationshipType.Client,
              overrideCount: 0,
              riskSummaryHash: "hash",
              sourceHash: "stale-hash",
              computedAt: new Date("2026-03-26T12:00:00.000Z"),
            },
            computedAt: new Date("2026-03-26T12:00:00.000Z"),
          };
        },
      },
    } as any);

    const result = await service.resolveConnectionPermissions({
      connectionId: "snapshot-stale-1",
      preferSnapshot: true,
    });

    assert.equal(snapshotReads, 1);
    assert.equal(result.template.templateKey, "business.client");
  });

  it("resolverVersion mismatch invalidates snapshot", async () => {
    const service = new IdentitiesService({
      identityConnection: {
        findUnique: async () =>
          createConnectionRecord({
            trustState: "UNVERIFIED",
            connectionType: "CLIENT",
          }),
      },
      identity: {
        findUnique: async ({ where }: any) => ({
          id: where.id,
          identityType: "BUSINESS",
          updatedAt: new Date("2026-03-26T12:00:00.000Z"),
        }),
      },
      connectionPolicyTemplate: {
        findFirst: async () => createTemplateRecord("business.client"),
      },
      connectionPermissionOverride: {
        findMany: async () => [],
      },
    } as any);

    const freshness = await service.isSnapshotFresh(
      "connection-1",
      {
        id: "snapshot-old-version",
        connectionId: "connection-1",
        policyVersion: 1,
        permissionsJson:
          createTemplateRecord("business.client").permissionsJson,
        metadataJson: {
          resolverVersion: "older-version",
          templateKey: "business.client",
          templatePolicyVersion: 1,
          trustState: TrustState.Unverified,
          connectionType: ConnectionType.Client,
          relationshipType: RelationshipType.Client,
          overrideCount: 0,
          riskSummaryHash: "hash",
          sourceHash: "hash",
          computedAt: new Date("2026-03-26T12:00:00.000Z"),
        },
        computedAt: new Date("2026-03-26T12:00:00.000Z"),
      },
      {},
    );

    assert.equal(freshness.fresh, false);
    assert.equal(freshness.reason, "RESOLVER_VERSION_MISMATCH");
  });

  it("preferSnapshot false recomputes without snapshot reuse", async () => {
    let snapshotReads = 0;
    const service = new IdentitiesService({
      identityConnection: {
        findUnique: async () =>
          createConnectionRecord({
            trustState: "UNVERIFIED",
            connectionType: "CLIENT",
          }),
      },
      identity: {
        findUnique: async ({ where }: any) => ({
          id: where.id,
          identityType: "BUSINESS",
          updatedAt: new Date("2026-03-26T12:00:00.000Z"),
        }),
      },
      connectionPolicyTemplate: {
        findFirst: async () => createTemplateRecord("business.client"),
      },
      connectionPermissionOverride: {
        findMany: async () => [],
      },
      connectionPermissionSnapshot: {
        findFirst: async () => {
          snapshotReads += 1;
          return null;
        },
      },
    } as any);

    await service.resolveConnectionPermissions({
      connectionId: "prefer-snapshot-off-1",
      preferSnapshot: false,
    });

    assert.equal(snapshotReads, 0);
  });

  it("preferSnapshot true consults snapshot only when fresh and safe", async () => {
    let snapshotReads = 0;
    const service = new IdentitiesService({
      identityConnection: {
        findUnique: async () =>
          createConnectionRecord({
            trustState: "UNVERIFIED",
            connectionType: "CLIENT",
          }),
      },
      identity: {
        findUnique: async ({ where }: any) => ({
          id: where.id,
          identityType: "BUSINESS",
          updatedAt: new Date("2026-03-26T12:00:00.000Z"),
        }),
      },
      connectionPolicyTemplate: {
        findFirst: async () => createTemplateRecord("business.client"),
      },
      connectionPermissionOverride: {
        findMany: async () => [],
      },
      connectionPermissionSnapshot: {
        findFirst: async () => {
          snapshotReads += 1;
          return {
            id: "snapshot-fresh-1",
            connectionId: "connection-1",
            policyVersion: 1,
            permissionsJson:
              createTemplateRecord("business.client").permissionsJson,
            metadataJson: {
              resolverVersion: "2026-03-26.prompt-114",
              templateKey: "business.client",
              templatePolicyVersion: 1,
              trustState: TrustState.Unverified,
              connectionType: ConnectionType.Client,
              relationshipType: RelationshipType.Client,
              overrideCount: 0,
              riskSummaryHash: "hash",
              sourceHash: await service.computePermissionSourceHash(
                "connection-1",
                {},
              ),
              computedAt: new Date("2026-03-26T12:00:00.000Z"),
            },
            computedAt: new Date("2026-03-26T12:00:00.000Z"),
          };
        },
      },
    } as any);

    await service.resolveConnectionPermissions({
      connectionId: "prefer-snapshot-on-1",
      preferSnapshot: true,
    });

    assert.equal(snapshotReads, 1);
  });

  it("previewRiskSignals do not poison stable cache entries", async () => {
    const service = new IdentitiesService({
      identityConnection: {
        findUnique: async () =>
          createConnectionRecord({
            trustState: "UNVERIFIED",
            connectionType: "CLIENT",
          }),
      },
      identity: {
        findUnique: async ({ where }: any) => ({
          id: where.id,
          identityType: "BUSINESS",
          updatedAt: new Date("2026-03-26T12:00:00.000Z"),
        }),
      },
      connectionPolicyTemplate: {
        findFirst: async () => createTemplateRecord("business.client"),
      },
      connectionPermissionOverride: {
        findMany: async () => [],
      },
      connectionPermissionSnapshot: {
        findFirst: async () => null,
      },
    } as any);

    const preview = await service.resolveConnectionPermissions({
      connectionId: "cache-risk-preview-1",
      previewRiskSignals: [
        { signal: "AI_SAFETY_RISK" as any, severity: "HIGH" as any },
      ],
    });
    const stable = await service.resolveConnectionPermissions({
      connectionId: "cache-risk-preview-1",
    });

    assert.equal(preview.riskSummary.aiRestricted, true);
    assert.equal(stable.riskSummary.aiRestricted, false);
  });

  it("blocked trust-state still preserves hard deny in final resolver", async () => {
    const service = new IdentitiesService({
      identityConnection: {
        findUnique: async () =>
          createConnectionRecord({ trustState: "BLOCKED" }),
      },
      identity: {
        findUnique: async () => ({
          id: "identity-source",
          identityType: "BUSINESS",
        }),
      },
      connectionPolicyTemplate: {
        findFirst: async () => createTemplateRecord("business.client"),
      },
      connectionPermissionOverride: {
        findMany: async () => [
          {
            permissionKey: PERMISSION_KEYS.calling.voiceStart,
            effect: "ALLOW",
            limitsJson: null,
            reason: "manual allow",
            createdAt: new Date("2026-03-26T12:00:00.000Z"),
            createdByIdentityId: "identity-source",
          },
        ],
      },
    } as any);

    const result = await service.resolveConnectionPermissions({
      connectionId: "02b3319c-a903-45c0-a0ae-47d7b8d9b71f",
    });

    assert.equal(
      result.permissions[PERMISSION_KEYS.calling.voiceStart]?.finalEffect,
      PermissionEffect.Deny,
    );
  });

  it("couple.partner export and reshare deny preserved in final resolver", async () => {
    const service = new IdentitiesService({
      identityConnection: {
        findUnique: async () =>
          createConnectionRecord({
            trustState: "TRUSTED_BY_USER",
            connectionType: "PARTNER",
          }),
      },
      identity: {
        findUnique: async () => ({
          id: "identity-source",
          identityType: "COUPLE",
        }),
      },
      connectionPolicyTemplate: {
        findFirst: async () => createTemplateRecord("couple.partner"),
      },
      connectionPermissionOverride: {
        findMany: async () => [
          {
            permissionKey: PERMISSION_KEYS.vault.itemReshare,
            effect: "ALLOW",
            limitsJson: null,
            reason: "manual allow",
            createdAt: new Date("2026-03-26T12:00:00.000Z"),
            createdByIdentityId: "identity-source",
          },
        ],
      },
    } as any);

    const result = await service.resolveConnectionPermissions({
      connectionId: "0f3b9a7c-3994-4f6a-9069-e1a8c3f59e53",
    });

    assert.equal(
      result.permissions[PERMISSION_KEYS.vault.itemReshare]?.finalEffect,
      PermissionEffect.Deny,
    );
  });

  it("trace contains stage data for resolved permissions", async () => {
    const service = new IdentitiesService({
      identityConnection: {
        findUnique: async () =>
          createConnectionRecord({ trustState: "UNVERIFIED" }),
      },
      identity: {
        findUnique: async () => ({
          id: "identity-source",
          identityType: "BUSINESS",
        }),
      },
      connectionPolicyTemplate: {
        findFirst: async () => createTemplateRecord("business.client"),
      },
      connectionPermissionOverride: {
        findMany: async () => [
          {
            permissionKey: PERMISSION_KEYS.ai.summaryUse,
            effect: "ALLOW",
            limitsJson: null,
            reason: "manual allow",
            createdAt: new Date("2026-03-26T12:00:00.000Z"),
            createdByIdentityId: "identity-source",
          },
        ],
      },
    } as any);

    const result = await service.resolveConnectionPermissions({
      connectionId: "6e53c74b-cfe7-4b18-973e-c1f5800a34f7",
    });

    assert.equal(
      result.trace[PERMISSION_KEYS.ai.summaryUse]?.manualOverrideEffect,
      PermissionEffect.Allow,
    );
    assert.equal(
      typeof result.trace[PERMISSION_KEYS.ai.summaryUse]
        ?.postIdentityBehaviorEffect,
      "string",
    );
    assert.equal(
      typeof result.trace[PERMISSION_KEYS.ai.summaryUse]
        ?.identityBehaviorEffect === "string" ||
        result.trace[PERMISSION_KEYS.ai.summaryUse]?.identityBehaviorEffect ===
          null,
      true,
    );
    assert.equal(
      typeof result.trace[PERMISSION_KEYS.ai.summaryUse]
        ?.postRelationshipEffect,
      "string",
    );
    assert.equal(
      typeof result.trace[PERMISSION_KEYS.ai.summaryUse]
        ?.relationshipBehaviorEffect === "string" ||
        result.trace[PERMISSION_KEYS.ai.summaryUse]
          ?.relationshipBehaviorEffect === null,
      true,
    );
    assert.equal(
      result.trace[PERMISSION_KEYS.ai.summaryUse]?.overrideApplied,
      true,
    );
    assert.equal(typeof result.resolvedAt.getTime(), "number");
  });

  it("resolver exposes identity behavior summary and compatibility flags", async () => {
    const service = new IdentitiesService({
      identityConnection: {
        findUnique: async () =>
          createConnectionRecord({
            trustState: "TRUSTED_BY_USER",
            connectionType: "PARTNER",
          }),
      },
      identity: {
        findUnique: async ({ where }: any) => ({
          id: where.id,
          identityType: where.id === "identity-source" ? "COUPLE" : "PERSONAL",
        }),
      },
      connectionPolicyTemplate: {
        findFirst: async () => createTemplateRecord("couple.partner"),
      },
      connectionPermissionOverride: {
        findMany: async () => [],
      },
    } as any);

    const result = await service.resolveConnectionPermissions({
      connectionId: "1becc7fd-39aa-42f8-a522-a4f3879f98f9",
    });

    assert.equal(
      result.identityBehaviorSummary.sourceIdentityType,
      IdentityType.Couple,
    );
    assert.equal(
      result.identityBehaviorSummary.targetIdentityType,
      IdentityType.Personal,
    );
    assert.equal(
      result.identityBehaviorSummary.restrictionFlags
        .prefersProtectedConversation,
      true,
    );
    assert.equal(
      result.identityBehaviorSummary.restrictionFlags
        .allowsBusinessConversation,
      false,
    );
    assert.equal(
      result.identityBehaviorSummary.restrictionFlags.restrictsExport,
      true,
    );
    assert.equal(
      result.identityBehaviorSummary.restrictionFlags.restrictsReshare,
      true,
    );
    assert.equal(
      result.identityBehaviorSummary.restrictionFlags
        .schedulingPreferredForCalls,
      false,
    );
    assert.equal(
      result.identityBehaviorSummary.restrictionFlags.restrictsDirectVideo,
      true,
    );
  });

  it("previewPermissionsWithIdentityBehavior returns behavior-shaped preview", async () => {
    const service = new IdentitiesService({
      connectionPolicyTemplate: {
        findFirst: async () => createTemplateRecord("professional.client"),
      },
    } as any);

    const result = await service.previewPermissionsWithIdentityBehavior({
      sourceIdentityType: IdentityType.Professional,
      targetIdentityType: IdentityType.Business,
      connectionType: ConnectionType.Client,
      trustState: TrustState.TrustedByUser,
    });

    assert.equal(result.sourceIdentityType, IdentityType.Professional);
    assert.equal(result.targetIdentityType, IdentityType.Business);
    assert.equal(
      result.behaviorSummary.restrictionFlags.schedulingPreferredForCalls,
      true,
    );
    assert.equal(
      result.postIdentityBehaviorPermissions[
        PERMISSION_KEYS.actions.supportTicketCreate
      ]?.effect,
      PermissionEffect.Allow,
    );
    assert.equal(
      typeof result.mergeTrace[PERMISSION_KEYS.actions.supportTicketCreate]
        ?.postIdentityBehaviorEffect,
      "string",
    );
    assert.equal(
      result.behaviorSummary.reasonCodes.includes(
        "IDENTITY_BEHAVIOR_SCHEDULE_PREFERRED",
      ),
      true,
    );
  });

  it("PARTNER reinforces protected private posture", async () => {
    const service = new IdentitiesService({
      connectionPolicyTemplate: {
        findFirst: async () => createTemplateRecord("generic.trusted"),
      },
    } as any);

    const result = await service.previewPermissionsWithRelationship({
      sourceIdentityType: IdentityType.Personal,
      targetIdentityType: IdentityType.Personal,
      connectionType: ConnectionType.Trusted,
      relationshipType: RelationshipType.Partner,
      trustState: TrustState.TrustedByUser,
    });

    assert.equal(
      result.relationshipBehaviorSummary.recommendedConversationType,
      "PROTECTED_DIRECT",
    );
    assert.equal(
      result.relationshipBehaviorSummary.compatibilityFlags
        .prefersProtectedConversation,
      true,
    );
    assert.equal(
      result.postRelationshipBehaviorPermissions[
        PERMISSION_KEYS.mediaPrivacy.export
      ]?.effect,
      PermissionEffect.Deny,
    );
    assert.equal(
      result.postRelationshipBehaviorPermissions[
        PERMISSION_KEYS.vault.itemReshare
      ]?.effect,
      PermissionEffect.Deny,
    );
  });

  it("FAMILY_MEMBER improves vault-friendly behavior safely", async () => {
    const service = new IdentitiesService({
      connectionPolicyTemplate: {
        findFirst: async () => createTemplateRecord("generic.known"),
      },
    } as any);

    const result = await service.previewPermissionsWithRelationship({
      sourceIdentityType: IdentityType.Family,
      targetIdentityType: IdentityType.Family,
      connectionType: ConnectionType.Known,
      relationshipType: RelationshipType.FamilyMember,
      trustState: TrustState.BasicVerified,
    });

    assert.equal(
      result.postRelationshipBehaviorPermissions[PERMISSION_KEYS.vault.itemView]
        ?.effect,
      PermissionEffect.Allow,
    );
    assert.equal(
      result.postRelationshipBehaviorPermissions[
        PERMISSION_KEYS.vault.itemDownload
      ]?.effect,
      PermissionEffect.Allow,
    );
    assert.equal(
      result.relationshipBehaviorSummary.compatibilityFlags.restrictsReshare,
      true,
    );
  });

  it("CLIENT improves business actions without opening private profile fields", async () => {
    const service = new IdentitiesService({
      connectionPolicyTemplate: {
        findFirst: async () => createTemplateRecord("generic.known"),
      },
    } as any);

    const result = await service.previewPermissionsWithRelationship({
      sourceIdentityType: IdentityType.Business,
      targetIdentityType: IdentityType.Personal,
      connectionType: ConnectionType.Client,
      relationshipType: RelationshipType.Client,
      trustState: TrustState.BasicVerified,
    });

    assert.equal(
      result.postRelationshipBehaviorPermissions[
        PERMISSION_KEYS.actions.bookingRequestCreate
      ]?.effect,
      PermissionEffect.Allow,
    );
    assert.equal(
      result.postRelationshipBehaviorPermissions[
        PERMISSION_KEYS.actions.paymentRequestCreate
      ]?.effect,
      PermissionEffect.Allow,
    );
    assert.equal(
      result.postRelationshipBehaviorPermissions[
        PERMISSION_KEYS.actions.supportTicketCreate
      ]?.effect,
      PermissionEffect.Allow,
    );
    assert.equal(
      result.postRelationshipBehaviorPermissions[
        PERMISSION_KEYS.profile.phoneView
      ]?.effect,
      PermissionEffect.RequestApproval,
    );
  });

  it("COLLEAGUE mildly improves call and support behavior", async () => {
    const service = new IdentitiesService({
      connectionPolicyTemplate: {
        findFirst: async () => createTemplateRecord("generic.known"),
      },
    } as any);

    const result = await service.previewPermissionsWithRelationship({
      sourceIdentityType: IdentityType.Professional,
      targetIdentityType: IdentityType.Professional,
      connectionType: ConnectionType.Colleague,
      relationshipType: RelationshipType.Colleague,
      trustState: TrustState.BasicVerified,
    });

    assert.equal(
      result.postRelationshipBehaviorPermissions[
        PERMISSION_KEYS.calling.voiceStart
      ]?.effect,
      PermissionEffect.Allow,
    );
    assert.equal(
      result.postRelationshipBehaviorPermissions[
        PERMISSION_KEYS.actions.supportTicketCreate
      ]?.effect,
      PermissionEffect.Allow,
    );
    assert.equal(
      result.relationshipBehaviorSummary.prefersScheduledCalls,
      true,
    );
  });

  it("UNKNOWN relationship remains neutral", async () => {
    const service = new IdentitiesService({
      connectionPolicyTemplate: {
        findFirst: async () => createTemplateRecord("generic.trusted"),
      },
    } as any);

    const templatePermissions =
      createTemplateRecord("generic.trusted").permissionsJson;
    const result = await service.previewPermissionsWithRelationship({
      sourceIdentityType: IdentityType.Personal,
      targetIdentityType: IdentityType.Personal,
      connectionType: ConnectionType.Trusted,
      relationshipType: RelationshipType.Unknown,
      trustState: TrustState.TrustedByUser,
    });

    assert.deepEqual(
      result.postRelationshipBehaviorPermissions,
      templatePermissions,
    );
  });

  it("relationship summary exposes call and service hints", async () => {
    const service = new IdentitiesService({
      connectionPolicyTemplate: {
        findFirst: async () => createTemplateRecord("generic.known"),
      },
    } as any);

    const result = await service.previewPermissionsWithRelationship({
      sourceIdentityType: IdentityType.Business,
      targetIdentityType: IdentityType.Personal,
      connectionType: ConnectionType.Client,
      relationshipType: RelationshipType.HouseholdService,
      trustState: TrustState.BasicVerified,
    });

    assert.equal(
      result.relationshipBehaviorSummary.prefersScheduledCalls,
      true,
    );
    assert.equal(result.relationshipBehaviorSummary.routineCallFriendly, true);
    assert.equal(result.relationshipBehaviorSummary.serviceFlowFriendly, true);
  });

  it("relationship behavior does not override hard-deny constraints", async () => {
    const service = new IdentitiesService({
      connectionPolicyTemplate: {
        findFirst: async () => createTemplateRecord("couple.partner"),
      },
    } as any);

    const result = await service.previewPermissionsWithRelationship({
      sourceIdentityType: IdentityType.Couple,
      targetIdentityType: IdentityType.Personal,
      connectionType: ConnectionType.Partner,
      relationshipType: RelationshipType.InnerCircle,
      trustState: TrustState.TrustedByUser,
    });

    assert.equal(
      result.postRelationshipBehaviorPermissions[
        PERMISSION_KEYS.mediaPrivacy.export
      ]?.effect,
      PermissionEffect.Deny,
    );
    assert.equal(
      result.postRelationshipBehaviorPermissions[
        PERMISSION_KEYS.vault.itemReshare
      ]?.effect,
      PermissionEffect.Deny,
    );
  });

  it("service getIdentityTypeBehavior exposes pairwise behavior summary", () => {
    const service = new IdentitiesService({} as any);

    const result = service.getIdentityTypeBehavior(
      IdentityType.Family,
      IdentityType.Family,
    );

    assert.equal(
      result.summary.restrictionFlags.prefersProtectedConversation,
      true,
    );
    assert.equal(
      result.summary.pairAppliedKeys.includes(PERMISSION_KEYS.vault.itemView),
      true,
    );
  });

  it("BUSINESS behavior promotes business actions without overexposing private profile fields", async () => {
    const service = new IdentitiesService({
      connectionPolicyTemplate: {
        findFirst: async () => createTemplateRecord("business.known"),
      },
    } as any);

    const result = await service.previewPermissionsWithIdentityBehavior({
      sourceIdentityType: IdentityType.Business,
      targetIdentityType: IdentityType.Business,
      connectionType: ConnectionType.Known,
      trustState: TrustState.Unverified,
    });

    assert.equal(
      result.postIdentityBehaviorPermissions[
        PERMISSION_KEYS.actions.bookingRequestCreate
      ]?.effect,
      PermissionEffect.Allow,
    );
    assert.equal(
      result.postIdentityBehaviorPermissions[
        PERMISSION_KEYS.actions.paymentRequestCreate
      ]?.effect,
      PermissionEffect.Allow,
    );
    assert.equal(
      result.postIdentityBehaviorPermissions[
        PERMISSION_KEYS.actions.invoiceIssue
      ]?.effect,
      undefined,
    );
    assert.equal(
      result.postIdentityBehaviorPermissions[
        PERMISSION_KEYS.actions.supportTicketCreate
      ]?.effect,
      PermissionEffect.Allow,
    );
    assert.equal(
      result.postIdentityBehaviorPermissions[PERMISSION_KEYS.profile.phoneView]
        ?.effect,
      PermissionEffect.RequestApproval,
    );
    assert.equal(
      result.postIdentityBehaviorPermissions[PERMISSION_KEYS.profile.emailView]
        ?.effect,
      PermissionEffect.RequestApproval,
    );
  });

  it("PROFESSIONAL behavior applies only mild promotion", async () => {
    const service = new IdentitiesService({
      connectionPolicyTemplate: {
        findFirst: async () => createTemplateRecord("professional.client"),
      },
    } as any);

    const result = await service.previewPermissionsWithIdentityBehavior({
      sourceIdentityType: IdentityType.Professional,
      targetIdentityType: IdentityType.Business,
      connectionType: ConnectionType.Client,
      trustState: TrustState.Unverified,
    });

    assert.equal(
      result.postIdentityBehaviorPermissions[PERMISSION_KEYS.ai.summaryUse]
        ?.effect,
      PermissionEffect.AllowWithLimits,
    );
    assert.equal(
      result.postIdentityBehaviorPermissions[PERMISSION_KEYS.ai.replyUse]
        ?.effect,
      PermissionEffect.AllowWithLimits,
    );
    assert.equal(
      result.postIdentityBehaviorPermissions[
        PERMISSION_KEYS.actions.supportTicketCreate
      ]?.effect,
      PermissionEffect.Allow,
    );
    assert.equal(
      result.postIdentityBehaviorPermissions[PERMISSION_KEYS.profile.phoneView]
        ?.effect,
      PermissionEffect.RequestApproval,
    );
  });

  it("PERSONAL behavior does not over-promote template permissions", async () => {
    const service = new IdentitiesService({
      connectionPolicyTemplate: {
        findFirst: async () => createTemplateRecord("personal.trusted"),
      },
    } as any);

    const templatePermissions =
      createTemplateRecord("personal.trusted").permissionsJson;
    const result = await service.previewPermissionsWithIdentityBehavior({
      sourceIdentityType: IdentityType.Personal,
      targetIdentityType: IdentityType.Personal,
      connectionType: ConnectionType.Trusted,
      trustState: TrustState.TrustedByUser,
    });

    assert.equal(result.behaviorSummary.sourceAppliedKeys.length, 0);
    assert.equal(result.behaviorSummary.pairAppliedKeys.length, 0);
    assert.deepEqual(
      result.postIdentityBehaviorPermissions,
      templatePermissions,
    );
  });
});
