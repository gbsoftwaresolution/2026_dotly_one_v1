import { Injectable } from "@nestjs/common";

type ExceptionSource =
  | "request"
  | "process_unhandled_rejection"
  | "process_uncaught_exception";

const KNOWN_EXCEPTION_SOURCES: ExceptionSource[] = [
  "request",
  "process_unhandled_rejection",
  "process_uncaught_exception",
];

@Injectable()
export class OperationalMetricsService {
  private readonly startedAt = Date.now();
  private readonly httpRequestTotals = new Map<string, number>();
  private readonly httpRequestDurationSums = new Map<string, number>();
  private readonly httpRequestDurationCounts = new Map<string, number>();
  private readonly unhandledExceptionTotals = new Map<string, number>();

  recordHttpRequest(
    method: string,
    statusCode: number,
    durationMs: number,
  ): void {
    const normalizedMethod = method.trim().toUpperCase() || "UNKNOWN";
    const statusClass = this.toStatusClass(statusCode);
    const key = `${normalizedMethod}:${statusClass}`;

    this.increment(this.httpRequestTotals, key, 1);
    this.increment(this.httpRequestDurationSums, key, durationMs);
    this.increment(this.httpRequestDurationCounts, key, 1);
  }

  recordUnhandledException(source: ExceptionSource): void {
    this.increment(this.unhandledExceptionTotals, source, 1);
  }

  renderPrometheusMetrics(): string {
    const lines = [
      "# HELP dotly_process_start_time_seconds Unix time when the current backend process started",
      "# TYPE dotly_process_start_time_seconds gauge",
      `dotly_process_start_time_seconds ${Math.floor(this.startedAt / 1000)}`,
      "# HELP dotly_process_uptime_seconds Seconds since the current backend process started",
      "# TYPE dotly_process_uptime_seconds gauge",
      `dotly_process_uptime_seconds ${this.getProcessUptimeSeconds().toFixed(3)}`,
      "# HELP dotly_http_requests_total Count of completed HTTP requests by method and status class",
      "# TYPE dotly_http_requests_total counter",
      ...this.renderRequestMetricLines(
        "dotly_http_requests_total",
        this.httpRequestTotals,
      ),
      "# HELP dotly_http_request_duration_ms_sum Sum of completed HTTP request duration in milliseconds by method and status class",
      "# TYPE dotly_http_request_duration_ms_sum counter",
      ...this.renderRequestMetricLines(
        "dotly_http_request_duration_ms_sum",
        this.httpRequestDurationSums,
      ),
      "# HELP dotly_http_request_duration_ms_count Count of completed HTTP request duration samples by method and status class",
      "# TYPE dotly_http_request_duration_ms_count counter",
      ...this.renderRequestMetricLines(
        "dotly_http_request_duration_ms_count",
        this.httpRequestDurationCounts,
      ),
      "# HELP dotly_unhandled_exceptions_total Count of unhandled backend exceptions by source",
      "# TYPE dotly_unhandled_exceptions_total counter",
      ...KNOWN_EXCEPTION_SOURCES.map((source) => {
        const value = this.unhandledExceptionTotals.get(source) ?? 0;

        return `dotly_unhandled_exceptions_total{source="${source}"} ${value}`;
      }),
    ];

    return `${lines.join("\n")}\n`;
  }

  private getProcessUptimeSeconds(): number {
    return (Date.now() - this.startedAt) / 1000;
  }

  private renderRequestMetricLines(
    metricName: string,
    values: Map<string, number>,
  ): string[] {
    return [...values.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => {
        const [method, statusClass] = key.split(":");

        return `${metricName}{method="${method}",status_class="${statusClass}"} ${Number.isInteger(value) ? value : value.toFixed(3)}`;
      });
  }

  private increment(
    store: Map<string, number>,
    key: string,
    amount: number,
  ): void {
    store.set(key, (store.get(key) ?? 0) + amount);
  }

  private toStatusClass(statusCode: number): string {
    if (!Number.isFinite(statusCode) || statusCode < 100 || statusCode > 999) {
      return "unknown";
    }

    return `${Math.floor(statusCode / 100)}xx`;
  }
}
