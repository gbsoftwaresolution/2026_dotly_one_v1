# Dotly Identity & Permission API Contract

This document outlines the REST API surface for the Identities and Permissions backend from a frontend-consumption perspective. It focuses on the endpoints required to create identities and connections, resolve permissions, manage conversation context, preview enforcement decisions, and inspect internal permission debug data.

## Production Exposure Note

- These endpoints are wired behind `JwtAuthGuard` in the controller layer.
- Before any public or admin rollout, verify ownership/actor scoping for each route and confirm which endpoints should stay internal-only, especially explain/diff/audit endpoints.
- Recommended: keep audit/debug routes limited to internal tooling even after auth is enabled.

## Frontend Integration Order

**Recommended order for integrating these APIs on the frontend:**

1. **Identities + Connections:** Establish identities and connect them.
2. **Resolved Permissions:** Fetch the final resolved permission states for connections to drive UI features (e.g., hiding or showing buttons based on `Allow` vs `Deny`).
3. **Conversations:** Establish context by mapping connections into conversations (direct or group) for messaging and interaction.
4. **Enforcement Preview:** Use action, call, and AI capability enforcement endpoints to check if an operation is permitted before fully committing it.
5. **Audit/Debug:** Only intended for internal tools, admin panels, or developer views to diagnose _why_ a permission resolved a certain way.

---

## Identities & Connections

### `POST /v1/identities`

Creates an identity record.

- Request body:
  - `personId?` UUID
  - `identityType` enum
  - `displayName` string
  - `handle?` string
  - `verificationLevel` string
  - `status` string
  - `metadataJson?` object
- Key response fields:
  - `id`, `personId`, `identityType`, `displayName`, `handle`, `verificationLevel`, `status`, `metadataJson`
- Validation / errors:
  - invalid UUIDs return `400`
  - invalid enums return `400`

### `POST /v1/identity-connections`

Creates a directional identity connection.

- Request body:
  - `sourceIdentityId` UUID
  - `targetIdentityId` UUID
  - `connectionType` enum
  - `trustState` enum
  - `relationshipType?` enum
  - `status` enum
  - `createdByIdentityId` UUID
  - `note?` string
  - `metadataJson?` object
- Key response fields:
  - `id`, `sourceIdentityId`, `targetIdentityId`, `connectionType`, `relationshipType`, `trustState`, `status`

### `GET /v1/identity-connections/:connectionId`

Returns one connection by id.

- Path params:
  - `connectionId` UUID

### `GET /v1/identities/:identityId/connections`

Lists all inbound/outbound connections for one identity.

- Path params:
  - `identityId` UUID
- Query params:
  - `status?` connection status enum

### `PATCH /v1/identity-connections/:connectionId/type`

Updates `connectionType`.

- Path params:
  - `connectionId` UUID
- Request body:
  - `connectionType` enum

### `PATCH /v1/identity-connections/:connectionId/trust-state`

Updates `trustState`.

- Path params:
  - `connectionId` UUID
- Request body:
  - `trustState` enum

### `PATCH /v1/identity-connections/:connectionId/relationship-type`

Updates `relationshipType`.

- Path params:
  - `connectionId` UUID
- Request body:
  - `relationshipType` enum

### `PUT /v1/identity-connections/:connectionId/permission-overrides/:permissionKey`

Upserts a manual permission override.

- Path params:
  - `connectionId` UUID
  - `permissionKey` must match a known permission key
- Request body:
  - `effect` permission effect enum
  - `limitsJson?` object
  - `reason?` string
  - `createdByIdentityId` UUID

### `GET /v1/identity-connections/:connectionId/permission-overrides`

Lists overrides for one connection in deterministic key order.

- Path params:
  - `connectionId` UUID

---

## Resolved Permissions

### `GET /v1/identity-connections/:connectionId/resolved-permissions`

Resolves and returns the fully evaluated permission map for a connection.

