#+#+#+#+--------------------------------
# Memory Bank (Project Context)

This folder is the **project's durable context** used to keep implementation, architecture, and current focus documented.

## Core files (must exist)

- `projectbrief.md` — scope, goals, constraints, and “what done looks like”
- `productContext.md` — why this product exists + UX goals
- `systemPatterns.md` — architecture + important patterns
- `techContext.md` — stack, tooling, dev setup
- `activeContext.md` — what we’re doing *now*, recent changes, next steps, blockers
- `progress.md` — what’s done, what’s left, current status, known issues

## Ground rules

1. **Prefer reality over intent**
   - If docs disagree with code, update docs.
   - `IMPLEMENTATION_REPORT.md` is treated as the “implementation snapshot” summary.

2. **Update Memory Bank when**
   - a major feature lands (auth, uploads, sharing, exports, etc.)
   - a key decision changes (crypto scheme, storage driver, queue model)
   - new known gaps/TODOs are discovered
   - after significant refactors that change file locations/patterns

3. **Keep `activeContext.md` short-lived**
   - It should reflect the *current* focus and near-term next steps.
   - Move “what shipped” summaries into `progress.md`.

## Quick update checklist

- [ ] Update `activeContext.md` with what you're working on now + blockers
- [ ] Update `progress.md` (done/left/known issues)
- [ ] If architecture changed, update `systemPatterns.md`
- [ ] If tooling/setup changed, update `techContext.md`
- [ ] If scope/constraints changed, update `projectbrief.md`
- [ ] If UX goals changed, update `productContext.md`

## Suggested cadence

- Small changes: update at end of PR/feature branch
- Large changes: update while implementing, then tighten at the end
