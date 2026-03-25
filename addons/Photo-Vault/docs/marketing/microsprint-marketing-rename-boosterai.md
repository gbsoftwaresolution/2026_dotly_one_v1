<!--
Marketing / Public pages
Micro-sprint prompt for VS Code Copilot

Scope: rename brand to "BoosterAi.me" across public marketing pages + metadata.
-->

# Micro-sprint — Marketing public pages: Rename brand to BoosterAi.me (Copilot prompt)

## Role
You are a senior frontend engineer. Your task is to update marketing/public pages to consistently use the brand name **BoosterAi.me**.

## Goal
Ensure all public-facing marketing pages, metadata, and UI nav references use:
- **BoosterAi.me** (exact casing)

Instead of older/shorter names like:
- Booster
- Booster Vault
- BoosterAi

This is a **copy/branding** change only; do not refactor core app flows.

## Scope (in repo)
Primary sources:
- `apps/web/src/pages/Homepage.tsx`
- `apps/web/src/pages/Pricing.tsx`
- `apps/web/src/pages/FAQ.tsx`
- `apps/web/src/pages/HowEncryptionWorks.tsx`
- `apps/web/src/pages/PrivacyPolicy.tsx`
- `apps/web/src/pages/TermsOfService.tsx`
- `apps/web/index.html` (title/meta)
- `apps/web/public/*` if it contains any brand text

Also check:
- `marketing-copy/*.md` (site copy source-of-truth)

Out of scope:
- API/service internal names
- Database model names
- package names

## Deliverables
1) Updated UI text and headings to “BoosterAi.me”
2) Updated HTML title/meta description if needed
3) No broken builds / lint errors

## Implementation steps

### Step 1 — Find all occurrences
Search in `apps/web/src/pages` + `apps/web/index.html` + `marketing-copy/` for:
- `Booster Vault`
- `Booster` (careful: may match in contexts where it’s not the brand)
- `BoosterAi`

### Step 2 — Update copy
Rules:
- Prefer “BoosterAi.me” in:
  - page titles
  - hero headings
  - CTA text
  - footer
  - policy documents
- If a sentence becomes awkward, rewrite minimally to read naturally.

### Step 3 — Update metadata
Update `apps/web/index.html`:
- `<title>`
- OpenGraph tags if present

### Step 4 — Sanity check
Run:

```bash
pnpm -w type-check
pnpm --filter @booster-vault/web dev
```

Manually spot-check:
- homepage
- pricing
- faq

## Acceptance criteria
- Marketing pages consistently say “BoosterAi.me”
- No obvious leftover old brand names
- App builds and runs
