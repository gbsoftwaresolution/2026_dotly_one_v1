import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import {
  ConflictException,
  ForbiddenException,
  HttpException,
} from "@nestjs/common";
import {
  ContactRequestSourceType as PrismaContactRequestSourceType,
  ContactRequestStatus as PrismaContactRequestStatus,
  PersonaAccessMode as PrismaPersonaAccessMode,
  PersonaSharingMode as PrismaPersonaSharingMode,
} from "../src/generated/prisma/client";

import { ContactRequestSourceType } from "../src/common/enums/contact-request-source-type.enum";
import { BlocksService } from "../src/modules/blocks/blocks.service";
import { ContactRequestCreateService } from "../src/modules/contact-requests/contact-request-create.service";
import { ContactRequestRecipientPolicyService } from "../src/modules/contact-requests/contact-request-recipient-policy.service";
import { ContactRequestRespondService } from "../src/modules/contact-requests/contact-request-respond.service";
import { ContactRequestRetryPolicyService } from "../src/modules/contact-requests/contact-request-retry-policy.service";
import { ContactRequestSourcePolicyService } from "../src/modules/contact-requests/contact-request-source-policy.service";
import { ContactRequestsService as ContactRequestsServiceBase } from "../src/modules/contact-requests/contact-requests.service";
import { RequestRateLimitService } from "../src/modules/contact-requests/request-rate-limit.service";

function buildContactRequestsService(
  prismaService: any,
  personasService: any,
  blocksService: any,
  relationshipsService: any,
  contactMemoryService: any,
  requestRateLimitService: any,
  eventsService: any = { validateEventRequestAccess: async () => undefined },
  notificationsService: any = { createSafe: async () => undefined },
  analyticsService: any = {
    trackRequestSent: async () => undefined,
    trackRequestApproved: async () => undefined,
    trackContactCreated: async () => undefined,
  },
  verificationPolicyService: any = {
    assertUserIsVerified: async () => undefined,
  },
) {
  if (
    prismaService?.persona &&
    typeof prismaService.persona.findFirst !== "function" &&
    typeof prismaService.persona.findUnique === "function"
  ) {
    prismaService.persona.findFirst = prismaService.persona.findUnique;
  }

  const createService = new ContactRequestCreateService(
    prismaService,
    new ContactRequestRecipientPolicyService(
      prismaService,
      personasService,
      blocksService,
    ),
    new ContactRequestRetryPolicyService(prismaService),
    new ContactRequestSourcePolicyService(eventsService),
    requestRateLimitService,
    notificationsService,
    analyticsService,
    verificationPolicyService,
  );
  const respondService = new ContactRequestRespondService(
    prismaService,
    blocksService,
    relationshipsService,
    contactMemoryService,
    notificationsService,
    analyticsService,
  );

  return new ContactRequestsServiceBase(
    prismaService,
    createService as any,
    respondService as any,
  );
}

const ContactRequestsService: new (...args: any[]) => ContactRequestsServiceBase =
  buildContactRequestsService as any;

