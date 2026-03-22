import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { AuthMetricsService } from "../src/modules/auth/auth-metrics.service";
import { MetricsService } from "../src/modules/health/metrics.service";

describe("MetricsService", () => {
  it("renders prometheus-style health gauges", async () => {
    const authMetricsService = new AuthMetricsService();
    authMetricsService.recordLoginFailure("invalid_password");
    authMetricsService.recordDelivery(
      "sms",
      "mobile_otp",
      "twilio",
      "provider_unavailable",
    );

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
      authMetricsService,
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
    assert.match(
      metrics,
      /dotly_auth_login_total\{outcome="failure",reason="invalid_password"\} 1/,
    );
    assert.match(
      metrics,
      /dotly_auth_delivery_total\{channel="sms",template="mobile_otp",provider="twilio",outcome="provider_unavailable"\} 1/,
    );
  });
});
