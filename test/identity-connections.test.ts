import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { BadRequestException, ConflictException } from "@nestjs/common";
import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";

import { ConnectionStatus } from "../src/common/enums/connection-status.enum";
import { ConnectionType } from "../src/common/enums/connection-type.enum";
import { IdentityType } from "../src/common/enums/identity-type.enum";
import { PermissionEffect } from "../src/common/enums/permission-effect.enum";
import { RelationshipType } from "../src/common/enums/relationship-type.enum";
import { TrustState } from "../src/common/enums/trust-state.enum";
import {
  Prisma,
  ConnectionStatus as PrismaConnectionStatus,
  ConnectionType as PrismaConnectionType,
  RelationshipType as PrismaRelationshipType,
  TrustState as PrismaTrustState,
} from "../src/generated/prisma/client";
import { CreateIdentityDto } from "../src/modules/identities/dto/create-identity.dto";
import { UpdateConnectionRelationshipTypeDto } from "../src/modules/identities/dto/update-connection-relationship-type.dto";
import { SetPermissionOverrideDto } from "../src/modules/identities/dto/set-permission-override.dto";
import { IdentitiesService } from "../src/modules/identities/identities.service";
import { PERMISSION_KEYS } from "../src/modules/identities/permission-keys";

describe("Identity domain DTO validation", () => {
  it("trims and normalizes create identity fields", () => {
    const dto = plainToInstance(CreateIdentityDto, {
      identityType: IdentityType.Business,
      displayName: "  Dotly Ops  ",
      handle: "  Dotly-Team  ",
      verificationLevel: "  partner_verified  ",
      status: "  active  ",
      metadataJson: {
        labels: ["core"],
      },
    });

    assert.deepEqual(validateSync(dto), []);
    assert.equal(dto.displayName, "Dotly Ops");
    assert.equal(dto.handle, "dotly-team");
    assert.equal(dto.verificationLevel, "partner_verified");
    assert.equal(dto.status, "active");
  });

  it("trims permission override keys and reason", () => {
    const dto = plainToInstance(SetPermissionOverrideDto, {
      connectionId: "50f0c0d9-8fd0-4916-91f5-743126b8e495",
      permissionKey: `  ${PERMISSION_KEYS.messaging.textSend}  `,
      effect: PermissionEffect.AllowWithLimits,
      reason: "  trusted vendor exception  ",
      createdByIdentityId: "44fd373e-cb5d-4bd0-a0ea-c97f2ecf2ffe",
      limitsJson: {
        maxUses: 5,
      },
    });

    assert.deepEqual(validateSync(dto), []);
    assert.equal(dto.permissionKey, PERMISSION_KEYS.messaging.textSend);
    assert.equal(dto.reason, "trusted vendor exception");
  });
});

