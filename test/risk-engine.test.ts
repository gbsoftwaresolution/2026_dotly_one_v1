import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { IdentityType } from "../src/common/enums/identity-type.enum";
import { PermissionEffect } from "../src/common/enums/permission-effect.enum";
import { TrustState } from "../src/common/enums/trust-state.enum";
import { IdentitiesService } from "../src/modules/identities/identities.service";
import {
  applyRiskOverlay,
  RiskSeverity,
  RiskSignal,
} from "../src/modules/identities/risk-engine";
import { CONNECTION_POLICY_TEMPLATE_SEEDS } from "../src/modules/identities/policy-template-seeds";
import { PERMISSION_KEYS } from "../src/modules/identities/permission-keys";
import { applyTrustStateAdjustment } from "../src/modules/identities/permission-merge";
import { applyManualOverrides } from "../src/modules/identities/manual-override-merge";

function getTemplatePermissions(templateKey: string) {
  const template = CONNECTION_POLICY_TEMPLATE_SEEDS.find(
    (candidate) => candidate.templateKey === templateKey,
  );

  if (!template) {
    throw new Error(`Missing template ${templateKey}`);
  }

  return template.permissions;
}

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

function createRiskSignal(signal: RiskSignal, severity: RiskSeverity) {
  return { signal, severity };
}

