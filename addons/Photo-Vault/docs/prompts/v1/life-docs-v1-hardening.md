# V1 Spec Prompt — Life Docs Hardening (Masked Mode + Reminder Reliability)

## Role
You are a senior backend engineer shipping V1 quality for the **Life Docs** module.

## Goal
Deliver two V1-grade improvements:

1) **Masked Mode must be server-enforced** (not just UI hiding)
2) **Reminders must be reliable** (quiet-hours deferrals must actually deliver close to scheduled time)

## Current State (what exists)
- API endpoints are implemented under `apps/api/src/life-docs/*`.
- Life Docs attach to existing Vault media via `CreateLifeDocDto.mediaId`.
- Integrity binding exists via `Media.sha256Ciphertext` compared to `LifeDoc.fileHash`.
- Reminders scan job exists via BullMQ (`life-docs:scan-reminders`) and writes `NotificationEvent` + `LifeDocReminderEvent`.
- Quiet hours deferral writes `LifeDocReminderEvent.scheduledFor` in the future.

### Problems to fix
1) **Masked mode is currently only a UI gate**
   - `LifeDocsService.buildResponse()` always returns plaintext fields (`title`, `issuingAuthority`, `expiryDate`, etc.).
   - Any shared member can read these values directly from the API response.

2) **Quiet-hours deferrals can be missed for a long time**
   - Reminder scans are scheduled every `LIFE_DOCS_REMINDER_SCAN_INTERVAL_HOURS` (default is currently 24).
   - If a reminder is deferred to a time later today, the next scan may not run until tomorrow.

## Success Criteria

### A) Masked Mode (server enforced)
1. If a Life Doc has `maskedMode=true` and the viewer is **not the owner**:
   - `title` must be returned as:
     - `aliasTitle` if present and non-empty, else a constant like `"Private document"`.
   - `issuingAuthority` must be `null`.
   - `issueDate` must be `null`.
   - `expiryDate` must be:
     - `null` if `maskedHideExpiry=true`, else allow the date.
2. If the viewer **is** the owner, return real values (no redaction).
3. Search/list/timeline endpoints must not leak masked values to non-owners.
4. Add tests verifying redaction behavior.

### B) Reminders reliability
1. Quiet-hours deferrals must be delivered within a reasonable window (<= 60 minutes) after `scheduledFor`.
2. Ensure the reminder engine is idempotent (no duplicate notifications/emails).
3. Add tests that cover:
   - creating a deferred reminder event
   - later processing it
   - dedupe prevents duplicates

## Constraints / Repo Pointers
- Backend:
  - `apps/api/src/life-docs/life-docs.service.ts`
  - `apps/api/src/life-docs/reminders/life-docs-reminders.service.ts`
  - `apps/api/src/life-docs/reminders/life-docs-reminders.scheduler.service.ts`
  - Prisma models: `LifeDoc`, `LifeDocReminderEvent`, `NotificationEvent`
- Frontend references:
  - UI pages already exist (`apps/web/src/pages/LifeDocDetail.tsx`, `LifeDocs.tsx`, `LifeDocsTimeline.tsx`).
  - Assume UI should continue working with redacted responses.

## Implementation Plan

### Part 1 — Enforce masked mode on the server
1) In `LifeDocsService.buildResponse()` (or a wrapper), compute a **presentation layer** based on:
   - `viewerRole`
   - `doc.maskedMode`
   - `doc.maskedHideExpiry`
   - `doc.aliasTitle`

2) Apply redaction rules when `viewerRole !== OWNER`.
   - Keep `category/subcategory/visibility/status/versionGroupId/fileHash/uploadTimestamp` intact.
   - Only redact PII-like fields.

3) Ensure all endpoints use the same response builder so behavior is consistent:
   - list
   - getById
   - timeline
   - search
   - versions

4) Tests (Jest):
   - Owner sees real title + dates.
   - Shared member sees alias/placeholder and nulls.
   - MaskedHideExpiry toggles expiry visibility.

### Part 2 — Make reminders reliable
Implement a two-phase reminder approach:

**Phase A — Scan:** find docs that should generate reminder events and ensure a `LifeDocReminderEvent` exists (dedupeKey).

**Phase B — Process:** send any reminder events where:
- `sentAt IS NULL`
- `scheduledFor <= now`

Recommended approach:
1) Add a method `processDueReminderEvents()` to `LifeDocsRemindersService`:
   - Query due `LifeDocReminderEvent` rows.
   - For each, create a `NotificationEvent` and/or send email depending on channel.
   - Mark that reminder event `sentAt=now` in the same transaction as creating `NotificationEvent`.

2) Modify existing `scanAndEmitDueReminders()`:
   - Split into `scanAndScheduleReminderEvents()` and `processDueReminderEvents()`.
   - Keep dedupe behavior stable.

3) Scheduling:
   - Add a second repeatable BullMQ job, e.g. `life-docs:process-reminders`, every **5–15 minutes**.
   - Or reduce `lifeDocsReminderScanIntervalHours` default to 1 and run scan frequently enough.
   - Preferred: keep scan hourly, process every 5–15 minutes.

4) Idempotency:
   - Continue using `dedupeKey` uniqueness.
   - Never send if `sentAt` already set.

5) Tests:
   - Use fake timers to validate deferred reminder is sent after scheduledFor.

## Deliverables
- Backend code updates (Life Docs service + reminders services/queue/scheduler).
- Jest tests for masked mode redaction + reminder processing.
- Update any docs if behavior changes (optional).

## Manual Acceptance Tests
1) Create a Life Doc, enable masked mode + alias title.
2) Share it with another user.
3) As the shared user, call `GET /v1/life-docs` and confirm title is alias/placeholder and dates/issuer are redacted.
4) Configure quiet hours and a reminder due today; ensure notification/email arrives shortly after quiet hours end.
