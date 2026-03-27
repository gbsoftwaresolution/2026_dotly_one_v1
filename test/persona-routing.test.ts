import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import {
  BadRequestException,
  ConflictException,
} from "@nestjs/common";

import {
  PersonaAccessMode as PrismaPersonaAccessMode,
  PersonaSharingMode as PrismaPersonaSharingMode,
  PersonaType as PrismaPersonaType,
} from "../src/generated/prisma/client";
import { PersonaAccessMode } from "../src/common/enums/persona-access-mode.enum";
import { PersonaType } from "../src/common/enums/persona-type.enum";
import {
  toPublicPersonaView,
  type PrivatePersonaRecord,
} from "../src/modules/personas/persona.presenter";
import { PersonasService } from "../src/modules/personas/personas.service";

type StoredPersonaRecord = PrivatePersonaRecord & {
  userId: string;
};

function createPersonaRecord(
  overrides?: Partial<StoredPersonaRecord>,
): StoredPersonaRecord {
  return {
    id: "persona-1",
    userId: "user-1",
    identityId: "identity-1",
    identity: {
      handle: "identity-one",
    },
    type: PrismaPersonaType.PERSONAL,
    isPrimary: false,
    username: "alpha",
    publicUrl: "https://dotly.one/u/alpha",
    fullName: "Alpha Persona",
    jobTitle: "Founder",
    companyName: null,
    tagline: null,
    websiteUrl: null,
    isVerified: false,
    profilePhotoUrl: null,
    accessMode: PrismaPersonaAccessMode.PRIVATE,
    verifiedOnly: false,
    emailVerified: false,
    phoneVerified: false,
    businessVerified: false,
    sharingMode: PrismaPersonaSharingMode.CONTROLLED,
    smartCardConfig: null,
    publicPhone: null,
    publicWhatsappNumber: null,
    publicEmail: null,
    routingKey: null,
    routingDisplayName: null,
    isDefaultRouting: false,
    routingRulesJson: null,
    createdAt: new Date("2026-03-27T10:00:00.000Z"),
    updatedAt: new Date("2026-03-27T10:00:00.000Z"),
    ...overrides,
  };
}

