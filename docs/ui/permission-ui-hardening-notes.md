# Permission UI Hardening Notes

## Current State & Optimistic UI Flaws (MS-520.1 Audit)

As part of the MS-520 hardening pass, an audit was conducted on the permission-sensitive UI components (`frontend/src/components/connections/` and `frontend/src/components/connections/protected/`).

### 1. Risky Optimistic Assumptions in Permission Controls

**Location:** `frontend/src/components/connections/permission-controls-widget.tsx`

- **Issue:** When `handleOverrideChange` updates an override, it optimistically sets the local override state and immediately calls `getResolvedPermissions(connectionId)`.
- **The Stale Cache Trap:** The `getResolvedPermissions` API client explicitly passes `?preferCache=true`. Because the backend (from Prompt 120) introduced snapshot caching for resolved permissions, fetching immediately after an override mutation will likely return the _old/stale_ cached permissions.
- **Consequence:** A user sets "Messaging" to `allowed`. The override saves successfully, but the resolved permissions fetch returns the cached `blocked` state. The UI flickers back to `blocked` or shows conflicting statuses, completely confusing the user. It incorrectly trusts the local success without guaranteeing the backend cache is invalidated or refreshed.

### 2. Lack of "Disabled After Save" (Fail-Closed) Feedback

**Location:** `frontend/src/components/connections/permission-control-card.tsx` & `override-status-badge.tsx`

- **Issue:** The UI allows users to freely change the override toggle (e.g., to "Allowed"). However, due to backend fail-closed rules (e.g., Trust State = "Untrusted" overriding all permissions to "Blocked"), the final resolved permission may remain "Blocked" even though the override is "Allowed".
- **Missing Clarity:** The UI updates the `OverrideStatusBadge` but doesn't explicitly disable or explain _why_ the actual effective permission remains blocked despite the user's action. The user thinks their save failed, when in reality it succeeded but was superseded by a higher policy.

### 3. Loading, Error, and Empty States in Protected Mode

**Location:** `frontend/src/components/connections/protected/protected-conversation-screen.tsx`

- **Brittle Initial Load:** The component uses a simple `isLoading` boolean. If the API takes a long time, the user just sees `<div>Loading protected environment...</div>`.
- **Dead-End Errors:** If `getResolvedPermissions` or `explainResolvedPermissions` fails, the screen renders `<div>{error || "Not found"}</div>`. There is no retry mechanism, fallback UI, or graceful degradation. It completely locks the user out of the conversation view.
- **No Refetching:** There's no mechanism to poll or force-refresh permissions if the user suspects they are stale (e.g., another admin changed policies).

### 4. Protected Action State (Action Buttons)

**Location:** `frontend/src/components/connections/protected/protected-action-state.tsx`

- **Issue:** The `ProtectedActionState` wrapper handles "blocked" by disabling buttons and showing tooltips, which is good. However, if the permission is "requires_approval" or "limited", the UI doesn't provide specialized visual cues (like an amber warning or an explicit "Request Approval" flow). It currently treats everything purely as allowed or blocked for immediate action.

## Recommended Fixes (For Upcoming MS-520 Tasks)

~~1. **Fix the Stale Cache Bug:** Change the mutation flow in `permission-controls-widget.tsx` to call `refreshResolvedPermissions(connectionId)` (which passes `?forceRefresh=true`) instead of `getResolvedPermissions`, ensuring the UI receives the true post-mutation state.~~ _(Status: Already fixed in codebase prior to audit)_ 2. **Improve Error Boundaries:** Implement retry buttons and better error states in `protected-conversation-screen.tsx` rather than dead-end divs. _(Status: Implemented. Added `RefreshCw` retry functionality and styled error state)._ 3. **Clarify Superseded Overrides:** In `permission-control-card.tsx`, add a clear warning when `vm.overrideEffect !== vm.resolvedEffect` (e.g., "Your override to 'Allowed' is currently restricted by the connection's Trust State"). _(Status: Implemented. Added an amber warning banner comparing preferences with active policy)._ 4. **Enhanced Loading Skeletons:** Replace raw text "Loading..." with proper skeleton loaders to prevent jarring layout shifts. _(Status: Implemented. Replaced with pulsing `animate-pulse` blocks matching layout)._

### MS-520 Completion Status

- Core backend fail-closed rules and caching are robust (Prompt 120).
- Frontend UI no longer trusts stale caches.
- Dead-end UI states have been converted to graceful degradations and retry loops.
- Overrides overridden by higher-level policies are explicitly communicated to the user to prevent confusion.
- Targeted UI tests covering superseded states and retry states are passing.
