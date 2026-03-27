import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { OperationalMetricsService } from "../src/infrastructure/logging/operational-metrics.service";
import { AuthMetricsService } from "../src/modules/auth/auth-metrics.service";
import { MetricsService } from "../src/modules/health/metrics.service";

describe("MetricsService", () => {
  it("renders prometheus-style health gauges", async () => {
    const authMetricsService = new AuthMetricsService();
    const operationalMetricsService = new OperationalMetricsService();

    authMetricsService.recordLoginFailure("invalid_password");
    authMetricsService.recordDelivery(
      "sms",
      "mobile_otp",
      "twilio",
      "provider_unavailable",
    );
    operationalMetricsService.recordHttpRequest("GET", 503, 87.4321);
    operationalMetricsService.recordUnhandledException("request");

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
      operationalMetricsService,
    );

    const metrics = await service.getPrometheusSnapshot();

    assert.match(
      metrics,
      /dotly_service_info\{service="dotly-backend",environment="development"\} 1/,
    );
    assert.match(metrics, /dotly_database_up 1/);
    assert.match(metrics, /dotly_cache_up 1/);
    assert.match(metrics, /dotly_process_start_time_seconds \d+/);
    assert.match(metrics, /dotly_process_uptime_seconds \d+\.\d{3}/);
    assert.match(
      metrics,
      /dotly_http_requests_total\{method="GET",status_class="5xx"\} 1/,
    );
    assert.match(
      metrics,
      /dotly_http_request_duration_ms_sum\{method="GET",status_class="5xx"\} 87\.432/,
    );
    assert.match(
      metrics,
      /dotly_unhandled_exceptions_total\{source="request"\} 1/,
    );
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
