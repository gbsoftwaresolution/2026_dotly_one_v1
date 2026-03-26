# Dotly Identity & Permission API Contract

This document outlines the REST API surface for the Identities and Permissions backend from a frontend-consumption perspective. It focuses on the endpoints required to resolve, preview, enforce, and debug permissions within identities, connections, and conversations.

## Frontend Integration Order

**Recommended order for integrating these APIs on the frontend:**

1. **Identities + Connections:** Establish identities and connect them.
2. **Resolved Permissions:** Fetch the final resolved permission states for connections to drive UI features (e.g., hiding or showing buttons based on `Allow` vs `Deny`).
3. **Conversations:** Establish context by mapping connections into conversations (direct or group) for messaging and interaction.
4. **Enforcement Preview:** Use action, call, and AI capability enforcement endpoints to check if an operation is permitted before fully committing it.
5. **Audit/Debug:** Only intended for internal tools, admin panels, or developer views to diagnose _why_ a permission resolved a certain way.

---

## Connections & Base Permissions

### `GET /api/connections/:connectionId/permissions`

**Description:** Resolves and returns the fully evaluated permission map for a connection.

- **Request Params:**
  - `connectionId` (UUID)
- **Query Params:**
  - `forceRefresh` (boolean, optional) - Bypass the cache to force a fresh recompute.
  - `preferCache` (boolean, optional) - Attempt to use fast memory cache first.
  - `preferSnapshot` (boolean, optional) - Attempt to use stored snapshot if cache misses.
  - `applyRiskOverlay` (boolean, optional) - Apply dynamic risk engine evaluation on top of rules.
- **Response:**
  - `connectionId`, `sourceIdentityId`, `targetIdentityId`
  - `permissions`: Record of `PermissionKey` to `ResolvedPermissionValue` (includes `finalEffect`, `limits`, `trace`).
  - `riskSummary`, `overridesSummary`
- **Notes:** This is the high-traffic endpoint for determining what a user can do in the context of a connection. Use `preferCache=true` and `preferSnapshot=true` in most UI flows to minimize latency.

---

## Debug & Explain Endpoints (Internal / Dev Tools)

### `GET /api/connections/:connectionId/permissions/explain`

**Description:** Returns a detailed summary of all permissions on a connection, including how they were resolved stage-by-stage.

- **Request Params:**
  - `connectionId` (UUID)
- **Query Params:**
  - `verbosity` (`BASIC` | `DETAILED`, optional)
  - `previewRiskSignals` (array of signals, optional)
  - `forceRefresh`, `preferCache`, `preferSnapshot`, `applyRiskOverlay`
- **Response:**
  - `PermissionDebugSummary` including `effectCounts`, `stageSummaries`, `blockedPermissionKeys`, and an array of `PermissionExplainResult` if verbosity is `DETAILED`.

### `GET /api/connections/:connectionId/permissions/explain/:permissionKey`

**Description:** Explains the resolution trace for a single specific permission key.

- **Request Params:**
  - `connectionId` (UUID)
  - `permissionKey` (string, e.g., `media.download`)
- **Query Params:** Same as above.
- **Response:**
  - `PermissionExplainResult` detailing `initialTemplateEffect`, `trustEffect`, `manualOverrideEffect`, `riskEffect`, `finalEffect`, and an `explanationText`.

### `GET /api/connections/:connectionId/permissions/diff`

**Description:** Compares the current live permission resolution against the most recently persisted database snapshot.

- **Request Params:**
  - `connectionId` (UUID)
- **Query Params:**
  - `forceRefresh`, `applyRiskOverlay`
- **Response:**
  - `status`: `"NO_SNAPSHOT"` or `"DIFF_COMPUTED"`
  - `diff`: `PermissionDiffResult` detailing keys that were `PROMOTED`, `RESTRICTED`, `ADDED`, `REMOVED`, or `MODIFIED`.

---

## Conversation Context

### `GET /api/conversations/:conversationId/permissions/explain`

**Description:** Debugs and explains the permission context bound to a conversation.

- **Request Params:**
  - `conversationId` (UUID)
- **Response:**
  - `conversationId`, `connectionId`
  - `stale` (boolean) - Indicates if the underlying connection permissions have changed since the conversation was bound.
  - `bindingSummary`, `traceSummary`
  - `permissionSummary` (`PermissionDebugSummary`)

---

## Enforcement & Previews

### `POST /api/conversations/:conversationId/enforce-action`

**Description:** Previews or enforces whether a specific action is allowed in the conversation context.

- **Request Params:**
  - `conversationId` (UUID)
- **Body:**
  - `actorIdentityId` (UUID)
  - `actionType` (`ActionType` enum)
  - `contentId` (UUID, optional)
  - `currentViewCount` (number, optional)
- **Response:**
  - `ActionDecision` containing `allowed` (boolean), `effect` (Allow, Deny, etc.), `reasonCode`, and `reasons` string array.

### `POST /api/conversations/:conversationId/enforce-call`

**Description:** Previews or enforces whether a specific call type can be initiated.

- **Request Params:**
  - `conversationId` (UUID)
- **Body:**
  - `actorIdentityId` (UUID)
  - `callType` (`CallType` enum)
  - `initiationMode` (`CallInitiationMode` enum)
- **Response:**
  - `CallPermissionDecision` containing `allowed`, `effect`, `restrictionSummary`, and `reasonCode`.

### `POST /api/conversations/:conversationId/enforce-ai`

**Description:** Previews or enforces whether an AI capability can be used.

- **Request Params:**
  - `conversationId` (UUID)
- **Body:**
  - `actorIdentityId` (UUID)
  - `capability` (`AICapability` enum)
  - `contextType` (`AIExecutionContext` enum)
  - `contentId` (UUID, optional)
- **Response:**
  - `AICapabilityDecision` containing `allowed`, `restrictionLevel` (`FULL`, `LIMITED`, `DENIED`), and `reasonCode`.

---

## Audit Logs (Internal)

### `GET /api/permissions/audit-events`

**Description:** Lists recent permission audit events (e.g., resolution computed, cache invalidated, action enforced).

- **Query Params:**
  - `eventType` (PermissionAuditEventType, optional)
  - `connectionId` (UUID, optional)
  - `conversationId` (UUID, optional)
  - `actorIdentityId` (UUID, optional)
  - `limit` (number, default: 50, max: 100)
- **Response:**
  - Array of `PermissionAuditEvent` with `summaryText` and `payloadJson`.

---

## Validation & Error Expectations

- **400 Bad Request:** Missing required IDs, invalid enum values (e.g., wrong `permissionKey` or `actionType`).
- **404 Not Found:** If a requested `connectionId` or `conversationId` does not exist.
- **Type Safety:** The frontend should strictly type permission keys using the provided enums/constants to avoid failed evaluations.
- **Fail-Closed:** If the enforcement endpoints return 500 or cannot be reached, the frontend must assume the action is **DENIED**.
