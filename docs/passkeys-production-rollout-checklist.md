# Dotly Passkeys Production Rollout Checklist

Use this as the operator run sheet for first production enablement of Dotly passkeys.

## Rollout Order

- [ ] Confirm the passkey Prisma migration `20260328173000_phase41_passkeys` is present in the release artifact.
- [ ] Apply Prisma migrations to production before app traffic cutover.
- [ ] Verify the new `PasskeyChallenge` and `PasskeyCredential` tables and indexes exist.
- [ ] Deploy backend with production WebAuthn env vars set.
- [ ] Verify `/v1/health/verification` shows `webauthnConfigured=true` and `missingRequiredMigrations=[]`.
- [ ] Expose passkey UI only after backend health, env, and smoke checks pass.

## Required Env Vars

- [ ] `WEBAUTHN_RP_ID`: production relying party domain, not localhost or placeholder hosts.
- [ ] `WEBAUTHN_RP_NAME`: user-facing relying party name, typically `Dotly`.
- [ ] `WEBAUTHN_ORIGINS`: comma-separated HTTPS origins allowed to start and finish passkey ceremonies.
- [ ] Keep every `WEBAUTHN_ORIGINS` entry aligned to `WEBAUTHN_RP_ID` or its subdomains.

Example:

```env
WEBAUTHN_RP_ID=app.dotly.one
WEBAUTHN_RP_NAME=Dotly
WEBAUTHN_ORIGINS=https://app.dotly.one
```

## RP And Origin Verification

- [ ] Every origin is HTTPS, bare-origin only, with no path, query, or hash.
- [ ] Each origin hostname exactly matches `WEBAUTHN_RP_ID` or is a subdomain of it.
- [ ] Browser-visible origin matches the real production URL after CDN, proxy, and redirect handling.
- [ ] Registration and authentication both succeed from the intended production origin.
- [ ] Attempts from non-listed origins fail closed.

## Browser And Device QA

- [ ] Safari on macOS: register, authenticate, sign out, re-authenticate.
- [ ] Safari on iPhone: same-device passkey create/use succeeds.
- [ ] Chrome on macOS or Windows: create and use platform authenticator.
- [ ] Chrome on Android: platform authenticator succeeds.
- [ ] Cross-device flow: phone-mediated sign-in to desktop succeeds.
- [ ] Existing password login remains healthy when no passkey is enrolled.
- [ ] Multiple passkeys per account, rename, and delete flows behave correctly.
- [ ] Failure cases are clean: canceled prompt, stale challenge, wrong origin, revoked session.

## Staged Rollout

- [ ] Stage 1: deploy schema and backend support with UI hidden.
- [ ] Stage 2: enable for internal operators only; watch 24 hours.
- [ ] Stage 3: canary a small production cohort; keep password login as the primary fallback.
- [ ] Stage 4: expand gradually only if ceremony success, support load, and auth metrics stay normal.

## Rollback

- [ ] First rollback lever is feature disablement, not schema rollback.
- [ ] Hide passkey enrollment and sign-in entry points before app rollback.
- [ ] Preserve `PasskeyCredential` data; do not drop passkey tables during an incident.
- [ ] If origin or RP config is wrong, correct env and redeploy rather than mutating stored credentials.
- [ ] Treat already-enrolled users as password fallback users until passkeys are re-enabled.

## Monitoring After Release

- [ ] Watch `/v1/health/verification` for `webauthnConfigured`, degraded status, and migration readiness.
- [ ] Monitor `/v1/metrics` and logs for passkey ceremony failures, unexpected auth `system_error`, and browser-specific spikes.
- [ ] Review auth audit events for `auth.passkey.registration.start`, `auth.passkey.registration.finish`, `auth.passkey.authentication.start`, and `auth.passkey.authentication.finish`.
- [ ] Expect low initial adoption, near-zero origin mismatch errors, and no regression in password login success.
- [ ] Hold rollout expansion if support tickets, ceremony abandonment, or failed verification patterns trend up.