function createPersonaPrisma(initialPersonas: StoredPersonaRecord[]) {
  const personas = initialPersonas.map((persona, index) =>
    createPersonaRecord({
      ...persona,
      createdAt:
        persona.createdAt ??
        new Date(`2026-03-27T10:00:0${index}.000Z`),
      updatedAt:
        persona.updatedAt ??
        new Date(`2026-03-27T10:00:0${index}.000Z`),
    }),
  );
  let nextPersonaId = personas.length + 1;

  const prisma: any = {
    $transaction: async (callback: (tx: typeof prisma) => Promise<unknown>) =>
      callback(prisma),
    user: {
      findUnique: async () => ({
        isVerified: false,
        phoneVerifiedAt: null,
      }),
      update: async () => ({ id: "user-1" }),
      updateMany: async () => ({ count: 0 }),
    },
    identity: {
      findFirst: async ({ where }: any) => {
        if (where.id) {
          return where.id === "identity-1" && where.personId === "user-1"
            ? { id: "identity-1" }
            : null;
        }

        return null;
      },
      create: async () => ({ id: "identity-created" }),
    },
    persona: {
      count: async ({ where }: any) =>
        personas.filter((persona) => persona.userId === where.userId).length,
      findUnique: async ({ where }: any) =>
        personas.find((persona) => persona.id === where.id) ?? null,
      findFirst: async ({ where }: any) => {
        const results = personas.filter((persona) => {
          if (where.id !== undefined && persona.id !== where.id) {
            return false;
          }

          if (where.userId !== undefined && persona.userId !== where.userId) {
            return false;
          }

          if (
            where.identityId !== undefined &&
            persona.identityId !== where.identityId
          ) {
            return false;
          }

          if (
            where.routingKey !== undefined &&
            persona.routingKey !== where.routingKey
          ) {
            return false;
          }

          if (
            where.isDefaultRouting !== undefined &&
            persona.isDefaultRouting !== where.isDefaultRouting
          ) {
            return false;
          }

          if (where.username !== undefined && persona.username !== where.username) {
            return false;
          }

          if (where.NOT?.id !== undefined && persona.id === where.NOT.id) {
            return false;
          }

          return true;
        });

        return results[0] ?? null;
      },
      findMany: async ({ where, orderBy }: any) => {
        const results = personas.filter((persona) => {
          if (
            where?.identityId !== undefined &&
            persona.identityId !== where.identityId
          ) {
            return false;
          }

          return true;
        });

        if (Array.isArray(orderBy)) {
          results.sort((left, right) => {
            for (const rule of orderBy) {
              if (rule.isPrimary) {
                const direction = rule.isPrimary === "asc" ? 1 : -1;
                const compare = Number(left.isPrimary) - Number(right.isPrimary);

                if (compare !== 0) {
                  return compare * direction;
                }
              }

              if (rule.createdAt) {
                const direction = rule.createdAt === "asc" ? 1 : -1;
                const compare =
                  left.createdAt.getTime() - right.createdAt.getTime();

                if (compare !== 0) {
                  return compare * direction;
                }
              }

              if (rule.id) {
                const direction = rule.id === "asc" ? 1 : -1;
                const compare = left.id.localeCompare(right.id);

                if (compare !== 0) {
                  return compare * direction;
                }
              }
            }

            return 0;
          });
        }

        return results;
      },
      create: async ({ data }: any) => {
        const createdPersona = createPersonaRecord({
          id: `persona-${nextPersonaId}`,
          userId: data.userId,
          identityId: data.identity.connect.id,
          type: data.type,
          isPrimary: data.isPrimary,
          username: data.username,
          publicUrl: data.publicUrl,
          fullName: data.fullName,
          jobTitle: data.jobTitle,
          companyName: data.companyName,
          tagline: data.tagline,
          websiteUrl: data.websiteUrl,
          isVerified: data.isVerified,
          profilePhotoUrl: data.profilePhotoUrl,
          accessMode: data.accessMode,
          verifiedOnly: data.verifiedOnly,
          routingKey: data.routingKey,
          routingDisplayName: data.routingDisplayName,
          isDefaultRouting: data.isDefaultRouting,
          routingRulesJson:
            data.routingRulesJson === null ? null : data.routingRulesJson,
          createdAt: new Date(`2026-03-27T10:00:${nextPersonaId}0.000Z`),
          updatedAt: new Date(`2026-03-27T10:00:${nextPersonaId}0.000Z`),
        });

        nextPersonaId += 1;
        personas.push(createdPersona);
        return createdPersona;
      },
      update: async ({ where, data }: any) => {
        const persona = personas.find((candidate) => candidate.id === where.id);

        if (!persona) {
          throw new Error("Persona not found");
        }

        if (data.identity) {
          persona.identityId = data.identity.connect.id;
          persona.identity = { handle: "identity-one" };
        }

        Object.assign(persona, {
          ...data,
          routingRulesJson:
            data.routingRulesJson === undefined
              ? persona.routingRulesJson
              : data.routingRulesJson === null
                ? null
                : data.routingRulesJson,
          updatedAt: new Date("2026-03-27T11:00:00.000Z"),
        });

        return persona;
      },
      updateMany: async ({ where, data }: any) => {
        let count = 0;

        for (const persona of personas) {
          if (
            where.identityId !== undefined &&
            persona.identityId !== where.identityId
          ) {
            continue;
          }

          if (
            where.isDefaultRouting !== undefined &&
            persona.isDefaultRouting !== where.isDefaultRouting
          ) {
            continue;
          }

          if (where.NOT?.id !== undefined && persona.id === where.NOT.id) {
            continue;
          }

          Object.assign(persona, data, {
            updatedAt: new Date("2026-03-27T11:00:00.000Z"),
          });
          count += 1;
        }

        return { count };
      },
    },
  };

  return { prisma, personas };
}

