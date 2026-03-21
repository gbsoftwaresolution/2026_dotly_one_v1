import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { MetricsService } from "../src/modules/health/metrics.service";

describe("MetricsService", () => {
  it("renders prometheus-style health gauges", async () => {
    const service = new MetricsService(
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

    const metrics = await service.getPrometheusSnapshot();

    assert.match(
      metrics,
      /dotly_service_info\{service="dotly-backend",environment="development"\} 1/,
    );
    assert.match(metrics, /dotly_database_up 1/);
    assert.match(metrics, /dotly_cache_up 1/);
  });
});
