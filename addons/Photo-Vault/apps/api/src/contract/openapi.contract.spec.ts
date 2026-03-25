import * as yaml from "yaml";
import * as fs from "fs";
import * as path from "path";
import { describe, it, expect } from "@jest/globals";

// Load OpenAPI spec
const openapiPath = path.resolve(__dirname, "../../../../api/openapi.yaml");
const openapiContent = fs.readFileSync(openapiPath, "utf8");
const openapi = yaml.parse(openapiContent);

describe("OpenAPI Contract Conformance", () => {
  describe("Spec validation", () => {
    it("should parse OpenAPI YAML without errors", () => {
      expect(openapi).toBeDefined();
      expect(openapi.openapi).toBe("3.0.3");
      expect(openapi.info.title).toBe("Booster Vault API (Non-AI MVP)");
    });

    it("should have required security schemes", () => {
      expect(openapi.components.securitySchemes.bearerAuth).toEqual({
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      });
    });
  });

  describe("Idempotency-Key header documentation", () => {
    it("should have Idempotency-Key header in POST /v1/media/upload-intents", () => {
      const endpoint = openapi.paths["/v1/media/upload-intents"]?.post;
      expect(endpoint).toBeDefined();
      const params = endpoint.parameters || [];
      const idempotencyParam = params.find(
        (p: any) => p.name === "Idempotency-Key" && p.in === "header",
      );
      expect(idempotencyParam).toBeDefined();
      expect(idempotencyParam.required).toBe(false);
      expect(idempotencyParam.schema.type).toBe("string");
      expect(idempotencyParam.schema.format).toBe("uuid");
    });

    it("should have Idempotency-Key header in POST /v1/media/{mediaId}/complete-upload", () => {
      const endpoint =
        openapi.paths["/v1/media/{mediaId}/complete-upload"]?.post;
      expect(endpoint).toBeDefined();
      const params = endpoint.parameters || [];
      const idempotencyParam = params.find(
        (p: any) => p.name === "Idempotency-Key" && p.in === "header",
      );
      expect(idempotencyParam).toBeDefined();
    });

    it("should have Idempotency-Key header in POST /v1/media/{mediaId}/thumbnail-upload-intent", () => {
      const endpoint =
        openapi.paths["/v1/media/{mediaId}/thumbnail-upload-intent"]?.post;
      expect(endpoint).toBeDefined();
      const params = endpoint.parameters || [];
      const idempotencyParam = params.find(
        (p: any) => p.name === "Idempotency-Key" && p.in === "header",
      );
      expect(idempotencyParam).toBeDefined();
    });

    it("should have Idempotency-Key header in POST /v1/media/{mediaId}/complete-thumbnail-upload", () => {
      const endpoint =
        openapi.paths["/v1/media/{mediaId}/complete-thumbnail-upload"]?.post;
      expect(endpoint).toBeDefined();
      const params = endpoint.parameters || [];
      const idempotencyParam = params.find(
        (p: any) => p.name === "Idempotency-Key" && p.in === "header",
      );
      expect(idempotencyParam).toBeDefined();
    });

    it("should have Idempotency-Key header in POST /v1/exports", () => {
      const endpoint = openapi.paths["/v1/exports"]?.post;
      expect(endpoint).toBeDefined();
      const params = endpoint.parameters || [];
      const idempotencyParam = params.find(
        (p: any) => p.name === "Idempotency-Key" && p.in === "header",
      );
      expect(idempotencyParam).toBeDefined();
    });
  });
});
