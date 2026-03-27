import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { ActivationMilestonesService } from "../src/modules/users/activation-milestones.service";

function createService(initialActivationMilestonesJson: unknown = null) {
  let storedActivationMilestonesJson = initialActivationMilestonesJson;

  const prismaService = {
    user: {
      findUnique: async () => ({
        id: "user-1",
        lastUsedPersonaId: null,
        activationMilestonesJson: storedActivationMilestonesJson,
      }),
      update: async ({ data }: any) => {
        storedActivationMilestonesJson = data.activationMilestonesJson;
        return {
          id: "user-1",
          activationMilestonesJson: storedActivationMilestonesJson,
        };
      },
    },
    persona: {
      findMany: async () => [],
      findUnique: async () => null,
    },
    qRAccessToken: {
      findFirst: async () => null,
    },
    analyticsEvent: {
      findFirst: async () => null,
    },
    contactRequest: {
      findFirst: async () => null,
    },
    $transaction: async (callback: (tx: any) => Promise<unknown>) =>
      callback({
        user: {
          findUnique: async () => ({
            id: "user-1",
            activationMilestonesJson: storedActivationMilestonesJson,
          }),
          update: async ({ data }: any) => {
            storedActivationMilestonesJson = data.activationMilestonesJson;
            return {
              id: "user-1",
              activationMilestonesJson: storedActivationMilestonesJson,
            };
          },
        },
      }),
  };

  return {
    service: new ActivationMilestonesService(prismaService as any),
    readStored: () => storedActivationMilestonesJson,
  };
}

describe("ActivationMilestonesService", () => {
  it("arms a requests nudge after the first inbound request lands", async () => {
    const occurredAt = new Date("2026-03-27T12:00:00.000Z");
    const { service, readStored } = createService({
      firstPersonaCreatedAt: "2026-03-27T10:00:00.000Z",
      firstQrOpenedAt: "2026-03-27T10:05:00.000Z",
      firstShareCompletedAt: "2026-03-27T10:10:00.000Z",
      firstRequestReceivedAt: null,
    });

    await service.markFirstRequestReceived("user-1", occurredAt);

    assert.deepEqual(readStored(), {
      firstPersonaCreatedAt: "2026-03-27T10:00:00.000Z",
      firstQrOpenedAt: "2026-03-27T10:05:00.000Z",
      firstShareCompletedAt: "2026-03-27T10:10:00.000Z",
      firstRequestReceivedAt: "2026-03-27T12:00:00.000Z",
      firstResponseNudge: {
        queue: "requests",
        triggeredAt: "2026-03-27T12:00:00.000Z",
        clearedAt: null,
      },
    });
  });

  it("marks the nudge cleared once the matching queue is opened", async () => {
    const { service, readStored } = createService({
      firstPersonaCreatedAt: "2026-03-27T10:00:00.000Z",
      firstQrOpenedAt: "2026-03-27T10:05:00.000Z",
      firstShareCompletedAt: "2026-03-27T10:10:00.000Z",
      firstRequestReceivedAt: "2026-03-27T12:00:00.000Z",
      firstResponseNudge: {
        queue: "requests",
        triggeredAt: "2026-03-27T12:00:00.000Z",
        clearedAt: null,
      },
    });

    await service.clearFirstResponseNudge(
      "user-1",
      "requests",
      new Date("2026-03-27T12:15:00.000Z"),
    );

    assert.deepEqual(readStored(), {
      firstPersonaCreatedAt: "2026-03-27T10:00:00.000Z",
      firstQrOpenedAt: "2026-03-27T10:05:00.000Z",
      firstShareCompletedAt: "2026-03-27T10:10:00.000Z",
      firstRequestReceivedAt: "2026-03-27T12:00:00.000Z",
      firstResponseNudge: {
        queue: "requests",
        triggeredAt: "2026-03-27T12:00:00.000Z",
        clearedAt: "2026-03-27T12:15:00.000Z",
      },
    });
  });
});