# Session Security Contract

This backend treats the session registry as the source of truth for authenticated access.

## Contract

- Every authenticated JWT must carry a `sessionId` that maps to an `AuthSession` row owned by the token subject.
- A session is considered active only when `revokedAt` is `null` and `expiresAt` is still in the future.
- JWT validation updates `lastActiveAt` only after confirming the session is still active at validation time.
- Revoked, expired, or missing tracked sessions are rejected with the same unauthorized response.

## Lifecycle

- `createdAt`: when the session record was issued during login.
- `lastActiveAt`: last successful authenticated request that passed tracked-session validation.
- `expiresAt`: absolute expiry for the session. Expired sessions are invalid even if they were never explicitly revoked.
- `revokedAt` and `revokedReason`: terminal state for explicit sign-out and security-driven invalidation.

Idle timeout is not enforced separately today. `lastActiveAt` exists for visibility, operational analysis, and future policy expansion, while `expiresAt` remains the enforced expiry boundary.

## Revocation Guarantees

- Current-session logout revokes the tracked current session.
- Remote sign-out targets another session owned by the same user and is idempotent when that session is already inactive.
- Sign out other sessions revokes every other active session while retaining the tracked current session.
- Password change revokes other active sessions in the same transaction as the password update.
- Password reset revokes all active sessions in the same transaction as token consumption and password update.

## Listing Semantics

- Session listing endpoints return active sessions only.
- `isCurrent` is derived by comparing each active session id with the authenticated token's tracked `sessionId`.
- Revoked and expired sessions are not surfaced as active devices.

## Cleanup Expectations

- Expired sessions are rejected immediately by validation and excluded from active-session queries.
- Session rows are retained for auditability until operational cleanup removes stale inactive rows.