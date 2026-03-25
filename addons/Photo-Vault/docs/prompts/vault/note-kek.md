Below is the deep, end-to-end “how it must work” for KEK + Recovery Phrase + Vault Master Key, including every important branch (master key missing → generate new, existing user migration, password change, forgot password, new device restore, trusted device). Then I’ll give you a ready-to-paste GPT-5.2 prompt that forces a correct implementation.

1) The correct architecture (non-negotiable)
A. Keys (three layers)
1) Vault Master Key (VMK) — the only key that ultimately unlocks user data

Random 256-bit key (cryptographically random)

Generated once per user (unless user explicitly rotates)

Used to wrap per-media keys (recommended) or directly encrypt media (less ideal)

Must never be derived from password or recovery phrase

Must never be stored in plaintext on server

Can exist in plaintext only in device memory while vault is unlocked

2) Password KEK (Key Encryption Key)

Derived from user password using a slow KDF (PBKDF2/Argon2)

Used only to encrypt/decrypt the VMK (“wrap/unwrap VMK”)

Changing password means rewrapping the same VMK (no re-encrypting media)

3) Recovery Phrase KEK

Derived from 12-word recovery phrase (client-generated)

Used to encrypt/decrypt the same VMK

Enables “forgot password” recovery without server access to secrets

B. What the server stores (ciphertext only)
VaultKeyBundle (password-wrapped VMK)

Stored server-side per user:

encryptedVmk (ciphertext bytes)

iv (AES-GCM IV)

kdfSalt, kdfIterations, kdfAlgo

metadata: createdAt, updatedAt

RecoveryBundle (recovery-wrapped VMK) — optional feature

Stored server-side per user:

encryptedVmk (ciphertext bytes)

iv

kdfSalt, kdfIterations, kdfAlgo

enabledAt, disabledAt (optional)

Note: server cannot validate the phrase; it only stores ciphertext.

Server must never store:

password

recovery phrase

plaintext VMK

plaintext per-media keys

2) The core invariant (this is the whole system)

Media decryption depends on VMK, and VMK can be unlocked by either Password KEK or Recovery KEK.

That’s it.

Everything else is flow control.

3) Required flows (including “VMK missing → generate new”)
Flow 0 — Definitions

“Unlocked” means device has VMK in memory.

“Locked” means device does not have VMK (even if logged in).

Flow 1 — New user / first unlock (VMK does not exist yet)

Trigger: user signs up, logs in, and tries to unlock/upload, but server has no VaultKeyBundle.

Client behavior:

Prompt user for vault password (usually same as account password unless you choose separate vault password; more on that below).

Generate VMK = random 32 bytes.

Derive KEK_password = KDF(password, salt, iterations).

Encrypt VMK with KEK_password using AES-256-GCM → encryptedVmk.

Upload VaultKeyBundle to server.

Cache VMK in memory as “unlocked”.

Server behavior:

Stores bundle as ciphertext only.

Logs audit event: VAULT_KEY_BUNDLE_CREATED.

✅ Result: user can now encrypt media.

Flow 2 — Existing user migration (they have encrypted media but no VMK bundle yet)

This can happen if you shipped media encryption earlier with a different scheme.

Recommended approach (strict):

If you already have encrypted media, you MUST already have a way to decrypt it.

The moment user successfully unlocks with the “old method”, you should generate/establish VMK and rewrap per-media keys under VMK (migration step) OR define the VMK as the old root key.

If you truly have no root key available:

There is no safe migration; you cannot decrypt existing media.

This should not happen in production.

Practical safe migration pattern:

On first unlock after update:

derive old key (old scheme) → decrypt per-media keys → rewrap under VMK → store VMK bundle.

This is client-only.

Flow 3 — Normal unlock (VMK exists, password known)

Trigger: vault locked; user enters password.

Client:

Fetch VaultKeyBundle from server.

Derive KEK_password from entered password using bundle KDF params.

AES-GCM decrypt encryptedVmk → VMK.

If decrypt fails → show “Invalid password” (do not leak info).

Hold VMK in memory.

✅ Result: user can decrypt any media keys.

Flow 4 — Enable recovery phrase (VMK must already be unlocked)

Trigger: user clicks “Enable Recovery”.

Client:

Ensure vault is unlocked (VMK in memory). If not, prompt password first.

Generate recovery phrase (12 words) on client.

Derive KEK_recovery = KDF(phrase, recoverySalt, iterations).

AES-GCM encrypt the same VMK → encryptedVmk_recovery.

Upload RecoveryBundle ciphertext to server.

Show phrase ONCE with strong warnings.

Server:

Stores recovery bundle only.

Logs audit event: RECOVERY_ENABLED.

✅ Result: user can recover VMK without password.

Flow 5 — Disable recovery phrase

Client:

Authenticated call to disable/remove recovery bundle.

(Optional) require password unlock first.

Server:

Marks disabledAt or deletes record.

Logs RECOVERY_DISABLED.

Flow 6 — Change password (password known, VMK stays same)

Trigger: user wants new password, but must retain access.

Client:

Vault must be unlocked (VMK in memory), OR:

Ask old password → unlock VMK (Flow 3).

Ask new password.

Derive new KEK_password_new with new salt/iterations.

Encrypt SAME VMK into new VaultKeyBundle.

Send update to server.

Server:

Replace bundle.

Revoke old sessions if you want.

Audit: PASSWORD_CHANGED, VAULT_KEY_BUNDLE_UPDATED.

✅ Media continues to decrypt because VMK unchanged.

Flow 7 — Forgot password (password not known)

This is the critical truth table:

Case A: Recovery enabled ✅

Client:

User resets account password (identity) via standard auth flow.

Vault remains locked (VMK not in memory).

User chooses “Restore vault with recovery phrase”.

Fetch RecoveryBundle.

Derive KEK_recovery and decrypt VMK.

Now derive new KEK_password_new from new password.

Rewrap VMK into new VaultKeyBundle.

Upload bundle update.

✅ Success: user regains data with new password.

Case B: Recovery not enabled ❌

No recovery KEK exists.

Possible only if:

user still has a trusted device where VMK can be unlocked (by having old password or device cache).

otherwise, data is unrecoverable by design.

This is why you soft-mandate recovery before meaningful uploads.

Flow 8 — New device restore

Same as forgot password Case A, but user might still know password.

Options:

If user knows password: normal unlock (Flow 3).

If user doesn’t: recovery restore (Flow 7A).

Flow 9 — Trusted device (optional third method; must still require password)

Trusted device should not be “auto unlock without password.”

Correct model:

store encrypted VMK locally (wrapped with a KEK derived from password + device salt)

user still types password; the device just prevents extra server calls / improves UX

if password changes, trusted device must be updated or re-established

4) “Separate vault password” vs “same as login password”

Recommended for now: use the same password (account password) as the vault password to reduce confusion.

If you introduce separate vault password:

you must handle two reset flows

user confusion spikes

support load increases

You can add separate vault password later.

5) Key rotation (not needed now, but define the rule)

Rotation means generating a new VMK and rewrapping every per-media key (client-side migration).

This is expensive; keep as future feature.

6) Security checks you must enforce

Never log keys, ivs, raw bundle bytes

Never store plaintext VMK (server)

Recovery phrase shown once; require confirmation

Rate-limit unlock attempts (but server can’t validate phrase; only password unlock attempts get server-side rate limits if you add an endpoint)

Exports must remain available even when uploads block