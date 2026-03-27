# Launch Readiness Release Notes

## Title

Production hardening and premium contact-identity repositioning

## Summary

- Dotly is now positioned more clearly as a premium, trust-forward alternative to handing out a phone number.
- The stack is materially more launch-ready, with production containerization, observability, startup guardrails, and browser-level confidence checks in place.
- Current posture supports a controlled launch, assuming production secrets, HTTPS origins, provider config, and staging smoke checks are confirmed at rollout time.

## Engineering

- Added production Docker assets for backend and frontend plus CI image build and publish workflow coverage.
- Hardened runtime startup rules around secrets, trusted origins, proxy configuration, and partial provider misconfiguration.
- Added structured observability improvements, runtime error capture, verification diagnostics, and stronger production error handling.
- Expanded confidence gates with app-shell test coverage, critical frontend smoke coverage, and Playwright-backed end-to-end checks.

## Product And Brand

- Reframed Dotly as a premium contact identity product rather than a generic digital contact utility.
- Updated landing, auth, QR, sharing, and public profile surfaces to emphasize trust, control, and a better first exchange.
- Tightened messaging around permission-based sharing, modern presentation, and replacing raw phone-number exchange with a higher-context alternative.

## Validation

- Release assets now build in CI for pull requests and publish on mainline release paths.
- Frontend critical flows and auth smoke coverage were added to reduce launch regression risk.
- Launch guidance and staging verification checklists now document the expected production contract and rollout checks.

## Current CTO Launch Posture

- Recommended posture: proceed with a controlled production launch, not an unmonitored broad release.
- Go live only with verified HTTPS origins, non-placeholder secrets, explicit `TRUST_PROXY`, and healthy Mailgun configuration.
- Treat `/v1/health/verification`, `/v1/metrics`, structured logs, and browser smoke checks as required launch monitors during rollout.

## Known Limitations

- The frontend CSP is still a compatibility-first baseline and has not yet moved to nonce- or hash-based strict script enforcement.
- Twilio remains optional; SMS trust factor coverage depends on full provider configuration.
- Some trust-sensitive actions still intentionally gate on verified identity, so launch success depends on smooth verification delivery.
- The frontend API base URL is build-time configuration, so production origin changes still require a rebuild.
