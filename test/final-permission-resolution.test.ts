import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { ConnectionType } from "../src/common/enums/connection-type.enum";
import { IdentityType } from "../src/common/enums/identity-type.enum";
import { PermissionEffect } from "../src/common/enums/permission-effect.enum";
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
          return {
            id: "snapshot-1",
            connectionId: data.connectionId,
            policyVersion: data.policyVersion,
            permissionsJson: data.permissionsJson,
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
      result.trace[PERMISSION_KEYS.ai.summaryUse]?.overrideApplied,
      true,
    );
    assert.equal(typeof result.resolvedAt.getTime(), "number");
  });
});
