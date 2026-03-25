/**
 * Vault master key management with VaultKeyBundle system.
 *
 * Design:
 * - Random 256-bit vault master key generated once per user (never derived from password)
 * - Password-derived key (KEK) used only to encrypt/decrypt the vault master key
 * - Encrypted vault master key + IV + KDF params stored on server as VaultKeyBundle
 * - On password change: re-encrypt same vault master key with new password KEK
 */

import {
  arrayBufferToBase64,
  base64ToArrayBuffer,
  deriveKeyFromPassword,
  randomBytes,
  generateAesGcmKey,
  wrapKey,
  unwrapKey,
  exportKeyRaw,
  importKeyRaw,
} from "./webcrypto";
import { vaultKeyApi } from "../api/vaultKey";
import { ApiError } from "../api/client";

// In-memory cache (single session)
let masterKeyCache: CryptoKey | null = null;

const PASSWORD_KDF_ITERATIONS_DEFAULT = 300000;
const PASSWORD_KDF_ITERATIONS_MIN_ACCEPTED = 10000;
const PASSWORD_KDF_ITERATIONS_MAX_ACCEPTED = 2000000;

// Diagnostic error codes (for dev logs only)
enum UnlockErrorCode {
  AUTH_BOOTSTRAPPING = "AUTH_BOOTSTRAPPING",
  BUNDLE_NOT_LOADED = "BUNDLE_NOT_LOADED",
  BUNDLE_MISSING = "BUNDLE_MISSING",
  KDF_PARAMS_INVALID = "KDF_PARAMS_INVALID",
  DECRYPT_FAILED = "DECRYPT_FAILED",
  PASSWORD_WRONG_OR_CHANGED = "PASSWORD_WRONG_OR_CHANGED",
  RECOVERY_REQUIRED = "RECOVERY_REQUIRED",
}

class VaultUnlockError extends Error {
  constructor(
    public code: UnlockErrorCode,
    message: string,
    public details?: any,
  ) {
    super(message);
    this.name = "VaultUnlockError";
  }
}

function logUnlockError(code: UnlockErrorCode, details?: any) {
  if (!import.meta.env.DEV) return;

  const SENSITIVE_KEYS = new Set([
    "password",
    "salt",
    "saltHex",
    "encryptedMasterKey",
    "iv",
    "wrappedKey",
    "key",
    "accessToken",
    "refreshToken",
    "token",
    "bundle",
    "kdfParams",
  ]);

  const sanitize = (value: any, depth: number): any => {
    if (depth > 2) return "[redacted]";
    if (value == null) return value;
    if (typeof value === "string") {
      // Avoid dumping large identifiers/ciphertext-ish blobs.
      return value.length > 80
        ? `${value.slice(0, 12)}…(${value.length})`
        : value;
    }
    if (typeof value !== "object") return value;
    if (Array.isArray(value))
      return value.slice(0, 20).map((v) => sanitize(v, depth + 1));

    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (SENSITIVE_KEYS.has(k)) {
        out[k] = "[redacted]";
      } else {
        out[k] = sanitize(v, depth + 1);
      }
    }
    return out;
  };

  console.debug(`[VaultUnlock] ${code}`, sanitize(details, 0));
}

/**
 * Derive password-derived key (KEK) from password and salt.
 * This is used only to encrypt/decrypt the vault master key.
 */
export async function derivePasswordKey(
  password: string,
  salt: ArrayBuffer,
  iterations = PASSWORD_KDF_ITERATIONS_DEFAULT,
): Promise<CryptoKey> {
  try {
    if (import.meta.env.DEV) {
      console.debug("[derivePasswordKey] Starting derivation:", {
        passwordLength: password.length,
        saltBytes: salt.byteLength,
        iterations,
      });
    }

    // Validate iterations
    if (
      typeof iterations !== "number" ||
      !Number.isFinite(iterations) ||
      iterations < PASSWORD_KDF_ITERATIONS_MIN_ACCEPTED ||
      iterations > PASSWORD_KDF_ITERATIONS_MAX_ACCEPTED
    ) {
      console.warn(`Suspicious iterations value: ${iterations}`);
      // Use default if invalid
      iterations = PASSWORD_KDF_ITERATIONS_DEFAULT;
    }

    // Validate salt size
    if (salt.byteLength < 8 || salt.byteLength > 128) {
      console.warn(`Unusual salt size: ${salt.byteLength} bytes`);
    }

    const key = await deriveKeyFromPassword(password, salt, iterations, 256);

    if (import.meta.env.DEV) {
      console.debug("[derivePasswordKey] Successfully derived key");
    }

    return key;
  } catch (err: any) {
    console.error("[derivePasswordKey] Failed to derive password key:", {
      error: err.message,
      name: err.name,
      saltSize: salt?.byteLength,
      iterations,
      passwordLength: password?.length,
    });
    throw new Error(`Failed to derive password key: ${err.message}`);
  }
}

