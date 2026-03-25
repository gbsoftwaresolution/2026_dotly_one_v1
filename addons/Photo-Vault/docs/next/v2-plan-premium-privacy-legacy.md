# V2 Plan — Premium Privacy / Legacy Product (Vault + Life Docs + Continuity)

Target: **Premium privacy/legacy** customers (high trust, strong recovery, auditability, continuity/heir flows).

This is a product + engineering roadmap (not a spec). Each section ends with suggested “first implementation prompts”.

---

## Guiding principles (V2)
1. **Security > Convenience** for legacy/continuity flows.
2. **Fail closed**: when integrity/ACL/pointers don’t verify, content must not leak.
3. **Auditability**: every sensitive action creates an immutable audit trail.
4. **Recoverability**: users can recover access without weakening zero‑knowledge guarantees.
5. **Least privilege sharing**: explicit roles with clear UI and enforced server-side.

---

## Vault V2 Roadmap

### V2.1 Key Management & Recovery (must-have for premium)
- **Key rotation** for vault master key (re-wrap, not re-encrypt all media)
  - Add a vault-key “generation” concept and allow re-wrapping with new KEK.
- **Recovery hardening**
  - Split recovery into: (a) owner self-recovery, (b) trusted contact recovery (optional), (c) emergency lockout.
  - Make recovery flows auditable and rate limited.
- **2FA for account actions** (not for decrypting media)
  - TOTP + recovery codes for login, share creation, export creation, continuity arming.

Acceptance outcomes:
- User can rotate password/KEK without losing media.
- User can recover account securely and verifiably.

### V2.2 Tamper-evident Audit Log (security narrative)
- Build an **audit log UI** in web app.
- Add **hash-chained audit events**:
  - `audit_event[i].hash = H(audit_event[i-1].hash || serializedEvent)`
  - Enables tamper evidence even for internal admins.
- Export audit log as a signed bundle.

Acceptance outcomes:
- Owners can see: logins, key events, share events, export events, continuity events.

### V2.3 Sharing 2.0 (roles + revocation + safer public links)
- **Member-based sharing** (not only public links) with explicit roles:
  - viewer / contributor / manager
- **Revocation + key rotation on revocation** for shared albums.
- **Share link “hardening profile”**:
  - Strong passphrase (already in V1 backlog)
  - Optional expiry + view limits
  - Per-link rate limiting policies

### V2.4 Exports 2.0 (legal-grade portability)
- More formats:
  - Encrypted ZIP (current)
  - Google Photos-style structure
  - “Vault manifest” signed for integrity
- Scheduled exports to user-owned storage.

---

## Life Docs V2 Roadmap

### V2.1 Masking & Privacy Model (formalize)
- Server-enforced masked mode (V1 hardening) becomes the baseline.
- Add **privacy tiers per field**:
  - public-to-shared (safe)
  - owner-only
  - masked-to-non-owner
- Allow policy templates (e.g. “Passport template”).

### V2.2 Attachments & Binder UX
- Allow multiple media attachments per Life Doc:
  - scans, supporting documents, renewals, etc.
- “Binder view”:
  - print-ready index
  - export binder package (encrypted)

### V2.3 Reminder Engine 2.0
- Quiet hours becomes a full scheduler:
  - due events, retries, delivery status
- Multi-channel delivery:
  - in-app (baseline)
  - email (opt-in)
  - push (future)

### V2.4 Sharing roles + guardian workflows
- Guardian roles get explicit capabilities:
  - view masked/unmasked depending on owner policy
  - “renewal manager” for specific docs
- Guardian actions are heavily audit-logged.

---

## Continuity V2 Roadmap (core differentiator)

### V2.1 Heir portal productionization
- Strong heir authentication (V1 prompt)
- Verified identity options:
  - signed email link + access code
  - optional KYC (only if product direction allows)

### V2.2 Release policies (real rules)
- Inactivity policy:
  - require periodic owner check-in
  - multi-step warnings
- Multi-party attestation:
  - 2-of-3 trustees can release
- Emergency manual release:
  - owner triggers release with 2FA

### V2.3 Scope snapshots & cryptographic guarantees
- Release instance should store an immutable snapshot:
  - what docs/media were included
  - what was masked/unmasked
  - expiry
- Consider encrypting “release keys” with recipient-specific keys.

---

## Suggested execution order (premium/legacy)
1. **Audit log UI + hash chaining** (security story + trust)
2. **Key management & recovery hardening** (risk reduction)
3. **Continuity heir portal + release policies** (differentiator)
4. **Life Docs attachments + binder exports** (high value)

---

## Next: implementation prompts to generate
If you want, I can generate Copilot/GPT prompts (like V1) for the first V2 tranche:
1) Audit log UI + hash-chained audit events
2) Vault key rotation (re-wrap) + 2FA gating for sensitive actions
3) Continuity inactivity policy + trustee attestation
