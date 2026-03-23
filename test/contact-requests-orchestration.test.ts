import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { ContactRequestsService } from "../src/modules/contact-requests/contact-requests.service";

describe("ContactRequestsService orchestration", () => {
  it("delegates request creation to the injected use-case service", async () => {
    const calls: Array<{ userId: string; dto: unknown }> = [];
    const createUseCase = {
      create: async (userId: string, dto: unknown) => {
        calls.push({ userId, dto });
        return { id: "request-1" };
      },
    };

    const service = new ContactRequestsService(
      {
        contactRequest: {
          findMany: async () => [],
        },
      } as any,
      createUseCase as any,
      {} as any,
    );

    const result = await service.create("user-1", {
      fromPersonaId: "persona-1",
      toPersonaId: "persona-2",
      sourceType: "profile" as any,
    });

    assert.deepEqual(calls, [
      {
        userId: "user-1",
        dto: {
          fromPersonaId: "persona-1",
          toPersonaId: "persona-2",
          sourceType: "profile",
        },
      },
    ]);
    assert.deepEqual(result, { id: "request-1" });
  });

  it("delegates approval and rejection to the injected responder service", async () => {
    const respondUseCase = {
      approve: async (userId: string, requestId: string) => ({
        requestId,
        status: "approved",
        delegatedUserId: userId,
      }),
      reject: async (userId: string, requestId: string) => ({
        requestId,
        status: "rejected",
        delegatedUserId: userId,
      }),
    };

    const service = new ContactRequestsService(
      {
        contactRequest: {
          findMany: async () => [],
        },
      } as any,
      {} as any,
      respondUseCase as any,
    );

    const approved = await service.approve("user-2", "request-9");
    const rejected = await service.reject("user-2", "request-10");

    assert.deepEqual(approved, {
      requestId: "request-9",
      status: "approved",
      delegatedUserId: "user-2",
    });
    assert.deepEqual(rejected, {
      requestId: "request-10",
      status: "rejected",
      delegatedUserId: "user-2",
    });
  });
});