/**
 * Generate a new random vault master key (256-bit AES-GCM)
 */
export async function generateVaultMasterKey(): Promise<CryptoKey> {
  return generateAesGcmKey();
}

/**
 * Wrap (encrypt) vault master key with password-derived key
 * @param salt The salt used to derive the passwordKey (must be stored in kdfParams)
 */
export async function wrapVaultMasterKey(
  vaultMasterKey: CryptoKey,
  passwordKey: CryptoKey,
  salt: ArrayBuffer,
  iterations: number = PASSWORD_KDF_ITERATIONS_DEFAULT,
): Promise<{ encryptedMasterKey: string; iv: string; kdfParams: any }> {
  const { wrappedKey, iv } = await wrapKey(vaultMasterKey, passwordKey);

  return {
    encryptedMasterKey: arrayBufferToBase64(wrappedKey),
    iv: arrayBufferToBase64(iv),
    kdfParams: {
      iterations,
      hash: "SHA-256",
      salt: arrayBufferToBase64(salt),
    },
  };
}

/**
 * Unwrap (decrypt) vault master key with password-derived key
 */
export async function unwrapVaultMasterKey(
  encryptedMasterKey: string,
  iv: string,
  passwordKey: CryptoKey,
): Promise<CryptoKey> {
  try {
    // Validate inputs
    if (!encryptedMasterKey || !iv) {
      throw new Error("Missing encrypted key or IV");
    }

    // Log diagnostic info in dev mode
    if (import.meta.env.DEV) {
      console.debug("[unwrapVaultMasterKey] Inputs:", {
        encryptedKeyLength: encryptedMasterKey.length,
        ivLength: iv.length,
        hasPasswordKey: !!passwordKey,
      });
    }

    // Best-effort validation only (decoder supports base64url + missing padding)
    const base64ishRegex = /^[A-Za-z0-9+/_-]*={0,3}$/;
    if (!base64ishRegex.test(encryptedMasterKey) || !base64ishRegex.test(iv)) {
      console.warn("Unexpected key/iv encoding format detected:", {
        encryptedKeyValid: base64ishRegex.test(encryptedMasterKey),
        ivValid: base64ishRegex.test(iv),
      });
    }

    const wrappedKey = base64ToArrayBuffer(encryptedMasterKey);
    const ivBuffer = base64ToArrayBuffer(iv);

    // Log buffer sizes for debugging
    if (import.meta.env.DEV) {
      console.debug("[unwrapVaultMasterKey] Buffer sizes:", {
        wrappedKeyBytes: wrappedKey.byteLength,
        ivBufferBytes: ivBuffer.byteLength,
      });
    }

    // Validate buffer sizes but be more permissive
    if (wrappedKey.byteLength < 32) {
      // Minimum: 256-bit key (32 bytes) without tag
      console.warn(`Small wrapped key size: ${wrappedKey.byteLength} bytes`);
    }

    if (ivBuffer.byteLength !== 12) {
      // 96-bit IV for AES-GCM is standard
      console.warn(
        `Non-standard IV size: ${ivBuffer.byteLength} bytes, expected 12 bytes`,
      );
    }

    // Try to unwrap the key
    const result = await unwrapKey(wrappedKey, passwordKey, ivBuffer);

    if (import.meta.env.DEV) {
      console.debug("[unwrapVaultMasterKey] Successfully unwrapped key");
    }

    return result;
  } catch (err: any) {
    // Re-throw with more context
    const errorMessage = err?.message || String(err);
    console.error("[unwrapVaultMasterKey] Error details:", {
      error: errorMessage,
      encryptedKeyLength: encryptedMasterKey?.length,
      ivLength: iv?.length,
      errorName: err?.name,
      errorStack: err?.stack,
    });
    throw new Error(`Failed to unwrap vault master key: ${errorMessage}`);
  }
}

/**
 * Unlock vault with password.
 * Flow:
 * 1. Check if VaultKeyBundle exists on server
 * 2. If exists: fetch bundle, derive password key, decrypt vault master key
 * 3. If not exists: generate new vault master key, create bundle, upload to server
 */