describe("risk engine overlay", () => {
  it("DEVICE_COMPROMISED blocks protected media vault access and calls", () => {
    const trustAdjusted = applyTrustStateAdjustment(
      getTemplatePermissions("generic.trusted"),
      TrustState.TrustedByUser,
    );
    const result = applyRiskOverlay(
      trustAdjusted.mergedPermissions,
      [createRiskSignal(RiskSignal.DeviceCompromised, RiskSeverity.Critical)],
      { mergeTrace: trustAdjusted.mergeTrace },
    );

    assert.equal(
      result.mergedPermissions[PERMISSION_KEYS.mediaPrivacy.protectedSend]
        .effect,
      PermissionEffect.Deny,
    );
    assert.equal(
      result.mergedPermissions[PERMISSION_KEYS.vault.itemView].effect,
      PermissionEffect.Deny,
    );
    assert.equal(
      result.mergedPermissions[PERMISSION_KEYS.calling.voiceStart].effect,
      PermissionEffect.Deny,
    );
  });

  it("SPAM_FLAGGED blocks sends and calls but preserves report and block", () => {
    const trustAdjusted = applyTrustStateAdjustment(
      getTemplatePermissions("generic.trusted"),
      TrustState.TrustedByUser,
    );
    const result = applyRiskOverlay(
      trustAdjusted.mergedPermissions,
      [createRiskSignal(RiskSignal.SpamFlagged, RiskSeverity.High)],
      { mergeTrace: trustAdjusted.mergeTrace },
    );

    assert.equal(
      result.mergedPermissions[PERMISSION_KEYS.messaging.textSend].effect,
      PermissionEffect.Deny,
    );
    assert.equal(
      result.mergedPermissions[PERMISSION_KEYS.calling.videoStart].effect,
      PermissionEffect.Deny,
    );
    assert.equal(
      result.mergedPermissions[PERMISSION_KEYS.relationship.report].effect,
      PermissionEffect.Allow,
    );
    assert.equal(
      result.mergedPermissions[PERMISSION_KEYS.relationship.block].effect,
      PermissionEffect.Allow,
    );
  });

  it("PAYMENT_RISK blocks payment and invoice actions", () => {
    const trustAdjusted = applyTrustStateAdjustment(
      getTemplatePermissions("business.client"),
      TrustState.TrustedByUser,
    );
    const result = applyRiskOverlay(
      trustAdjusted.mergedPermissions,
      [createRiskSignal(RiskSignal.PaymentRisk, RiskSeverity.High)],
      { mergeTrace: trustAdjusted.mergeTrace },
    );

    assert.equal(
      result.mergedPermissions[PERMISSION_KEYS.actions.paymentRequestCreate]
        .effect,
      PermissionEffect.Deny,
    );
    assert.equal(
      result.mergedPermissions[PERMISSION_KEYS.actions.invoiceIssue]?.effect,
      PermissionEffect.Deny,
    );
  });

  it("AI_SAFETY_RISK blocks AI actions", () => {
    const trustAdjusted = applyTrustStateAdjustment(
      getTemplatePermissions("generic.trusted"),
      TrustState.TrustedByUser,
    );
    const result = applyRiskOverlay(
      trustAdjusted.mergedPermissions,
      [createRiskSignal(RiskSignal.AiSafetyRisk, RiskSeverity.High)],
      { mergeTrace: trustAdjusted.mergeTrace },
    );

    assert.equal(
      result.mergedPermissions[PERMISSION_KEYS.ai.summaryUse].effect,
      PermissionEffect.Deny,
    );
    assert.equal(
      result.mergedPermissions[PERMISSION_KEYS.ai.replyUse].effect,
      PermissionEffect.Deny,
    );
  });

  it("SCREEN_CAPTURE_RISK blocks protected send and export", () => {
    const trustAdjusted = applyTrustStateAdjustment(
      getTemplatePermissions("generic.trusted"),
      TrustState.TrustedByUser,
    );
    const result = applyRiskOverlay(
      trustAdjusted.mergedPermissions,
      [createRiskSignal(RiskSignal.ScreenCaptureRisk, RiskSeverity.High)],
      { mergeTrace: trustAdjusted.mergeTrace },
    );

    assert.equal(
      result.mergedPermissions[PERMISSION_KEYS.mediaPrivacy.protectedSend]
        .effect,
      PermissionEffect.Deny,
    );
    assert.equal(
      result.mergedPermissions[PERMISSION_KEYS.mediaPrivacy.export].effect,
      PermissionEffect.Deny,
    );
    assert.equal(result.riskSummary.blockedProtectedMode, true);
  });

  it("CASTING_RISK blocks video call and protected send", () => {
    const trustAdjusted = applyTrustStateAdjustment(
      getTemplatePermissions("generic.trusted"),
      TrustState.TrustedByUser,
    );
    const result = applyRiskOverlay(
      trustAdjusted.mergedPermissions,
      [createRiskSignal(RiskSignal.CastingRisk, RiskSeverity.Medium)],
      { mergeTrace: trustAdjusted.mergeTrace },
    );

    assert.equal(
      result.mergedPermissions[PERMISSION_KEYS.calling.videoStart].effect,
      PermissionEffect.Deny,
    );
    assert.equal(
      result.mergedPermissions[PERMISSION_KEYS.mediaPrivacy.protectedSend]
        .effect,
      PermissionEffect.Deny,
    );
  });

  it("HIGH_FRAUD_PROBABILITY blocks payment and sensitive profile fields", () => {
    const trustAdjusted = applyTrustStateAdjustment(
      getTemplatePermissions("business.client"),
      TrustState.StrongVerified,
    );
    const result = applyRiskOverlay(
      trustAdjusted.mergedPermissions,
      [createRiskSignal(RiskSignal.HighFraudProbability, RiskSeverity.High)],
      { mergeTrace: trustAdjusted.mergeTrace },
    );

    assert.equal(
      result.mergedPermissions[PERMISSION_KEYS.actions.paymentRequestCreate]
        .effect,
      PermissionEffect.Deny,
    );
    assert.equal(
      result.mergedPermissions[PERMISSION_KEYS.profile.phoneView].effect,
      PermissionEffect.Deny,
    );
    assert.equal(
      result.mergedPermissions[PERMISSION_KEYS.profile.emailView].effect,
      PermissionEffect.Deny,
    );
  });

  it("RATE_LIMITED reduces text and calls without denying all messaging", () => {
    const trustAdjusted = applyTrustStateAdjustment(
      getTemplatePermissions("generic.trusted"),
      TrustState.TrustedByUser,
    );
    const result = applyRiskOverlay(
      trustAdjusted.mergedPermissions,
      [createRiskSignal(RiskSignal.RateLimited, RiskSeverity.Medium)],
      { mergeTrace: trustAdjusted.mergeTrace },
    );

    assert.equal(
      result.mergedPermissions[PERMISSION_KEYS.messaging.textSend].effect,
      PermissionEffect.AllowWithLimits,
    );
    assert.equal(
      result.mergedPermissions[PERMISSION_KEYS.calling.voiceStart].effect,
      PermissionEffect.Deny,
    );
    assert.equal(
      result.mergedPermissions[PERMISSION_KEYS.messaging.imageSend].effect,
      PermissionEffect.Allow,
    );
  });

  it("explicit preview risk signals apply on top of overrides", () => {
    const trustAdjusted = applyTrustStateAdjustment(
      getTemplatePermissions("generic.known"),
      TrustState.Unverified,
    );
    const withOverride = applyManualOverrides(
      trustAdjusted.mergedPermissions,
      {
        [PERMISSION_KEYS.ai.summaryUse]: {
          permissionKey: PERMISSION_KEYS.ai.summaryUse,
          effect: PermissionEffect.Allow,
          limits: null,
          reason: "manual allow",
          createdAt: new Date("2026-03-26T12:00:00.000Z"),
          createdByIdentityId: "identity-source",
        },
      },
      {
        trustState: TrustState.Unverified,
        templateKey: "generic.known",
        mergeTrace: trustAdjusted.mergeTrace,
      },
    );
    const result = applyRiskOverlay(
      withOverride.mergedPermissions,
      [createRiskSignal(RiskSignal.AiSafetyRisk, RiskSeverity.High)],
      { mergeTrace: withOverride.mergeTrace },
    );

    assert.equal(
      result.mergedPermissions[PERMISSION_KEYS.ai.summaryUse].effect,
      PermissionEffect.Deny,
    );
  });

  it("risk overlay cannot be bypassed by manual overrides", () => {
    const trustAdjusted = applyTrustStateAdjustment(
      getTemplatePermissions("generic.trusted"),
      TrustState.TrustedByUser,
    );
    const withOverride = applyManualOverrides(
      trustAdjusted.mergedPermissions,
      {
        [PERMISSION_KEYS.calling.voiceStart]: {
          permissionKey: PERMISSION_KEYS.calling.voiceStart,
          effect: PermissionEffect.Allow,
          limits: null,
          reason: "manual allow",
          createdAt: new Date("2026-03-26T12:00:00.000Z"),
          createdByIdentityId: "identity-source",
        },
      },
      {
        trustState: TrustState.TrustedByUser,
        templateKey: "generic.trusted",
        mergeTrace: trustAdjusted.mergeTrace,
      },
    );
    const result = applyRiskOverlay(
      withOverride.mergedPermissions,
      [createRiskSignal(RiskSignal.DeviceCompromised, RiskSeverity.Critical)],
      { mergeTrace: withOverride.mergeTrace },
    );

    assert.equal(
      result.mergedPermissions[PERMISSION_KEYS.calling.voiceStart].effect,
      PermissionEffect.Deny,
    );
  });
});

