import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { BadRequestException } from "@nestjs/common";

import { ConnectionType } from "../src/common/enums/connection-type.enum";
import { IdentityType } from "../src/common/enums/identity-type.enum";
import { PermissionEffect } from "../src/common/enums/permission-effect.enum";
import { TrustState } from "../src/common/enums/trust-state.enum";
import { IdentitiesService } from "../src/modules/identities/identities.service";
import {
  RecordPolicy,
  ScreenshotPolicy,
} from "../src/modules/identities/identity.types";
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

function createContentRuleRecord(overrides?: Partial<Record<string, unknown>>) {
  return {
    id: "content-rule-1",
    contentId: "11111111-1111-4111-8111-111111111111",
    targetIdentityId: "identity-target",
    canView: true,
    canDownload: true,
    canForward: true,
    canExport: true,
    screenshotPolicy: "INHERIT",
    recordPolicy: "INHERIT",
    expiryAt: null,
    viewLimit: null,
    watermarkMode: null,
    aiAccessAllowed: true,
    metadataJson: null,
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
      findUnique: async () => ({
        id: "identity-source",
        identityType: "PERSONAL",
      }),
    },
    connectionPolicyTemplate: {
      findFirst: async ({ where }: any) =>
        createTemplateRecord(
          where.connectionType === "TRUSTED"
            ? "personal.trusted"
            : "generic.trusted",
        ),
    },
    connectionPermissionOverride: {
      findMany: async () => [],
    },
    contentAccessRule: {
      findUnique: async () => null,
      upsert: async ({ create, update }: any) => ({
        id: "content-rule-1",
        ...create,
        ...update,
        createdAt: new Date("2026-03-26T12:00:00.000Z"),
        updatedAt: new Date("2026-03-26T12:00:00.000Z"),
      }),
      findMany: async () => [],
      deleteMany: async () => ({ count: 1 }),
    },
    ...overrides,
  } as any);
}

