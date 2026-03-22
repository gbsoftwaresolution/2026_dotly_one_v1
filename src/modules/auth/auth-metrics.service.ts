import { Injectable } from "@nestjs/common";

type CounterLabels = Record<string, string>;

interface CounterSeriesDefinition {
  labels: CounterLabels;
}

interface CounterMetricDefinition {
  name: string;
  help: string;
  labelNames: string[];
  zeroSeries: CounterSeriesDefinition[];
}

const TRUST_REQUIREMENTS = [
  "send_contact_request",
  "create_profile_qr",
  "create_quick_connect_qr",
  "create_event",
  "join_event",
  "enable_event_discovery",
  "view_event_participants",
] as const;

const COUNTER_DEFINITIONS: CounterMetricDefinition[] = [
  {
    name: "dotly_auth_login_total",
    help: "Authentication login attempts by outcome and reason",
    labelNames: ["outcome", "reason"],
    zeroSeries: [
      { labels: { outcome: "success", reason: "none" } },
      { labels: { outcome: "failure", reason: "unknown_email" } },
      { labels: { outcome: "failure", reason: "invalid_password" } },
      { labels: { outcome: "failure", reason: "system_error" } },
      { labels: { outcome: "throttled", reason: "account_lockout" } },
      { labels: { outcome: "throttled", reason: "account_ip_lockout" } },
      { labels: { outcome: "throttled", reason: "ip_lockout" } },
    ],
  },
  {
    name: "dotly_auth_signup_total",
    help: "Authentication signup attempts by outcome and reason",
    labelNames: ["outcome", "reason"],
    zeroSeries: [
      { labels: { outcome: "success", reason: "none" } },
      { labels: { outcome: "failure", reason: "email_already_registered" } },
      { labels: { outcome: "failure", reason: "system_error" } },
      { labels: { outcome: "throttled", reason: "email_rate_limited" } },
      { labels: { outcome: "throttled", reason: "ip_rate_limited" } },
    ],
  },
  {
    name: "dotly_auth_verification_email_issue_total",
    help: "Email verification issuance attempts by context and outcome",
    labelNames: ["context", "outcome"],
    zeroSeries: [
      { labels: { context: "signup", outcome: "issued" } },
      { labels: { context: "signup", outcome: "delivery_failed" } },
      { labels: { context: "resend", outcome: "issued" } },
      { labels: { context: "resend", outcome: "delivery_failed" } },
    ],
  },
  {
    name: "dotly_auth_verification_email_complete_total",
    help: "Email verification completion attempts by outcome and reason",
    labelNames: ["outcome", "reason"],
    zeroSeries: [
      { labels: { outcome: "success", reason: "none" } },
      { labels: { outcome: "accepted", reason: "already_verified" } },
      { labels: { outcome: "failure", reason: "invalid_or_expired_token" } },
      { labels: { outcome: "failure", reason: "system_error" } },
      { labels: { outcome: "throttled", reason: "ip_rate_limited" } },
    ],
  },
  {
    name: "dotly_auth_verification_resend_total",
    help: "Verification resend requests by outcome and reason",
    labelNames: ["outcome", "reason"],
    zeroSeries: [
      { labels: { outcome: "issued", reason: "none" } },
      { labels: { outcome: "suppressed", reason: "already_verified" } },
      { labels: { outcome: "suppressed", reason: "unknown_email" } },
      { labels: { outcome: "throttled", reason: "cooldown_active" } },
      { labels: { outcome: "throttled", reason: "window_limit_exceeded" } },
      { labels: { outcome: "throttled", reason: "email_rate_limited" } },
      { labels: { outcome: "throttled", reason: "ip_rate_limited" } },
      { labels: { outcome: "throttled", reason: "session_rate_limited" } },
      { labels: { outcome: "failed", reason: "system_error" } },
    ],
  },
  {
    name: "dotly_auth_password_reset_request_total",
    help: "Password reset requests by outcome and reason",
    labelNames: ["outcome", "reason"],
    zeroSeries: [
      { labels: { outcome: "requested", reason: "issued" } },
      { labels: { outcome: "requested", reason: "unknown_email" } },
      { labels: { outcome: "requested", reason: "delivery_failed" } },
      { labels: { outcome: "suppressed", reason: "per_account_rate_limited" } },
      { labels: { outcome: "throttled", reason: "cooldown_active" } },
      { labels: { outcome: "throttled", reason: "window_limit_exceeded" } },
      { labels: { outcome: "throttled", reason: "email_rate_limited" } },
      { labels: { outcome: "throttled", reason: "ip_rate_limited" } },
      { labels: { outcome: "failed", reason: "system_error" } },
    ],
  },
  {
    name: "dotly_auth_password_reset_complete_total",
    help: "Password reset completion attempts by outcome and reason",
    labelNames: ["outcome", "reason"],
    zeroSeries: [
      { labels: { outcome: "completed", reason: "none" } },
      { labels: { outcome: "failed", reason: "invalid_or_expired_token" } },
      { labels: { outcome: "failed", reason: "password_reuse" } },
      { labels: { outcome: "failed", reason: "system_error" } },
      { labels: { outcome: "throttled", reason: "ip_rate_limited" } },
    ],
  },
  {
    name: "dotly_auth_otp_request_total",
    help: "Mobile OTP request attempts by outcome and reason",
    labelNames: ["outcome", "reason"],
    zeroSeries: [
      { labels: { outcome: "requested", reason: "none" } },
      { labels: { outcome: "sent", reason: "none" } },
      { labels: { outcome: "failed", reason: "delivery_failed" } },
      { labels: { outcome: "failed", reason: "system_error" } },
      { labels: { outcome: "blocked", reason: "phone_already_verified_elsewhere" } },
      { labels: { outcome: "throttled", reason: "cooldown_active" } },
      { labels: { outcome: "throttled", reason: "window_limit_exceeded" } },
      { labels: { outcome: "throttled", reason: "phone_rate_limited" } },
      { labels: { outcome: "throttled", reason: "session_rate_limited" } },
      { labels: { outcome: "throttled", reason: "ip_rate_limited" } },
    ],
  },
  {
    name: "dotly_auth_otp_verify_total",
    help: "Mobile OTP verification attempts by outcome and reason",
    labelNames: ["outcome", "reason"],
    zeroSeries: [
      { labels: { outcome: "verified", reason: "none" } },
      { labels: { outcome: "invalid", reason: "invalid_code" } },
      { labels: { outcome: "failed", reason: "challenge_not_found" } },
      { labels: { outcome: "failed", reason: "inactive_challenge" } },
      { labels: { outcome: "failed", reason: "expired_challenge" } },
      { labels: { outcome: "failed", reason: "system_error" } },
      { labels: { outcome: "throttled", reason: "attempt_limit_reached" } },
      { labels: { outcome: "throttled", reason: "attempt_cooldown_active" } },
      { labels: { outcome: "throttled", reason: "session_rate_limited" } },
      { labels: { outcome: "throttled", reason: "ip_rate_limited" } },
    ],
  },
  {
    name: "dotly_auth_session_security_total",
    help: "Session security actions by action, outcome, and reason",
    labelNames: ["action", "outcome", "reason"],
    zeroSeries: [
      { labels: { action: "revoke", outcome: "success", reason: "remote_sign_out" } },
      { labels: { action: "revoke", outcome: "success", reason: "already_inactive" } },
      { labels: { action: "revoke", outcome: "failure", reason: "session_not_found" } },
      { labels: { action: "revoke", outcome: "failure", reason: "system_error" } },
      { labels: { action: "revoke", outcome: "blocked", reason: "current_session_protected" } },
      { labels: { action: "revoke_others", outcome: "success", reason: "sign_out_other_sessions" } },
      { labels: { action: "revoke_others", outcome: "failure", reason: "system_error" } },
      { labels: { action: "logout_current", outcome: "success", reason: "logout" } },
      { labels: { action: "logout_current", outcome: "failure", reason: "system_error" } },
    ],
  },
  {
    name: "dotly_auth_trust_blocked_total",
    help: "Trust-sensitive actions blocked due to missing trust factors",
    labelNames: ["requirement"],
    zeroSeries: TRUST_REQUIREMENTS.map((requirement) => ({
      labels: { requirement },
    })),
  },
  {
    name: "dotly_auth_delivery_total",
    help: "Auth delivery attempts by channel, template, provider, and outcome",
    labelNames: ["channel", "template", "provider", "outcome"],
    zeroSeries: [
      { labels: { channel: "email", template: "verification", provider: "mailgun", outcome: "sent" } },
      { labels: { channel: "email", template: "verification", provider: "mailgun", outcome: "provider_error" } },
      { labels: { channel: "email", template: "verification", provider: "mailgun", outcome: "provider_unavailable" } },
      { labels: { channel: "email", template: "password_reset", provider: "mailgun", outcome: "sent" } },
      { labels: { channel: "email", template: "password_reset", provider: "mailgun", outcome: "provider_error" } },
      { labels: { channel: "email", template: "password_reset", provider: "mailgun", outcome: "provider_unavailable" } },
      { labels: { channel: "sms", template: "mobile_otp", provider: "twilio", outcome: "sent" } },
      { labels: { channel: "sms", template: "mobile_otp", provider: "twilio", outcome: "provider_error" } },
      { labels: { channel: "sms", template: "mobile_otp", provider: "twilio", outcome: "provider_unavailable" } },
    ],
  },
];

