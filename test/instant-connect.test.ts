import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import {
  ContactRelationshipState as PrismaContactRelationshipState,
  ContactRequestSourceType as PrismaContactRequestSourceType,
  PersonaAccessMode as PrismaPersonaAccessMode,
  QrStatus as PrismaQrStatus,
  QrType as PrismaQrType,
} from "@prisma/client";

import { ContactsService } from "../src/modules/contacts/contacts.service";
import { QrService } from "../src/modules/qr/qr.service";
import { RelationshipsService } from "../src/modules/relationships/relationships.service";

const INSTANT_ACCESS_STATE = "INSTANT_ACCESS" as PrismaContactRelationshipState;
const EXPIRED_STATE = "EXPIRED" as PrismaContactRelationshipState;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

describe("QrService.connectQuickConnectQr", () => {
  it("creates an instant access relationship from a quick connect QR", async () => {
    let updateManyPayload: Record<string, unknown> | null = null;
    let relationshipPayload: Record<string, unknown> | null = null;
    let memoryPayload: Record<string, unknown> | null = null;

    const service = new QrService(
      {
        $transaction: async <T>(callback: (tx: any) => Promise<T>) =>
          callback({
            user: {
              findUnique: async () => ({
                id: "scanner-user",
                isVerified: true,
              }),
            },
            qRAccessToken: {
              findUnique: async (args: any) => {
                if (args.where.code) {
                  return {
                    id: "qr-token-id",
                    type: PrismaQrType.quick_connect,
                    startsAt: null,
                    endsAt: new Date("2099-03-20T15:00:00.000Z"),
                    maxUses: 5,
                    usedCount: 1,
                    status: PrismaQrStatus.active,
                    rules: {
                      durationHours: 4,
                    },
                    persona: {
                      id: "target-persona",
                      userId: "target-user",
                      username: "target",
                      fullName: "Target User",
                      jobTitle: "Founder",
                      companyName: "Dotly",
                      tagline: "Connect fast",
                      profilePhotoUrl: null,
                      verifiedOnly: false,
                    },
                  };
                }

                return null;
              },
              updateMany: async (payload: Record<string, unknown>) => {
                updateManyPayload = payload;
                return { count: 1 };
              },
            },
          }),
      } as any,
      {
        get: () => "https://dotly.id/q",
      } as any,
      {
        findOwnedPersonaIdentity: async () => ({ id: "from-persona" }),
      } as any,
      {
        assertNoInteractionBlockInTransaction: async () => undefined,
      } as any,
      {
        createOrRefreshInstantAccessRelationship: async (
          _tx: unknown,
          payload: Record<string, unknown>,
        ) => {
          relationshipPayload = payload;
          return {
            id: "relationship-id",
            state: INSTANT_ACCESS_STATE,
            accessStartAt: new Date("2099-03-20T12:00:00.000Z"),
            accessEndAt: new Date("2099-03-20T16:00:00.000Z"),
          };
        },
      } as any,
      {
        createInitialMemory: async (
          _tx: unknown,
          payload: Record<string, unknown>,
        ) => {
          memoryPayload = payload;
          return { id: "memory-id" };
        },
      } as any,
    );

    const result = await service.connectQuickConnectQr("scanner-user", "qr", {
      fromPersonaId: "from-persona",
    });

    assert.equal(result.relationshipId, "relationship-id");
    assert.equal(result.state, "instant_access");
    assert.equal(result.targetPersona.id, "target-persona");
    assert.equal((updateManyPayload as any)?.where.id, "qr-token-id");
    assert.equal((relationshipPayload as any)?.ownerUserId, "scanner-user");
    assert.equal(
      (relationshipPayload as any)?.targetPersonaId,
      "target-persona",
    );
    assert.equal((memoryPayload as any)?.sourceLabel, "Quick Connect QR");
  });

  it("rejects self-connect attempts", async () => {
    const service = new QrService(
      {
        $transaction: async <T>(callback: (tx: any) => Promise<T>) =>
          callback({
            user: {
              findUnique: async () => ({
                id: "scanner-user",
                isVerified: true,
              }),
            },
            qRAccessToken: {
              findUnique: async () => ({
                id: "qr-token-id",
                type: PrismaQrType.quick_connect,
                startsAt: null,
                endsAt: null,
                maxUses: null,
                usedCount: 0,
                status: PrismaQrStatus.active,
                rules: {
                  durationHours: 4,
                },
                persona: {
                  id: "target-persona",
                  userId: "scanner-user",
                  username: "self",
                  fullName: "Self User",
                  jobTitle: "Founder",
                  companyName: "Dotly",
                  tagline: "Connect fast",
                  profilePhotoUrl: null,
                  verifiedOnly: false,
                },
              }),
            },
          }),
      } as any,
      {} as any,
      {
        findOwnedPersonaIdentity: async () => ({ id: "from-persona" }),
      } as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await assert.rejects(
      service.connectQuickConnectQr("scanner-user", "qr", {
        fromPersonaId: "from-persona",
      }),
      (error: unknown) => {
        assert.ok(error instanceof BadRequestException);
        assert.equal(error.message, "You cannot connect to your own persona");
        return true;
      },
    );
  });

  it("rejects verified-only quick connect for unverified scanners", async () => {
    const service = new QrService(
      {
        $transaction: async <T>(callback: (tx: any) => Promise<T>) =>
          callback({
            user: {
              findUnique: async () => ({
                id: "scanner-user",
                isVerified: false,
              }),
            },
            qRAccessToken: {
              findUnique: async () => ({
                id: "qr-token-id",
                type: PrismaQrType.quick_connect,
                startsAt: null,
                endsAt: null,
                maxUses: null,
                usedCount: 0,
                status: PrismaQrStatus.active,
                rules: {
                  durationHours: 4,
                },
                persona: {
                  id: "target-persona",
                  userId: "target-user",
                  username: "target",
                  fullName: "Target User",
                  jobTitle: "Founder",
                  companyName: "Dotly",
                  tagline: "Connect fast",
                  profilePhotoUrl: null,
                  verifiedOnly: true,
                },
              }),
            },
          }),
      } as any,
      {} as any,
      {
        findOwnedPersonaIdentity: async () => ({ id: "from-persona" }),
      } as any,
      {
        assertNoInteractionBlockInTransaction: async () => undefined,
      } as any,
      {} as any,
      {} as any,
    );

    await assert.rejects(
      service.connectQuickConnectQr("scanner-user", "qr", {
        fromPersonaId: "from-persona",
      }),
      (error: unknown) => {
        assert.ok(error instanceof ForbiddenException);
        assert.equal(error.message, "Verified profiles only");
        return true;
      },
    );
  });

  it("rejects exhausted quick connect QR codes", async () => {
    const service = new QrService(
      {
        $transaction: async <T>(callback: (tx: any) => Promise<T>) =>
          callback({
            user: {
              findUnique: async () => ({
                id: "scanner-user",
                isVerified: true,
              }),
            },
            qRAccessToken: {
              findUnique: async () => ({
                id: "qr-token-id",
                type: PrismaQrType.quick_connect,
                startsAt: null,
                endsAt: null,
                maxUses: 1,
                usedCount: 1,
                status: PrismaQrStatus.active,
                rules: {
                  durationHours: 4,
                },
                persona: {
                  id: "target-persona",
                  userId: "target-user",
                  username: "target",
                  fullName: "Target User",
                  jobTitle: "Founder",
                  companyName: "Dotly",
                  tagline: "Connect fast",
                  profilePhotoUrl: null,
                  verifiedOnly: false,
                },
              }),
              updateMany: async () => ({ count: 1 }),
            },
          }),
      } as any,
      {} as any,
      {
        findOwnedPersonaIdentity: async () => ({ id: "from-persona" }),
      } as any,
      {
        assertNoInteractionBlockInTransaction: async () => undefined,
      } as any,
      {} as any,
      {} as any,
    );

    await assert.rejects(
      service.connectQuickConnectQr("scanner-user", "qr", {
        fromPersonaId: "from-persona",
      }),
      (error: unknown) => {
        assert.ok(error instanceof ConflictException);
        assert.equal(error.message, "QR code usage limit reached");
        return true;
      },
    );
  });

  it("rejects quick connect QR codes that are not active yet", async () => {
    const service = new QrService(
      {
        $transaction: async <T>(callback: (tx: any) => Promise<T>) =>
          callback({
            user: {
              findUnique: async () => ({
                id: "scanner-user",
                isVerified: true,
              }),
            },
            qRAccessToken: {
              findUnique: async () => ({
                id: "qr-token-id",
                type: PrismaQrType.quick_connect,
                startsAt: new Date("2099-03-20T15:00:00.000Z"),
                endsAt: new Date("2099-03-20T20:00:00.000Z"),
                maxUses: null,
                usedCount: 0,
                status: PrismaQrStatus.active,
                rules: {
                  durationHours: 4,
                },
                persona: {
                  id: "target-persona",
                  userId: "target-user",
                  username: "target",
                  fullName: "Target User",
                  jobTitle: "Founder",
                  companyName: "Dotly",
                  tagline: "Connect fast",
                  profilePhotoUrl: null,
                  verifiedOnly: false,
                },
              }),
            },
          }),
      } as any,
      {} as any,
      {
        findOwnedPersonaIdentity: async () => ({ id: "from-persona" }),
      } as any,
      {
        assertNoInteractionBlockInTransaction: async () => undefined,
      } as any,
      {} as any,
      {} as any,
    );

    await assert.rejects(
      service.connectQuickConnectQr("scanner-user", "qr", {
        fromPersonaId: "from-persona",
      }),
      (error: unknown) => {
        assert.ok(error instanceof ConflictException);
        assert.equal(error.message, "QR code is not active yet");
        return true;
      },
    );
  });
});

describe("QrService verification enforcement", () => {
  it("blocks profile QR generation for unverified accounts", async () => {
    const service = new QrService(
      {} as any,
      {} as any,
      {
        findOwnedPersonaIdentity: async () => ({ id: "persona-id" }),
      } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {
        assertUserIsVerified: async () => {
          throw new ForbiddenException(
            "Verify your email before creating shareable profile QR codes. Check your inbox for the verification link, or resend it.",
          );
        },
      } as any,
    );

    await assert.rejects(
      service.createProfileQr("scanner-user", "persona-id"),
      (error: unknown) => {
        assert.ok(error instanceof ForbiddenException);
        assert.equal(
          error.message,
          "Verify your email before creating shareable profile QR codes. Check your inbox for the verification link, or resend it.",
        );
        return true;
      },
    );
  });

  it("blocks quick-connect QR generation for unverified accounts", async () => {
    const service = new QrService(
      {} as any,
      {} as any,
      {
        findOwnedPersonaIdentity: async () => ({ id: "persona-id" }),
      } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {
        assertUserIsVerified: async () => {
          throw new ForbiddenException(
            "Verify your email before creating Quick Connect QR codes. Check your inbox for the verification link, or resend it.",
          );
        },
      } as any,
    );

    await assert.rejects(
      service.createQuickConnectQr("scanner-user", "persona-id", {
        durationHours: 4,
        maxUses: 2,
      }),
      (error: unknown) => {
        assert.ok(error instanceof ForbiddenException);
        assert.equal(
          error.message,
          "Verify your email before creating Quick Connect QR codes. Check your inbox for the verification link, or resend it.",
        );
        return true;
      },
    );
  });
});

describe("RelationshipsService", () => {
  it("updates interaction metadata atomically", async () => {
    const updateManyPayloads: Array<Record<string, unknown>> = [];
    const interactionAt = new Date("2026-03-22T18:15:00.000Z");

    const service = new RelationshipsService({} as any);
    const prisma = {
      contactRelationship: {
        updateMany: async (payload: Record<string, unknown>) => {
          updateManyPayloads.push(payload);
          return {
            count: 1,
          };
        },
        findUnique: async () => ({
          id: "relationship-id",
          lastInteractionAt: interactionAt,
          interactionCount: 3,
        }),
      },
    };

    const result = await service.updateInteractionMetadata(
      prisma as any,
      "relationship-id",
      interactionAt,
    );

    assert.equal(updateManyPayloads.length, 2);
    assert.equal((updateManyPayloads[0] as any)?.where?.id, "relationship-id");
    assert.equal(
      (updateManyPayloads[0] as any)?.data?.interactionCount?.increment,
      1,
    );
    assert.equal((updateManyPayloads[1] as any)?.where?.id, "relationship-id");
    assert.equal(
      (updateManyPayloads[1] as any)?.where?.OR?.[1]?.lastInteractionAt?.lt?.toISOString(),
      interactionAt.toISOString(),
    );
    assert.equal(
      (updateManyPayloads[1] as any)?.data?.lastInteractionAt?.toISOString(),
      interactionAt.toISOString(),
    );
    assert.equal(result?.interactionCount, 3);
  });

  it("returns null when interaction metadata is updated for a missing relationship", async () => {
    const service = new RelationshipsService({} as any);
    const prisma = {
      contactRelationship: {
        updateMany: async () => ({
          count: 0,
        }),
      },
    };

    const result = await service.updateInteractionMetadata(
      prisma as any,
      "missing-relationship-id",
    );

    assert.equal(result, null);
  });

  it("rejects invalid interaction timestamps", async () => {
    const service = new RelationshipsService({} as any);

    await assert.rejects(
      service.updateInteractionMetadata(
        {
          contactRelationship: {
            updateMany: async () => ({ count: 1 }),
          },
        } as any,
        "relationship-id",
        new Date(Number.NaN),
      ),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal(error.message, "Invalid interaction timestamp");
        return true;
      },
    );
  });

  it("prevents upgrading expired instant access relationships", async () => {
    const service = new RelationshipsService({
      $transaction: async <T>(callback: (tx: any) => Promise<T>) =>
        callback({
          contactRelationship: {
            findUnique: async () => ({
              id: "relationship-id",
              ownerUserId: "owner-user",
              state: INSTANT_ACCESS_STATE,
              accessEndAt: new Date("2026-03-20T09:00:00.000Z"),
            }),
            updateMany: async () => ({ count: 1 }),
          },
        }),
    } as any);

    await assert.rejects(
      service.upgradeOwnedRelationship("owner-user", "relationship-id"),
      (error: unknown) => {
        assert.ok(error instanceof ConflictException);
        assert.equal(
          error.message,
          "Expired instant access relationships cannot be upgraded",
        );
        return true;
      },
    );
  });

  it("clears temporal fields when upgrading to approved", async () => {
    let updatePayload: Record<string, unknown> | null = null;

    const service = new RelationshipsService({
      $transaction: async <T>(callback: (tx: any) => Promise<T>) =>
        callback({
          contactRelationship: {
            findUnique: async () => ({
              id: "relationship-id",
              ownerUserId: "owner-user",
              state: INSTANT_ACCESS_STATE,
              accessEndAt: new Date("2099-03-20T09:00:00.000Z"),
            }),
            update: async (payload: Record<string, unknown>) => {
              updatePayload = payload;
              return { id: "relationship-id" };
            },
          },
        }),
    } as any);

    const result = await service.upgradeOwnedRelationship(
      "owner-user",
      "relationship-id",
    );

    assert.equal(result.state, "approved");
    assert.equal((updatePayload as any)?.data?.state, "APPROVED");
    assert.equal((updatePayload as any)?.data?.accessStartAt, null);
    assert.equal((updatePayload as any)?.data?.accessEndAt, null);
  });

  it("returns expired on repeated expire calls", async () => {
    const service = new RelationshipsService({
      $transaction: async <T>(callback: (tx: any) => Promise<T>) =>
        callback({
          contactRelationship: {
            findUnique: async () => ({
              id: "relationship-id",
              ownerUserId: "owner-user",
              state: EXPIRED_STATE,
              accessEndAt: new Date("2026-03-20T09:00:00.000Z"),
            }),
          },
        }),
    } as any);

    const result = await service.expireOwnedRelationship(
      "owner-user",
      "relationship-id",
    );

    assert.equal(result.relationshipId, "relationship-id");
    assert.equal(result.state, "expired");
  });
});

