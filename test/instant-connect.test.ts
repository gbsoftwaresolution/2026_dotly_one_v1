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
  PersonaSharingMode as PrismaPersonaSharingMode,
  QrStatus as PrismaQrStatus,
  QrType as PrismaQrType,
} from "@prisma/client";

import { ContactsService } from "../src/modules/contacts/contacts.service";
import { QrService } from "../src/modules/qr/qr.service";
import { RelationshipsService } from "../src/modules/relationships/relationships.service";
import { ContactRequestSourceType } from "../src/common/enums/contact-request-source-type.enum";

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
      undefined,
      undefined,
      {
        assertUserIsVerified: async () => undefined,
      } as any,
    );

    const result = await service.connectQuickConnectQr("scanner-user", "qr", {
      fromPersonaId: "from-persona",
    });

    assert.equal(result.relationshipId, "relationship-id");
    assert.equal(result.status, "connected");
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
      undefined,
      undefined,
      {
        assertUserIsVerified: async () => undefined,
      } as any,
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
      undefined,
      undefined,
      {
        assertUserIsVerified: async () => undefined,
      } as any,
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
      undefined,
      undefined,
      {
        assertUserIsVerified: async () => undefined,
      } as any,
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
      undefined,
      undefined,
      {
        assertUserIsVerified: async () => undefined,
      } as any,
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
  it("blocks quick connect scans for unverified accounts before opening a transaction", async () => {
    let transactionCalled = false;

    const service = new QrService(
      {
        $transaction: async () => {
          transactionCalled = true;
          throw new Error("transaction should not run");
        },
      } as any,
      {} as any,
      {
        findOwnedPersonaIdentity: async () => ({ id: "from-persona" }),
      } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {
        assertUserIsVerified: async () => {
          throw new ForbiddenException(
            "Verify your email or complete mobile OTP before using instant connect.",
          );
        },
      } as any,
    );

    await assert.rejects(
      service.connectQuickConnectQr("scanner-user", "qr", {
        fromPersonaId: "from-persona",
      }),
      (error: unknown) => {
        assert.ok(error instanceof ForbiddenException);
        assert.equal(
          error.message,
          "Verify your email or complete mobile OTP before using instant connect.",
        );
        assert.equal(transactionCalled, false);
        return true;
      },
    );
  });

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
            "Verify your email or complete mobile OTP before creating shareable profile QR codes.",
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
          "Verify your email or complete mobile OTP before creating shareable profile QR codes.",
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
            "Verify your email or complete mobile OTP before creating Quick Connect QR codes.",
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
          "Verify your email or complete mobile OTP before creating Quick Connect QR codes.",
        );
        return true;
      },
    );
  });

  it("allows verified-only quick connect when mobile OTP is active", async () => {
    let updateManyCalls = 0;

    const service = new QrService(
      {
        $transaction: async <T>(callback: (tx: any) => Promise<T>) =>
          callback({
            user: {
              findUnique: async () => ({
                id: "scanner-user",
                isVerified: false,
                phoneVerifiedAt: new Date("2026-03-23T10:00:00.000Z"),
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
              updateMany: async () => {
                updateManyCalls += 1;
                return { count: 1 };
              },
            },
            contactRelationship: {
              findFirst: async () => null,
              create: async () => ({
                id: "relationship-1",
                reciprocalRelationshipId: null,
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
      {
        createOrRefreshInstantAccessRelationship: async () => ({
          id: "relationship-1",
          accessStartAt: new Date("2026-03-23T10:00:00.000Z"),
          accessEndAt: new Date("2026-03-23T14:00:00.000Z"),
        }),
      } as any,
      {
        upsertInteractionMemory: async () => ({ id: "memory-1" }),
        createInitialMemory: async () => ({ id: "memory-1" }),
      } as any,
      undefined,
      undefined,
      {
        assertUserIsVerified: async () => undefined,
      } as any,
    );

    const result = await service.connectQuickConnectQr("scanner-user", "qr", {
      fromPersonaId: "from-persona",
    });

    assert.equal(result.relationshipId, "relationship-1");
    assert.equal(result.status, "connected");
    assert.equal(result.targetPersona.id, "target-persona");
    assert.equal(updateManyCalls, 1);
  });
});

describe("RelationshipsService", () => {
  it("blocks direct instant connect for unverified actors before opening a transaction", async () => {
    let transactionCalled = false;

    const service = new RelationshipsService(
      {
        $transaction: async () => {
          transactionCalled = true;
          throw new Error("transaction should not run");
        },
      } as any,
      undefined as any,
      undefined as any,
      {
        assertUserIsVerified: async () => {
          throw new ForbiddenException(
            "Verify your email or complete mobile OTP before using instant connect.",
          );
        },
      } as any,
      undefined as any,
    );

    await assert.rejects(
      service.instantConnect("actor-user", {
        fromPersonaId: "actor-persona",
        targetPersonaId: "target-persona",
      }),
      (error: unknown) => {
        assert.ok(error instanceof ForbiddenException);
        assert.equal(
          error.message,
          "Verify your email or complete mobile OTP before using instant connect.",
        );
        return true;
      },
    );

    assert.equal(transactionCalled, false);
  });

  it("blocks username instant connect for unverified actors before opening a transaction", async () => {
    let transactionCalled = false;

    const service = new RelationshipsService(
      {
        $transaction: async () => {
          transactionCalled = true;
          throw new Error("transaction should not run");
        },
      } as any,
      undefined as any,
      undefined as any,
      {
        assertUserIsVerified: async () => {
          throw new ForbiddenException(
            "Verify your email or complete mobile OTP before using instant connect.",
          );
        },
      } as any,
      undefined as any,
    );

    await assert.rejects(
      service.instantConnectByUsername("actor-user", "target", {
        fromPersonaId: "actor-persona",
      }),
      (error: unknown) => {
        assert.ok(error instanceof ForbiddenException);
        assert.equal(
          error.message,
          "Verify your email or complete mobile OTP before using instant connect.",
        );
        return true;
      },
    );

    assert.equal(transactionCalled, false);
  });

  it("creates an approved relationship immediately for eligible smart-card personas", async () => {
    const updateManyPayloads: Array<Record<string, unknown>> = [];
    const createdRelationships: Array<Record<string, unknown>> = [];
    let memoryCreatePayload: Record<string, unknown> | null = null;
    const now = Date.now();

    const service = new RelationshipsService(
      {
        $transaction: async <T>(callback: (tx: any) => Promise<T>) =>
          callback({
            persona: {
              findFirst: async ({ where }: any) => {
                if (where.userId) {
                  return {
                    id: "actor-persona",
                  };
                }

                return null;
              },
              findUnique: async () => ({
                id: "target-persona",
                userId: "target-user",
                accessMode: PrismaPersonaAccessMode.OPEN,
                sharingMode: PrismaPersonaSharingMode.SMART_CARD,
                smartCardConfig: {
                  primaryAction: "instant_connect",
                  allowCall: false,
                  allowWhatsapp: false,
                  allowEmail: false,
                  allowVcard: false,
                },
                verifiedOnly: false,
              }),
            },
            user: {
              findUnique: async () => ({
                id: "actor-user",
                isVerified: true,
              }),
            },
            qRAccessToken: {
              findFirst: async () => ({
                id: "active-profile-qr",
              }),
            },
            event: {
              findUnique: async () => ({
                id: "event-1",
                name: "Dotly Launch Week",
                startsAt: new Date(now - 60 * 60 * 1000),
                endsAt: new Date(now + 60 * 60 * 1000),
                status: "LIVE",
              }),
            },
            contactRelationship: {
              findUnique: async ({ where }: any) => {
                if (where.id === "relationship-id") {
                  return {
                    id: "relationship-id",
                    lastInteractionAt: new Date("2026-03-23T10:00:00.000Z"),
                    interactionCount: 1,
                  };
                }

                if (where.id === "reciprocal-relationship-id") {
                  return {
                    id: "reciprocal-relationship-id",
                    lastInteractionAt: new Date("2026-03-23T10:00:00.000Z"),
                    interactionCount: 1,
                  };
                }

                return null;
              },
              create: async ({ data }: any) => {
                createdRelationships.push(data);

                return {
                  id:
                    createdRelationships.length === 1
                      ? "relationship-id"
                      : "reciprocal-relationship-id",
                };
              },
              updateMany: async (payload: Record<string, unknown>) => {
                updateManyPayloads.push(payload);
                return { count: 1 };
              },
              update: async () => ({
                id: "relationship-id",
              }),
            },
            contactMemory: {
              findFirst: async () => null,
              create: async ({ data }: any) => {
                memoryCreatePayload = data;
                return { id: "memory-id" };
              },
            },
          }),
      } as any,
      {
        assertNoInteractionBlockInTransaction: async () => undefined,
      } as any,
      {
        upsertInteractionMemory: async (
          tx: any,
          payload: Record<string, unknown>,
        ) => tx.contactMemory.create({ data: payload }),
      } as any,
      {
        assertUserIsVerified: async () => undefined,
      } as any,
      {
        assertSourceAccess: async () => undefined,
      } as any,
    );

    const result = await service.instantConnect("actor-user", {
      fromPersonaId: "actor-persona",
      targetPersonaId: "target-persona",
      eventId: "event-1",
      source: ContactRequestSourceType.Event,
    });

    assert.deepEqual(result, {
      relationshipId: "relationship-id",
      status: "connected",
    });
    assert.equal(createdRelationships.length, 2);
    assert.equal(
      (createdRelationships[0] as any)?.state,
      PrismaContactRelationshipState.APPROVED,
    );
    assert.equal(
      (createdRelationships[0] as any)?.sourceType,
      PrismaContactRequestSourceType.EVENT,
    );
    assert.deepEqual((createdRelationships[0] as any)?.connectionContext, {
      type: "event",
      eventId: "event-1",
      label: "Dotly Launch Week",
    });
    assert.equal(
      (memoryCreatePayload as any)?.relationshipId,
      "relationship-id",
    );
    assert.equal((memoryCreatePayload as any)?.eventId, "event-1");
    assert.equal(
      (memoryCreatePayload as any)?.contextLabel,
      "Dotly Launch Week",
    );
    assert.equal(
      (memoryCreatePayload as any)?.sourceLabel,
      "Instant connect via Event",
    );
    assert.equal(updateManyPayloads.length, 4);
  });

  it("rejects event instant connect when the event context is missing or inactive", async () => {
    const service = new RelationshipsService(
      {
        $transaction: async <T>(callback: (tx: any) => Promise<T>) =>
          callback({
            persona: {
              findFirst: async ({ where }: any) => {
                if (where.userId) {
                  return {
                    id: "actor-persona",
                  };
                }

                return null;
              },
              findUnique: async () => ({
                id: "target-persona",
                userId: "target-user",
                accessMode: PrismaPersonaAccessMode.OPEN,
                sharingMode: PrismaPersonaSharingMode.SMART_CARD,
                smartCardConfig: {
                  primaryAction: "instant_connect",
                  allowCall: false,
                  allowWhatsapp: false,
                  allowEmail: false,
                  allowVcard: false,
                },
                verifiedOnly: false,
              }),
            },
            user: {
              findUnique: async () => ({
                id: "actor-user",
                isVerified: true,
              }),
            },
            qRAccessToken: {
              findFirst: async () => ({
                id: "active-profile-qr",
              }),
            },
            event: {
              findUnique: async () => null,
            },
            contactRelationship: {
              findUnique: async () => null,
              create: async () => ({
                id: "unexpected-relationship-id",
              }),
              updateMany: async () => ({ count: 1 }),
              update: async () => ({
                id: "unexpected-relationship-id",
              }),
            },
            contactMemory: {
              findFirst: async () => null,
              create: async () => ({ id: "memory-id" }),
            },
          }),
      } as any,
      {
        assertNoInteractionBlockInTransaction: async () => undefined,
      } as any,
      {
        upsertInteractionMemory: async (
          tx: any,
          payload: Record<string, unknown>,
        ) => tx.contactMemory.create({ data: payload }),
      } as any,
      {
        assertUserIsVerified: async () => undefined,
      } as any,
      {
        assertSourceAccess: async () => undefined,
      } as any,
    );

    await assert.rejects(
      service.instantConnect("actor-user", {
        fromPersonaId: "actor-persona",
        targetPersonaId: "target-persona",
        eventId: "missing-event",
        source: ContactRequestSourceType.Event,
      }),
      (error: unknown) => {
        assert.ok(error instanceof BadRequestException);
        assert.equal(error.message, "Event networking is not active");
        return true;
      },
    );
  });

  it("returns the existing approved relationship for repeated taps", async () => {
    let relationshipCreateCalled = false;
    let memoryUpdateCalled = false;
    let interactionCount = 0;

    const service = new RelationshipsService(
      {
        $transaction: async <T>(callback: (tx: any) => Promise<T>) =>
          callback({
            persona: {
              findFirst: async ({ where }: any) => {
                if (where.userId) {
                  return {
                    id: "actor-persona",
                  };
                }

                return null;
              },
              findUnique: async () => ({
                id: "target-persona",
                userId: "target-user",
                accessMode: PrismaPersonaAccessMode.OPEN,
                sharingMode: PrismaPersonaSharingMode.SMART_CARD,
                smartCardConfig: {
                  primaryAction: "instant_connect",
                  allowCall: false,
                  allowWhatsapp: false,
                  allowEmail: false,
                  allowVcard: false,
                },
                verifiedOnly: false,
              }),
            },
            user: {
              findUnique: async () => ({
                id: "actor-user",
                isVerified: true,
              }),
            },
            qRAccessToken: {
              findFirst: async () => ({
                id: "active-profile-qr",
              }),
            },
            contactRelationship: {
              findUnique: async ({ where }: any) => {
                if (where.id === "existing-relationship") {
                  return {
                    id: "existing-relationship",
                    lastInteractionAt: new Date("2026-03-23T10:00:00.000Z"),
                    interactionCount: 8,
                  };
                }

                if (where.id === "reciprocal-relationship") {
                  return {
                    id: "reciprocal-relationship",
                    lastInteractionAt: new Date("2026-03-23T10:00:00.000Z"),
                    interactionCount: 4,
                  };
                }

                const composite =
                  where.ownerUserId_targetUserId_ownerPersonaId_targetPersonaId;

                if (composite?.ownerUserId === "actor-user") {
                  return {
                    id: "existing-relationship",
                    state: PrismaContactRelationshipState.APPROVED,
                    sourceType: PrismaContactRequestSourceType.PROFILE,
                    sourceId: null,
                    accessStartAt: null,
                    accessEndAt: null,
                  };
                }

                return {
                  id: "reciprocal-relationship",
                  state: PrismaContactRelationshipState.APPROVED,
                  sourceType: PrismaContactRequestSourceType.PROFILE,
                  sourceId: null,
                  accessStartAt: null,
                  accessEndAt: null,
                };
              },
              create: async () => {
                relationshipCreateCalled = true;
                return { id: "unexpected" };
              },
              updateMany: async () => ({ count: 1 }),
              update: async () => ({ id: "existing-relationship" }),
            },
            contactMemory: {
              findFirst: async () => ({
                id: "memory-id",
              }),
              update: async () => {
                memoryUpdateCalled = true;
                return { id: "memory-id" };
              },
            },
          }),
      } as any,
      {
        assertNoInteractionBlockInTransaction: async () => undefined,
      } as any,
      {
        upsertInteractionMemory: async (
          tx: any,
          payload: Record<string, unknown>,
        ) => {
          const existingMemory = await tx.contactMemory.findFirst({});
          return { id: existingMemory.id };
        },
      } as any,
      {
        assertUserIsVerified: async () => undefined,
      } as any,
      {
        assertSourceAccess: async () => undefined,
      } as any,
    );

    (service as any).updateInteractionMetadata = async () => {
      interactionCount += 1;
      return null;
    };

    const result = await service.instantConnect("actor-user", {
      fromPersonaId: "actor-persona",
      targetPersonaId: "target-persona",
    });

    assert.deepEqual(result, {
      relationshipId: "existing-relationship",
      status: "connected",
    });
    assert.equal(relationshipCreateCalled, false);
    assert.equal(memoryUpdateCalled, false);
    assert.equal(interactionCount, 0);
  });

  it("returns 404 when the target persona does not exist", async () => {
    const service = new RelationshipsService(
      {
        $transaction: async <T>(callback: (tx: any) => Promise<T>) =>
          callback({
            persona: {
              findFirst: async () => ({
                id: "actor-persona",
              }),
              findUnique: async () => null,
            },
          }),
      } as any,
      undefined,
      undefined,
      {
        assertUserIsVerified: async () => undefined,
      } as any,
    );

    await assert.rejects(
      service.instantConnect("actor-user", {
        fromPersonaId: "actor-persona",
        targetPersonaId: "missing-persona",
      }),
      (error: unknown) => {
        assert.ok(error instanceof NotFoundException);
        assert.equal(error.message, "Target persona not found");
        return true;
      },
    );
  });

  it("resolves the target persona by username for public smart-card connects", async () => {
    const service = new RelationshipsService(
      {
        $transaction: async <T>(callback: (tx: any) => Promise<T>) =>
          callback({
            persona: {
              findFirst: async ({ where }: any) => {
                if (where.userId) {
                  return {
                    id: "actor-persona",
                  };
                }

                return {
                  id: "target-persona",
                  userId: "target-user",
                  accessMode: PrismaPersonaAccessMode.OPEN,
                  sharingMode: PrismaPersonaSharingMode.SMART_CARD,
                  smartCardConfig: {
                    primaryAction: "instant_connect",
                    allowCall: false,
                    allowWhatsapp: false,
                    allowEmail: false,
                    allowVcard: false,
                  },
                  verifiedOnly: false,
                };
              },
            },
            user: {
              findUnique: async () => ({
                id: "actor-user",
                isVerified: true,
              }),
            },
            qRAccessToken: {
              findFirst: async () => ({
                id: "active-profile-qr",
              }),
            },
            contactRelationship: {
              findUnique: async ({ where }: any) => {
                if (where.id) {
                  return {
                    id: where.id,
                    lastInteractionAt: new Date("2026-03-23T10:00:00.000Z"),
                    interactionCount: 1,
                  };
                }

                return null;
              },
              create: async ({ data }: any) => ({
                id:
                  data.ownerUserId === "actor-user"
                    ? "relationship-id"
                    : "reciprocal-relationship-id",
              }),
              updateMany: async () => ({ count: 1 }),
              update: async ({ where }: any) => ({
                id: where.id,
              }),
            },
            contactMemory: {
              findFirst: async () => null,
              create: async () => ({ id: "memory-id" }),
            },
          }),
      } as any,
      {
        assertNoInteractionBlockInTransaction: async () => undefined,
      } as any,
      {
        upsertInteractionMemory: async (
          tx: any,
          payload: Record<string, unknown>,
        ) => tx.contactMemory.create({ data: payload }),
      } as any,
      {
        assertUserIsVerified: async () => undefined,
      } as any,
      {
        assertSourceAccess: async () => undefined,
      } as any,
    );

    const result = await service.instantConnectByUsername(
      "actor-user",
      "target",
      {
        fromPersonaId: "actor-persona",
        source: ContactRequestSourceType.Profile,
      },
    );

    assert.deepEqual(result, {
      relationshipId: "relationship-id",
      status: "connected",
    });
  });

  it("returns 404 when the username-based target persona does not exist", async () => {
    const service = new RelationshipsService(
      {
        $transaction: async <T>(callback: (tx: any) => Promise<T>) =>
          callback({
            persona: {
              findFirst: async ({ where }: any) => {
                if (where.userId) {
                  return {
                    id: "actor-persona",
                  };
                }

                return null;
              },
            },
          }),
      } as any,
      undefined,
      undefined,
      {
        assertUserIsVerified: async () => undefined,
      } as any,
    );

    await assert.rejects(
      service.instantConnectByUsername("actor-user", "missing", {
        fromPersonaId: "actor-persona",
      }),
      (error: unknown) => {
        assert.ok(error instanceof NotFoundException);
        assert.equal(error.message, "Target persona not found");
        return true;
      },
    );
  });

  it("returns the same 404 when the username belongs to a private persona", async () => {
    const usernameLookups: Array<Record<string, unknown>> = [];

    const service = new RelationshipsService(
      {
        $transaction: async <T>(callback: (tx: any) => Promise<T>) =>
          callback({
            persona: {
              findFirst: async ({ where }: any) => {
                if (where.userId) {
                  return {
                    id: "actor-persona",
                  };
                }

                usernameLookups.push(where);
                return null;
              },
            },
          }),
      } as any,
      undefined,
      undefined,
      {
        assertUserIsVerified: async () => undefined,
      } as any,
    );

    await assert.rejects(
      service.instantConnectByUsername("actor-user", "private-user", {
        fromPersonaId: "actor-persona",
      }),
      (error: unknown) => {
        assert.ok(error instanceof NotFoundException);
        assert.equal(error.message, "Target persona not found");
        return true;
      },
    );

    assert.equal(usernameLookups.length, 1);
    assert.equal((usernameLookups[0] as any)?.username, "private-user");
    assert.equal(
      (usernameLookups[0] as any)?.accessMode?.not,
      PrismaPersonaAccessMode.PRIVATE,
    );
  });

  it("returns 403 when the target user is blocked", async () => {
    const service = new RelationshipsService(
      {
        $transaction: async <T>(callback: (tx: any) => Promise<T>) =>
          callback({
            persona: {
              findFirst: async () => ({
                id: "actor-persona",
              }),
              findUnique: async () => ({
                id: "target-persona",
                userId: "target-user",
                accessMode: PrismaPersonaAccessMode.OPEN,
                sharingMode: PrismaPersonaSharingMode.SMART_CARD,
                smartCardConfig: {
                  primaryAction: "instant_connect",
                  allowCall: false,
                  allowWhatsapp: false,
                  allowEmail: false,
                  allowVcard: false,
                },
                verifiedOnly: false,
              }),
            },
          }),
      } as any,
      {
        assertNoInteractionBlockInTransaction: async () => {
          throw new ForbiddenException("User has blocked you");
        },
      } as any,
      undefined,
      {
        assertUserIsVerified: async () => undefined,
      } as any,
    );

    await assert.rejects(
      service.instantConnect("actor-user", {
        fromPersonaId: "actor-persona",
        targetPersonaId: "target-persona",
      }),
      (error: unknown) => {
        assert.ok(error instanceof ForbiddenException);
        assert.equal(error.message, "User has blocked you");
        return true;
      },
    );
  });

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
      (
        updateManyPayloads[1] as any
      )?.where?.OR?.[1]?.lastInteractionAt?.lt?.toISOString(),
      interactionAt.toISOString(),
    );
    assert.equal(
      (updateManyPayloads[1] as any)?.data?.lastInteractionAt?.toISOString(),
      interactionAt.toISOString(),
    );
    assert.equal(result?.interactionCount, 3);
  });

  it("rejects instant connect when the supplied source persona is not owned by the actor", async () => {
    const service = new RelationshipsService(
      {
        $transaction: async <T>(callback: (tx: any) => Promise<T>) =>
          callback({
            persona: {
              findFirst: async ({ where }: any) => {
                if (where.userId && where.id === "foreign-persona") {
                  return null;
                }

                return {
                  id: "target-persona",
                  userId: "target-user",
                  accessMode: PrismaPersonaAccessMode.OPEN,
                  sharingMode: PrismaPersonaSharingMode.SMART_CARD,
                  smartCardConfig: {
                    primaryAction: "instant_connect",
                    allowCall: false,
                    allowWhatsapp: false,
                    allowEmail: false,
                    allowVcard: false,
                  },
                  verifiedOnly: false,
                };
              },
              findUnique: async () => ({
                id: "target-persona",
                userId: "target-user",
                accessMode: PrismaPersonaAccessMode.OPEN,
                sharingMode: PrismaPersonaSharingMode.SMART_CARD,
                smartCardConfig: {
                  primaryAction: "instant_connect",
                  allowCall: false,
                  allowWhatsapp: false,
                  allowEmail: false,
                  allowVcard: false,
                },
                verifiedOnly: false,
              }),
            },
          }),
      } as any,
      undefined as any,
      undefined as any,
      {
        assertUserIsVerified: async () => undefined,
      } as any,
      undefined as any,
    );

    await assert.rejects(
      service.instantConnect("actor-user", {
        fromPersonaId: "foreign-persona",
        targetPersonaId: "target-persona",
      }),
      (error: unknown) => {
        assert.ok(error instanceof NotFoundException);
        assert.equal(error.message, "Persona not found");
        return true;
      },
    );
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

  it("returns the same 404 when upgrading another user's relationship", async () => {
    const service = new RelationshipsService({
      $transaction: async <T>(callback: (tx: any) => Promise<T>) =>
        callback({
          contactRelationship: {
            findUnique: async () => ({
              id: "relationship-id",
              ownerUserId: "another-user",
              state: INSTANT_ACCESS_STATE,
              accessEndAt: new Date("2099-03-20T09:00:00.000Z"),
            }),
          },
        }),
    } as any);

    await assert.rejects(
      service.upgradeOwnedRelationship("owner-user", "relationship-id"),
      (error: unknown) => {
        assert.ok(error instanceof NotFoundException);
        assert.equal(error.message, "Relationship not found");
        return true;
      },
    );
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

  it("returns the same 404 when expiring another user's relationship", async () => {
    const service = new RelationshipsService({
      $transaction: async <T>(callback: (tx: any) => Promise<T>) =>
        callback({
          contactRelationship: {
            findUnique: async () => ({
              id: "relationship-id",
              ownerUserId: "another-user",
              state: INSTANT_ACCESS_STATE,
              accessEndAt: new Date("2099-03-20T09:00:00.000Z"),
            }),
          },
        }),
    } as any);

    await assert.rejects(
      service.expireOwnedRelationship("owner-user", "relationship-id"),
      (error: unknown) => {
        assert.ok(error instanceof NotFoundException);
        assert.equal(error.message, "Relationship not found");
        return true;
      },
    );
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
                connectionContext: {
                  type: "profile",
                  eventId: null,
                  label: "Profile",
                },
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
                    eventId: null,
                    contextLabel: "Quick Connect QR",
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
    assert.equal(
      result[0].metadata.lastInteractionAt?.toISOString(),
      recentInteractionAt.toISOString(),
    );
    assert.equal(result[0].metadata.interactionCount, 4);
    assert.equal(result[0].metadata.hasInteractions, true);
    assert.equal(result[0].metadata.isRecentlyActive, true);
    assert.equal(result[0].metadata.relationshipAgeDays, 4);
    assert.equal(result[0].memory.sourceLabel, "Profile");
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
    assert.deepEqual((findManyPayload as any)?.orderBy, [
      {
        lastInteractionAt: {
          sort: "desc",
          nulls: "last",
        },
      },
      {
        createdAt: "desc",
      },
      {
        id: "asc",
      },
    ]);
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

            const recentRange = (
              payload.where as Record<string, any> | undefined
            )?.lastInteractionAt;

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
      (findManyPayload as any)?.where?.lastInteractionAt?.gte instanceof Date,
      true,
    );
    assert.equal(
      (findManyPayload as any)?.where?.lastInteractionAt?.lte instanceof Date,
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
            connectionContext: {
              type: "event",
              eventId: "event-1",
              label: "Dotly Launch Week",
            },
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
          isTriggered: true,
          isOverdue: false,
          isUpcomingSoon: false,
        }),
      } as any,
    );

    const result = await service.findOne("owner-user", "relationship-id");

    assert.equal(
      result.lastInteractionAt?.toISOString(),
      lastInteractionAt.toISOString(),
    );
    assert.equal(result.interactionCount, 2);
    assert.equal(
      result.metadata.lastInteractionAt?.toISOString(),
      lastInteractionAt.toISOString(),
    );
    assert.equal(result.metadata.interactionCount, 2);
    assert.equal(result.metadata.hasInteractions, true);
    assert.equal(result.metadata.isRecentlyActive, true);
    assert.equal(result.metadata.relationshipAgeDays, 3);
    assert.equal(result.memory.sourceLabel, "Dotly Launch Week");
    assert.equal(result.followUpSummary.hasPendingFollowUp, true);
    assert.equal(result.followUpSummary.pendingFollowUpCount, 2);
    assert.equal(
      result.followUpSummary.nextFollowUpAt?.toISOString(),
      nextFollowUpAt.toISOString(),
    );
    assert.equal(result.followUpSummary.isTriggered, true);
    assert.equal(result.followUpSummary.isOverdue, false);
    assert.equal(result.followUpSummary.isUpcomingSoon, false);
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
      isTriggered: false,
      isOverdue: false,
      isUpcomingSoon: false,
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
        updateInteractionMetadata: async (
          tx: unknown,
          relationshipId: string,
        ) => {
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
        updateInteractionMetadata: async (
          tx: unknown,
          relationshipId: string,
        ) => {
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