describe("ContactRequestsService", () => {
  it("blocks contact requests from unverified accounts when verification is required", async () => {
    const service = new ContactRequestCreateService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {
        assertUserIsVerified: async () => {
          throw new ForbiddenException(
            "Verify your email or complete mobile OTP before sending connection requests.",
          );
        },
      } as any,
    );

    await assert.rejects(
      service.create("sender-user", {
        fromPersonaId: "from-persona",
        toPersonaId: "target-persona",
        sourceType: ContactRequestSourceType.Profile,
      }),
      (error: unknown) => {
        assert.ok(error instanceof ForbiddenException);
        assert.equal(
          error.message,
          "Verify your email or complete mobile OTP before sending connection requests.",
        );
        return true;
      },
    );
  });

  it("rejects requests when the target user has blocked the sender", async () => {
    const service = new ContactRequestsService(
      {
        persona: {
          findUnique: async () => ({
            id: "target-persona",
            userId: "target-user",
            username: "target",
            fullName: "Target User",
            accessMode: PrismaPersonaAccessMode.OPEN,
            sharingMode: PrismaPersonaSharingMode.CONTROLLED,
            smartCardConfig: null,
            verifiedOnly: false,
          }),
        },
      } as any,
      {
        findOwnedPersonaIdentity: async () => ({ id: "from-persona" }),
      } as any,
      {
        assertNoInteractionBlock: async () => {
          throw new ForbiddenException("User has blocked you");
        },
      } as any,
      {} as any,
      {} as any,
      {
        consume: async () => undefined,
      } as any,
    );

    await assert.rejects(
      service.create("sender-user", {
        fromPersonaId: "from-persona",
        toPersonaId: "target-persona",
        sourceType: ContactRequestSourceType.Profile,
      }),
      (error: unknown) => {
        assert.ok(error instanceof ForbiddenException);
        assert.equal(error.message, "User has blocked you");
        return true;
      },
    );
  });

  it("prevents duplicate pending requests between the same personas", async () => {
    let findFirstCalls = 0;

    const service = new ContactRequestsService(
      {
        persona: {
          findUnique: async () => ({
            id: "target-persona",
            userId: "target-user",
            username: "target",
            fullName: "Target User",
            accessMode: PrismaPersonaAccessMode.REQUEST,
            sharingMode: PrismaPersonaSharingMode.CONTROLLED,
            smartCardConfig: null,
            verifiedOnly: false,
          }),
        },
        user: {
          findUnique: async () => ({
            id: "sender-user",
            isVerified: false,
          }),
        },
        contactRequest: {
          findFirst: async () => {
            findFirstCalls += 1;

            if (findFirstCalls === 1) {
              return { id: "pending-request" };
            }

            return null;
          },
        },
      } as any,
      {
        findOwnedPersonaIdentity: async () => ({ id: "from-persona" }),
      } as any,
      {
        assertNoInteractionBlock: async () => undefined,
      } as any,
      {} as any,
      {} as any,
      {
        consume: async () => undefined,
      } as any,
    );

    await assert.rejects(
      service.create("sender-user", {
        fromPersonaId: "from-persona",
        toPersonaId: "target-persona",
        sourceType: ContactRequestSourceType.Profile,
      }),
      (error: unknown) => {
        assert.ok(error instanceof ConflictException);
        assert.equal(
          error.message,
          "A pending contact request already exists for this persona",
        );
        return true;
      },
    );
  });

  it("enforces the rejection cooldown before allowing a re-request", async () => {
    let findFirstCalls = 0;

    const service = new ContactRequestsService(
      {
        persona: {
          findUnique: async () => ({
            id: "target-persona",
            userId: "target-user",
            username: "target",
            fullName: "Target User",
            accessMode: PrismaPersonaAccessMode.OPEN,
            sharingMode: PrismaPersonaSharingMode.CONTROLLED,
            smartCardConfig: null,
            verifiedOnly: false,
          }),
        },
        user: {
          findUnique: async () => ({
            id: "sender-user",
            isVerified: false,
          }),
        },
        contactRequest: {
          findFirst: async () => {
            findFirstCalls += 1;

            if (findFirstCalls === 1) {
              return null;
            }

            return { id: "recent-rejection" };
          },
        },
      } as any,
      {
        findOwnedPersonaIdentity: async () => ({ id: "from-persona" }),
      } as any,
      {
        assertNoInteractionBlock: async () => undefined,
      } as any,
      {} as any,
      {} as any,
      {
        consume: async () => undefined,
      } as any,
    );

    await assert.rejects(
      service.create("sender-user", {
        fromPersonaId: "from-persona",
        toPersonaId: "target-persona",
        sourceType: ContactRequestSourceType.Profile,
      }),
      (error: unknown) => {
        assert.ok(error instanceof ForbiddenException);
        assert.equal(error.message, "Cooldown active");
        return true;
      },
    );
  });

  it("allows distinct persona pairs even when the same user pair has another pending request", async () => {
    const service = new ContactRequestsService(
      {
        persona: {
          findUnique: async () => ({
            id: "target-persona",
            userId: "target-user",
            username: "target",
            fullName: "Target User",
            accessMode: PrismaPersonaAccessMode.REQUEST,
            sharingMode: PrismaPersonaSharingMode.CONTROLLED,
            smartCardConfig: null,
            verifiedOnly: false,
          }),
        },
        user: {
          findUnique: async () => ({
            id: "sender-user",
            isVerified: false,
          }),
        },
        contactRequest: {
          findFirst: async (args: any) => {
            if (args.where.status === PrismaContactRequestStatus.PENDING) {
              assert.equal(args.where.fromPersonaId, "alternate-from-persona");
              assert.equal(args.where.toPersonaId, "target-persona");
              return null;
            }

            return null;
          },
          create: async () => ({
            id: "request-id",
            status: PrismaContactRequestStatus.PENDING,
            createdAt: new Date("2026-03-22T12:00:00.000Z"),
            toPersona: {
              id: "target-persona",
              username: "target",
              fullName: "Target User",
            },
          }),
        },
      } as any,
      {
        findOwnedPersonaIdentity: async () => ({
          id: "alternate-from-persona",
        }),
      } as any,
      {
        assertNoInteractionBlock: async () => undefined,
      } as any,
      {} as any,
      {} as any,
      {
        reserveAndCreate: async (
          _userId: string,
          callback: (tx: any) => Promise<any>,
        ) =>
          callback({
            contactRequest: {
              create: async () => ({
                id: "request-id",
                status: PrismaContactRequestStatus.PENDING,
                createdAt: new Date("2026-03-22T12:00:00.000Z"),
                toPersona: {
                  id: "target-persona",
                  username: "target",
                  fullName: "Target User",
                },
              }),
            },
          }),
      } as any,
    );

    const result = await service.create("sender-user", {
      fromPersonaId: "alternate-from-persona",
      toPersonaId: "target-persona",
      sourceType: ContactRequestSourceType.Profile,
    });

    assert.equal(result.id, "request-id");
  });

  it("allows distinct persona pairs even when the same user pair has a recent rejection", async () => {
    const service = new ContactRequestsService(
      {
        persona: {
          findUnique: async () => ({
            id: "target-persona",
            userId: "target-user",
            username: "target",
            fullName: "Target User",
            accessMode: PrismaPersonaAccessMode.OPEN,
            sharingMode: PrismaPersonaSharingMode.CONTROLLED,
            smartCardConfig: null,
            verifiedOnly: false,
          }),
        },
        user: {
          findUnique: async () => ({
            id: "sender-user",
            isVerified: false,
          }),
        },
        contactRequest: {
          findFirst: async (args: any) => {
            if (args.where.status === PrismaContactRequestStatus.PENDING) {
              return null;
            }

            assert.equal(args.where.fromPersonaId, "alternate-from-persona");
            assert.equal(args.where.toPersonaId, "target-persona");
            return null;
          },
          create: async () => ({
            id: "request-id",
            status: PrismaContactRequestStatus.PENDING,
            createdAt: new Date("2026-03-22T12:00:00.000Z"),
            toPersona: {
              id: "target-persona",
              username: "target",
              fullName: "Target User",
            },
          }),
        },
      } as any,
      {
        findOwnedPersonaIdentity: async () => ({
          id: "alternate-from-persona",
        }),
      } as any,
      {
        assertNoInteractionBlock: async () => undefined,
      } as any,
      {} as any,
      {} as any,
      {
        reserveAndCreate: async (
          _userId: string,
          callback: (tx: any) => Promise<any>,
        ) =>
          callback({
            contactRequest: {
              create: async () => ({
                id: "request-id",
                status: PrismaContactRequestStatus.PENDING,
                createdAt: new Date("2026-03-22T12:00:00.000Z"),
                toPersona: {
                  id: "target-persona",
                  username: "target",
                  fullName: "Target User",
                },
              }),
            },
          }),
      } as any,
    );

    const result = await service.create("sender-user", {
      fromPersonaId: "alternate-from-persona",
      toPersonaId: "target-persona",
      sourceType: ContactRequestSourceType.Profile,
    });

    assert.equal(result.id, "request-id");
  });

  it("rejects requests to verified-only personas from unverified users", async () => {
    const service = new ContactRequestsService(
      {
        persona: {
          findUnique: async () => ({
            id: "target-persona",
            userId: "target-user",
            username: "target",
            fullName: "Target User",
            accessMode: PrismaPersonaAccessMode.REQUEST,
            sharingMode: PrismaPersonaSharingMode.CONTROLLED,
            smartCardConfig: null,
            verifiedOnly: true,
          }),
        },
        user: {
          findUnique: async () => ({
            id: "sender-user",
            isVerified: false,
          }),
        },
      } as any,
      {
        findOwnedPersonaIdentity: async () => ({ id: "from-persona" }),
      } as any,
      {
        assertNoInteractionBlock: async () => undefined,
      } as any,
      {} as any,
      {} as any,
      {
        consume: async () => undefined,
      } as any,
    );

    await assert.rejects(
      service.create("sender-user", {
        fromPersonaId: "from-persona",
        toPersonaId: "target-persona",
        sourceType: ContactRequestSourceType.Profile,
      }),
      (error: unknown) => {
        assert.ok(error instanceof ForbiddenException);
        assert.equal(error.message, "Verified profiles only");
        return true;
      },
    );
  });

  it("rejects requests to private personas server-side", async () => {
    const service = new ContactRequestsService(
      {
        persona: {
          findUnique: async () => ({
            id: "target-persona",
            userId: "target-user",
            username: "target",
            fullName: "Target User",
            accessMode: PrismaPersonaAccessMode.PRIVATE,
            verifiedOnly: false,
          }),
        },
      } as any,
      {
        findOwnedPersonaIdentity: async () => ({ id: "from-persona" }),
      } as any,
      {
        assertNoInteractionBlock: async () => undefined,
      } as any,
      {} as any,
      {} as any,
      {
        consume: async () => undefined,
      } as any,
    );

    await assert.rejects(
      service.create("sender-user", {
        fromPersonaId: "from-persona",
        toPersonaId: "target-persona",
        sourceType: ContactRequestSourceType.Profile,
      }),
      (error: unknown) => {
        assert.ok(error instanceof ForbiddenException);
        assert.equal(error.message, "Cannot request private profile");
        return true;
      },
    );
  });

  it("rejects profile requests when smart card mode disables request access", async () => {
    const service = new ContactRequestCreateService(
      {
        qRAccessToken: {
          findFirst: async () => ({ id: "profile-qr-1" }),
        },
      } as any,
      {
        resolveEligibleParticipants: async () => ({
          fromPersona: { id: "from-persona", fullName: "Sender Persona" },
          targetPersona: {
            id: "target-persona",
            userId: "target-user",
            username: "target",
            fullName: "Target User",
            accessMode: PrismaPersonaAccessMode.OPEN,
            sharingMode: PrismaPersonaSharingMode.SMART_CARD,
            smartCardConfig: {
              primaryAction: "instant_connect",
              allowCall: true,
            },
            verifiedOnly: false,
          },
          senderUser: { id: "sender-user", isVerified: true },
        }),
      } as any,
      {
        assertCanCreateRequest: async () => undefined,
      } as any,
      {
        assertSourceAccess: async () => ({
          sourceType: ContactRequestSourceType.Profile,
          sourceId: null,
        }),
      } as any,
      {
        reserveAndCreate: async () => {
          throw new Error("should not create request");
        },
      } as any,
      {
        createSafe: async () => undefined,
      } as any,
      {
        trackRequestSent: async () => undefined,
      } as any,
      {
        assertUserIsVerified: async () => undefined,
      } as any,
    );

    await assert.rejects(
      service.create("sender-user", {
        fromPersonaId: "from-persona",
        toPersonaId: "target-persona",
        sourceType: ContactRequestSourceType.Profile,
      }),
      (error: unknown) => {
        assert.ok(error instanceof ForbiddenException);
        assert.equal(
          error.message,
          "This profile is not accepting requests at this time.",
        );
        return true;
      },
    );
  });

  it("allows profile requests when instant connect has no active profile QR", async () => {
    let created = false;

    const service = new ContactRequestCreateService(
      {
        qRAccessToken: {
          findFirst: async () => null,
        },
      } as any,
      {
        resolveEligibleParticipants: async () => ({
          fromPersona: { id: "from-persona", fullName: "Sender Persona" },
          targetPersona: {
            id: "target-persona",
            userId: "target-user",
            username: "target",
            fullName: "Target User",
            accessMode: PrismaPersonaAccessMode.OPEN,
            sharingMode: PrismaPersonaSharingMode.SMART_CARD,
            smartCardConfig: {
              primaryAction: "instant_connect",
              allowCall: true,
            },
            verifiedOnly: false,
          },
          senderUser: { id: "sender-user", isVerified: true },
        }),
      } as any,
      {
        assertCanCreateRequest: async () => undefined,
      } as any,
      {
        assertSourceAccess: async () => ({
          sourceType: ContactRequestSourceType.Profile,
          sourceId: null,
        }),
      } as any,
      {
        reserveAndCreate: async () => {
          created = true;

          return {
            id: "request-id",
            status: PrismaContactRequestStatus.PENDING,
            createdAt: new Date("2026-03-22T12:00:00.000Z"),
            toPersona: {
              id: "target-persona",
              username: "target",
              fullName: "Target User",
            },
          };
        },
      } as any,
      {
        createSafe: async () => undefined,
      } as any,
      {
        trackRequestSent: async () => undefined,
      } as any,
      {
        assertUserIsVerified: async () => undefined,
      } as any,
    );

    const result = await service.create("sender-user", {
      fromPersonaId: "from-persona",
      toPersonaId: "target-persona",
      sourceType: ContactRequestSourceType.Profile,
    });

    assert.equal(created, true);
    assert.equal(result.id, "request-id");
  });

  it("blocks approval when a block exists before approval", async () => {
    const service = new ContactRequestsService(
      {
        $transaction: async <T>(callback: (tx: any) => Promise<T>) =>
          callback({
            contactRequest: {
              findUnique: async () => ({
                id: "request-id",
                status: PrismaContactRequestStatus.PENDING,
                fromUserId: "sender-user",
                toUserId: "receiver-user",
                fromPersonaId: "from-persona",
                toPersonaId: "to-persona",
                sourceType: PrismaContactRequestSourceType.PROFILE,
                sourceId: null,
              }),
            },
          }),
      } as any,
      {} as any,
      {
        assertNoInteractionBlock: async () => {
          throw new ForbiddenException("User has blocked you");
        },
      } as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await assert.rejects(
      service.approve("receiver-user", "request-id"),
      (error: unknown) => {
        assert.ok(error instanceof ForbiddenException);
        assert.equal(error.message, "User has blocked you");
        return true;
      },
    );
  });
});