describe("IdentitiesService", () => {
  it("creates an identity", async () => {
    const service = new IdentitiesService({
      identity: {
        create: async ({ data }: any) => ({
          id: "identity-1",
          personId: data.personId,
          identityType: data.identityType,
          displayName: data.displayName,
          handle: data.handle,
          verificationLevel: data.verificationLevel,
          status: data.status,
          metadataJson: data.metadataJson,
          createdAt: new Date("2026-03-26T10:00:00.000Z"),
          updatedAt: new Date("2026-03-26T10:00:00.000Z"),
        }),
      },
    } as any);

    const result = await service.createIdentity({
      personId: "bd411f14-e55d-48c4-8928-8b17119270f1",
      identityType: IdentityType.Personal,
      displayName: "Alice Identity",
      handle: "alice-main",
      verificationLevel: "basic",
      status: "active",
      metadataJson: {
        labels: ["owner"],
      },
    });

    assert.equal(result.displayName, "Alice Identity");
    assert.equal(result.handle, "alice-main");
    assert.equal(result.verificationLevel, "basic");
  });

  it("creates a connection", async () => {
    const service = new IdentitiesService({
      identityConnection: {
        create: async ({ data }: any) => ({
          id: "connection-1",
          sourceIdentityId: data.sourceIdentityId,
          targetIdentityId: data.targetIdentityId,
          connectionType: data.connectionType,
          relationshipType: data.relationshipType,
          trustState: data.trustState,
          status: data.status,
          createdByIdentityId: data.createdByIdentityId,
          note: data.note,
          metadataJson: data.metadataJson,
          createdAt: new Date("2026-03-26T10:00:00.000Z"),
          updatedAt: new Date("2026-03-26T10:00:00.000Z"),
        }),
      },
    } as any);

    const result = await service.createConnection({
      sourceIdentityId: "11111111-1111-4111-8111-111111111111",
      targetIdentityId: "22222222-2222-4222-8222-222222222222",
      connectionType: ConnectionType.Known,
      trustState: TrustState.BasicVerified,
      status: ConnectionStatus.Active,
      createdByIdentityId: "11111111-1111-4111-8111-111111111111",
      note: "Met at launch week",
      metadataJson: {
        source: "manual",
      },
    });

    assert.equal(
      result.sourceIdentityId,
      "11111111-1111-4111-8111-111111111111",
    );
    assert.equal(
      result.targetIdentityId,
      "22222222-2222-4222-8222-222222222222",
    );
    assert.equal(result.connectionType, PrismaConnectionType.KNOWN);
    assert.equal(result.relationshipType, PrismaRelationshipType.UNKNOWN);
    assert.equal(result.status, PrismaConnectionStatus.ACTIVE);
  });

  it("validates update connection relationship type dto", () => {
    const dto = plainToInstance(UpdateConnectionRelationshipTypeDto, {
      connectionId: "50f0c0d9-8fd0-4916-91f5-743126b8e495",
      relationshipType: RelationshipType.Client,
    });

    assert.deepEqual(validateSync(dto), []);
  });

  it("rejects self connections", async () => {
    const service = new IdentitiesService({} as any);

    await assert.rejects(
      service.createConnection({
        sourceIdentityId: "11111111-1111-4111-8111-111111111111",
        targetIdentityId: "11111111-1111-4111-8111-111111111111",
        connectionType: ConnectionType.Known,
        trustState: TrustState.Unverified,
        status: ConnectionStatus.Pending,
        createdByIdentityId: "11111111-1111-4111-8111-111111111111",
      }),
      (error: unknown) => {
        assert.ok(error instanceof BadRequestException);
        assert.equal(
          error.message,
          "Identity connections cannot target the same identity",
        );
        return true;
      },
    );
  });

  it("rejects duplicate directional connections", async () => {
    const service = new IdentitiesService({
      identityConnection: {
        create: async () => {
          throw new Prisma.PrismaClientKnownRequestError("duplicate", {
            code: "P2002",
            clientVersion: "test",
          });
        },
      },
    } as any);

    await assert.rejects(
      service.createConnection({
        sourceIdentityId: "11111111-1111-4111-8111-111111111111",
        targetIdentityId: "22222222-2222-4222-8222-222222222222",
        connectionType: ConnectionType.Requested,
        trustState: TrustState.Unverified,
        status: ConnectionStatus.Pending,
        createdByIdentityId: "11111111-1111-4111-8111-111111111111",
      }),
      (error: unknown) => {
        assert.ok(error instanceof ConflictException);
        assert.equal(error.message, "Identity connection already exists");
        return true;
      },
    );
  });

  it("upserts a permission override", async () => {
    let findUniqueCalls = 0;
    const service = new IdentitiesService({
      identityConnection: {
        findUnique: async () => {
          findUniqueCalls += 1;
          return {
            id: "connection-1",
            sourceIdentityId: "11111111-1111-4111-8111-111111111111",
            targetIdentityId: "22222222-2222-4222-8222-222222222222",
            connectionType: PrismaConnectionType.KNOWN,
            relationshipType: PrismaRelationshipType.UNKNOWN,
            trustState: PrismaTrustState.BASIC_VERIFIED,
            status: PrismaConnectionStatus.ACTIVE,
            createdByIdentityId: "11111111-1111-4111-8111-111111111111",
            note: null,
            metadataJson: null,
            createdAt: new Date("2026-03-26T10:00:00.000Z"),
            updatedAt: new Date("2026-03-26T10:00:00.000Z"),
          };
        },
      },
      connectionPermissionOverride: {
        upsert: async ({ where, update, create }: any) => ({
          id: "override-1",
          connectionId: where.connectionId_permissionKey.connectionId,
          permissionKey: where.connectionId_permissionKey.permissionKey,
          effect: update.effect ?? create.effect,
          limitsJson: update.limitsJson ?? create.limitsJson,
          reason: update.reason ?? create.reason,
          createdByIdentityId:
            update.createdByIdentityId ?? create.createdByIdentityId,
          createdAt: update.createdAt ?? new Date("2026-03-26T11:00:00.000Z"),
        }),
      },
    } as any);

    const result = await service.setPermissionOverride({
      connectionId: "connection-1",
      permissionKey: PERMISSION_KEYS.messaging.textSend,
      effect: PermissionEffect.AllowWithLimits,
      limitsJson: {
        maxUses: 3,
      },
      reason: "Approved trial window",
      createdByIdentityId: "11111111-1111-4111-8111-111111111111",
    });

    assert.equal(findUniqueCalls, 1);
    assert.equal(result.permissionKey, PERMISSION_KEYS.messaging.textSend);
    assert.equal(result.effect, "ALLOW_WITH_LIMITS");
  });

  it("forces blocked status when connection type is blocked", async () => {
    const service = new IdentitiesService({
      identityConnection: {
        create: async ({ data }: any) => ({
          id: "connection-2",
          sourceIdentityId: data.sourceIdentityId,
          targetIdentityId: data.targetIdentityId,
          connectionType: data.connectionType,
          relationshipType: data.relationshipType,
          trustState: data.trustState,
          status: data.status,
          createdByIdentityId: data.createdByIdentityId,
          note: data.note,
          metadataJson: data.metadataJson,
          createdAt: new Date("2026-03-26T10:00:00.000Z"),
          updatedAt: new Date("2026-03-26T10:00:00.000Z"),
        }),
      },
    } as any);

    const result = await service.createConnection({
      sourceIdentityId: "11111111-1111-4111-8111-111111111111",
      targetIdentityId: "33333333-3333-4333-8333-333333333333",
      connectionType: ConnectionType.Blocked,
      trustState: TrustState.Unverified,
      status: ConnectionStatus.Active,
      createdByIdentityId: "11111111-1111-4111-8111-111111111111",
    });

    assert.equal(result.connectionType, PrismaConnectionType.BLOCKED);
    assert.equal(result.relationshipType, PrismaRelationshipType.UNKNOWN);
    assert.equal(result.status, PrismaConnectionStatus.BLOCKED);
  });

  it("updates connection relationship type", async () => {
    const service = new IdentitiesService({
      identityConnection: {
        findUnique: async () => ({
          id: "connection-1",
          sourceIdentityId: "identity-1",
          targetIdentityId: "identity-2",
          connectionType: PrismaConnectionType.KNOWN,
          relationshipType: PrismaRelationshipType.UNKNOWN,
          trustState: PrismaTrustState.BASIC_VERIFIED,
          status: PrismaConnectionStatus.ACTIVE,
          createdByIdentityId: "identity-1",
          note: null,
          metadataJson: null,
          createdAt: new Date("2026-03-26T10:00:00.000Z"),
          updatedAt: new Date("2026-03-26T10:00:00.000Z"),
        }),
        update: async ({ data }: any) => ({
          id: "connection-1",
          sourceIdentityId: "identity-1",
          targetIdentityId: "identity-2",
          connectionType: PrismaConnectionType.KNOWN,
          relationshipType: data.relationshipType,
          trustState: PrismaTrustState.BASIC_VERIFIED,
          status: PrismaConnectionStatus.ACTIVE,
          createdByIdentityId: "identity-1",
          note: null,
          metadataJson: null,
          createdAt: new Date("2026-03-26T10:00:00.000Z"),
          updatedAt: new Date("2026-03-26T11:00:00.000Z"),
        }),
      },
    } as any);

    const result = await service.updateConnectionRelationshipType({
      connectionId: "connection-1",
      relationshipType: RelationshipType.Partner,
    });

    assert.equal(result.relationshipType, PrismaRelationshipType.PARTNER);
  });

  it("lists connections for an identity across both directions", async () => {
    let capturedWhere: Record<string, unknown> | null = null;
    const service = new IdentitiesService({
      identityConnection: {
        findMany: async ({ where }: any) => {
          capturedWhere = where;
          return [
            {
              id: "connection-a",
              sourceIdentityId: "identity-1",
              targetIdentityId: "identity-2",
              connectionType: PrismaConnectionType.KNOWN,
              relationshipType: PrismaRelationshipType.FRIEND,
              trustState: PrismaTrustState.BASIC_VERIFIED,
              status: PrismaConnectionStatus.ACTIVE,
              createdByIdentityId: "identity-1",
              note: null,
              metadataJson: null,
              createdAt: new Date("2026-03-26T10:00:00.000Z"),
              updatedAt: new Date("2026-03-26T10:00:00.000Z"),
            },
            {
              id: "connection-b",
              sourceIdentityId: "identity-3",
              targetIdentityId: "identity-1",
              connectionType: PrismaConnectionType.REQUESTED,
              relationshipType: PrismaRelationshipType.UNKNOWN,
              trustState: PrismaTrustState.UNVERIFIED,
              status: PrismaConnectionStatus.PENDING,
              createdByIdentityId: "identity-3",
              note: null,
              metadataJson: null,
              createdAt: new Date("2026-03-26T09:00:00.000Z"),
              updatedAt: new Date("2026-03-26T09:00:00.000Z"),
            },
          ];
        },
      },
    } as any);

    const result = await service.listConnectionsForIdentity({
      identityId: "identity-1",
    });

    assert.equal(result.length, 2);
    assert.deepEqual(capturedWhere, {
      OR: [
        {
          sourceIdentityId: "identity-1",
        },
        {
          targetIdentityId: "identity-1",
        },
      ],
    });
  });
});
