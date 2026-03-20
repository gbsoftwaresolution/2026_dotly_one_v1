import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import {
  BadRequestException,
  ForbiddenException,
  HttpException,
} from "@nestjs/common";
import {
  ContactRequestSourceType as PrismaContactRequestSourceType,
  ContactRequestStatus as PrismaContactRequestStatus,
  PersonaAccessMode as PrismaPersonaAccessMode,
} from "@prisma/client";

import { ContactRequestSourceType } from "../src/common/enums/contact-request-source-type.enum";
import { BlocksService } from "../src/modules/blocks/blocks.service";
import { ContactRequestsService } from "../src/modules/contact-requests/contact-requests.service";
import { RequestRateLimitService } from "../src/modules/contact-requests/request-rate-limit.service";

describe("ContactRequestsService", () => {
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
      new RequestRateLimitService(),
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
      new RequestRateLimitService(),
    );

    await assert.rejects(
      service.create("sender-user", {
        fromPersonaId: "from-persona",
        toPersonaId: "target-persona",
        sourceType: ContactRequestSourceType.Profile,
      }),
      (error: unknown) => {
        assert.ok(error instanceof BadRequestException);
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
      new RequestRateLimitService(),
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
});

describe("RequestRateLimitService", () => {
  it("returns 429 after the hourly request cap is reached", () => {
    const service = new RequestRateLimitService();
    const start = Date.now();

    for (let index = 0; index < 20; index += 1) {
      service.consume("sender-user", start + index);
    }

    assert.throws(
      () => service.consume("sender-user", start + 21),
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