@Injectable()
export class AuthMetricsService {
  private readonly counters = new Map<
    string,
    Map<string, { labels: CounterLabels; value: number }>
  >();

  recordLoginSuccess() {
    this.increment("dotly_auth_login_total", {
      outcome: "success",
      reason: "none",
    });
  }

  recordLoginFailure(reason: "unknown_email" | "invalid_password" | "system_error") {
    this.increment("dotly_auth_login_total", {
      outcome: "failure",
      reason,
    });
  }

  recordLoginThrottle(
    reason: "account_lockout" | "account_ip_lockout" | "ip_lockout",
  ) {
    this.increment("dotly_auth_login_total", {
      outcome: "throttled",
      reason,
    });
  }

  recordSignupSuccess() {
    this.increment("dotly_auth_signup_total", {
      outcome: "success",
      reason: "none",
    });
  }

  recordSignupFailure(reason: "email_already_registered" | "system_error") {
    this.increment("dotly_auth_signup_total", {
      outcome: "failure",
      reason,
    });
  }

  recordSignupThrottle(reason: "email_rate_limited" | "ip_rate_limited") {
    this.increment("dotly_auth_signup_total", {
      outcome: "throttled",
      reason,
    });
  }

  recordVerificationEmailIssued(context: "signup" | "resend") {
    this.increment("dotly_auth_verification_email_issue_total", {
      context,
      outcome: "issued",
    });
  }