- Path params:
  - `connectionId` UUID
- Query params:
  - `forceRefresh?` boolean
  - `preferCache?` boolean
  - `preferSnapshot?` boolean
  - `persistSnapshot?` boolean
  - `applyRiskOverlay?` boolean
- Key response fields:
  - `connectionId`, `sourceIdentityId`, `targetIdentityId`
  - `template`, `overridesSummary`, `riskSummary`
  - `permissions` record with `finalEffect`, optional `limits`, and `trace`
- Frontend notes:
  - default to `preferCache=true` for normal reads
  - use `forceRefresh=true` only when the UI just changed trust, relationship, or overrides and needs a hard refresh
  - use `preferSnapshot=true` only when slightly stale but fast reads are acceptable

---

## Debug & Explain Endpoints (Internal / Dev Tools)

### `GET /v1/identity-connections/:connectionId/permissions/explain`

Returns a summary of all resolved permissions plus stage counts.

- Path params:
  - `connectionId` UUID
- Query params:
  - `verbosity?` = `BASIC | DETAILED`
  - `forceRefresh?`, `preferCache?`, `preferSnapshot?`, `applyRiskOverlay?`
- Key response fields:
  - `connection`
  - `effectCounts`
  - `stageSummaries`
  - `blockedPermissionKeys`, `riskyPermissionKeys`
  - `permissions` only when `verbosity=DETAILED`

### `GET /v1/identity-connections/:connectionId/permissions/:permissionKey/explain`

Explains one permission using actual resolver trace output.

- Path params:
  - `connectionId` UUID
  - `permissionKey` known permission key
- Query params:
  - `verbosity?`, `forceRefresh?`, `applyRiskOverlay?`
- Key response fields:
  - `permissionKey`, `label`
  - `initialTemplateEffect`, `trustEffect`, `manualOverrideEffect`, `riskEffect`, `finalEffect`
  - `stages[]`, `explanationText`, `incomplete`

### `GET /v1/identity-connections/:connectionId/permissions/diff-against-snapshot`

Diffs current permissions against the latest stored snapshot.

- Path params:
  - `connectionId` UUID
- Query params:
  - `forceRefresh?`, `applyRiskOverlay?`
- Key response fields:
  - `status` = `NO_SNAPSHOT | DIFF_COMPUTED`
  - `summaryText`
  - when present: `snapshotId`, `snapshotComputedAt`, `diff.summary`, `diff.entries`

---

## Conversation Context

### `POST /v1/identity-conversations`

Creates a conversation bound to a connection.

- Request body:
  - `sourceIdentityId` UUID
  - `targetIdentityId` UUID
  - `connectionId` UUID
  - `conversationType` enum
  - `status?` enum
  - `title?` string
  - `metadataJson?` object
  - `createdByIdentityId` UUID

### `GET /v1/identity-conversations/:conversationId`

Returns one conversation by id.

### `GET /v1/identities/:identityId/conversations`

Lists conversations for one identity.

- Query params:
  - `status?` conversation status enum

### `PATCH /v1/identity-conversations/:conversationId/status`

Updates conversation status.

- Request body:
  - `status` conversation status enum

### `GET /v1/identity-conversations/:conversationId/context`

Returns the current conversation permission context.

- Key response fields:
  - `conversation`
  - `resolvedPermissions`
  - `stale`
  - `bindingSummary`, `traceSummary`

### `POST /v1/identity-conversations/:conversationId/bind-permissions`

Rebinds the latest resolved permissions to the conversation.

- Key response fields:
  - `conversationId`, `connectionId`, `bindingSummary`, `resolvedAt`, `stale`

### `GET /v1/identity-conversations/:conversationId/binding-staleness`

Checks whether the stored permission binding is stale.

- Key response fields:
  - `stale`, `currentHash`, `storedHash`, `lastResolvedAt`, `currentResolvedAt`

### `GET /v1/identity-conversations/:conversationId/explain-context`

