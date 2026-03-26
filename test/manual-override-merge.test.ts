import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { PermissionEffect } from "../src/common/enums/permission-effect.enum";
import { TrustState } from "../src/common/enums/trust-state.enum";
import { IdentitiesService } from "../src/modules/identities/identities.service";
import { applyManualOverrides } from "../src/modules/identities/manual-override-merge";
import { applyTrustStateAdjustment } from "../src/modules/identities/permission-merge";
import { CONNECTION_POLICY_TEMPLATE_SEEDS } from "../src/modules/identities/policy-template-seeds";
import { PERMISSION_KEYS } from "../src/modules/identities/permission-keys";
import type { PermissionKey } from "../src/modules/identities/permission-keys";

function getTemplatePermissions(templateKey: string) {
  const template = CONNECTION_POLICY_TEMPLATE_SEEDS.find(
    (candidate) => candidate.templateKey === templateKey,
  );

  if (!template) {
    throw new Error(`Missing template ${templateKey}`);
  }

  return template.permissions;
}

function createOverride(
  permissionKey: PermissionKey,
  effect: PermissionEffect,
  limits?: Record<string, unknown>,
) {
  return {
    permissionKey,
    effect,
    limits: limits ?? null,
    reason: "manual test override",
    createdAt: new Date("2026-03-26T12:00:00.000Z"),
    createdByIdentityId: "identity-creator",
  };
}