  recordVerificationEmailDeliveryFailed(context: "signup" | "resend") {
    this.increment("dotly_auth_verification_email_issue_total", {
      context,
      outcome: "delivery_failed",
    });
  }

  recordVerificationEmailCompletion(
    outcome: "success" | "accepted" | "failure" | "throttled",
    reason:
      | "none"
      | "already_verified"
      | "invalid_or_expired_token"
      | "system_error"
      | "ip_rate_limited",
  ) {
    this.increment("dotly_auth_verification_email_complete_total", {
      outcome,
      reason,
    });
  }

  recordVerificationResend(
    outcome: "issued" | "suppressed" | "throttled" | "failed",
    reason:
      | "none"
      | "already_verified"
      | "unknown_email"
      | "cooldown_active"
      | "window_limit_exceeded"
      | "email_rate_limited"
      | "ip_rate_limited"
      | "session_rate_limited"
      | "system_error",
  ) {
    this.increment("dotly_auth_verification_resend_total", {
      outcome,
      reason,
    });
  }

  recordPasswordResetRequest(
    outcome: "requested" | "suppressed" | "throttled" | "failed",
    reason:
      | "issued"
      | "unknown_email"
      | "delivery_failed"
      | "per_account_rate_limited"
      | "cooldown_active"
      | "window_limit_exceeded"
      | "email_rate_limited"
      | "ip_rate_limited"
      | "system_error",
  ) {
    this.increment("dotly_auth_password_reset_request_total", {
      outcome,
      reason,
    });
  }

  recordPasswordResetCompletion(
    outcome: "completed" | "failed" | "throttled",
    reason:
      | "none"
      | "invalid_or_expired_token"
      | "password_reuse"
      | "system_error"
      | "ip_rate_limited",
  ) {
    this.increment("dotly_auth_password_reset_complete_total", {
      outcome,
      reason,
    });
  }

  recordOtpRequest(
    outcome: "requested" | "sent" | "failed" | "blocked" | "throttled",
    reason:
      | "none"
      | "delivery_failed"
      | "system_error"
      | "phone_already_verified_elsewhere"
      | "cooldown_active"
      | "window_limit_exceeded"
      | "phone_rate_limited"
      | "session_rate_limited"
      | "ip_rate_limited",
  ) {
    this.increment("dotly_auth_otp_request_total", {
      outcome,
      reason,
    });
  }

  recordOtpVerification(
    outcome: "verified" | "invalid" | "failed" | "throttled",
    reason:
      | "none"
      | "invalid_code"
      | "challenge_not_found"
      | "inactive_challenge"
      | "expired_challenge"
      | "system_error"
      | "attempt_limit_reached"
      | "attempt_cooldown_active"
      | "session_rate_limited"
      | "ip_rate_limited",
  ) {
    this.increment("dotly_auth_otp_verify_total", {
      outcome,
      reason,
    });
  }

