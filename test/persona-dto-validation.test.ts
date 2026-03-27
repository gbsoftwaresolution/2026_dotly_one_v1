import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";

import { PersonaAccessMode } from "../src/common/enums/persona-access-mode.enum";
import { PersonaType } from "../src/common/enums/persona-type.enum";
import { CreatePersonaDto } from "../src/modules/personas/dto/create-persona.dto";
import { UpdatePersonaDto } from "../src/modules/personas/dto/update-persona.dto";

describe("Persona DTO validation", () => {
  it("trims and accepts nullable identity enhancement fields", () => {
    const dto = plainToInstance(CreatePersonaDto, {
      type: PersonaType.Personal,
      username: "  alicedemo  ",
      fullName: "  Alice Demo  ",
      jobTitle: "  Founder  ",
      companyName: "  Dotly  ",
      tagline: "  Building better networking  ",
      websiteUrl: "  https://dotly.one  ",
      accessMode: PersonaAccessMode.Open,
      isVerified: true,
    });

    assert.deepEqual(validateSync(dto), []);
    assert.equal(dto.companyName, "Dotly");
    assert.equal(dto.tagline, "Building better networking");
    assert.equal(dto.websiteUrl, "https://dotly.one");
  });

  it("rejects invalid website urls and overlong taglines", () => {
    const dto = plainToInstance(UpdatePersonaDto, {
      websiteUrl: "not-a-url",
      tagline: "x".repeat(121),
    });

    const errors = validateSync(dto);
    const properties = errors.map((error) => error.property).sort();

    assert.deepEqual(properties, ["tagline", "websiteUrl"]);
  });

  it("rejects short premium usernames on create", () => {
    const dto = plainToInstance(CreatePersonaDto, {
      type: PersonaType.Personal,
      username: "short",
      fullName: "Alice Demo",
      jobTitle: "Founder",
      companyName: "Dotly",
      accessMode: PersonaAccessMode.Open,
    });

    const errors = validateSync(dto);
    const properties = errors.map((error) => error.property);

    assert.equal(properties.includes("username"), true);
  });

  it("normalizes blank nullable enhancement fields to null", () => {
    const dto = plainToInstance(UpdatePersonaDto, {
      companyName: "   ",
      tagline: "   ",
      websiteUrl: "   ",
    });

    assert.deepEqual(validateSync(dto), []);
    assert.equal(dto.companyName, null);
    assert.equal(dto.tagline, null);
    assert.equal(dto.websiteUrl, null);
  });

  it("rejects null identity ids instead of treating them as disconnects", () => {
    const dto = plainToInstance(UpdatePersonaDto, {
      identityId: null,
    });

    const errors = validateSync(dto);
    const properties = errors.map((error) => error.property);

    assert.equal(properties.includes("identityId"), true);
  });

  it("normalizes safe routing fields", () => {
    const dto = plainToInstance(CreatePersonaDto, {
      type: PersonaType.Personal,
      username: "alice-demo",
      fullName: "Alice Demo",
      jobTitle: "Founder",
      accessMode: PersonaAccessMode.Private,
      routingKey: "  Team_Main  ",
      routingDisplayName: "  Team Main  ",
      routingRulesJson: {
        queue: "team-main",
      },
    });

    assert.deepEqual(validateSync(dto), []);
    assert.equal(dto.routingKey, "team_main");
    assert.equal(dto.routingDisplayName, "Team Main");
    assert.deepEqual(dto.routingRulesJson, {
      queue: "team-main",
    });
  });

  it("rejects unsafe routing keys", () => {
    const dto = plainToInstance(UpdatePersonaDto, {
      routingKey: "team/main",
    });

    const errors = validateSync(dto);
    const properties = errors.map((error) => error.property);

    assert.equal(properties.includes("routingKey"), true);
  });

  it("normalizes blank routing display names to null", () => {
    const dto = plainToInstance(UpdatePersonaDto, {
      routingDisplayName: "   ",
    });

    assert.deepEqual(validateSync(dto), []);
    assert.equal(dto.routingDisplayName, null);
  });
});