export async function unlockVault(password: string): Promise<boolean> {
  try {
    // Log diagnostic info in dev mode
    if (import.meta.env.DEV) {
      console.debug("[VaultUnlock] Starting unlock process");
    }

    // Check vault key bundle status
    const status = await vaultKeyApi.getStatus();

    if (import.meta.env.DEV) {
      console.debug("[VaultUnlock] Bundle status:", status);
    }

    if (status.enabled) {
      // Bundle exists - fetch and decrypt
      let bundle: any;
      try {
        bundle = await vaultKeyApi.getBundle();
      } catch (e: any) {
        // If status says enabled but bundle is missing, treat as first-time bootstrap.
        if (e instanceof ApiError && e.status === 404) {
          if (import.meta.env.DEV) {
            console.warn(
              "[VaultUnlock] Status enabled but bundle 404; bootstrapping new bundle",
            );
          }

          const vaultMasterKey = await generateVaultMasterKey();
          const salt = randomBytes(16);
          const passwordKey = await derivePasswordKey(password, salt);
          const newBundle = await wrapVaultMasterKey(
            vaultMasterKey,
            passwordKey,
            salt,
            PASSWORD_KDF_ITERATIONS_DEFAULT,
          );
          await vaultKeyApi.upsert(newBundle);
          masterKeyCache = vaultMasterKey;
          return true;
        }
        throw e;
      }

      if (import.meta.env.DEV) {
        console.debug("[VaultUnlock] Retrieved bundle:", {
          hasKdfParams: !!bundle.kdfParams,
          saltLength: bundle.kdfParams?.salt?.length,
          iterations: bundle.kdfParams?.iterations,
          hash: bundle.kdfParams?.hash,
          encryptedKeyLength: bundle.encryptedMasterKey?.length,
          ivLength: bundle.iv?.length,
        });
      }

      // Validate bundle + kdfParams
      if (!bundle?.encryptedMasterKey || !bundle?.iv) {
        logUnlockError(UnlockErrorCode.KDF_PARAMS_INVALID, { bundle });
        throw new VaultUnlockError(
          UnlockErrorCode.KDF_PARAMS_INVALID,
          "Vault setup data is missing or invalid.",
        );
      }

      if (
        !bundle.kdfParams?.salt ||
        !bundle.kdfParams?.iterations ||
        !bundle.kdfParams?.hash
      ) {
        logUnlockError(UnlockErrorCode.KDF_PARAMS_INVALID, {
          kdfParams: bundle.kdfParams,
        });
        throw new VaultUnlockError(
          UnlockErrorCode.KDF_PARAMS_INVALID,
          "Vault setup data is missing or invalid.",
        );
      }

      // Derive password key using stored salt (source of truth)
      const salt = base64ToArrayBuffer(bundle.kdfParams.salt);
      const passwordKey = await derivePasswordKey(
        password,
        salt,
        bundle.kdfParams.iterations,
      );

      if (import.meta.env.DEV) {
        console.debug(
          "[VaultUnlock] Derived password key, attempting unwrap...",
        );
      }

      // Decrypt vault master key
      const vaultMasterKey = await unwrapVaultMasterKey(
        bundle.encryptedMasterKey,
        bundle.iv,
        passwordKey,
      );

      // Cache the master key
      masterKeyCache = vaultMasterKey;
      logUnlockError(UnlockErrorCode.DECRYPT_FAILED, { success: true });

      // Best-effort security upgrade: rewrap VMK if stored iterations are below our current default.
      // This should never block unlock.
      try {
        const iters =
          typeof bundle.kdfParams?.iterations === "number"
            ? bundle.kdfParams.iterations
            : null;
        if (iters !== null && iters < PASSWORD_KDF_ITERATIONS_DEFAULT) {
          const upgradeSalt = randomBytes(16);
          const upgradePasswordKey = await derivePasswordKey(
            password,
            upgradeSalt,
            PASSWORD_KDF_ITERATIONS_DEFAULT,
          );
          const upgradedBundle = await wrapVaultMasterKey(
            vaultMasterKey,
            upgradePasswordKey,
            upgradeSalt,
            PASSWORD_KDF_ITERATIONS_DEFAULT,
          );
          await vaultKeyApi.upsert(upgradedBundle);
          if (import.meta.env.DEV) {
            console.debug("[VaultUnlock] Upgraded vault KDF iterations", {
              from: iters,
              to: PASSWORD_KDF_ITERATIONS_DEFAULT,
            });
          }
        }
      } catch (e) {
        if (import.meta.env.DEV) {
          console.warn(
            "[VaultUnlock] Failed to upgrade vault KDF params (non-fatal)",
            e,
          );
        }
      }

      if (import.meta.env.DEV) {
        console.debug("[VaultUnlock] Successfully unlocked vault");
      }

      return true;
    } else {
      // No bundle exists - generate new vault master key and create bundle
      if (import.meta.env.DEV) {
        console.debug("[VaultUnlock] No bundle exists, creating new one");
      }

      const vaultMasterKey = await generateVaultMasterKey();

      // Generate random salt for password derivation
      const salt = randomBytes(16);
      const passwordKey = await derivePasswordKey(password, salt);

      // Wrap vault master key
      const bundle = await wrapVaultMasterKey(
        vaultMasterKey,
        passwordKey,
        salt,
        PASSWORD_KDF_ITERATIONS_DEFAULT,
      );

      // Upload bundle to server
      await vaultKeyApi.upsert(bundle);

      // Cache the master key
      masterKeyCache = vaultMasterKey;
      logUnlockError(UnlockErrorCode.BUNDLE_MISSING, { created: true });

      if (import.meta.env.DEV) {
        console.debug("[VaultUnlock] Created new vault bundle");
      }

      return true;
    }
  } catch (err: any) {
    // Log the full error for debugging
    if (import.meta.env.DEV) {
      console.error("[VaultUnlock] Detailed error analysis:", {
        error: err,
        name: err.name,
        message: err.message,
        stack: err.stack,
        constructor: err.constructor?.name,
        isVaultUnlockError: err instanceof VaultUnlockError,
        errorString: String(err),
      });
    }

    if (err instanceof VaultUnlockError) {
      logUnlockError(err.code, err.details);
      throw err;
    }

    // API errors (non-network) with actionable status codes
    if (err instanceof ApiError) {
      const status = err.status;

      if (status === 401 || status === 403) {
        logUnlockError(UnlockErrorCode.BUNDLE_NOT_LOADED, { status });
        throw new VaultUnlockError(
          UnlockErrorCode.BUNDLE_NOT_LOADED,
          "Your session expired. Please sign in again and retry.",
        );
      }

      if (status === 400 || status === 422) {
        logUnlockError(UnlockErrorCode.KDF_PARAMS_INVALID, {
          status,
          data: err.data,
        });
        throw new VaultUnlockError(
          UnlockErrorCode.KDF_PARAMS_INVALID,
          "Vault setup data was rejected by the server. Please refresh and try again.",
        );
      }

      if (status >= 500) {
        logUnlockError(UnlockErrorCode.BUNDLE_NOT_LOADED, { status });
        throw new VaultUnlockError(
          UnlockErrorCode.BUNDLE_NOT_LOADED,
          "Server error while unlocking. Please try again.",
        );
      }
    }

    // Determine error type
    const errorMessage = err?.message || String(err);
    const errorString = errorMessage.toLowerCase();

    // Log raw error for debugging
    if (import.meta.env.DEV) {
      console.debug("[VaultUnlock] Raw error categorization:", {
        errorMessage,
        errorString,
        includesCrypto: errorString.includes("crypto"),
        includesSubtle: errorString.includes("subtle"),
        includesKey: errorString.includes("key"),
        includesAlgorithm: errorString.includes("algorithm"),
        includesOperation: errorString.includes("operation"),
      });
    }

    // Network/API errors
    if (
      errorString.includes("network") ||
      errorString.includes("fetch") ||
      errorString.includes("status") ||
      errorString.includes("failed to fetch") ||
      errorString.includes("connection") ||
      errorString.includes("offline") ||
      errorString.includes("api") ||
      errorString.includes("endpoint")
    ) {
      logUnlockError(UnlockErrorCode.BUNDLE_NOT_LOADED, {
        error: errorMessage,
      });
      throw new VaultUnlockError(
        UnlockErrorCode.BUNDLE_NOT_LOADED,
        "Network error. Please check your connection and try again.",
        { originalError: errorMessage },
      );
    }

    const errorName = (err?.name || "").toLowerCase();
    const isOperationError =
      errorName === "operationerror" || errorString.includes("operationerror");

    // Decryption / unwrap failures (most commonly wrong password or password changed)
    // NOTE: WebCrypto uses OperationError for AES-GCM auth/tag failures (wrong key/password).
    if (
      isOperationError ||
      errorString.includes("decrypt") ||
      errorString.includes("unwrap") ||
      errorString.includes("authentication") ||
      errorString.includes("integrity") ||
      errorString.includes("bad padding") ||
      errorString.includes("gcm") ||
      errorString.includes("aes") ||
      errorString.includes("failed to unwrap vault master key")
    ) {
      logUnlockError(UnlockErrorCode.PASSWORD_WRONG_OR_CHANGED, {
        error: errorMessage,
        name: err?.name,
      });
      throw new VaultUnlockError(
        UnlockErrorCode.PASSWORD_WRONG_OR_CHANGED,
        "Couldn't unlock the vault with that password.",
        { originalError: errorMessage, errorName: err?.name },
      );
    }

    // Web Crypto / environment errors (unsupported algorithms, bad key types, missing APIs)
    if (
      errorString.includes("crypto") ||
      errorString.includes("subtle") ||
      errorString.includes("algorithm") ||
      errorString.includes("not supported") ||
      errorString.includes("unsupported") ||
      errorString.includes("invalid") ||
      errorString.includes("type") ||
      errorString.includes("parameter") ||
      errorName === "notsupportederror" ||
      errorName === "invalidaccesserror" ||
      errorName === "dataerror"
    ) {
      logUnlockError(UnlockErrorCode.DECRYPT_FAILED, {
        error: errorMessage,
        name: err?.name,
      });
      throw new VaultUnlockError(
        UnlockErrorCode.DECRYPT_FAILED,
        "Failed to unlock vault due to a cryptographic error. Please try again.",
        { originalError: errorMessage, errorName: err?.name },
      );
    }

    // Default to password wrong or changed
    logUnlockError(UnlockErrorCode.PASSWORD_WRONG_OR_CHANGED, {
      error: errorMessage,
    });
    throw new VaultUnlockError(
      UnlockErrorCode.PASSWORD_WRONG_OR_CHANGED,
      "Couldn't unlock the vault with that password.",
      { originalError: errorMessage },
    );
  }
}