  recordSessionSecurity(
    action: "revoke" | "revoke_others" | "logout_current",
    outcome: "success" | "failure" | "blocked",
    reason:
      | "remote_sign_out"
      | "already_inactive"
      | "session_not_found"
      | "current_session_protected"
      | "sign_out_other_sessions"
      | "logout"
      | "system_error",
  ) {
    this.increment("dotly_auth_session_security_total", {
      action,
      outcome,
      reason,
    });
  }

  recordTrustSensitiveActionBlocked(requirement: string) {
    this.increment("dotly_auth_trust_blocked_total", {
      requirement,
    });
  }

  recordDelivery(
    channel: "email" | "sms",
    template: "verification" | "password_reset" | "mobile_otp",
    provider: "mailgun" | "twilio",
    outcome: "sent" | "provider_error" | "provider_unavailable",
  ) {
    this.increment("dotly_auth_delivery_total", {
      channel,
      template,
      provider,
      outcome,
    });
  }

  getCounterValue(name: string, labels: CounterLabels): number {
    const metricSeries = this.counters.get(name);

    if (!metricSeries) {
      return 0;
    }

    return metricSeries.get(this.buildLabelKey(labels))?.value ?? 0;
  }

  renderPrometheusMetrics(): string {
    const lines: string[] = [];

    for (const definition of COUNTER_DEFINITIONS) {
      lines.push(`# HELP ${definition.name} ${definition.help}`);
      lines.push(`# TYPE ${definition.name} counter`);

      const renderedSeries = new Map<string, { labels: CounterLabels; value: number }>();

      for (const zeroSeries of definition.zeroSeries) {
        const key = this.buildLabelKey(zeroSeries.labels);
        renderedSeries.set(key, {
          labels: zeroSeries.labels,
          value: this.getCounterValue(definition.name, zeroSeries.labels),
        });
      }

      for (const [key, series] of this.counters.get(definition.name) ?? []) {
        renderedSeries.set(key, series);
      }

      const orderedSeries = [...renderedSeries.values()].sort((left, right) =>
        this.buildLabelKey(left.labels).localeCompare(this.buildLabelKey(right.labels)),
      );

      for (const series of orderedSeries) {
        lines.push(this.renderMetricLine(definition.name, definition.labelNames, series));
      }
    }

    return `${lines.join("\n")}\n`;
  }

  private increment(name: string, labels: CounterLabels) {
    const metricSeries = this.counters.get(name) ?? new Map<string, { labels: CounterLabels; value: number }>();
    const key = this.buildLabelKey(labels);
    const current = metricSeries.get(key);

    metricSeries.set(key, {
      labels: { ...labels },
      value: (current?.value ?? 0) + 1,
    });

    this.counters.set(name, metricSeries);
  }

  private buildLabelKey(labels: CounterLabels): string {
    return Object.entries(labels)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `${key}=${value}`)
      .join(",");
  }

  private renderMetricLine(
    name: string,
    labelNames: string[],
    series: { labels: CounterLabels; value: number },
  ): string {
    if (labelNames.length === 0) {
      return `${name} ${series.value}`;
    }

    const renderedLabels = labelNames
      .map((labelName) => {
        const value = series.labels[labelName] ?? "unknown";
        return `${labelName}="${this.escapeLabelValue(value)}"`;
      })
      .join(",");

    return `${name}{${renderedLabels}} ${series.value}`;
  }

  private escapeLabelValue(value: string): string {
    return value.replaceAll("\\", "\\\\").replaceAll("\"", '\\"').replaceAll("\n", "\\n");
  }
}

export const noopAuthMetricsService = {
  recordLoginSuccess: () => undefined,
  recordLoginFailure: () => undefined,
  recordSignupSuccess: () => undefined,
  recordSignupFailure: () => undefined,
  recordVerificationEmailIssued: () => undefined,
  recordVerificationEmailDeliveryFailed: () => undefined,
  recordVerificationEmailCompletion: () => undefined,
  recordVerificationResend: () => undefined,
  recordPasswordResetRequest: () => undefined,
  recordPasswordResetCompletion: () => undefined,
  recordOtpRequest: () => undefined,
  recordOtpVerification: () => undefined,
  recordSessionSecurity: () => undefined,
  recordTrustSensitiveActionBlocked: () => undefined,
  recordDelivery: () => undefined,
  getCounterValue: () => 0,
  renderPrometheusMetrics: () => "",
} as unknown as AuthMetricsService;