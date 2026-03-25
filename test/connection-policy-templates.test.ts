import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { NotFoundException } from "@nestjs/common";

import { ConnectionType } from "../src/common/enums/connection-type.enum";
import { IdentityType } from "../src/common/enums/identity-type.enum";
import { PermissionEffect } from "../src/common/enums/permission-effect.enum";
import { IdentitiesService } from "../src/modules/identities/identities.service";
import {
  CONNECTION_POLICY_TEMPLATE_SEEDS,
  resolveTemplateKeyCandidates,
  validateTemplatePermissions,
} from "../src/modules/identities/policy-template-seeds";
import { PERMISSION_KEYS } from "../src/modules/identities/permission-keys";

const REQUIRED_TEMPLATE_PERMISSION_KEYS = [
  PERMISSION_KEYS.messaging.textSend,
  PERMISSION_KEYS.messaging.voiceSend,
  PERMISSION_KEYS.messaging.imageSend,
  PERMISSION_KEYS.messaging.videoSend,
  PERMISSION_KEYS.messaging.documentSend,
  PERMISSION_KEYS.calling.voiceStart,
  PERMISSION_KEYS.calling.videoStart,
  PERMISSION_KEYS.calling.directRing,
  PERMISSION_KEYS.mediaPrivacy.protectedSend,
  PERMISSION_KEYS.mediaPrivacy.download,
  PERMISSION_KEYS.mediaPrivacy.forward,
  PERMISSION_KEYS.mediaPrivacy.export,
  PERMISSION_KEYS.vault.itemAttach,
  PERMISSION_KEYS.vault.itemView,
  PERMISSION_KEYS.vault.itemDownload,
  PERMISSION_KEYS.vault.itemReshare,
  PERMISSION_KEYS.profile.basicView,
  PERMISSION_KEYS.profile.fullView,
  PERMISSION_KEYS.profile.phoneView,
  PERMISSION_KEYS.profile.emailView,
  PERMISSION_KEYS.actions.bookingRequestCreate,
  PERMISSION_KEYS.actions.paymentRequestCreate,
  PERMISSION_KEYS.actions.supportTicketCreate,
  PERMISSION_KEYS.ai.summaryUse,
  PERMISSION_KEYS.ai.replyUse,
  PERMISSION_KEYS.relationship.block,
  PERMISSION_KEYS.relationship.report,
  PERMISSION_KEYS.relationship.mute,
] as const;