describe("persona routing", () => {
  it("promotes the first identity persona to default routing when omitted", async () => {
    const { prisma, personas } = createPersonaPrisma([]);
    const service = new PersonasService(prisma as any);

    const result = await service.create("user-1", {
      identityId: "identity-1",
      type: PersonaType.Personal,
      username: "alphademo",
      fullName: "Alpha Persona",
      jobTitle: "Founder",
      accessMode: PersonaAccessMode.Private,
      routingKey: "alpha",
    });

    assert.equal(result.isDefaultRouting, true);
    assert.equal(personas[0]?.isDefaultRouting, true);
  });

  it("rejects clearing persona identity ownership", async () => {
    const { prisma } = createPersonaPrisma([
      createPersonaRecord({
        id: "persona-1",
        userId: "user-1",
        routingKey: "alpha",
        routingDisplayName: "Alpha",
        isDefaultRouting: true,
      }),
    ]);
    const service = new PersonasService(prisma as any);

    await assert.rejects(
      service.update(
        "user-1",
        "persona-1",
        {
          identityId: null,
        } as any,
      ),
      (error: unknown) => {
        assert.ok(error instanceof BadRequestException);
        return true;
      },
    );
  });

  it("keeps exactly one default routing persona per identity", async () => {
    const { prisma, personas } = createPersonaPrisma([
      createPersonaRecord({
        id: "persona-1",
        userId: "user-1",
        username: "alphaaa",
        publicUrl: "https://dotly.one/u/alphaaa",
        routingKey: "alpha",
        isDefaultRouting: true,
      }),
      createPersonaRecord({
        id: "persona-2",
        userId: "user-1",
        username: "betaaaa",
        publicUrl: "https://dotly.one/u/betaaaa",
        fullName: "Beta Persona",
        routingKey: "beta",
        isDefaultRouting: false,
        createdAt: new Date("2026-03-27T10:00:02.000Z"),
        updatedAt: new Date("2026-03-27T10:00:02.000Z"),
      }),
    ]);
    const service = new PersonasService(prisma as any);

    const result = await service.update("user-1", "persona-2", {
      isDefaultRouting: true,
    });

    assert.equal(result.isDefaultRouting, true);
    assert.equal(
      personas.find((persona) => persona.id === "persona-1")?.isDefaultRouting,
      false,
    );
    assert.equal(
      personas.find((persona) => persona.id === "persona-2")?.isDefaultRouting,
      true,
    );
  });

  it("reassigns default routing deterministically when the current default is unset", async () => {
    const { prisma, personas } = createPersonaPrisma([
      createPersonaRecord({
        id: "persona-1",
        userId: "user-1",
        username: "alphaaa",
        publicUrl: "https://dotly.one/u/alphaaa",
        routingKey: "alpha",
        isDefaultRouting: true,
      }),
      createPersonaRecord({
        id: "persona-2",
        userId: "user-1",
        username: "betaaaa",
        publicUrl: "https://dotly.one/u/betaaaa",
        fullName: "Beta Persona",
        routingKey: "beta",
        isDefaultRouting: false,
        createdAt: new Date("2026-03-27T10:00:02.000Z"),
        updatedAt: new Date("2026-03-27T10:00:02.000Z"),
      }),
    ]);
    const service = new PersonasService(prisma as any);

    await service.update("user-1", "persona-1", {
      isDefaultRouting: false,
    });

    assert.equal(
      personas.find((persona) => persona.id === "persona-1")?.isDefaultRouting,
      false,
    );
    assert.equal(
      personas.find((persona) => persona.id === "persona-2")?.isDefaultRouting,
      true,
    );
  });

  it("rejects duplicate routing keys within the same identity", async () => {
    const { prisma } = createPersonaPrisma([
      createPersonaRecord({
        id: "persona-1",
        userId: "user-1",
        username: "alphaaa",
        publicUrl: "https://dotly.one/u/alphaaa",
        routingKey: "sales",
        isDefaultRouting: true,
      }),
      createPersonaRecord({
        id: "persona-2",
        userId: "user-1",
        username: "betaaaa",
        publicUrl: "https://dotly.one/u/betaaaa",
        fullName: "Beta Persona",
        routingKey: "beta",
      }),
    ]);
    const service = new PersonasService(prisma as any);

    await assert.rejects(
      service.update("user-1", "persona-2", {
        routingKey: "sales",
      }),
      (error: unknown) => {
        assert.ok(error instanceof ConflictException);
        return true;
      },
    );
  });

  it("keeps routing fields out of public persona views", () => {
    const publicView = toPublicPersonaView(
      createPersonaRecord({
        routingKey: "sales",
        routingDisplayName: "Sales",
        isDefaultRouting: true,
      }) as any,
    ) as unknown as Record<string, unknown>;

    assert.equal("routingKey" in publicView, false);
    assert.equal("routingDisplayName" in publicView, false);
    assert.equal("isDefaultRouting" in publicView, false);
    assert.equal("routingRulesJson" in publicView, false);
  });
});