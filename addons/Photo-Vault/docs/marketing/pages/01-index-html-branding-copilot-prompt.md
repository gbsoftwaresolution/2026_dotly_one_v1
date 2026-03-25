<!--
Public marketing branding
Single-page Copilot prompt (page 1 of N)

Target: apps/web/index.html
-->

# Page 01 — `apps/web/index.html`: Brand rename to BoosterAi.me (Copilot prompt)

## Role
You are a senior frontend engineer.

## Goal
Update **only** `apps/web/index.html` so all public metadata uses the brand name **BoosterAi.me**.

## Constraints
- Do not change routing or JS bundles.
- Do not change API/service names.
- Keep changes limited to the HTML metadata/head.

## What to update
In `apps/web/index.html`, search for any occurrences of:
- `Booster`
- `Booster Vault`
- `BoosterAi`

Update them to **BoosterAi.me** where they refer to the product/brand.

Specifically check:
- `<title>`
- `<meta name="description" ...>`
- OpenGraph tags (if present):
  - `og:site_name`
  - `og:title`
  - `og:description`
- Twitter tags (if present):
  - `twitter:title`
  - `twitter:description`

## Acceptance criteria
- Brand is consistently “BoosterAi.me” in the HTML head.
- No unrelated changes.

## Verification
Run:

```bash
pnpm -w type-check
pnpm --filter @booster-vault/web dev
```

Open the homepage and confirm the browser tab title is correct.
