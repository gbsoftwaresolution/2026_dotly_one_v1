# V1 Spec Prompt — Vault Crypto Hardening (Bind ciphertext via AES-GCM AAD)

## Role
You are a senior cryptography-aware full-stack engineer hardening a zero-knowledge vault.

## Goal (V1 security)
Add **cryptographic binding** between encrypted blobs and their intended context by using **AES-GCM AAD (additional authenticated data)** and a versioned `encMeta` schema.

This prevents “ciphertext swap” / “replay in wrong context” classes of bugs where ciphertext can be moved between media items or variants without detection.

## Background / Current State
- Client encrypts media and uploads ciphertext.
- Server stores ciphertext + JSON `encMeta` (algorithm, IV, etc.).
- AES-GCM already provides integrity for (ciphertext + AAD). Right now AAD is not consistently used.

## Success Criteria
1. For all new uploads, client encryption must use AES-GCM with **AAD** derived from stable identifiers:
   - `userId`
   - `mediaId`
   - `variant` (e.g., `"original" | "thumbnail"`)
   - `encMetaVersion`
2. Decryption must fail if any of these values differ.
3. The AAD encoding is deterministic (same bytes across devices/browsers).
4. Backward compatible:
   - Existing items without AAD must still decrypt.
   - Introduce `encMeta.v` to branch decryption logic.
5. Add tests for both v1 (no AAD) and v2 (AAD) flows.

## Design

### `encMeta` versioning
Define a discriminated union in `packages/shared`:

- `encMeta.v = 1`: legacy (no AAD)
- `encMeta.v = 2`: AAD-enabled

Example `encMeta v2`:
```json
{
  "v": 2,
  "alg": "aes-256-gcm",
  "iv": "<base64>",
  "aad": {
    "userId": "...",
    "mediaId": "...",
    "variant": "original",
    "purpose": "vault-media",
    "metaVersion": 2
  }
}
```

### AAD bytes
Use a canonical string -> UTF-8 bytes approach:

```
aad = `booster:vault-media:v2|userId=${userId}|mediaId=${mediaId}|variant=${variant}`
```

Then `TextEncoder().encode(aad)` in the browser.

Rules:
- Do NOT JSON.stringify an object unless you also canonicalize key order.
- Prefer the explicit pipe-delimited string.

### Where to implement
- Web crypto code:
  - `apps/web/src/crypto/*` (search for AES-GCM usage)
  - Thumbnail encryption code path too
- Shared types:
  - `packages/shared/src/media/*` (or wherever `encMeta` is typed)
- API does not need to understand AAD, but it must persist `encMeta` and `thumbEncMeta` as provided.

## Implementation Steps
1. Locate encryption functions for original upload + thumbnails.
2. Introduce `buildAad({ userId, mediaId, variant, v: 2 }) => Uint8Array`.
3. When encrypting with WebCrypto AES-GCM:
   - pass `{ additionalData: aadBytes }`.
4. Persist `encMeta.v=2` and the human-readable AAD fields (NOT the bytes) so the decryptor can recompute AAD.
5. Decryption:
   - if `encMeta.v===2`, recompute AAD bytes and pass them into decrypt.
   - if `encMeta.v===1` or missing, decrypt without AAD.
6. Tests:
   - Unit test: v2 decrypt fails when mediaId changes.
   - Unit test: v1 still decrypts.
7. Migration strategy:
   - No DB migration required; only new uploads use v2.

## Deliverables
- Updated crypto utilities in `apps/web/src/crypto/`
- Strong types in `packages/shared` for `encMeta`
- Tests (Vitest/Jest) validating AAD enforcement
- Short note in `IMPLEMENTATION_REPORT.md` describing the new `encMeta.v=2`

## Acceptance Checklist
1) Upload + download works for new items
2) Existing items remain decryptable
3) Swapping ciphertext between two media IDs fails to decrypt (v2)
