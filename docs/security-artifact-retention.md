# Security Artifact Retention

This backend treats security artifacts as lifecycle-bound records rather than permanent history. Active flows query live rows only, and a scheduled cleanup removes stale terminal rows on a fixed cadence.

## Lifecycle States

- `active`: the artifact is still valid for its flow. For tokens and OTP challenges this means `consumedAt` and `supersededAt` are `null` and `expiresAt` is still in the future. For sessions this means `revokedAt` is `null` and `expiresAt` is still in the future.
- `expired`: the artifact was never consumed or revoked, but its `expiresAt` boundary has passed.
- `consumed`: the artifact completed its flow successfully and has a `consumedAt` timestamp.
- `superseded`: a newer artifact replaced it or the challenge was forced inactive after terminal failure handling.
- `revoked`: the session was explicitly invalidated and has a `revokedAt` timestamp.

## Retention Policy

- Email verification tokens:
  Expired but unused tokens are retained for 7 days so support can diagnose delivery timing and stale-link complaints.
  Consumed and superseded tokens are retained for 14 days for short-lived audit and troubleshooting needs.
- Password reset tokens:
  Expired but unused reset tokens are retained for 3 days and then deleted quickly.
  Consumed and superseded reset tokens are retained for 30 days to preserve stronger investigation value around account recovery activity.
- Mobile OTP challenges:
  Expired, consumed, and superseded challenges are retained for 3 days for SMS troubleshooting and abuse analysis, then deleted.
- Sessions:
  Expired sessions are retained for 7 days after expiry for short operational diagnostics.
  Revoked sessions are retained for 30 days for security investigations, device sign-out review, and recovery-event correlation.

## Cleanup Cadence

- The `SecurityArtifactLifecycleService` runs hourly through Nest scheduling.
- Each run deletes only rows already in a terminal state and already older than the relevant retention cutoff.
- Live auth flows never depend on cleanup to enforce safety. Expired or revoked records are already treated as inactive immediately.

## Query Hygiene

- Verification, reset, OTP, and session flows must continue filtering to active rows only.
- The Prisma schema keeps indexes aligned with both live-flow filters and cleanup predicates so record growth does not turn terminal-state scans into table-wide work.

## Manual Fallback

- Run `pnpm security:cleanup` from the repository root to invoke the same cleanup path on demand.
- Use the manual command for maintenance windows, after large test imports, or when support wants immediate pruning without waiting for the next hourly run.

## Operational Expectations

- Cleanup is safe to run repeatedly. After stale rows are gone, subsequent runs are no-ops.
- Manual and scheduled cleanup share the same policy constants and deletion logic.
- Audit and support surfaces should assume revoked and expired sessions are inactive immediately, even before the retained rows are physically deleted.