describe("ContactsService", () => {
  it("returns approved and active instant access contacts", async () => {
    let findManyPayload: Record<string, unknown> | null = null;
    const recentInteractionAt = new Date(Date.now() - 2 * DAY_IN_MS);
    const approvedCreatedAt = new Date(Date.now() - 4 * DAY_IN_MS);
    const instantCreatedAt = new Date(Date.now() - 3 * DAY_IN_MS);

    const service = new ContactsService(
      {
        contactRelationship: {
          findMany: async (payload: Record<string, unknown>) => {
            findManyPayload = payload;
            return [
              {
                id: "approved-id",
                ownerUserId: "owner-user",
                state: PrismaContactRelationshipState.APPROVED,
                accessStartAt: null,
                accessEndAt: null,
                lastInteractionAt: recentInteractionAt,
                interactionCount: 4,
                createdAt: approvedCreatedAt,
                sourceType: PrismaContactRequestSourceType.PROFILE,
                targetPersona: {
                  id: "persona-1",
                  username: "approved",
                  publicUrl: "approved",
                  fullName: "Approved User",
                  jobTitle: "Engineer",
                  companyName: "Dotly",
                  tagline: "Hello",
                  profilePhotoUrl: null,
                  accessMode: PrismaPersonaAccessMode.OPEN,
                },
                memories: [],
              },
              {
                id: "instant-id",
                ownerUserId: "owner-user",
                state: INSTANT_ACCESS_STATE,
                accessStartAt: instantCreatedAt,
                accessEndAt: new Date(Date.now() + DAY_IN_MS),
                lastInteractionAt: null,
                interactionCount: 0,
                createdAt: instantCreatedAt,
                sourceType: PrismaContactRequestSourceType.QR,
                targetPersona: {
                  id: "persona-2",
                  username: "instant",
                  publicUrl: "instant",
                  fullName: "Instant User",
                  jobTitle: "Designer",
                  companyName: "Dotly",
                  tagline: "Quick connect",
                  profilePhotoUrl: null,
                  accessMode: PrismaPersonaAccessMode.REQUEST,
                },
                memories: [
                  {
                    id: "memory-id",
                    metAt: instantCreatedAt,
                    sourceLabel: "Quick Connect QR",
                    note: null,
                  },
                ],
              },
            ];
          },
        },
      } as any,
      {} as any,
      {
        expireOwnedExpiredRelationships: async () => undefined,
      } as any,
    );

    const result = await service.findAll("owner-user", {});

    assert.equal(result.length, 2);
    assert.equal(result[0].state, "approved");
    assert.equal(result[1].state, "instant_access");
    assert.equal(
      result[0].lastInteractionAt?.toISOString(),
      recentInteractionAt.toISOString(),
    );
    assert.equal(result[0].interactionCount, 4);
    assert.equal(result[0].metadata.lastInteractionAt?.toISOString(), recentInteractionAt.toISOString());
    assert.equal(result[0].metadata.interactionCount, 4);
    assert.equal(result[0].metadata.hasInteractions, true);
    assert.equal(result[0].metadata.isRecentlyActive, true);
    assert.equal(result[0].metadata.relationshipAgeDays, 4);
    assert.equal(result[1].memory.sourceLabel, "Quick Connect QR");
    assert.equal(result[1].interactionCount, 0);
    assert.equal(result[1].metadata.lastInteractionAt, null);
    assert.equal(result[1].metadata.hasInteractions, false);
    assert.equal(result[1].metadata.isRecentlyActive, false);
    assert.equal(result[1].metadata.relationshipAgeDays, 3);
    assert.equal(
      ((findManyPayload as any)?.where?.OR?.[1]?.state as string) ?? "",
      INSTANT_ACCESS_STATE,
    );
  });

  it("filters contacts by recent relationship activity when requested", async () => {
    const recentInteractionAt = new Date(Date.now() - DAY_IN_MS);
    const staleInteractionAt = new Date(Date.now() - 10 * DAY_IN_MS);
    let findManyPayload: Record<string, unknown> | null = null;

    const service = new ContactsService(
      {
        contactRelationship: {
          findMany: async (payload: Record<string, unknown>) => {
            findManyPayload = payload;

            const recentRange = (payload.where as Record<string, any> | undefined)
              ?.lastInteractionAt;

            const results = [
            {
              id: "recent-id",
              ownerUserId: "owner-user",
              state: PrismaContactRelationshipState.APPROVED,
              accessStartAt: null,
              accessEndAt: null,
              lastInteractionAt: recentInteractionAt,
              interactionCount: 1,
              createdAt: new Date(Date.now() - 4 * DAY_IN_MS),
              sourceType: PrismaContactRequestSourceType.PROFILE,
              targetPersona: {
                id: "persona-recent",
                username: "recent",
                publicUrl: "recent",
                fullName: "Recent User",
                jobTitle: "Engineer",
                companyName: "Dotly",
                tagline: "Recent",
                profilePhotoUrl: null,
                accessMode: PrismaPersonaAccessMode.OPEN,
              },
              memories: [],
            },
            {
              id: "stale-id",
              ownerUserId: "owner-user",
              state: PrismaContactRelationshipState.APPROVED,
              accessStartAt: null,
              accessEndAt: null,
              lastInteractionAt: staleInteractionAt,
              interactionCount: 2,
              createdAt: new Date(Date.now() - 12 * DAY_IN_MS),
              sourceType: PrismaContactRequestSourceType.EVENT,
              targetPersona: {
                id: "persona-stale",
                username: "stale",
                publicUrl: "stale",
                fullName: "Stale User",
                jobTitle: "Designer",
                companyName: "Dotly",
                tagline: "Stale",
                profilePhotoUrl: null,
                accessMode: PrismaPersonaAccessMode.REQUEST,
              },
              memories: [],
            },
            ];

            if (!recentRange) {
              return results;
            }

            return results.filter((relationship) => {
              const lastInteractionAt = relationship.lastInteractionAt;

              return (
                lastInteractionAt instanceof Date &&
                lastInteractionAt >= recentRange.gte &&
                lastInteractionAt <= recentRange.lte
              );
            });
          },
        },
      } as any,
      {} as any,
      {
        expireOwnedExpiredRelationships: async () => undefined,
      } as any,
    );

    const result = await service.findAll("owner-user", { recent: true });

    assert.equal(result.length, 1);
    assert.equal(result[0]?.relationshipId, "recent-id");
    assert.equal(result[0]?.metadata.isRecentlyActive, true);
    assert.equal(
      ((findManyPayload as any)?.where?.lastInteractionAt?.gte instanceof Date),
      true,
    );
    assert.equal(
      ((findManyPayload as any)?.where?.lastInteractionAt?.lte instanceof Date),
      true,
    );
  });

  it("returns interaction metadata in contact detail responses", async () => {
    const lastInteractionAt = new Date(Date.now() - DAY_IN_MS);
    const createdAt = new Date(Date.now() - 3 * DAY_IN_MS - 60 * 1000);
    const nextFollowUpAt = new Date(Date.now() + 2 * 60 * 60 * 1000);

    const service = new ContactsService(
      {
        contactRelationship: {
          findFirst: async () => ({
            id: "relationship-id",
            ownerUserId: "owner-user",
            state: PrismaContactRelationshipState.APPROVED,
            accessStartAt: null,
            accessEndAt: null,
            lastInteractionAt,
            interactionCount: 2,
            createdAt,
            sourceType: PrismaContactRequestSourceType.PROFILE,
            targetPersona: {
              id: "persona-id",
              username: "detail",
              publicUrl: "dotly.id/detail",
              fullName: "Detail User",
              jobTitle: "Engineer",
              companyName: "Dotly",
              tagline: "Approved",
              profilePhotoUrl: null,
              accessMode: PrismaPersonaAccessMode.OPEN,
            },
            memories: [],
          }),
        },
      } as any,
      {} as any,
      {
        expireRelationshipIfNeeded: async (
          _tx: unknown,
          relationship: Record<string, unknown>,
        ) => relationship,
      } as any,
      {
        getFollowUpSummaryForRelationship: async () => ({
          hasPendingFollowUp: true,
          nextFollowUpAt,
          pendingFollowUpCount: 2,
        }),
      } as any,
    );

    const result = await service.findOne("owner-user", "relationship-id");

    assert.equal(
      result.lastInteractionAt?.toISOString(),
      lastInteractionAt.toISOString(),
    );
    assert.equal(result.interactionCount, 2);
    assert.equal(result.metadata.lastInteractionAt?.toISOString(), lastInteractionAt.toISOString());
    assert.equal(result.metadata.interactionCount, 2);
    assert.equal(result.metadata.hasInteractions, true);
    assert.equal(result.metadata.isRecentlyActive, true);
    assert.equal(result.metadata.relationshipAgeDays, 3);
    assert.equal(result.followUpSummary.hasPendingFollowUp, true);
    assert.equal(result.followUpSummary.pendingFollowUpCount, 2);
    assert.equal(
      result.followUpSummary.nextFollowUpAt?.toISOString(),
      nextFollowUpAt.toISOString(),
    );
  });

  it("returns null-safe detail metadata for sparse or future interaction values", async () => {
    const service = new ContactsService(
      {
        contactRelationship: {
          findFirst: async () => ({
            id: "relationship-id",
            ownerUserId: "owner-user",
            state: PrismaContactRelationshipState.APPROVED,
            accessStartAt: null,
            accessEndAt: null,
            lastInteractionAt: new Date(Date.now() + DAY_IN_MS),
            interactionCount: -3,
            createdAt: new Date(Date.now() + DAY_IN_MS),
            sourceType: PrismaContactRequestSourceType.PROFILE,
            targetPersona: {
              id: "persona-id",
              username: "detail",
              publicUrl: "dotly.id/detail",
              fullName: "Detail User",
              jobTitle: "Engineer",
              companyName: "Dotly",
              tagline: "Approved",
              profilePhotoUrl: null,
              accessMode: PrismaPersonaAccessMode.OPEN,
            },
            memories: [],
          }),
        },
      } as any,
      {} as any,
      {
        expireRelationshipIfNeeded: async (
          _tx: unknown,
          relationship: Record<string, unknown>,
        ) => relationship,
      } as any,
    );

    const result = await service.findOne("owner-user", "relationship-id");

    assert.equal(result.lastInteractionAt, null);
    assert.equal(result.interactionCount, 0);
    assert.equal(result.metadata.lastInteractionAt, null);
    assert.equal(result.metadata.interactionCount, 0);
    assert.equal(result.metadata.hasInteractions, false);
    assert.equal(result.metadata.isRecentlyActive, false);
    assert.equal(result.metadata.relationshipAgeDays, 0);
    assert.deepEqual(result.followUpSummary, {
      hasPendingFollowUp: false,
      nextFollowUpAt: null,
      pendingFollowUpCount: 0,
    });
  });

  it("updates interaction metadata when a contact note changes", async () => {
    const interactionAt = new Date("2026-03-22T11:00:00.000Z");
    const interactionCalls: Array<{ tx: unknown; relationshipId: string }> = [];

    const service = new ContactsService(
      {
        $transaction: async <T>(callback: (tx: any) => Promise<T>) =>
          callback({
            contactRelationship: {
              findFirst: async () => ({
                id: "relationship-id",
                ownerUserId: "owner-user",
                state: PrismaContactRelationshipState.APPROVED,
                accessStartAt: null,
                accessEndAt: null,
                lastInteractionAt: null,
                interactionCount: 0,
                createdAt: new Date("2026-03-20T08:00:00.000Z"),
                sourceType: PrismaContactRequestSourceType.PROFILE,
                targetPersona: {
                  id: "persona-id",
                  username: "detail",
                  publicUrl: "dotly.id/detail",
                  fullName: "Detail User",
                  jobTitle: "Engineer",
                  companyName: "Dotly",
                  tagline: "Approved",
                  profilePhotoUrl: null,
                  accessMode: PrismaPersonaAccessMode.OPEN,
                },
                memories: [],
              }),
            },
          }),
      } as any,
      {
        updateNote: async () => ({
          note: "New note",
        }),
      } as any,
      {
        expireRelationshipIfNeeded: async (
          _tx: unknown,
          relationship: Record<string, unknown>,
        ) => relationship,
        updateInteractionMetadata: async (tx: unknown, relationshipId: string) => {
          interactionCalls.push({ tx, relationshipId });
          return {
            id: relationshipId,
            lastInteractionAt: interactionAt,
            interactionCount: 1,
          };
        },
      } as any,
    );

    const result = await service.updateNote("owner-user", "relationship-id", {
      note: "New note",
    });

    assert.equal(interactionCalls.length, 1);
    assert.equal(interactionCalls[0]?.relationshipId, "relationship-id");
    assert.equal(
      result.lastInteractionAt?.toISOString(),
      interactionAt.toISOString(),
    );
    assert.equal(result.interactionCount, 1);
  });

  it("does not increment interaction metadata when the note is unchanged", async () => {
    const interactionCalls: Array<{ tx: unknown; relationshipId: string }> = [];

    const service = new ContactsService(
      {
        $transaction: async <T>(callback: (tx: any) => Promise<T>) =>
          callback({
            contactRelationship: {
              findFirst: async () => ({
                id: "relationship-id",
                ownerUserId: "owner-user",
                state: PrismaContactRelationshipState.APPROVED,
                accessStartAt: null,
                accessEndAt: null,
                lastInteractionAt: new Date("2026-03-22T11:00:00.000Z"),
                interactionCount: 4,
                createdAt: new Date("2026-03-20T08:00:00.000Z"),
                sourceType: PrismaContactRequestSourceType.PROFILE,
                targetPersona: {
                  id: "persona-id",
                  username: "detail",
                  publicUrl: "dotly.id/detail",
                  fullName: "Detail User",
                  jobTitle: "Engineer",
                  companyName: "Dotly",
                  tagline: "Approved",
                  profilePhotoUrl: null,
                  accessMode: PrismaPersonaAccessMode.OPEN,
                },
                memories: [
                  {
                    id: "memory-id",
                    metAt: new Date("2026-03-20T08:00:00.000Z"),
                    sourceLabel: "Profile",
                    note: "Unchanged note",
                  },
                ],
              }),
            },
          }),
      } as any,
      {
        updateNote: async () => {
          throw new Error("updateNote should not be called for no-op saves");
        },
      } as any,
      {
        expireRelationshipIfNeeded: async (
          _tx: unknown,
          relationship: Record<string, unknown>,
        ) => relationship,
        updateInteractionMetadata: async (tx: unknown, relationshipId: string) => {
          interactionCalls.push({ tx, relationshipId });
          return null;
        },
      } as any,
    );

    const result = await service.updateNote("owner-user", "relationship-id", {
      note: "Unchanged note",
    });

    assert.equal(interactionCalls.length, 0);
    assert.equal(result.note, "Unchanged note");
    assert.equal(result.interactionCount, 4);
    assert.equal(
      result.lastInteractionAt?.toISOString(),
      "2026-03-22T11:00:00.000Z",
    );
  });

  it("denies fetching expired instant access contact details", async () => {
    const service = new ContactsService(
      {
        contactRelationship: {
          findFirst: async () => ({
            id: "relationship-id",
            ownerUserId: "owner-user",
            state: INSTANT_ACCESS_STATE,
            accessStartAt: new Date("2026-03-20T08:00:00.000Z"),
            accessEndAt: new Date("2026-03-20T09:00:00.000Z"),
            lastInteractionAt: null,
            interactionCount: 0,
            createdAt: new Date("2026-03-20T08:00:00.000Z"),
            sourceType: PrismaContactRequestSourceType.QR,
            targetPersona: {
              id: "persona-id",
              username: "expired",
              publicUrl: "dotly.id/expired",
              fullName: "Expired User",
              jobTitle: "Engineer",
              companyName: "Dotly",
              tagline: "Expired",
              profilePhotoUrl: null,
              accessMode: PrismaPersonaAccessMode.OPEN,
            },
            memories: [],
          }),
        },
      } as any,
      {} as any,
      {
        expireRelationshipIfNeeded: async () => ({
          id: "relationship-id",
          ownerUserId: "owner-user",
          state: EXPIRED_STATE,
          accessStartAt: new Date("2026-03-20T08:00:00.000Z"),
          accessEndAt: new Date("2026-03-20T09:00:00.000Z"),
          lastInteractionAt: null,
          interactionCount: 0,
          createdAt: new Date("2026-03-20T08:00:00.000Z"),
          sourceType: PrismaContactRequestSourceType.QR,
          targetPersona: {
            id: "persona-id",
            username: "expired",
            publicUrl: "dotly.id/expired",
            fullName: "Expired User",
            jobTitle: "Engineer",
            companyName: "Dotly",
            tagline: "Expired",
            profilePhotoUrl: null,
            accessMode: PrismaPersonaAccessMode.OPEN,
          },
          memories: [],
        }),
      } as any,
    );

    await assert.rejects(
      service.findOne("owner-user", "relationship-id"),
      (error: unknown) => {
        assert.ok(error instanceof NotFoundException);
        assert.equal(error.message, "Contact not found");
        return true;
      },
    );
  });
});
