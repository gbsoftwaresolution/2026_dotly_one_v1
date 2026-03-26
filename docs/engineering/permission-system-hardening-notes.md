# Permission System Hardening Notes

- Fail closed: if conversation context, permission mapping, content resolution, or runtime safety inputs are missing or uncertain, enforcement must deny or require approval rather than allow.
- Cache and snapshot safety: preview risk inputs must never be persisted to stable cache or snapshots; snapshot freshness must include resolver version, source hash, and risk-overlay compatibility.
- Conversation binding safety: stale bindings must be re-resolved before enforcement, and older binding writes must not overwrite fresher resolution metadata.
- Protected mode guardrails: UI may display backend explanation text, but must not assume a saved custom setting overrides final safety enforcement.
- UI must not infer final allowed state from template/defaults alone; always use final effective state from resolved permissions or enforcement responses.
- Content rules are stricter than connection-level allows; expiry, view limits, and explicit content denials must win.
- Before production exposure, authentication and authorization still need to be enforced consistently at the API boundary and per-actor access path.
