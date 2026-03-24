import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { ConflictException, NotFoundException } from "@nestjs/common";
import {
  ContactRelationshipState as PrismaContactRelationshipState,
  ContactRequestSourceType as PrismaContactRequestSourceType,
  ContactRequestStatus as PrismaContactRequestStatus,
} from "../src/generated/prisma/client";

import { PersonaSharingMode } from "../src/common/enums/persona-sharing-mode.enum";
import { ContactRequestRespondService } from "../src/modules/contact-requests/contact-request-respond.service";
import { FollowUpsService } from "../src/modules/follow-ups/follow-ups.service";
import { PersonasService } from "../src/modules/personas/personas.service";
import { RelationshipsService } from "../src/modules/relationships/relationships.service";

async function captureNotFound(action: () => Promise<unknown>) {
  try {
    await action();
    assert.fail("Expected NotFoundException");
  } catch (error) {
    assert.ok(error instanceof NotFoundException);

    return {
      message: error.message,
      status: error.getStatus(),
    };
  }
}

describe("Sprint 1 ownership contract", () => {
  it("returns the same not found for missing and foreign persona sharing targets", async () => {
    const missingService = new PersonasService({
      persona: {
        findUnique: async () => null,
      },
    } as any);
    const foreignService = new PersonasService({
      persona: {
        findUnique: async () => ({
          userId: "user-2",
          accessMode: "REQUEST",
          sharingMode: "CONTROLLED",
          smartCardConfig: null,
          publicPhone: null,
          publicWhatsappNumber: null,
          publicEmail: null,
        }),
      },
    } as any);

    const missing = await captureNotFound(() =>
      missingService.updateSharingMode("user-1", "persona-1", {
        sharingMode: PersonaSharingMode.Controlled,
      }),
    );
    const foreign = await captureNotFound(() =>
      foreignService.updateSharingMode("user-1", "persona-1", {
        sharingMode: PersonaSharingMode.Controlled,
      }),
    );

    assert.deepEqual(foreign, missing);
  });

  it("returns the same not found for missing and foreign contact request approval", async () => {
    const createService = (contactRequest: unknown) =>
      new ContactRequestRespondService(
        {
          $transaction: async <T>(callback: (tx: any) => Promise<T>) =>
            callback({
              contactRequest: {
                findUnique: async () => contactRequest,
              },
            }),
        } as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
      );

    const missing = await captureNotFound(() =>
      createService(null).approve("user-1", "request-1"),
    );
    const foreign = await captureNotFound(() =>
      createService({
        id: "request-1",
        status: PrismaContactRequestStatus.PENDING,
        fromUserId: "user-2",
        toUserId: "user-3",
        fromPersonaId: "persona-2",
        toPersonaId: "persona-3",
        sourceType: PrismaContactRequestSourceType.PROFILE,
        sourceId: null,
        toPersona: {
          fullName: "Foreign Owner",
        },
      }).approve("user-1", "request-1"),
    );

    assert.deepEqual(foreign, missing);
  });

  it("returns the same not found for missing and foreign contact request rejection", async () => {
    const createService = (contactRequest: unknown) =>
      new ContactRequestRespondService(
        {
          contactRequest: {
            findUnique: async () => contactRequest,
          },
        } as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
      );

    const missing = await captureNotFound(() =>
      createService(null).reject("user-1", "request-1"),
    );
    const foreign = await captureNotFound(() =>
      createService({
        id: "request-1",
        toUserId: "user-3",
        status: PrismaContactRequestStatus.PENDING,
      }).reject("user-1", "request-1"),
    );

    assert.deepEqual(foreign, missing);
  });

  it("preserves owned contact request success and conflict behavior", async () => {
    const approvedService = new ContactRequestRespondService(
      {
        $transaction: async <T>(callback: (tx: any) => Promise<T>) =>
          callback({
            contactRequest: {
              findUnique: async () => ({
                id: "request-1",
                status: PrismaContactRequestStatus.PENDING,
                fromUserId: "user-2",
                toUserId: "user-1",
                fromPersonaId: "persona-2",
                toPersonaId: "persona-1",
                sourceType: PrismaContactRequestSourceType.PROFILE,
                sourceId: null,
                toPersona: {
                  fullName: "Owner Persona",
                },
              }),
              updateMany: async () => ({ count: 1 }),
            },
          }),
      } as any,
      {
        assertNoInteractionBlock: async () => undefined,
      } as any,
      {
        createApprovedRelationship: async () => ({
          id: "relationship-1",
          reciprocalRelationshipId: null,
        }),
        updateInteractionMetadata: async () => null,
      } as any,
      {
        createInitialMemory: async () => ({ id: "memory-1" }),
      } as any,
      {
        createSafe: async () => undefined,
      } as any,
      {
        trackRequestApproved: async () => undefined,
        trackContactCreated: async () => undefined,
      } as any,
    );
    const rejectedConflictService = new ContactRequestRespondService(
      {
        contactRequest: {
          findUnique: async () => ({
            id: "request-1",
            toUserId: "user-1",
            status: PrismaContactRequestStatus.APPROVED,
          }),
        },
      } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    const approved = await approvedService.approve("user-1", "request-1");

    assert.deepEqual(approved, {
      requestId: "request-1",
      status: "approved",
      relationshipId: "relationship-1",
    });

    await assert.rejects(
      rejectedConflictService.reject("user-1", "request-1"),
      (error: unknown) => {
        assert.ok(error instanceof ConflictException);
        assert.equal(
          error.message,
          "Only pending contact requests can be rejected",
        );
        return true;
      },
    );
  });

  it("returns the same not found for missing and foreign follow-up relationship ownership", async () => {
    const createService = (relationship: unknown) =>
      new FollowUpsService(
        {
          $transaction: async <T>(callback: (tx: any) => Promise<T>) =>
            callback({
              contactRelationship: {
                findUnique: async () => relationship,
              },
            }),
        } as any,
        {
          expireRelationshipIfNeeded: async (_tx: unknown, current: unknown) =>
            current,
        } as any,
      );

    const dto = {
      relationshipId: "relationship-1",
      remindAt: "2099-04-10T10:00:00.000Z",
    };
    const missing = await captureNotFound(() =>
      createService(null).createFollowUp("user-1", dto),
    );
    const foreign = await captureNotFound(() =>
      createService({
        id: "relationship-1",
        ownerUserId: "user-3",
        state: PrismaContactRelationshipState.APPROVED,
        accessEndAt: null,
      }).createFollowUp("user-1", dto),
    );

    assert.deepEqual(foreign, missing);
  });

  it("returns the same not found for missing and foreign relationship upgrades", async () => {
    const createService = (relationship: unknown) =>
      new RelationshipsService({
        $transaction: async <T>(callback: (tx: any) => Promise<T>) =>
          callback({
            contactRelationship: {
              findUnique: async () => relationship,
            },
          }),
      } as any);

    const missing = await captureNotFound(() =>
      createService(null).upgradeOwnedRelationship("user-1", "relationship-1"),
    );
    const foreign = await captureNotFound(() =>
      createService({
        id: "relationship-1",
        ownerUserId: "user-3",
        state: PrismaContactRelationshipState.INSTANT_ACCESS,
        accessEndAt: new Date("2099-04-10T10:00:00.000Z"),
      }).upgradeOwnedRelationship("user-1", "relationship-1"),
    );

    assert.deepEqual(foreign, missing);
  });

  it("returns the same not found for missing and foreign relationship expiry", async () => {
    const createService = (relationship: unknown) =>
      new RelationshipsService({
        $transaction: async <T>(callback: (tx: any) => Promise<T>) =>
          callback({
            contactRelationship: {
              findUnique: async () => relationship,
            },
          }),
      } as any);

    const missing = await captureNotFound(() =>
      createService(null).expireOwnedRelationship("user-1", "relationship-1"),
    );
    const foreign = await captureNotFound(() =>
      createService({
        id: "relationship-1",
        ownerUserId: "user-3",
        state: PrismaContactRelationshipState.INSTANT_ACCESS,
        accessEndAt: new Date("2099-04-10T10:00:00.000Z"),
      }).expireOwnedRelationship("user-1", "relationship-1"),
    );

    assert.deepEqual(foreign, missing);
  });
});