describe("content permission resolution", () => {
  it("inherits base content permissions when no content rule exists", async () => {
    const service = createBaseService();

    const result = await service.resolveContentPermissionsForConnection({
      connectionId: "7e18a269-65ef-4636-a903-9ca594a9bb19",
      contentId: "11111111-1111-4111-8111-111111111111",
      targetIdentityId: "identity-target",
    });

    assert.equal(
      result.effectiveContentPermissions["content.view"].effect,
      PermissionEffect.Allow,
    );
    assert.equal(
      result.contentTrace["content.view"].reasonCode,
      "CONTENT_NO_RULE",
    );
  });

  it("content rule can deny download even if base allows", async () => {
    const service = createBaseService({
      contentAccessRule: {
        findUnique: async () => createContentRuleRecord({ canDownload: false }),
      },
    });

    const result = await service.resolveContentPermissionsForConnection({
      connectionId: "9f7716a8-f401-4777-a6d9-d7c57f1e4d8b",
      contentId: "11111111-1111-4111-8111-111111111111",
      targetIdentityId: "identity-target",
    });

    assert.equal(
      result.effectiveContentPermissions["content.download"].effect,
      PermissionEffect.Deny,
    );
  });

  it("content rule can deny export even if base allows", async () => {
    const service = createBaseService({
      contentAccessRule: {
        findUnique: async () => createContentRuleRecord({ canExport: false }),
      },
    });

    const result = await service.resolveContentPermissionsForConnection({
      connectionId: "0b372620-4f5b-459f-bab0-2364b4e2b9a0",
      contentId: "11111111-1111-4111-8111-111111111111",
      targetIdentityId: "identity-target",
    });

    assert.equal(
      result.effectiveContentPermissions["content.export"].effect,
      PermissionEffect.Deny,
    );
  });

  it("expired content denies content access", async () => {
    const service = createBaseService({
      contentAccessRule: {
        findUnique: async () =>
          createContentRuleRecord({
            expiryAt: new Date("2026-03-25T12:00:00.000Z"),
          }),
      },
    });

    const result = await service.resolveContentPermissionsForConnection({
      connectionId: "003676f4-f6f8-484d-b3d9-a55a2d76d3e4",
      contentId: "11111111-1111-4111-8111-111111111111",
      targetIdentityId: "identity-target",
    });

    assert.equal(
      result.effectiveContentPermissions["content.view"].effect,
      PermissionEffect.Deny,
    );
    assert.equal(result.restrictionSummary.expired, true);
  });

  it("viewLimit reached denies content.view", async () => {
    const service = createBaseService({
      contentAccessRule: {
        findUnique: async () => createContentRuleRecord({ viewLimit: 1 }),
      },
    });

    const result = await service.resolveContentPermissionsForConnection({
      connectionId: "0be00c77-6672-4e49-a855-4f0a3878436d",
      contentId: "11111111-1111-4111-8111-111111111111",
      targetIdentityId: "identity-target",
      currentViewCount: 1,
    });

    assert.equal(
      result.effectiveContentPermissions["content.view"].effect,
      PermissionEffect.Deny,
    );
  });

  it("fails closed when content target does not match the connection target", async () => {
    const service = createBaseService({
      identityConnection: {
        findUnique: async () =>
          createConnectionRecord({ targetIdentityId: "identity-target" }),
      },
    });

    await assert.rejects(
      service.resolveContentPermissionsForConnection({
        connectionId: "connection-1",
        contentId: "11111111-1111-4111-8111-111111111111",
        targetIdentityId: "identity-other",
      }),
      (error: unknown) => {
        assert.ok(error instanceof BadRequestException);
        assert.match(String(error.message), /target must match/i);
        return true;
      },
    );
  });

  it("screenshotPolicy DENY denies content.screenshot", async () => {
    const result = await createBaseService().previewContentPermissions({
      sourceIdentityType: IdentityType.Personal,
      connectionType: ConnectionType.Trusted,
      trustState: TrustState.TrustedByUser,
      contentId: "11111111-1111-4111-8111-111111111111",
      targetIdentityId: "identity-target",
      contentRule: {
        screenshotPolicy: ScreenshotPolicy.Deny,
      },
    });

    assert.equal(
      result.effectiveContentPermissions["content.screenshot"].effect,
      PermissionEffect.Deny,
    );
  });

  it("recordPolicy DENY denies content.record", async () => {
    const result = await createBaseService().previewContentPermissions({
      sourceIdentityType: IdentityType.Personal,
      connectionType: ConnectionType.Trusted,
      trustState: TrustState.TrustedByUser,
      contentId: "11111111-1111-4111-8111-111111111111",
      targetIdentityId: "identity-target",
      contentRule: {
        recordPolicy: RecordPolicy.Deny,
      },
    });

    assert.equal(
      result.effectiveContentPermissions["content.record"].effect,
      PermissionEffect.Deny,
    );
  });

  it("aiAccessAllowed false denies content.ai_access", async () => {
    const result = await createBaseService().previewContentPermissions({
      sourceIdentityType: IdentityType.Personal,
      connectionType: ConnectionType.Trusted,
      trustState: TrustState.TrustedByUser,
      contentId: "11111111-1111-4111-8111-111111111111",
      targetIdentityId: "identity-target",
      contentRule: {
        aiAccessAllowed: false,
      },
    });

    assert.equal(
      result.effectiveContentPermissions["content.ai_access"].effect,
      PermissionEffect.Deny,
    );
  });

  it("content rule cannot promote base deny", async () => {
    const result = await createBaseService().previewContentPermissions({
      sourceIdentityType: IdentityType.Personal,
      connectionType: ConnectionType.Trusted,
      trustState: TrustState.TrustedByUser,
      contentId: "11111111-1111-4111-8111-111111111111",
      targetIdentityId: "identity-target",
      contentRule: {
        screenshotPolicy: ScreenshotPolicy.Allow,
      },
    });

    assert.equal(
      result.effectiveContentPermissions["content.screenshot"].effect,
      PermissionEffect.Deny,
    );
    assert.equal(
      result.contentTrace["content.screenshot"].reasonCode,
      "CONTENT_BASE_DENY_PRESERVED",
    );
  });

  it("setContentAccessRule upserts deterministically", async () => {
    let upsertCalls = 0;
    const service = createBaseService({
      contentAccessRule: {
        upsert: async ({ create, update }: any) => {
          upsertCalls += 1;
          return {
            id: "content-rule-1",
            ...create,
            ...update,
            createdAt: new Date("2026-03-26T12:00:00.000Z"),
            updatedAt: new Date("2026-03-26T12:00:00.000Z"),
          };
        },
      },
    });

    const result = await service.setContentAccessRule({
      contentId: "11111111-1111-4111-8111-111111111111",
      targetIdentityId: "identity-target",
      canDownload: false,
      screenshotPolicy: ScreenshotPolicy.Deny,
      createdByIdentityId: "33333333-3333-4333-8333-333333333333",
    });

    assert.equal(upsertCalls, 1);
    assert.equal(result.canDownload, false);
    assert.equal(result.screenshotPolicy, ScreenshotPolicy.Deny);
  });

  it("resolveContentPermissionsForConnection returns trace and summary", async () => {
    const service = createBaseService({
      contentAccessRule: {
        findUnique: async () => createContentRuleRecord({ canDownload: false }),
      },
    });

    const result = await service.resolveContentPermissionsForConnection({
      connectionId: "ad0735dc-7548-4ec5-bd22-6f8b5f786ab9",
      contentId: "11111111-1111-4111-8111-111111111111",
      targetIdentityId: "identity-target",
    });

    assert.equal(
      result.baseConnectionPermissions["content.download"].basePermissionKey,
      PERMISSION_KEYS.vault.itemDownload,
    );
    assert.equal(
      result.contentTrace["content.download"].reasonCode,
      "CONTENT_RULE_APPLIED",
    );
    assert.equal(result.restrictionSummary.rulePresent, true);
  });
});