describe("RequestRateLimitService", () => {
  it("returns 429 after the hourly request cap is reached", () => {
    const service = new RequestRateLimitService({
      contactRequest: {
        count: async () => 20,
      },
    } as any);

    return assert.rejects(
      service.consume("sender-user", new Date()),
      (error: unknown) => {
        assert.ok(error instanceof HttpException);
        assert.equal(error.message, "Requests are temporarily limited");
        assert.equal(error.getStatus(), 429);
        return true;
      },
    );
  });

  it("returns 429 from the atomic reservation path after the hourly cap is reached", () => {
    const service = new RequestRateLimitService({
      $transaction: async <T>(callback: (tx: any) => Promise<T>) =>
        callback({
          $executeRaw: async () => undefined,
          contactRequest: {
            count: async () => 20,
          },
        }),
    } as any);

    return assert.rejects(
      service.reserveAndCreate("sender-user", async () => ({
        id: "request-id",
      })),
      (error: unknown) => {
        assert.ok(error instanceof HttpException);
        assert.equal(error.message, "Requests are temporarily limited");
        assert.equal(error.getStatus(), 429);
        return true;
      },
    );
  });
});

describe("BlocksService", () => {
  it("cancels pending requests when a block is created", async () => {
    let updateManyPayload: Record<string, unknown> | null = null;
    let deleteManyPayload: Record<string, unknown> | null = null;

    const service = new BlocksService({
      user: {
        findUnique: async () => ({ id: "blocked-user" }),
      },
      $transaction: async <T>(callback: (tx: any) => Promise<T>) =>
        callback({
          block: {
            findUnique: async () => null,
            create: async () => ({
              id: "block-id",
              blockerUserId: "blocker-user",
              blockedUserId: "blocked-user",
              createdAt: new Date("2026-03-20T10:00:00.000Z"),
            }),
          },
          contactRequest: {
            updateMany: async (payload: Record<string, unknown>) => {
              updateManyPayload = payload;
              return { count: 1 };
            },
          },
          contactRelationship: {
            deleteMany: async (payload: Record<string, unknown>) => {
              deleteManyPayload = payload;
              return { count: 2 };
            },
          },
        }),
    } as any);

    const result = await service.create("blocker-user", "blocked-user");

    assert.equal(result.id, "block-id");
    assert.equal(result.blockedUserId, "blocked-user");
    assert.ok(updateManyPayload);
    assert.deepEqual((updateManyPayload as any).where, {
      status: PrismaContactRequestStatus.PENDING,
      OR: [
        {
          fromUserId: "blocker-user",
          toUserId: "blocked-user",
        },
        {
          fromUserId: "blocked-user",
          toUserId: "blocker-user",
        },
      ],
    });
    assert.equal(
      (updateManyPayload as any).data.status,
      PrismaContactRequestStatus.CANCELLED,
    );
    assert.deepEqual((deleteManyPayload as any).where, {
      OR: [
        {
          ownerUserId: "blocker-user",
          targetUserId: "blocked-user",
        },
        {
          ownerUserId: "blocked-user",
          targetUserId: "blocker-user",
        },
      ],
    });
  });

  it("returns the correct error when the sender has blocked the receiver", async () => {
    const service = new BlocksService({
      block: {
        findMany: async () => [
          {
            blockerUserId: "sender-user",
            blockedUserId: "target-user",
          },
        ],
      },
    } as any);

    await assert.rejects(
      service.assertNoInteractionBlock("sender-user", "target-user"),
      (error: unknown) => {
        assert.ok(error instanceof ForbiddenException);
        assert.equal(error.message, "You have blocked this user");
        return true;
      },
    );
  });
});