describe("manual override merge", () => {
  it("manual override ALLOW applies over trust-adjusted request approval", () => {
    const trustAdjusted = applyTrustStateAdjustment(
      getTemplatePermissions("generic.known"),
      TrustState.Unverified,
    );
    const result = applyManualOverrides(
      trustAdjusted.mergedPermissions,
      {
        [PERMISSION_KEYS.ai.summaryUse]: createOverride(
          PERMISSION_KEYS.ai.summaryUse,
          PermissionEffect.Allow,
        ),
      },
      {
        trustState: TrustState.Unverified,
        templateKey: "generic.known",
        mergeTrace: trustAdjusted.mergeTrace,
      },
    );

    assert.equal(
      result.mergedPermissions[PERMISSION_KEYS.ai.summaryUse].effect,
      PermissionEffect.Allow,
    );
    assert.equal(
      result.mergeTrace[PERMISSION_KEYS.ai.summaryUse]?.overrideApplied,
      true,
    );
  });

  it("manual override DENY applies over allow", () => {
    const trustAdjusted = applyTrustStateAdjustment(
      getTemplatePermissions("generic.trusted"),
      TrustState.TrustedByUser,
    );
    const result = applyManualOverrides(
      trustAdjusted.mergedPermissions,
      {
        [PERMISSION_KEYS.vault.itemView]: createOverride(
          PERMISSION_KEYS.vault.itemView,
          PermissionEffect.Deny,
        ),
      },
      {
        trustState: TrustState.TrustedByUser,
        templateKey: "generic.trusted",
        mergeTrace: trustAdjusted.mergeTrace,
      },
    );

    assert.equal(
      result.mergedPermissions[PERMISSION_KEYS.vault.itemView].effect,
      PermissionEffect.Deny,
    );
  });

  it("manual override ALLOW_WITH_LIMITS merges limits conservatively", () => {
    const trustAdjusted = applyTrustStateAdjustment(
      {
        ...getTemplatePermissions("generic.known"),
        [PERMISSION_KEYS.vault.itemAttach]: {
          effect: PermissionEffect.AllowWithLimits,
          limits: {
            maxUses: 5,
            allowedFormats: ["pdf", "doc"],
          },
        },
      },
      TrustState.Unverified,
    );
    const result = applyManualOverrides(
      trustAdjusted.mergedPermissions,
      {
        [PERMISSION_KEYS.vault.itemAttach]: createOverride(
          PERMISSION_KEYS.vault.itemAttach,
          PermissionEffect.AllowWithLimits,
          {
            maxUses: 2,
            allowedFormats: ["pdf"],
          },
        ),
      },
      {
        trustState: TrustState.Unverified,
        templateKey: "generic.known",
        mergeTrace: trustAdjusted.mergeTrace,
      },
    );

    assert.deepEqual(
      result.mergedPermissions[PERMISSION_KEYS.vault.itemAttach].limits,
      {
        maxUses: 2,
        allowedFormats: ["pdf"],
      },
    );
    assert.equal(
      result.mergeTrace[PERMISSION_KEYS.vault.itemAttach]?.reasonCode,
      "OVERRIDE_LIMITS_MERGED",
    );
  });

  it("blocked trust-state hard deny cannot be overridden", () => {
    const trustAdjusted = applyTrustStateAdjustment(
      getTemplatePermissions("generic.trusted"),
      TrustState.Blocked,
    );
    const result = applyManualOverrides(
      trustAdjusted.mergedPermissions,
      {
        [PERMISSION_KEYS.messaging.textSend]: createOverride(
          PERMISSION_KEYS.messaging.textSend,
          PermissionEffect.Allow,
        ),
      },
      {
        trustState: TrustState.Blocked,
        templateKey: "generic.trusted",
        mergeTrace: trustAdjusted.mergeTrace,
      },
    );

    assert.equal(
      result.mergedPermissions[PERMISSION_KEYS.messaging.textSend].effect,
      PermissionEffect.Deny,
    );
    assert.equal(
      result.mergeTrace[PERMISSION_KEYS.messaging.textSend]?.reasonCode,
      "OVERRIDE_SKIPPED_HARD_DENY",
    );
  });

  it("couple partner export deny cannot be overridden", () => {
    const trustAdjusted = applyTrustStateAdjustment(
      getTemplatePermissions("couple.partner"),
      TrustState.TrustedByUser,
    );
    const result = applyManualOverrides(
      trustAdjusted.mergedPermissions,
      {
        [PERMISSION_KEYS.mediaPrivacy.export]: createOverride(
          PERMISSION_KEYS.mediaPrivacy.export,
          PermissionEffect.Allow,
        ),
      },
      {
        trustState: TrustState.TrustedByUser,
        templateKey: "couple.partner",
        mergeTrace: trustAdjusted.mergeTrace,
      },
    );

    assert.equal(
      result.mergedPermissions[PERMISSION_KEYS.mediaPrivacy.export].effect,
      PermissionEffect.Deny,
    );
    assert.equal(
      result.mergeTrace[PERMISSION_KEYS.mediaPrivacy.export]?.reasonCode,
      "OVERRIDE_BLOCKED_BY_GUARDRAIL",
    );
  });

  it("relationship block and report preserve allow", () => {
    const trustAdjusted = applyTrustStateAdjustment(
      getTemplatePermissions("generic.trusted"),
      TrustState.TrustedByUser,
    );
    const result = applyManualOverrides(
      trustAdjusted.mergedPermissions,
      {
        [PERMISSION_KEYS.relationship.block]: createOverride(
          PERMISSION_KEYS.relationship.block,
          PermissionEffect.Deny,
        ),
      },
      {
        trustState: TrustState.TrustedByUser,
        templateKey: "generic.trusted",
        mergeTrace: trustAdjusted.mergeTrace,
      },
    );

    assert.equal(
      result.mergedPermissions[PERMISSION_KEYS.relationship.block].effect,
      PermissionEffect.Allow,
    );
    assert.equal(
      result.mergeTrace[PERMISSION_KEYS.relationship.block]?.reasonCode,
      "OVERRIDE_PRESERVED_SYSTEM_PERMISSION",
    );
  });
});

