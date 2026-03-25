import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { ConnectionType } from "../src/common/enums/connection-type.enum";
import { IdentityType } from "../src/common/enums/identity-type.enum";
import { PermissionEffect } from "../src/common/enums/permission-effect.enum";
import { TrustState } from "../src/common/enums/trust-state.enum";
import { IdentitiesService } from "../src/modules/identities/identities.service";
import {
  applyTrustStateAdjustment,
  getTrustStateAdjustment,
} from "../src/modules/identities/permission-merge";
import { CONNECTION_POLICY_TEMPLATE_SEEDS } from "../src/modules/identities/policy-template-seeds";
import { PERMISSION_KEYS } from "../src/modules/identities/permission-keys";

function getTemplatePermissions(templateKey: string) {
  const template = CONNECTION_POLICY_TEMPLATE_SEEDS.find(
    (candidate) => candidate.templateKey === templateKey,
  );

  if (!template) {
    throw new Error(`Missing template ${templateKey}`);
  }

  return template.permissions;
}

describe("trust-state adjustments", () => {
  it("BASIC_VERIFIED mildly promotes allowed capabilities", () => {
    const result = applyTrustStateAdjustment(
      getTemplatePermissions("generic.known"),
      TrustState.BasicVerified,
    );

    assert.equal(
      result.mergedPermissions[PERMISSION_KEYS.ai.summaryUse].effect,
      PermissionEffect.AllowWithLimits,
    );
    assert.equal(
      result.mergedPermissions[PERMISSION_KEYS.profile.basicView].effect,
      PermissionEffect.Allow,
    );
  });

  it("STRONG_VERIFIED promotes calls from request approval to allow", () => {
    const result = applyTrustStateAdjustment(
      getTemplatePermissions("generic.known"),
      TrustState.StrongVerified,
    );

    assert.equal(
      result.mergedPermissions[PERMISSION_KEYS.calling.voiceStart].effect,
      PermissionEffect.Allow,
    );
    assert.equal(
      result.mergedPermissions[PERMISSION_KEYS.calling.videoStart].effect,
      PermissionEffect.Allow,
    );
  });

  it("TRUSTED_BY_USER promotes selected permissions", () => {
    const result = applyTrustStateAdjustment(
      getTemplatePermissions("generic.known"),
      TrustState.TrustedByUser,
    );

    assert.equal(
      result.mergedPermissions[PERMISSION_KEYS.vault.itemView].effect,
      PermissionEffect.Allow,
    );
    assert.equal(
      result.mergedPermissions[PERMISSION_KEYS.ai.replyUse].effect,
      PermissionEffect.Allow,
    );
  });

  it("HIGH_RISK restricts calls payment AI and export", () => {
    const result = applyTrustStateAdjustment(
      getTemplatePermissions("business.client"),
      TrustState.HighRisk,
    );

    assert.equal(
      result.mergedPermissions[PERMISSION_KEYS.calling.voiceStart].effect,
      PermissionEffect.Deny,
    );
    assert.equal(
      result.mergedPermissions[PERMISSION_KEYS.actions.paymentRequestCreate]
        .effect,
      PermissionEffect.Deny,
    );
    assert.equal(
      result.mergedPermissions[PERMISSION_KEYS.ai.summaryUse].effect,
      PermissionEffect.Deny,
    );
    assert.equal(
      result.mergedPermissions[PERMISSION_KEYS.mediaPrivacy.export].effect,
      PermissionEffect.Deny,
    );
  });

  it("RESTRICTED applies limited and deny behavior", () => {
    const result = applyTrustStateAdjustment(
      getTemplatePermissions("generic.trusted"),
      TrustState.Restricted,
    );

    assert.equal(
      result.mergedPermissions[PERMISSION_KEYS.calling.videoStart].effect,
      PermissionEffect.Deny,
    );
    assert.equal(
      result.mergedPermissions[PERMISSION_KEYS.mediaPrivacy.protectedSend]
        .effect,
      PermissionEffect.AllowWithLimits,
    );
  });

  it("BLOCKED denies nearly everything but preserves report and block", () => {
    const result = applyTrustStateAdjustment(
      getTemplatePermissions("generic.trusted"),
      TrustState.Blocked,
    );

    assert.equal(
      result.mergedPermissions[PERMISSION_KEYS.messaging.textSend].effect,
      PermissionEffect.Deny,
    );
    assert.equal(
      result.mergedPermissions[PERMISSION_KEYS.vault.itemDownload].effect,
      PermissionEffect.Deny,
    );
    assert.equal(
      result.mergedPermissions[PERMISSION_KEYS.relationship.block].effect,
      PermissionEffect.Allow,
    );
    assert.equal(
      result.mergedPermissions[PERMISSION_KEYS.relationship.report].effect,
      PermissionEffect.Allow,
    );
  });

  it("permissive adjustment does not override hard deny for couple partner export and reshare", () => {
    const result = applyTrustStateAdjustment(
      getTemplatePermissions("couple.partner"),
      TrustState.TrustedByUser,
    );

    assert.equal(
      result.mergedPermissions[PERMISSION_KEYS.mediaPrivacy.export].effect,
      PermissionEffect.Deny,
    );
    assert.equal(
      result.mergedPermissions[PERMISSION_KEYS.vault.itemReshare].effect,
      PermissionEffect.Deny,
    );
  });

  it("merge trace contains expected entries and reason codes", () => {
    const result = applyTrustStateAdjustment(
      getTemplatePermissions("generic.known"),
      TrustState.StrongVerified,
    );

    assert.equal(
      result.mergeTrace[PERMISSION_KEYS.calling.voiceStart].baseEffect,
      PermissionEffect.RequestApproval,
    );
    assert.equal(
      result.mergeTrace[PERMISSION_KEYS.calling.voiceStart].adjustmentEffect,
      PermissionEffect.Allow,
    );
    assert.equal(
      result.mergeTrace[PERMISSION_KEYS.calling.voiceStart].finalEffect,
      PermissionEffect.Allow,
    );
    assert.equal(
      result.mergeTrace[PERMISSION_KEYS.calling.voiceStart].reasonCode,
      "TRUST_PROMOTED",
    );
  });

  it("merge trace uses template base when adjustment effect matches base", () => {
    const result = applyTrustStateAdjustment(
      getTemplatePermissions("generic.trusted"),
      TrustState.TrustedByUser,
    );

    assert.equal(
      result.mergeTrace[PERMISSION_KEYS.calling.voiceStart].reasonCode,
      "TEMPLATE_BASE",
    );
  });

  it("merges limits conservatively when both base and adjustment provide limits", () => {
    const adjustment = getTrustStateAdjustment(TrustState.Restricted);
    const result = applyTrustStateAdjustment(
      {
        ...getTemplatePermissions("generic.trusted"),
        [PERMISSION_KEYS.mediaPrivacy.protectedSend]: {
          effect: PermissionEffect.AllowWithLimits,
          limits: {
            allowsProtectedMode: true,
            watermarkRequired: true,
            maxMediaSizeMb: 50,
          },
        },
      },
      TrustState.Restricted,
    );

    assert.equal(adjustment.mergeMode, "RESTRICTIVE");
    assert.deepEqual(
      result.mergedPermissions[PERMISSION_KEYS.mediaPrivacy.protectedSend]
        .limits,
      {
        allowsProtectedMode: true,
        watermarkRequired: true,
        maxMediaSizeMb: 50,
      },
    );
  });

  it("absent adjustment keys do not modify base permissions", () => {
    const result = applyTrustStateAdjustment(
      getTemplatePermissions("generic.known"),
      TrustState.BasicVerified,
    );

    assert.equal(
      result.mergedPermissions[PERMISSION_KEYS.messaging.documentSend].effect,
      PermissionEffect.Allow,
    );
    assert.equal(
      result.mergeTrace[PERMISSION_KEYS.messaging.documentSend].reasonCode,
      "TRUST_NO_CHANGE",
    );
  });
});

