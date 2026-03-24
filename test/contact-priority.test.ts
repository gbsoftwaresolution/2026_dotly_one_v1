import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import {
  ContactRelationshipState as PrismaContactRelationshipState,
  ContactRequestSourceType as PrismaContactRequestSourceType,
  RelationshipConnectionSource as PrismaRelationshipConnectionSource,
} from "../src/generated/prisma/client";
import { ContactsService } from "../src/modules/contacts/contacts.service";
import { calculateRelationshipPriority } from "../src/modules/contacts/relationship-priority.util";

const DAY_IN_MS = 24 * 60 * 60 * 1000;

function createRelationshipRecord(overrides: Record<string, unknown> = {}) {
  const createdAt = new Date("2099-04-01T09:00:00.000Z");

  return {
    id: "relationship-id",
    state: PrismaContactRelationshipState.APPROVED,
    accessEndAt: null,
    lastInteractionAt: null,
    interactionCount: 0,
    notes: null,
    createdAt,
    connectedAt: createdAt,
    metAt: createdAt,
    connectionSource: PrismaRelationshipConnectionSource.MANUAL,
    contextLabel: null,
    sourceType: PrismaContactRequestSourceType.PROFILE,
    connectionContext: null,
    targetPersona: {
      id: "persona-id",
      username: "contact",
      publicUrl: "dotly.id/contact",
      fullName: "Contact User",
      jobTitle: "Engineer",
      companyName: "Dotly",
      tagline: "Hello",
      profilePhotoUrl: null,
    },
    memories: [],
    ...overrides,
  };
}

describe("relationship priority", () => {
  it("applies recency, urgency, and connection weighting", () => {
    const now = new Date("2099-04-10T12:00:00.000Z");

    const score = calculateRelationshipPriority(
      {
        lastInteractionAt: new Date("2099-04-10T08:00:00.000Z"),
        connectedAt: new Date("2099-04-10T07:00:00.000Z"),
        hasPendingFollowUp: true,
        isOverdue: true,
        isUpcomingSoon: false,
      },
      now,
    );

    assert.equal(score, 120);
  });

  it("sorts contact lists by computed priority and exposes summary fields", async () => {
    const now = Date.now();
    const recentInteractionAt = new Date(now - 2 * 60 * 60 * 1000);
    const staleInteractionAt = new Date(now - 8 * DAY_IN_MS);
    const recentConnectionAt = new Date(now - 2 * DAY_IN_MS);
    const staleConnectionAt = new Date(now - 20 * DAY_IN_MS);

    const relationships = [
      createRelationshipRecord({
        id: "recent-id",
        lastInteractionAt: recentInteractionAt,
        interactionCount: 3,
        createdAt: recentConnectionAt,
        connectedAt: recentConnectionAt,
        metAt: recentConnectionAt,
        targetPersona: {
          id: "persona-recent",
          username: "recent",
          publicUrl: "dotly.id/recent",
          fullName: "Recent User",
          jobTitle: "Designer",
          companyName: "Dotly",
          tagline: "Recent",
          profilePhotoUrl: null,
        },
      }),
      createRelationshipRecord({
        id: "overdue-id",
        lastInteractionAt: staleInteractionAt,
        interactionCount: 1,
        createdAt: staleConnectionAt,
        connectedAt: staleConnectionAt,
        metAt: staleConnectionAt,
        targetPersona: {
          id: "persona-overdue",
          username: "overdue",
          publicUrl: "dotly.id/overdue",
          fullName: "Overdue User",
          jobTitle: "Founder",
          companyName: "Dotly",
          tagline: "Needs follow-up",
          profilePhotoUrl: null,
        },
      }),
      createRelationshipRecord({
        id: "pending-id",
        createdAt: recentConnectionAt,
        connectedAt: recentConnectionAt,
        metAt: recentConnectionAt,
        targetPersona: {
          id: "persona-pending",
          username: "pending",
          publicUrl: "dotly.id/pending",
          fullName: "Pending User",
          jobTitle: "Advisor",
          companyName: "Dotly",
          tagline: "Queued",
          profilePhotoUrl: null,
        },
      }),
    ];

    const followUpBatchCalls: Array<{ userId: string; relationshipIds: string[] }> = [];

    const service = new ContactsService(
      {
        contactRelationship: {
          findMany: async () => relationships,
        },
      } as any,
      {} as any,
      {
        expireOwnedExpiredRelationships: async () => undefined,
      } as any,
      {
        getFollowUpSummariesForRelationships: async (
          userId: string,
          relationshipIds: string[],
        ) => {
          followUpBatchCalls.push({ userId, relationshipIds });

          return new Map([
            [
              "overdue-id",
              {
                hasPendingFollowUp: true,
                nextFollowUpAt: new Date(now - 60 * 60 * 1000),
                pendingFollowUpCount: 1,
                hasPassiveInactivityFollowUp: false,
                isTriggered: false,
                isOverdue: true,
                isUpcomingSoon: false,
              },
            ],
            [
              "pending-id",
              {
                hasPendingFollowUp: true,
                nextFollowUpAt: new Date(now + 48 * 60 * 60 * 1000),
                pendingFollowUpCount: 1,
                hasPassiveInactivityFollowUp: false,
                isTriggered: false,
                isOverdue: false,
                isUpcomingSoon: false,
              },
            ],
          ]);
        },
      } as any,
    );

    const result = await service.findAll("owner-user", {} as any);

    assert.deepEqual(
      result.map((contact) => contact.id),
      ["overdue-id", "recent-id", "pending-id"],
    );
    assert.equal(result[0]?.relationshipId, "overdue-id");
    assert.equal(result[0]?.contact.fullName, "Overdue User");
    assert.equal(result[0]?.hasPendingFollowUp, true);
    assert.equal(result[0]?.followUpSummary.isOverdue, true);
    assert.equal(result[0]?.priorityScore, 75);
    assert.equal(result[1]?.priorityScore, 65);
    assert.equal(result[2]?.priorityScore, 45);
    assert.equal(result[1]?.hasPendingFollowUp, false);
    assert.equal(result[2]?.followUpSummary.hasPendingFollowUp, true);
    assert.deepEqual(followUpBatchCalls, [
      {
        userId: "owner-user",
        relationshipIds: ["recent-id", "overdue-id", "pending-id"],
      },
    ]);
  });
});