Returns a debug-friendly explanation summary for conversation permission context.

- Key response fields:
  - `conversationId`, `connectionId`, `stale`
  - `bindingSummary`, `traceSummary`
  - `permissionSummary`

---

## Content Access Rules

### `PUT /v1/content-access-rules`

Upserts a content access rule.

- Request body:
  - `contentId` UUID
  - `targetIdentityId` UUID
  - `canView?`, `canDownload?`, `canForward?`, `canExport?` booleans
  - `screenshotPolicy?`, `recordPolicy?` enums
  - `expiryAt?` ISO string
  - `viewLimit?` number
  - `watermarkMode?` string
  - `aiAccessAllowed?` boolean
  - `metadataJson?` object
  - `createdByIdentityId` UUID

### `GET /v1/content-access-rules`

Reads one content rule.

- Query params:
  - `contentId` UUID
  - `targetIdentityId` UUID

### `GET /v1/identity-connections/:connectionId/content/:contentId/permissions`

Resolves effective content permissions for one connection/content target pair.

- Path params:
  - `connectionId` UUID
  - `contentId` UUID
- Query params:
  - `targetIdentityId` UUID
  - `currentViewCount?` number
  - `persistSnapshot?` boolean
- Key response fields:
  - `connection`
  - `contentSummary`
  - `baseConnectionPermissions`
  - `effectiveContentPermissions`
  - `contentTrace`, `restrictionSummary`

---

## Enforcement Preview

### `POST /v1/identity-conversations/:conversationId/enforce-action`

Previews whether an action is allowed in conversation context.

- Request body:
  - `actorIdentityId` UUID
  - `actionType` enum
  - `contentId?` UUID
  - `currentViewCount?` number
  - `metadata?` object
- Key response fields:
  - `allowed`, `effect`, `reasonCode`, `reasons`, `trace`
- Frontend notes:
  - use before showing send/export/content actions that depend on runtime context

### `POST /v1/identity-conversations/:conversationId/enforce-call`

Previews whether a call is allowed.

- Request body:
  - `actorIdentityId` UUID
  - `callType` enum
  - `initiationMode` enum
  - runtime booleans like `screenCaptureDetected?`, `castingDetected?`, `deviceIntegrityCompromised?`, `currentProtectedModeExpectation?`
- Key response fields:
  - `allowed`, `effect`, `reasonCode`, `restrictionSummary`, `trace`

### `POST /v1/identity-conversations/:conversationId/enforce-ai`

Previews whether an AI capability is allowed.

- Request body:
  - `actorIdentityId` UUID
  - `capability` enum
  - `contextType` enum
  - `contentId?` UUID
  - `isProtectedContent?`, `isVaultContent?` booleans
- Key response fields:
  - `allowed`, `restrictionLevel`, `reasonCode`, `reasons`, `trace`
- Frontend notes:
  - treat this as preview + gating data for AI buttons and menus
  - if the request fails, fail closed and hide/disable the action

---

## Audit Logs (Internal)

### `GET /v1/permission-audit-events`

Lists recent permission audit events.

- Query params:
  - `eventType?` enum
  - `connectionId?` UUID
  - `conversationId?` UUID
  - `actorIdentityId?` UUID
  - `limit?` number, max `100`
- Key response fields:
  - `id`, `eventType`, `connectionId`, `conversationId`, `permissionKey`, `summaryText`, `payloadJson`, `createdAt`

---

## Validation & Error Expectations

- `400 Bad Request`
  - invalid UUID path/query/body fields
  - invalid enum values
  - invalid `permissionKey` path values
- `401 Unauthorized`
  - missing or invalid bearer token
- `404 Not Found`
  - unknown connection, conversation, or identity ids when the service rejects lookup
- Successful responses are wrapped by the shared response envelope used by the backend, so frontend callers should read `data` for the payload body.
- Errors use normal HTTP status codes and the shared error shape from the global exception filter.
