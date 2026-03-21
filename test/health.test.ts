import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { HealthService } from "../src/modules/health/health.service";

describe("HealthService", () => {
  it("reports ok readiness when database and cache are healthy", async () => {
    const service = new HealthService(
      {
        $queryRawUnsafe: async () => [{ result: 1 }],
      } as any,
      {
        getHealthStatus: async () => ({ status: "up" }),
      } as any,
      {
        get: (_key: string, defaultValue: string) => defaultValue,
      } as any,
    );

    const result = await service.getReadiness();

    assert.equal(result.status, "ok");
    assert.equal(result.checks.database.status, "up");
    assert.equal(result.checks.cache.status, "up");
  });

  it("reports degraded readiness when cache is unavailable but database is healthy", async () => {
    let receivedOptions: unknown;

    const service = new HealthService(
      {
        $queryRawUnsafe: async () => [{ result: 1 }],
      } as any,
      {
        getHealthStatus: async (options: unknown) => {
          receivedOptions = options;

          return {
            status: "down",
            message: "Redis unavailable.",
          };
        },
      } as any,
      {
        get: (_key: string, defaultValue: string) => defaultValue,
      } as any,
    );

    const result = await service.getReadiness();

    assert.equal(result.status, "degraded");
    assert.equal(result.checks.database.status, "up");
    assert.equal(result.checks.cache.status, "down");
    assert.deepEqual(receivedOptions, { attemptConnection: false });
  });

  it("reports down readiness when the database check fails", async () => {
    const service = new HealthService(
      {
        $queryRawUnsafe: async () => {
          throw new Error("db offline");
        },
      } as any,
      {
        getHealthStatus: async () => ({ status: "up" }),
      } as any,
      {
        get: (_key: string, defaultValue: string) => defaultValue,
      } as any,
    );

    const result = await service.getReadiness();

    assert.equal(result.status, "down");
    assert.equal(result.checks.database.status, "down");
  });
});
