import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import {
  ContactRelationshipState as PrismaContactRelationshipState,
  ContactRequestSourceType as PrismaContactRequestSourceType,
  ContactRequestStatus as PrismaContactRequestStatus,
} from "../src/generated/prisma/client";

const PrismaFollowUpStatus = {
  PENDING: "PENDING",
} as const;

import { ContactRequestRespondService } from "../src/modules/contact-requests/contact-request-respond.service";
import { ContactsService } from "../src/modules/contacts/contacts.service";
import { FollowUpsService } from "../src/modules/follow-ups/follow-ups.service";

describe("Sprint 2 event approval context", () => {
  it("persists event context on approved relationships", async () => {
    const relationshipCalls: Array<Record<string, unknown>> = [];

    const service = new ContactRequestRespondService(
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
                sourceType: PrismaContactRequestSourceType.EVENT,
                sourceId: "event-id",
                toPersona: {
                  fullName: "Receiver User",
                },
              }),
              updateMany: async () => ({ count: 1 }),
            },
            event: {
              findUnique: async () => ({
                name: "Dotly Summit",
              }),
            },
          }),
      } as any,
      {
        assertNoInteractionBlock: async () => undefined,
      } as any,
      {
        createApprovedRelationship: async (
          _tx: unknown,
          payload: Record<string, unknown>,
        ) => {
          relationshipCalls.push(payload);
          return {
            id: "relationship-id",
            reciprocalRelationshipId: null,
          };
        },
        updateInteractionMetadata: async () => null,
      } as any,
      {
        createInitialMemory: async () => ({ id: "memory-id" }),
      } as any,
      {
        createSafe: async () => undefined,
      } as any,
      {
        trackRequestApproved: async () => undefined,
        trackContactCreated: async () => undefined,
      } as any,
    );

    await service.approve("receiver-user", "request-id");

    assert.deepEqual(relationshipCalls, [
      {
        ownerUserId: "receiver-user",
        targetUserId: "sender-user",
        ownerPersonaId: "to-persona",
        targetPersonaId: "from-persona",
        sourceType: PrismaContactRequestSourceType.EVENT,
        sourceId: "event-id",
        connectionContext: {
          type: "event",
          eventId: "event-id",
          label: "Dotly Summit",
        },
      },
    ]);
  });

  it("creates event-aware contact memory on event request approval", async () => {
    const memoryCalls: Array<Record<string, unknown>> = [];

    const service = new ContactRequestRespondService(
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
                sourceType: PrismaContactRequestSourceType.EVENT,
                sourceId: "event-id",
                toPersona: {
                  fullName: "Receiver User",
                },
              }),
              updateMany: async () => ({ count: 1 }),
            },
            event: {
              findUnique: async () => ({
                name: "Dotly Summit",
              }),
            },
          }),
      } as any,
      {
        assertNoInteractionBlock: async () => undefined,
      } as any,
      {
        createApprovedRelationship: async () => ({
          id: "relationship-id",
          reciprocalRelationshipId: null,
        }),
        updateInteractionMetadata: async () => null,
      } as any,
      {
        createInitialMemory: async (
          _tx: unknown,
          payload: Record<string, unknown>,
        ) => {
          memoryCalls.push(payload);
          return { id: "memory-id" };
        },
      } as any,
      {
        createSafe: async () => undefined,
      } as any,
      {
        trackRequestApproved: async () => undefined,
        trackContactCreated: async () => undefined,
      } as any,
    );

    await service.approve("receiver-user", "request-id");

    assert.equal(memoryCalls.length, 1);
    assert.equal(memoryCalls[0]?.relationshipId, "relationship-id");
    assert.equal(memoryCalls[0]?.eventId, "event-id");
    assert.equal(memoryCalls[0]?.contextLabel, "Dotly Summit");
    assert.equal(memoryCalls[0]?.sourceLabel, "Event");
    assert.ok(memoryCalls[0]?.metAt instanceof Date);
  });

  it("keeps non-event approvals unchanged", async () => {
    const relationshipCalls: Array<Record<string, unknown>> = [];
    const memoryCalls: Array<Record<string, unknown>> = [];

    const service = new ContactRequestRespondService(
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
                toPersona: {
                  fullName: "Receiver User",
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
        createApprovedRelationship: async (
          _tx: unknown,
          payload: Record<string, unknown>,
        ) => {
          relationshipCalls.push(payload);
          return {
            id: "relationship-id",
            reciprocalRelationshipId: null,
          };
        },
        updateInteractionMetadata: async () => null,
      } as any,
      {
        createInitialMemory: async (
          _tx: unknown,
          payload: Record<string, unknown>,
        ) => {
          memoryCalls.push(payload);
          return { id: "memory-id" };
        },
      } as any,
      {
        createSafe: async () => undefined,
      } as any,
      {
        trackRequestApproved: async () => undefined,
        trackContactCreated: async () => undefined,
      } as any,
    );

    await service.approve("receiver-user", "request-id");

    assert.equal(
      relationshipCalls[0]?.sourceType,
      PrismaContactRequestSourceType.PROFILE,
    );
    assert.equal(relationshipCalls[0]?.sourceId, null);
    assert.equal(relationshipCalls[0]?.connectionContext, null);
    assert.equal(memoryCalls[0]?.eventId, null);
    assert.equal(memoryCalls[0]?.contextLabel, null);
    assert.equal(memoryCalls[0]?.sourceLabel, "Profile");
  });

  it("contacts list/detail prefer memory context label, then connection context label", async () => {
    const now = new Date();
    const relationships = [
      {
        id: "relationship-memory-first",
        ownerUserId: "owner-user",
        targetUserId: "target-user",
        state: PrismaContactRelationshipState.APPROVED,
        accessStartAt: null,
        accessEndAt: null,
        lastInteractionAt: now,
        interactionCount: 1,
        createdAt: now,
        sourceType: PrismaContactRequestSourceType.EVENT,
        connectionContext: {
          type: "event",
          eventId: "event-id",
          label: "Stored Event Label",
        },
        targetPersona: {
          id: "persona-1",
          username: "alice",
          publicUrl: "dotly.id/alice",
          fullName: "Alice",
          jobTitle: null,
          companyName: null,
          tagline: null,
          profilePhotoUrl: null,
          accessMode: "OPEN",
        },
        memories: [
          {
            id: "memory-1",
            eventId: "event-id",
            contextLabel: "Memory Event Label",
            metAt: now,
            sourceLabel: "Event",
            note: null,
          },
        ],
      },
      {
        id: "relationship-context-fallback",
        ownerUserId: "owner-user",
        targetUserId: "target-user",
        state: PrismaContactRelationshipState.APPROVED,
        accessStartAt: null,
        accessEndAt: null,
        lastInteractionAt: now,
        interactionCount: 1,
        createdAt: now,
        sourceType: PrismaContactRequestSourceType.EVENT,
        connectionContext: {
          type: "event",
          eventId: "event-2",
          label: "Connection Event Label",
        },
        targetPersona: {
          id: "persona-2",
          username: "bob",
          publicUrl: "dotly.id/bob",
          fullName: "Bob",
          jobTitle: null,
          companyName: null,
          tagline: null,
          profilePhotoUrl: null,
          accessMode: "OPEN",
        },
        memories: [
          {
            id: "memory-2",
            eventId: "event-2",
            contextLabel: "   ",
            metAt: now,
            sourceLabel: "Event",
            note: null,
          },
        ],
      },
    ];

    const service = new ContactsService(
      {
        contactRelationship: {
          findMany: async () => relationships,
          findFirst: async ({ where }: { where: { id: string } }) =>
            relationships.find(
              (relationship) => relationship.id === where.id,
            ) ?? null,
        },
      } as any,
      {} as any,
      {
        expireOwnedExpiredRelationships: async () => undefined,
        expireRelationshipIfNeeded: async (
          _tx: unknown,
          relationship: unknown,
        ) => relationship,
      } as any,
      {
        getFollowUpSummaryForRelationship: async () => ({
          hasPendingFollowUp: false,
          nextFollowUpAt: null,
          pendingFollowUpCount: 0,
          isTriggered: false,
          isOverdue: false,
          isUpcomingSoon: false,
        }),
      } as any,
    );

    const list = await service.findAll("owner-user", {} as any);
    const detail = await service.findOne(
      "owner-user",
      "relationship-context-fallback",
    );
    const memoryFirstContact = list.find(
      (relationship) => relationship.relationshipId === "relationship-memory-first",
    );
    const contextFallbackContact = list.find(
      (relationship) => relationship.relationshipId === "relationship-context-fallback",
    );

    assert.equal(memoryFirstContact?.memory.sourceLabel, "Event");
    assert.equal(memoryFirstContact?.contextLabel, "Memory Event Label");
    assert.equal(contextFallbackContact?.memory.sourceLabel, "Event");
    assert.equal(contextFallbackContact?.contextLabel, "Connection Event Label");
    assert.equal(detail.memory.sourceLabel, "Event");
    assert.equal(detail.contextLabel, "Connection Event Label");
  });

  it("follow-up relationship labels prefer memory context label, then connection context label", async () => {
    const now = new Date("2099-04-01T09:00:00.000Z");
    const service = new FollowUpsService(
      {
        followUp: {
          findFirst: async ({ where }: { where: { id: string } }) => {
            if (where.id === "follow-up-memory-first") {
              return {
                id: "follow-up-memory-first",
                ownerUserId: "owner-user",
                relationshipId: "relationship-1",
                remindAt: new Date("2099-04-10T10:00:00.000Z"),
                triggeredAt: null,
                status: PrismaFollowUpStatus.PENDING,
                note: null,
                createdAt: now,
                updatedAt: now,
                completedAt: null,
                relationship: {
                  id: "relationship-1",
                  ownerUserId: "owner-user",
                  state: PrismaContactRelationshipState.APPROVED,
                  sourceType: PrismaContactRequestSourceType.EVENT,
                  connectionContext: {
                    type: "event",
                    eventId: "event-id",
                    label: "Stored Event Label",
                  },
                  accessEndAt: null,
                  memories: [
                    {
                      contextLabel: "Memory Event Label",
                      sourceLabel: "Event",
                    },
                  ],
                  targetPersona: {
                    id: "persona-1",
                    username: "alice",
                    fullName: "Alice",
                    jobTitle: null,
                    companyName: null,
                    profilePhotoUrl: null,
                  },
                },
              };
            }

            return {
              id: "follow-up-context-fallback",
              ownerUserId: "owner-user",
              relationshipId: "relationship-2",
              remindAt: new Date("2099-04-10T10:00:00.000Z"),
              triggeredAt: null,
              status: PrismaFollowUpStatus.PENDING,
              note: null,
              createdAt: now,
              updatedAt: now,
              completedAt: null,
              relationship: {
                id: "relationship-2",
                ownerUserId: "owner-user",
                state: PrismaContactRelationshipState.APPROVED,
                sourceType: PrismaContactRequestSourceType.EVENT,
                connectionContext: {
                  type: "event",
                  eventId: "event-id",
                  label: "Connection Event Label",
                },
                accessEndAt: null,
                memories: [
                  {
                    contextLabel: "   ",
                    sourceLabel: "Event",
                  },
                ],
                targetPersona: {
                  id: "persona-2",
                  username: "bob",
                  fullName: "Bob",
                  jobTitle: null,
                  companyName: null,
                  profilePhotoUrl: null,
                },
              },
            };
          },
        },
      } as any,
      {
        expireOwnedExpiredRelationships: async () => undefined,
        expireExpiredRelationships: async () => undefined,
        expireRelationshipIfNeeded: async (
          _tx: unknown,
          relationship: unknown,
        ) => relationship,
      } as any,
    );

    const memoryFirst = await service.getFollowUp(
      "owner-user",
      "follow-up-memory-first",
    );
    const contextFallback = await service.getFollowUp(
      "owner-user",
      "follow-up-context-fallback",
    );

    assert.equal(memoryFirst.relationship.sourceLabel, "Memory Event Label");
    assert.equal(
      contextFallback.relationship.sourceLabel,
      "Connection Event Label",
    );
  });
});