describe("IdentitiesService manual override preview", () => {
  it("listPermissionOverridesForConnection returns deterministic order", async () => {
    const service = new IdentitiesService({
      connectionPermissionOverride: {
        findMany: async () => [
          {
            permissionKey: PERMISSION_KEYS.vault.itemView,
            effect: "ALLOW",
            limitsJson: null,
            reason: "b",
            createdAt: new Date("2026-03-26T12:00:01.000Z"),
            createdByIdentityId: "identity-b",
          },
          {
            permissionKey: PERMISSION_KEYS.ai.summaryUse,
            effect: "DENY",
            limitsJson: null,
            reason: "a",
            createdAt: new Date("2026-03-26T12:00:00.000Z"),
            createdByIdentityId: "identity-a",
          },
        ],
      },
    } as any);

    const result = await service.listPermissionOverridesForConnection({
      connectionId: "d9ec67f0-835c-4a91-9e52-cd60f8b592b9",
    });

    assert.equal(result[0]?.permissionKey, PERMISSION_KEYS.ai.summaryUse);
    assert.equal(result[1]?.permissionKey, PERMISSION_KEYS.vault.itemView);
  });

  it("previewResolvedPermissionsForConnection returns final permissions and trace", async () => {
    const service = new IdentitiesService({
      identityConnection: {
        findUnique: async () => ({
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
        }),
      },
      identity: {
        findUnique: async () => ({
          id: "identity-source",
          identityType: "COUPLE",
        }),
      },
      connectionPolicyTemplate: {
        findFirst: async ({ where }: any) => {
          const templateKey =
            where.sourceIdentityType === "COUPLE"
              ? "couple.partner"
              : "generic.partner";
          const template = CONNECTION_POLICY_TEMPLATE_SEEDS.find(
            (candidate) => candidate.templateKey === templateKey,
          );

          return template
            ? {
                id: `template-${template.templateKey}`,
                sourceIdentityType:
                  template.sourceIdentityType?.toUpperCase() ?? null,
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
              }
            : null;
        },
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
    } as any);

    const result = await service.previewResolvedPermissionsForConnection({
      connectionId: "8cfddb39-0c88-4f6a-83df-8d8ffcfb203f",
    });

    assert.equal(result.connection.id, "connection-1");
    assert.equal(result.template.templateKey, "couple.partner");
    assert.equal(
      result.finalPermissions[PERMISSION_KEYS.mediaPrivacy.export].effect,
      PermissionEffect.Deny,
    );
    assert.equal(
      result.mergeTrace[PERMISSION_KEYS.mediaPrivacy.export]?.overrideApplied,
      false,
    );
  });

  it("override trace shows applied vs blocked correctly", async () => {
    const trustAdjusted = applyTrustStateAdjustment(
      getTemplatePermissions("generic.known"),
      TrustState.Unverified,
    );
    const applied = applyManualOverrides(
      trustAdjusted.mergedPermissions,
      {
        [PERMISSION_KEYS.ai.replyUse]: createOverride(
          PERMISSION_KEYS.ai.replyUse,
          PermissionEffect.Allow,
        ),
      },
      {
        trustState: TrustState.Unverified,
        templateKey: "generic.known",
        mergeTrace: trustAdjusted.mergeTrace,
      },
    );
    const blocked = applyManualOverrides(
      applyTrustStateAdjustment(
        getTemplatePermissions("generic.trusted"),
        TrustState.Blocked,
      ).mergedPermissions,
      {
        [PERMISSION_KEYS.ai.summaryUse]: createOverride(
          PERMISSION_KEYS.ai.summaryUse,
          PermissionEffect.Allow,
        ),
      },
      {
        trustState: TrustState.Blocked,
        templateKey: "generic.trusted",
        mergeTrace: applyTrustStateAdjustment(
          getTemplatePermissions("generic.trusted"),
          TrustState.Blocked,
        ).mergeTrace,
      },
    );

    assert.equal(
      applied.mergeTrace[PERMISSION_KEYS.ai.replyUse]?.reasonCode,
      "OVERRIDE_APPLIED",
    );
    assert.equal(
      blocked.mergeTrace[PERMISSION_KEYS.ai.summaryUse]?.reasonCode,
      "OVERRIDE_SKIPPED_HARD_DENY",
    );
  });
});
