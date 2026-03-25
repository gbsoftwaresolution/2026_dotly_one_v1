# V1 Spec Prompt — Share Passphrase Hardening (Public Album Sharing)

## Role
You are a senior frontend/security engineer improving the security of public read-only album sharing.

## Goal (V1 security)
Increase the entropy of public share passphrases so that offline guessing is not feasible.

**Current risk:** the current `generatePassphrase()` uses a tiny word list and 4 words (~< 20 bits entropy). Since the server returns the encrypted share bundle even for wrong passphrases, an attacker can download the bundle and brute-force offline.

## Success Criteria
1. New passphrases have **>= 64 bits** of entropy.
2. Passphrase format remains user-friendly to type (OK to use words, but must be from a large list).
3. Existing shares remain unlockable (no breaking change):
   - Unlock uses existing `kdfParams` from the server bundle.
   - Only the passphrase generator changes for *new* shares.

## Recommended Design
### Option A (preferred): 6 words from a 2048-word list
- Use a standard BIP-39 English word list (2048 words).
- Generate 6 random indices via `crypto.getRandomValues`.
- Join with `-` (hyphen) for readability.
- Entropy: 6 * 11 = **66 bits**.

### Option B: Base64url token
- Generate 16 random bytes and encode as base64url.
- Entropy: 128 bits.
- Less user-friendly.

## Where to implement
- Generator: `apps/web/src/crypto/sharing.ts` (`generatePassphrase()`)
- Any UI that displays the passphrase to the user (share creation flow)
- Add/update tests if present.

## Tasks
1. Replace the tiny literal word list with a larger source.
   - Prefer: add a `apps/web/src/crypto/wordlists/bip39-en.ts` (or similar) containing the 2048 words.
   - Keep it tree-shakeable and not loaded in non-sharing flows if possible.
2. Implement:
   - `generatePassphrase({ words = 6 } = {})` producing 6 words by default.
3. Add a quick unit test:
   - Deterministic test that output matches `^[a-z]+(-[a-z]+){5}$`
   - And length/word count.
4. Confirm share unlock flow still works (no change needed).

## Acceptance Criteria
- Creating a share shows the new 6-word passphrase.
- Unlock continues to work for old and new shares.
- No lint/typecheck regressions.
