import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { AgencyProfileStatus } from "../src/common/enums/agency-profile-status.enum";
import { toPrivateAgencyProfileView } from "../src/modules/agencies/agency.presenter";
import { AgenciesService } from "../src/modules/agencies/agencies.service";

const prismaDraftStatus = "DRAFT" as const;
const prismaActiveStatus = "ACTIVE" as const;

function createAgencyRecord(overrides?: Partial<any>) {
  return {
    id: "agency-1",
    name: "Dotly Studio",
    slug: "dotly-studio",
    tagline: "Independent growth partners",
    description: "We help teams ship faster.",
    logoUrl: "https://cdn.dotly.local/logo.png",
    status: prismaDraftStatus,
    createdAt: new Date("2026-03-24T10:00:00.000Z"),
    updatedAt: new Date("2026-03-24T10:00:00.000Z"),
    ...overrides,
  };
}

function createPublicAgencyRecord(overrides?: Partial<any>) {
  return {
    id: "agency-1",
    name: "Dotly Studio",
    slug: "dotly-studio",
    tagline: "Independent growth partners",
    description: "We help teams ship faster.",
    logoUrl: "https://cdn.dotly.local/logo.png",
    ...overrides,
  };
}

function createPublicAgentRecord(overrides?: Partial<any>) {
  return {
    username: "alice-demo",
    publicUrl: "dotly.id/alice-demo",
    fullName: "Alice Demo",
    jobTitle: "Founder",
    companyName: "Dotly Studio",
    tagline: "Building better teams",
    profilePhotoUrl: null,
    emailVerified: true,
    phoneVerified: false,
    businessVerified: false,
    accessMode: "OPEN",
    sharingMode: "CONTROLLED",
    smartCardConfig: null,
    ...overrides,
  };
}