describe("risk-aware resolver", () => {
  it("applyRiskOverlay false preserves pre-risk resolver behavior", async () => {
    const service = new IdentitiesService({
      identityConnection: {
        findUnique: async () => ({
          id: "connection-1",
          sourceIdentityId: "identity-source",
          targetIdentityId: "identity-target",
          connectionType: "TRUSTED",
          trustState: "UNVERIFIED",
          status: "ACTIVE",
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
          identityType: "BUSINESS",
        }),
      },
      connectionPolicyTemplate: {
        findFirst: async () => createTemplateRecord("business.client"),
      },
      connectionPermissionOverride: {
        findMany: async () => [],
      },
    } as any);

    const result = await service.resolveConnectionPermissions({
      connectionId: "b7f3671d-4f7c-42a8-b2a4-b8d67d399094",
      applyRiskOverlay: false,
      previewRiskSignals: [
        createRiskSignal(RiskSignal.PaymentRisk, RiskSeverity.High),
      ],
    });

    assert.equal(result.riskSummary.appliedSignals.length, 0);
    assert.notEqual(
      result.permissions[PERMISSION_KEYS.actions.paymentRequestCreate]
        ?.finalEffect,
      PermissionEffect.Deny,
    );
  });

  it("resolveConnectionPermissions returns risk summary", async () => {
    const service = new IdentitiesService({
      identityConnection: {
        findUnique: async () => ({
          id: "connection-1",
          sourceIdentityId: "identity-source",
          targetIdentityId: "identity-target",
          connectionType: "CLIENT",
          trustState: "UNVERIFIED",
          status: "ACTIVE",
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
          identityType: "BUSINESS",
        }),
      },
      connectionPolicyTemplate: {
        findFirst: async () => createTemplateRecord("business.client"),
      },
      connectionPermissionOverride: {
        findMany: async () => [],
      },
    } as any);

    const result = await service.resolveConnectionPermissions({
      connectionId: "bc9d2de5-4b86-4666-8281-f527152f542c",
      previewRiskSignals: [
        createRiskSignal(RiskSignal.PaymentRisk, RiskSeverity.High),
      ],
    });

    assert.equal(result.riskSummary.blockedPayments, true);
    assert.equal(result.riskSummary.highestSeverity, RiskSeverity.High);
  });

  it("persistSnapshot true writes post-risk final permissions", async () => {
    let savedPermissions: Record<string, unknown> | null = null;
    const service = new IdentitiesService({
      identityConnection: {
        findUnique: async () => ({
          id: "connection-1",
          sourceIdentityId: "identity-source",
          targetIdentityId: "identity-target",
          connectionType: "TRUSTED",
          trustState: "UNVERIFIED",
          status: "ACTIVE",
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
          savedPermissions = data.permissionsJson;
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
      connectionId: "7d3c5483-3ee9-412f-902d-1418a6b6d8f7",
      persistSnapshot: true,
      previewRiskSignals: [
        createRiskSignal(RiskSignal.PaymentRisk, RiskSeverity.High),
      ],
    });

    assert.equal(
      (
        savedPermissions?.[
          PERMISSION_KEYS.actions.paymentRequestCreate
        ] as unknown as
          | {
              effect?: string;
            }
          | undefined
      )?.effect,
      PermissionEffect.Deny,
    );
  });

  it("previewPermissionsWithRisk applies explicit preview signals", async () => {
    const service = new IdentitiesService({
      connectionPolicyTemplate: {
        findFirst: async () => createTemplateRecord("business.client"),
      },
    } as any);

    const result = await service.previewPermissionsWithRisk({
      sourceIdentityType: IdentityType.Business,
      connectionType: "client" as any,
      trustState: TrustState.Unverified,
      previewRiskSignals: [
        createRiskSignal(RiskSignal.ScreenCaptureRisk, RiskSeverity.High),
      ],
    });

    assert.equal(
      result.finalPermissions[PERMISSION_KEYS.mediaPrivacy.protectedSend]
        .effect,
      PermissionEffect.Deny,
    );
    assert.equal(result.riskSummary.blockedProtectedMode, true);
  });
});
