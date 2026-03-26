# Permission UI Hardening Notes

These principles outline the standardized UI patterns and safeguards implemented during the MS-520 permission hardening milestone to ensure user safety and transparent expectation setting regarding access controls.

## 1. Backend-Truth-First Rule

- **Never Optimistically Render Policy Status:** While we can optimistically reflect a user's _preference choice_ in a control (e.g. they select "Allow"), the rendered system effect (badges, permissions summaries, blocks) MUST reflect the last known server truth (`effectiveEffect`).
- **Fail Closed on Null State:** If the connection permissions or explanations have not yet loaded or fail to load, the system defaults to displaying a `Deny` (Blocked) state. We never allow an unresolved async state to accidentally leak an "Allowed" presentation.

## 2. No Optimistic Assumption Rule

- **Explicit Synchronization:** After an override is successfully saved to the backend, the UI must fetch the new resolved policy.
- **Stale State Handling:** During this policy refresh window, the component operates in a "stale but known" state (indicated by a syncing pulse). If the revalidation fails, we show a explicit sync error ("Changes saved, but failed to sync the latest policy.") instead of assuming the user's override became the effective permission.
- **Guardrail Interventions:** Always clearly separate the user's chosen override from the enforced policy. If the backend overrides a user's preference (e.g., they ask for Allow but safety forces Blocked), the UI must explicitly message: "System safeguards still apply."

## 3. Protected-Mode Consistency Rule

- Standardized terminology is enforced across all surfaces interacting with `ProtectedDirect` or strict-mode constraints to prevent confusion:
  - Banners should state: **"Protected mode active"**
  - Denied/Blocked actionable UI elements (like export buttons) should state: **"Restricted because protected mode is on."**
  - General lock indicators should state: **"Unavailable until protected mode changes."**
- This applies to disabled buttons, explanation fallbacks, and empty states. Actions blocked by protected mode use `pointer-events-none` styling alongside `aria-disabled` and screen-reader appropriate text to prevent any interaction implying the feature is available.

## Known Follow-ups

- A deeper integration with the notification system could proactively alert users when a protected mode constraint lifts, rather than relying strictly on the active polling / refresh behavior built into the current UI.