describe("IdentitiesService trust preview", () => {
  it("returns template metadata and adjusted permissions", async () => {
    const service = new IdentitiesService({
      connectionPolicyTemplate: {
        findFirst: async ({ where }: any) => {
          const templateKey =
            where.sourceIdentityType === "BUSINESS"
              ? "business.client"
              : "generic.client";
          const template = CONNECTION_POLICY_TEMPLATE_SEEDS.find(
            (candidate) => candidate.templateKey === templateKey,
          );

          if (!template) {
            return null;
          }

          return {
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
          };
        },
      },
    } as any);

    const result = await service.previewPermissionsWithTrustState({
      sourceIdentityType: IdentityType.Business,
      connectionType: ConnectionType.Client,
      trustState: TrustState.HighRisk,
    });

    assert.equal(result.template.templateKey, "business.client");
    assert.equal(result.trustState, TrustState.HighRisk);
    assert.equal(
      result.mergedPermissions[PERMISSION_KEYS.actions.paymentRequestCreate]
        .effect,
      PermissionEffect.Deny,
    );
    assert.equal(
      result.mergeTrace[PERMISSION_KEYS.actions.paymentRequestCreate]
        .reasonCode,
      "TRUST_RESTRICTED",
    );
  });

  it("exposes trust adjustment definitions", () => {
    const adjustment = getTrustStateAdjustment(TrustState.Blocked);

    assert.equal(adjustment.trustState, TrustState.Blocked);
    assert.equal(adjustment.mergeMode, "RESTRICTIVE");
  });

  it("service getTrustStateAdjustment returns adjustment definition without recursion", () => {
    const service = new IdentitiesService({} as any);

    const adjustment = service.getTrustStateAdjustment(TrustState.HighRisk);

    assert.equal(adjustment.trustState, TrustState.HighRisk);
    assert.equal(
      adjustment.permissions[PERMISSION_KEYS.ai.summaryUse]?.effect,
      PermissionEffect.Deny,
    );
  });
});