describe("AgenciesService", () => {
  it("creates a single owner-managed agency with normalized slug", async () => {
    const service = new AgenciesService({
      agencyProfile: {
        findFirst: async () => null,
        create: async ({ data }: any) =>
          createAgencyRecord({
            name: data.name,
            slug: data.slug,
            status: data.status,
          }),
      },
    } as any);

    const result = await service.createMyAgencyProfile("user-1", {
      name: "Dotly Studio",
      slug: " Dotly Studio ",
      status: AgencyProfileStatus.Active,
    });

    assert.deepEqual(result, {
      id: "agency-1",
      name: "Dotly Studio",
      slug: "dotly-studio",
      tagline: "Independent growth partners",
      description: "We help teams ship faster.",
      logoUrl: "https://cdn.dotly.local/logo.png",
      status: AgencyProfileStatus.Active,
      createdAt: new Date("2026-03-24T10:00:00.000Z"),
      updatedAt: new Date("2026-03-24T10:00:00.000Z"),
    });
  });

  it("prevents creating more than one agency per owner", async () => {
    const service = new AgenciesService({
      agencyProfile: {
        findFirst: async () => ({ id: "agency-existing" }),
      },
    } as any);

    await assert.rejects(
      service.createMyAgencyProfile("user-1", {
        name: "Dotly Studio",
      }),
      (error: unknown) => {
        assert.ok(error instanceof ConflictException);
        assert.equal(
          error.message,
          "You already have an agency profile for this account",
        );
        return true;
      },
    );
  });

  it("returns not found when the owner has no agency", async () => {
    const service = new AgenciesService({
      agencyProfile: {
        findFirst: async () => null,
      },
    } as any);

    await assert.rejects(
      service.findMyAgencyProfile("user-1"),
      (error: unknown) => {
        assert.ok(error instanceof NotFoundException);
        assert.equal(error.message, "Agency profile not found");
        return true;
      },
    );
  });

  it("updates only the owner's agency profile", async () => {
    const service = new AgenciesService({
      agencyProfile: {
        findFirst: async () => createAgencyRecord(),
        update: async ({ data }: any) =>
          createAgencyRecord({
            name: data.name ?? "Dotly Studio",
            slug: data.slug ?? "dotly-studio",
            tagline: data.tagline ?? null,
            status: data.status ?? prismaDraftStatus,
            updatedAt: new Date("2026-03-24T11:00:00.000Z"),
          }),
      },
    } as any);

    const result = await service.updateMyAgencyProfile("user-1", {
      name: "Dotly Agency",
      slug: "Dotly Agency",
      tagline: null,
      status: AgencyProfileStatus.Active,
    });

    assert.equal(result.name, "Dotly Agency");
    assert.equal(result.slug, "dotly-agency");
    assert.equal(result.tagline, null);
    assert.equal(result.status, AgencyProfileStatus.Active);
  });

  it("rejects invalid derived create slug values", async () => {
    const service = new AgenciesService({
      agencyProfile: {
        findFirst: async () => null,
      },
    } as any);

    await assert.rejects(
      service.createMyAgencyProfile("user-1", {
        name: "***",
      }),
      (error: unknown) => {
        assert.ok(error instanceof BadRequestException);
        assert.equal(error.message, "Agency slug is invalid");
        return true;
      },
    );
  });

  it("maps unique slug conflicts to a clean domain error", async () => {
    const service = new AgenciesService({
      agencyProfile: {
        findFirst: async () => null,
        create: async () => {
          throw new Prisma.PrismaClientKnownRequestError("duplicate", {
            code: "P2002",
            clientVersion: "test",
          });
        },
      },
    } as any);

    await assert.rejects(
      service.createMyAgencyProfile("user-1", {
        name: "Dotly Studio",
        slug: "dotly-studio",
      }),
      (error: unknown) => {
        assert.ok(error instanceof ConflictException);
        assert.equal(error.message, "Agency slug already in use");
        return true;
      },
    );
  });

  it("returns a public agency profile only for active agencies", async () => {
    const service = new AgenciesService({
      agencyProfile: {
        findFirst: async () =>
          createPublicAgencyRecord({
            slug: "dotly-studio",
          }),
      },
    } as any);

    const result = await service.findPublicAgencyProfile("Dotly-Studio");

    assert.deepEqual(result, {
      name: "Dotly Studio",
      slug: "dotly-studio",
      tagline: "Independent growth partners",
      description: "We help teams ship faster.",
      logoUrl: "https://cdn.dotly.local/logo.png",
    });
  });

  it("returns not found when a public agency is inactive or missing", async () => {
    const service = new AgenciesService({
      agencyProfile: {
        findFirst: async () => null,
      },
    } as any);

    await assert.rejects(
      service.findPublicAgencyProfile("draft-agency"),
      (error: unknown) => {
        assert.ok(error instanceof NotFoundException);
        assert.equal(error.message, "Agency profile not found");
        return true;
      },
    );
  });

  it("returns frontend-friendly public agency agents and applies safe filters", async () => {
    const personaQueries: any[] = [];
    const service = new AgenciesService({
      agencyProfile: {
        findFirst: async () => createPublicAgencyRecord(),
      },
      persona: {
        findMany: async (args: any) => {
          personaQueries.push(args);

          return [
            createPublicAgentRecord(),
            createPublicAgentRecord({
              username: "broken-card",
              publicUrl: "dotly.id/broken-card",
              fullName: "Broken Card",
              sharingMode: "SMART_CARD",
              smartCardConfig: {
                source: "system_default",
              },
            }),
          ];
        },
      },
    } as any);

    const result = await service.findPublicAgencyAgents("dotly-studio");

    assert.deepEqual(personaQueries[0]?.where, {
      agencyProfile: {
        slug: "dotly-studio",
        status: "ACTIVE",
      },
      accessMode: {
        in: ["OPEN", "REQUEST"],
      },
    });
    assert.equal(result.agents.length, 1);
    assert.deepEqual(result.agents[0], {
      username: "alice-demo",
      publicUrl: "https://dotly.id/alice-demo",
      fullName: "Alice Demo",
      jobTitle: "Founder",
      companyName: "Dotly Studio",
      tagline: "Building better teams",
      profilePhotoUrl: null,
      trust: {
        isVerified: true,
        isStrongVerified: false,
        isBusinessVerified: false,
      },
    });
  });
});

describe("Agency presenter", () => {
  it("maps prisma status values to private DTO output", () => {
    const result = toPrivateAgencyProfileView(
      createAgencyRecord({ status: prismaActiveStatus }) as any,
    );

    assert.equal(result.status, AgencyProfileStatus.Active);
    assert.equal(result.slug, "dotly-studio");
  });
});
