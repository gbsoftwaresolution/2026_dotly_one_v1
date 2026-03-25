# Roadmap — What to add beyond Vault + Life Docs

This is a CTO-style backlog of **additional product areas** that fit Booster Vault’s **zero‑knowledge** and **non‑AI** positioning.

## 1) Family / Multi-user Vault (shared accounts)
- Family plan with multiple users under one subscription.
- Shared storage quota + separate vault keys per user.
- Shared albums with explicit member permissions (viewer/editor).

## 2) Devices + Session Security (account hardening)
- Device inventory + revoke sessions.
- Login alerts, suspicious login detection.
- Optional 2FA (TOTP + recovery codes).

## 3) Key Management & Recovery (advanced)
- Hardware key support (WebAuthn) to protect vault unlock.
- Key rotation for vault master key (re-wrap without re-encrypting media).
- “Emergency kit” export: printable recovery package.

## 4) Backup & Sync Tools (desktop/mobile clients)
- Desktop uploader (folder watch → encrypted upload).
- Local “encrypted cache” / offline mode.
- Scheduled backups to user’s own S3 bucket (bring-your-own-storage).

## 5) Collaboration Features (non-AI)
- Commenting/notes on albums/media (plaintext or encrypted notes depending on UX choice).
- “Requests”: ask someone to upload photos to your album (wedding/event).

## 6) Compliance / Audit / Forensics-friendly logging
- Security audit log UI (logins, shares created, exports, heir access).
- Tamper-evident audit log chain (hash chaining) for high-trust customers.

## 7) Exports 2.0 (portability & business value)
- More export formats:
  - encrypted ZIP (current)
  - “Google Photos-style” JSON + folder structure
  - “Life Docs binder” index + encrypted attachments
- Scheduled export to email / S3.

## 8) Private Media Workflows (no AI)
- Secure camera capture mode (mobile) straight into encrypted vault.
- Screenshot blocking / screen privacy mode.

## 9) Admin / Ops Console (internal)
- Queue health dashboards, stuck job recovery.
- Storage usage audit.
- Billing reconciliation tools.

## 10) Marketplace integrations (optional)
- Mailgun/SES production email wiring.
- Payment provider alternatives.

## Suggested next “big module” choices
- **Consumer privacy app**: devices/sessions + backups/sync + family plan.
- **Legacy/continuity product**: continuity hardening + audit logs + recovery/key management.
