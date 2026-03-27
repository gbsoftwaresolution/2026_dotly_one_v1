import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import {
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";

import { IdentitiesService } from "../src/modules/identities/identities.service";

function createService(overrides?: Partial<Record<string, unknown>>) {
  const prisma = {
    $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
      callback(prisma),
    identity: {
      findFirst: async () => ({
        id: "identity-1",
        personId: "owner-user",
        displayName: "Identity One",
        handle: "identity-one",
        members: [],
        operators: [],
      }),
    },
    persona: {
      findMany: async () => [
        {
          id: "persona-1",
          username: "alpha",
          fullName: "Alpha Persona",
          routingKey: "alpha",
          routingDisplayName: "Alpha",
          isDefaultRouting: true,
        },
      ],
    },
    identityMember: {
      findMany: async () => [
        {
          id: "member-1",
          personId: "member-user",
          role: "OWNER",
          status: "ACTIVE",
          createdAt: new Date("2026-03-27T08:00:00.000Z"),
          personaAssignments: [
            {
              personaId: "persona-1",
              persona: {
                id: "persona-1",
                username: "alpha",
                fullName: "Alpha Persona",
                routingKey: "alpha",
                routingDisplayName: "Alpha",
                isDefaultRouting: true,
              },
            },
          ],
        },
      ],
      findFirst: async () => ({
        id: "member-1",
        personId: "member-user",
        role: "OWNER",
        status: "ACTIVE",
      }),
      create: async () => ({
        id: "member-1",
      }),
      update: async () => ({
        id: "member-1",
        personId: "member-user",
        role: "OWNER",
        status: "ACTIVE",
        createdAt: new Date("2026-03-27T08:00:00.000Z"),
        personaAssignments: [],
      }),
    },
    identityOperator: {
      findMany: async () => [
        {
          id: "operator-1",
          personId: "operator-user",
          role: "ADMIN",
          status: "ACTIVE",
          createdAt: new Date("2026-03-27T08:00:00.000Z"),
          personaAssignments: [],
        },
      ],
      findFirst: async () => ({
        id: "operator-1",
        personId: "operator-user",
        role: "ADMIN",
        status: "ACTIVE",
      }),
      create: async () => ({
        id: "operator-1",
      }),
      update: async () => ({
        id: "operator-1",
        personId: "operator-user",
        role: "ADMIN",
        status: "ACTIVE",
        createdAt: new Date("2026-03-27T08:00:00.000Z"),
        personaAssignments: [],
      }),
    },
    identityMemberPersonaAssignment: {
      deleteMany: async () => ({ count: 1 }),
      createMany: async () => ({ count: 1 }),
    },
    identityOperatorPersonaAssignment: {
      deleteMany: async () => ({ count: 1 }),
      createMany: async () => ({ count: 1 }),
    },
    user: {
      findMany: async () => [
        { id: "member-user", email: "member@dotly.one" },
        { id: "operator-user", email: "operator@dotly.one" },
      ],
      findFirst: async ({ where }: any) => ({
        id: where?.id ?? "member-user",
        email:
          where?.id === "operator-user"
            ? "operator@dotly.one"
            : "member@dotly.one",
      }),
    },
    ...overrides,
  };

  return new IdentitiesService(prisma as any);
}

describe("identity team persona assignments", () => {
  it("lists active members and operators with mapped persona access", async () => {
    const service = createService();

    const result = await service.getIdentityTeamPersonaAccess(
      "owner-user",
      "identity-1",
    );

    assert.equal(result.identity.displayName, "Identity One");
    assert.equal(result.personas.length, 1);
    assert.equal(result.members[0]?.email, "member@dotly.one");
    assert.equal(result.members[0]?.accessMode, "restricted");
    assert.deepEqual(result.members[0]?.assignedPersonaIds, ["persona-1"]);
    assert.equal(result.operators[0]?.accessMode, "full");
  });

  it("forbids regular members from managing persona assignments", async () => {
    const service = createService({
      identity: {
        findFirst: async () => ({
          id: "identity-1",
          personId: null,
          displayName: "Identity One",
          handle: "identity-one",
          members: [{ role: "MANAGER" }],
          operators: [],
        }),
      },
    });

    await assert.rejects(
      service.getIdentityTeamPersonaAccess("manager-user", "identity-1"),
      (error: unknown) => {
        assert.ok(error instanceof ForbiddenException);
        return true;
      },
    );
  });

  it("rejects member assignment updates when personas belong to another identity", async () => {
    const service = createService({
      persona: {
        findMany: async () => [],
      },
    });

    await assert.rejects(
      service.updateIdentityMemberPersonaAssignments("owner-user", {
        identityId: "identity-1",
        memberId: "member-1",
        personaIds: ["persona-outside"],
      }),
      (error: unknown) => {
        assert.ok(error instanceof BadRequestException);
        return true;
      },
    );
  });

  it("allows admin operators to clear operator assignments back to full access", async () => {
    let deletedOperatorAssignments = 0;
    let createdOperatorAssignments = 0;
    const service = createService({
      identity: {
        findFirst: async () => ({
          id: "identity-1",
          personId: null,
          displayName: "Identity One",
          handle: "identity-one",
          members: [],
          operators: [{ role: "SUPER_ADMIN" }],
        }),
      },
      identityOperatorPersonaAssignment: {
        deleteMany: async () => {
          deletedOperatorAssignments += 1;
          return { count: 2 };
        },
        createMany: async () => {
          createdOperatorAssignments += 1;
          return { count: 0 };
        },
      },
      user: {
        findMany: async () => [{ id: "operator-user", email: "operator@dotly.one" }],
      },
    });

    const result = await service.updateIdentityOperatorPersonaAssignments(
      "admin-user",
      {
        identityId: "identity-1",
        operatorId: "operator-1",
        personaIds: [],
      },
    );

    assert.equal(deletedOperatorAssignments, 1);
    assert.equal(createdOperatorAssignments, 0);
    assert.equal(result.accessMode, "full");
    assert.deepEqual(result.assignedPersonaIds, []);
  });

  it("lets an owner invite a member with persona assignments", async () => {
    const service = createService({
      user: {
        findMany: async () => [
          { id: "member-user", email: "member@dotly.one" },
          { id: "new-member", email: "new-member@dotly.one" },
        ],
        findFirst: async ({ where }: any) => ({
          id: where?.id,
          email: where?.id === "new-member" ? "new-member@dotly.one" : "member@dotly.one",
        }),
      },
      identityMember: {
        findMany: async () => [],
        findFirst: async ({ where }: any) => {
          if (where?.identityId && where?.personId === "new-member") {
            return null;
          }

          if (where?.id === "member-2") {
            return {
              id: "member-2",
              personId: "new-member",
              role: "MANAGER",
              status: "INVITED",
              createdAt: new Date("2026-03-27T08:00:00.000Z"),
              personaAssignments: [
                {
                  personaId: "persona-1",
                  persona: {
                    id: "persona-1",
                    username: "alpha",
                    fullName: "Alpha Persona",
                    routingKey: "alpha",
                    routingDisplayName: "Alpha",
                    isDefaultRouting: true,
                  },
                },
              ],
            };
          }

          return {
            id: "member-1",
            personId: "member-user",
            role: "OWNER",
            status: "ACTIVE",
          };
        },
        create: async () => ({ id: "member-2" }),
        update: async () => ({ id: "member-2" }),
      },
      identityMemberPersonaAssignment: {
        deleteMany: async () => ({ count: 0 }),
        createMany: async () => ({ count: 1 }),
      },
    });

    const result = await service.createIdentityMember("owner-user", {
      identityId: "identity-1",
      personId: "new-member",
      role: "MANAGER" as any,
      status: "INVITED" as any,
      personaIds: ["persona-1"],
    });

    assert.equal(result.email, "new-member@dotly.one");
    assert.equal(result.role, "MANAGER");
    assert.deepEqual(result.assignedPersonaIds, ["persona-1"]);
  });

  it("denies operator admins from managing members", async () => {
    const service = createService({
      identity: {
        findFirst: async () => ({
          id: "identity-1",
          personId: null,
          displayName: "Identity One",
          handle: "identity-one",
          members: [],
          operators: [{ role: "ADMIN" }],
        }),
      },
    });

    await assert.rejects(
      service.createIdentityMember("admin-user", {
        identityId: "identity-1",
        personId: "new-member",
        role: "MEMBER" as any,
      }),
      (error: unknown) => {
        assert.ok(error instanceof ForbiddenException);
        return true;
      },
    );
  });

  it("allows operator admins to invite standard operators only", async () => {
    const service = createService({
      identity: {
        findFirst: async () => ({
          id: "identity-1",
          personId: null,
          displayName: "Identity One",
          handle: "identity-one",
          members: [],
          operators: [{ role: "ADMIN" }],
        }),
      },
      user: {
        findMany: async () => [
          { id: "operator-user", email: "operator@dotly.one" },
          { id: "new-operator", email: "new-operator@dotly.one" },
        ],
        findFirst: async ({ where }: any) => ({
          id: where?.id,
          email:
            where?.id === "new-operator"
              ? "new-operator@dotly.one"
              : "operator@dotly.one",
        }),
      },
      identityOperator: {
        findMany: async () => [],
        findFirst: async ({ where }: any) => {
          if (where?.identityId && where?.personId === "new-operator") {
            return null;
          }

          if (where?.id === "operator-2") {
            return {
              id: "operator-2",
              personId: "new-operator",
              role: "OPERATOR",
              status: "INVITED",
              createdAt: new Date("2026-03-27T08:00:00.000Z"),
              personaAssignments: [],
            };
          }

          return {
            id: "operator-1",
            personId: "operator-user",
            role: "ADMIN",
            status: "ACTIVE",
          };
        },
        create: async () => ({ id: "operator-2" }),
        update: async () => ({ id: "operator-2" }),
      },
      identityOperatorPersonaAssignment: {
        deleteMany: async () => ({ count: 0 }),
        createMany: async () => ({ count: 0 }),
      },
    });

    const result = await service.createIdentityOperator("admin-user", {
      identityId: "identity-1",
      personId: "new-operator",
      role: "OPERATOR" as any,
      status: "INVITED" as any,
    });

    assert.equal(result.role, "OPERATOR");

    await assert.rejects(
      service.createIdentityOperator("admin-user", {
        identityId: "identity-1",
        personId: "new-operator",
        role: "ADMIN" as any,
      }),
      (error: unknown) => {
        assert.ok(error instanceof ForbiddenException);
        return true;
      },
    );
  });
});