function createTemplateRecord(templateKey: string) {
  const template = CONNECTION_POLICY_TEMPLATE_SEEDS.find(
    (candidate) => candidate.templateKey === templateKey,
  );

  if (!template) {
    throw new Error(`Missing template seed for ${templateKey}`);
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

describe("Connection policy template seeds", () => {
  it("resolves source-specific then generic template candidates", () => {
    assert.deepEqual(
      resolveTemplateKeyCandidates(IdentityType.Personal, ConnectionType.Known),
      ["personal.known", "generic.known"],
    );
    assert.deepEqual(
      resolveTemplateKeyCandidates(
        IdentityType.Business,
        ConnectionType.Client,
      ),
      ["business.client", "generic.client"],
    );
  });

  it("defines expected blocked and business defaults", () => {
    const blockedTemplate = CONNECTION_POLICY_TEMPLATE_SEEDS.find(
      (template) => template.templateKey === "generic.blocked",
    );
    const businessClientTemplate = CONNECTION_POLICY_TEMPLATE_SEEDS.find(
      (template) => template.templateKey === "business.client",
    );
    const couplePartnerTemplate = CONNECTION_POLICY_TEMPLATE_SEEDS.find(
      (template) => template.templateKey === "couple.partner",
    );
    const genericUnknownTemplate = CONNECTION_POLICY_TEMPLATE_SEEDS.find(
      (template) => template.templateKey === "generic.unknown",
    );

    assert.ok(blockedTemplate);
    assert.ok(businessClientTemplate);
    assert.ok(couplePartnerTemplate);
    assert.ok(genericUnknownTemplate);

    assert.equal(
      blockedTemplate.permissions[PERMISSION_KEYS.messaging.textSend].effect,
      PermissionEffect.Deny,
    );
    assert.equal(
      businessClientTemplate.permissions[
        PERMISSION_KEYS.actions.bookingRequestCreate
      ].effect,
      PermissionEffect.Allow,
    );
    assert.equal(
      businessClientTemplate.permissions[
        PERMISSION_KEYS.actions.paymentRequestCreate
      ].effect,
      PermissionEffect.Allow,
    );
    assert.equal(
      businessClientTemplate.permissions[
        PERMISSION_KEYS.actions.supportTicketCreate
      ].effect,
      PermissionEffect.Allow,
    );
    assert.equal(
      couplePartnerTemplate.permissions[PERMISSION_KEYS.mediaPrivacy.export]
        .effect,
      PermissionEffect.Deny,
    );
    assert.equal(
      couplePartnerTemplate.permissions[PERMISSION_KEYS.vault.itemReshare]
        .effect,
      PermissionEffect.Deny,
    );
    assert.equal(
      genericUnknownTemplate.permissions[PERMISSION_KEYS.messaging.textSend]
        .effect,
      PermissionEffect.RequestApproval,
    );
    assert.equal(
      genericUnknownTemplate.permissions[PERMISSION_KEYS.calling.voiceStart]
        .effect,
      PermissionEffect.Deny,
    );
  });

  it("all templates contain required permission keys", () => {
    for (const template of CONNECTION_POLICY_TEMPLATE_SEEDS) {
      assert.doesNotThrow(() =>
        validateTemplatePermissions(template.permissions),
      );

      const permissionKeys = Object.keys(template.permissions);

      for (const requiredPermissionKey of REQUIRED_TEMPLATE_PERMISSION_KEYS) {
        assert.equal(
          permissionKeys.includes(requiredPermissionKey),
          true,
          `${template.templateKey} is missing ${requiredPermissionKey}`,
        );
      }
    }
  });
});

describe("IdentitiesService policy templates", () => {
  it("seeds templates with upsert payloads", async () => {
    const upsertCalls: Array<Record<string, unknown>> = [];
    const service = new IdentitiesService({
      connectionPolicyTemplate: {
        upsert: async (args: any) => {
          upsertCalls.push(args);
          return createTemplateRecord(args.where.templateKey);
        },
      },
    } as any);

    const result = await service.seedConnectionPolicyTemplates();

    assert.equal(result.length, CONNECTION_POLICY_TEMPLATE_SEEDS.length);
    assert.equal(upsertCalls.length, CONNECTION_POLICY_TEMPLATE_SEEDS.length);
    assert.equal(
      (upsertCalls[0]?.where as { templateKey?: string })?.templateKey,
      "generic.unknown",
    );
  });

  it("seeding is idempotent by templateKey", async () => {
    const seenKeys: string[] = [];
    const service = new IdentitiesService({
      connectionPolicyTemplate: {
        upsert: async (args: any) => {
          seenKeys.push(args.where.templateKey);
          return createTemplateRecord(args.where.templateKey);
        },
      },
    } as any);

    await service.seedConnectionPolicyTemplates();
    await service.seedConnectionPolicyTemplates();

    assert.equal(seenKeys.length, CONNECTION_POLICY_TEMPLATE_SEEDS.length * 2);
    assert.equal(
      seenKeys[0],
      seenKeys[CONNECTION_POLICY_TEMPLATE_SEEDS.length],
    );
  });

  it("returns source-specific template when available", async () => {
    const queries: Array<Record<string, unknown>> = [];
    const service = new IdentitiesService({
      connectionPolicyTemplate: {
        findFirst: async ({ where }: any) => {
          queries.push(where);
          return queries.length === 1
            ? createTemplateRecord("business.client")
            : null;
        },
      },
    } as any);

    const result = await service.getConnectionPolicyTemplate({
      sourceIdentityType: IdentityType.Business,
      connectionType: ConnectionType.Client,
    });

    assert.deepEqual(queries, [
      {
        sourceIdentityType: "BUSINESS",
        connectionType: "CLIENT",
        isActive: true,
      },
    ]);
    assert.equal(result.templateKey, "business.client");
    assert.equal(
      result.permissionsJson[PERMISSION_KEYS.actions.paymentRequestCreate]
        .effect,
      PermissionEffect.Allow,
    );
  });

  it("falls back to generic same-type template", async () => {
    const queries: Array<Record<string, unknown>> = [];
    const service = new IdentitiesService({
      connectionPolicyTemplate: {
        findFirst: async ({ where }: any) => {
          queries.push(where);
          return queries.length === 1
            ? null
            : createTemplateRecord("generic.requested");
        },
      },
    } as any);

    const result = await service.getConnectionPolicyTemplate({
      sourceIdentityType: IdentityType.Personal,
      connectionType: ConnectionType.Requested,
    });

    assert.deepEqual(queries, [
      {
        sourceIdentityType: "PERSONAL",
        connectionType: "REQUESTED",
        isActive: true,
      },
      {
        sourceIdentityType: null,
        connectionType: "REQUESTED",
        isActive: true,
      },
    ]);
    assert.equal(result.templateKey, "generic.requested");
    assert.equal(
      result.permissionsJson[PERMISSION_KEYS.messaging.textSend].effect,
      PermissionEffect.RequestApproval,
    );
  });

  it("throws when no template exists for candidates", async () => {
    const service = new IdentitiesService({
      connectionPolicyTemplate: {
        findFirst: async () => null,
      },
    } as any);

    await assert.rejects(
      service.getConnectionPolicyTemplate({
        sourceIdentityType: IdentityType.Business,
        connectionType: ConnectionType.AdminManaged,
      }),
      (error: unknown) => {
        assert.ok(error instanceof NotFoundException);
        assert.equal(error.message, "Connection policy template not found");
        return true;
      },
    );
  });

  it("looks up generic template directly when source identity type is absent", async () => {
    const queries: Array<Record<string, unknown>> = [];
    const service = new IdentitiesService({
      connectionPolicyTemplate: {
        findFirst: async ({ where }: any) => {
          queries.push(where);
          return createTemplateRecord("generic.known");
        },
      },
    } as any);

    const result = await service.getConnectionPolicyTemplate({
      connectionType: ConnectionType.Known,
    });

    assert.deepEqual(queries, [
      {
        sourceIdentityType: null,
        connectionType: "KNOWN",
        isActive: true,
      },
    ]);
    assert.equal(result.templateKey, "generic.known");
  });
});
