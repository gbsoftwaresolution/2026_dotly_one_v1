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
      username: "  AliceDemo  ",
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
});
