import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { MetricsService } from "../src/modules/health/metrics.service";

describe("MetricsService", () => {
  it("renders prometheus-style health gauges", async () => {
    const service = new MetricsService(
      {
        $queryRawUnsafe: async () => [{ result: 1 }],
        passwordResetToken: {
          count: async ({ where }: any) => {
            if (where?.consumedAt === null) {
              return 2;
            }

            return 7;
          },
        },
        mobileOtpChallenge: {
          count: async ({ where }: any) => {
            if (where?.consumedAt === null) {
              return 3;
            }

            return 9;
          },
        },
        authSession: {
          count: async ({ where }: any) => {
            if (where?.revokedAt === null) {
              return 11;
            }

            return 4;
          },
        },
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
    assert.match(metrics, /dotly_auth_password_reset_active_tokens 2/);
    assert.match(metrics, /dotly_auth_password_reset_issued_last_24h 7/);
    assert.match(metrics, /dotly_auth_mobile_otp_active_challenges 3/);
    assert.match(metrics, /dotly_auth_mobile_otp_issued_last_24h 9/);
    assert.match(metrics, /dotly_auth_sessions_active 11/);
    assert.match(metrics, /dotly_auth_sessions_revoked_last_24h 4/);
  });
});