/**
 * Change vault password.
 * Flow:
 * 1. Verify current password by unlocking vault
 * 2. Re-encrypt same vault master key with new password KEK
 * 3. Update bundle on server
 */
export async function changeVaultPassword(
  currentPassword: string,
  newPassword: string,
): Promise<boolean> {
  try {
    // First unlock with current password to get vault master key
    const unlocked = await unlockVault(currentPassword);
    if (!unlocked) {
      return false;
    }

    const vaultMasterKey = getCachedMasterKey();

    // Generate new salt for new password derivation
    const newSalt = randomBytes(16);
    const newPasswordKey = await derivePasswordKey(newPassword, newSalt);

    // Wrap vault master key with new password key
    const newBundle = await wrapVaultMasterKey(
      vaultMasterKey,
      newPasswordKey,
      newSalt,
      PASSWORD_KDF_ITERATIONS_DEFAULT,
    );

    // Update bundle on server
    await vaultKeyApi.upsert(newBundle);

    return true;
  } catch (err) {
    console.error("Failed to change vault password:", err);
    return false;
  }
}

/**
 * Get the cached master key.
 * @throws If master key not derived yet (call unlockVault first)
 */
export function getCachedMasterKey(): CryptoKey {
  if (!masterKeyCache) {
    throw new Error("Master key not cached. Call unlockVault first.");
  }
  return masterKeyCache;
}

/**
 * Set the cached master key (e.g., after restoring from trusted device or recovery).
 */
export function setCachedMasterKey(key: CryptoKey): void {
  masterKeyCache = key;
}

/**
 * Check if master key is cached (i.e., vault is unlocked).
 */
export function isMasterKeyCached(): boolean {
  return masterKeyCache !== null;
}

/**
 * Clear the cached master key (e.g., on logout).
 */
export function clearMasterKeyCache(): void {
  masterKeyCache = null;
}

/**
 * Lock the vault (clear cached key).
 */
export function lockVault(): void {
  clearMasterKeyCache();
}

/**
 * Export vault master key as raw bytes (for recovery phrase encryption).
 * Note: This is only safe when vault is unlocked.
 */
export async function exportVaultMasterKeyRaw(): Promise<ArrayBuffer> {
  const key = getCachedMasterKey();
  return exportKeyRaw(key);
}

/**
 * Import vault master key from raw bytes (for recovery phrase restoration).
 */
export async function importVaultMasterKeyRaw(
  keyData: ArrayBuffer,
): Promise<CryptoKey> {
  const key = await importKeyRaw(keyData);
  setCachedMasterKey(key);
  return key;
}
