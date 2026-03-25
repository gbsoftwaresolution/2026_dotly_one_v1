import React, { useEffect, useMemo, useState } from "react";
import {
  LifeDocCategory as LifeDocCategoryEnum,
  LifeDocReminderSetting as LifeDocReminderSettingEnum,
  LifeDocSubcategory as LifeDocSubcategoryEnum,
  LifeDocVisibility as LifeDocVisibilityEnum,
} from "@booster-vault/shared/life-docs/types";
import type {
  LifeDocCategory,
  LifeDocReminderSetting,
  LifeDocSubcategory,
  LifeDocVisibility,
} from "@booster-vault/shared/life-docs/types";
import { Link } from "react-router-dom";
import { useToast } from "../components/ToastProvider";
import {
  arrayBufferToBase64,
  base64ToArrayBuffer,
  decryptData,
  encryptData,
} from "../crypto/webcrypto";
import { isMasterKeyCached, getCachedMasterKey } from "../crypto/vaultKey";

const STORAGE_KEY = "booster_vault_life_docs_settings";

type EncryptedSettingsV1 = {
  v: 1;
  alg: "AES-GCM";
  ivB64: string;
  ciphertextB64: string;
};

type LifeDocsSettingsState = {
  defaultCategory?: LifeDocCategory;
  defaultSubcategory?: LifeDocSubcategory;
  defaultCustomSubcategory?: string;
  defaultVisibility?: LifeDocVisibility;
  defaultReminderSetting?: LifeDocReminderSetting;
};

function safeParseSettings(raw: string | null): LifeDocsSettingsState {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as LifeDocsSettingsState;
  } catch {
    return {};
  }
}

function isEncryptedSettingsV1(value: unknown): value is EncryptedSettingsV1 {
  const v = value as any;
  return (
    !!v &&
    typeof v === "object" &&
    v.v === 1 &&
    v.alg === "AES-GCM" &&
    typeof v.ivB64 === "string" &&
    typeof v.ciphertextB64 === "string"
  );
}

async function loadSettingsFromStorage(): Promise<LifeDocsSettingsState> {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return {};

  // Try encrypted payload first
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (isEncryptedSettingsV1(parsed)) {
      if (!isMasterKeyCached()) return {};
      const key = getCachedMasterKey();
      const plaintext = await decryptData(
        base64ToArrayBuffer(parsed.ciphertextB64),
        key,
        base64ToArrayBuffer(parsed.ivB64),
      );
      const json = new TextDecoder().decode(new Uint8Array(plaintext));
      return safeParseSettings(json);
    }
  } catch {
    // fall through to plaintext parse
  }

  // Legacy plaintext settings
  return safeParseSettings(raw);
}

async function saveSettingsToStorage(
  settings: LifeDocsSettingsState,
): Promise<void> {
  if (!isMasterKeyCached()) {
    throw new Error("Vault is locked");
  }

  const key = getCachedMasterKey();
  const json = JSON.stringify(settings);
  const data = new TextEncoder().encode(json).buffer;
  const { ciphertext, iv } = await encryptData(data, key);

  const wrapped: EncryptedSettingsV1 = {
    v: 1,
    alg: "AES-GCM",
    ivB64: arrayBufferToBase64(iv),
    ciphertextB64: arrayBufferToBase64(ciphertext),
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(wrapped));
}

export const LifeDocsSettings: React.FC = () => {
  const toast = useToast();

  const defaults = useMemo(
    () => ({
      defaultCategory: LifeDocCategoryEnum.IDENTITY_LEGAL as LifeDocCategory,
      defaultSubcategory: LifeDocSubcategoryEnum.PASSPORT as LifeDocSubcategory,
      defaultVisibility: LifeDocVisibilityEnum.PRIVATE as LifeDocVisibility,
      defaultReminderSetting:
        LifeDocReminderSettingEnum.EXPIRY_DEFAULT as LifeDocReminderSetting,
    }),
    [],
  );

  const [state, setState] = useState<LifeDocsSettingsState>({});
  const [vaultLocked, setVaultLocked] = useState<boolean>(!isMasterKeyCached());

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const locked = !isMasterKeyCached();
      setVaultLocked(locked);

      const current = await loadSettingsFromStorage();
      if (cancelled) return;
      setState({ ...defaults, ...current });
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [defaults]);

  const save = () => {
    void (async () => {
      try {
        await saveSettingsToStorage(state);
        toast.success("Saved", "Life Docs settings updated.");
      } catch {
        toast.warning(
          "Vault locked",
          "Unlock your Vault to save encrypted Life Docs settings.",
        );
      }
    })();
  };

  const reset = () => {
    setState({ ...defaults });
    void (async () => {
      try {
        await saveSettingsToStorage(defaults);
      } catch {
        // ignore
      }
      toast.success("Reset", "Life Docs settings reset to defaults.");
    })();
  };

  return (
    <div className="lifeDocsPage" style={{ maxWidth: 920 }}>
      <div className="lifeDocsHero lifeDocsHero--compact">
        <div className="lifeDocsHeroInner">
          <div>
            <h1 className="lifeDocsHeroTitle" style={{ fontSize: "2.1rem" }}>
              Life Docs Settings
            </h1>
            <p className="lifeDocsHeroSubtitle">
              Defaults used when creating new Life Docs.
            </p>
          </div>
          <div className="lifeDocsHeroActions">
            <Link to="/apps/life-docs" className="btn btn-ghost">
              Back
            </Link>
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: 18,
          background: "var(--bg-secondary)",
          border: "1px solid var(--border-primary)",
          borderRadius: 16,
          padding: 18,
        }}
      >
        {vaultLocked && (
          <div className="banner banner-warning" style={{ marginBottom: 14 }}>
            <div>
              <div className="banner-title">Vault locked</div>
              <div className="banner-message">
                Unlock your Vault to view and save encrypted Life Docs settings.
              </div>
            </div>
          </div>
        )}

        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}
        >
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontWeight: 700 }}>Default visibility</div>
            <select
              value={state.defaultVisibility}
              onChange={(e) =>
                setState((s) => ({
                  ...s,
                  defaultVisibility: e.target.value as LifeDocVisibility,
                }))
              }
              className="form-select"
            >
              {Object.values(LifeDocVisibilityEnum).map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontWeight: 700 }}>Default reminder</div>
            <select
              value={state.defaultReminderSetting}
              onChange={(e) =>
                setState((s) => ({
                  ...s,
                  defaultReminderSetting: e.target
                    .value as LifeDocReminderSetting,
                }))
              }
              className="form-select"
            >
              {Object.values(LifeDocReminderSettingEnum).map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontWeight: 700 }}>Default category</div>
            <select
              value={state.defaultCategory}
              onChange={(e) =>
                setState((s) => ({
                  ...s,
                  defaultCategory: e.target.value as LifeDocCategory,
                }))
              }
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid var(--border-primary)",
                background: "var(--bg-primary)",
                color: "var(--text-primary)",
              }}
            >
              {Object.values(LifeDocCategoryEnum).map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontWeight: 700 }}>Default subcategory</div>
            <select
              value={state.defaultSubcategory}
              onChange={(e) =>
                setState((s) => ({
                  ...s,
                  defaultSubcategory: e.target.value as LifeDocSubcategory,
                }))
              }
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid var(--border-primary)",
                background: "var(--bg-primary)",
                color: "var(--text-primary)",
              }}
            >
              {Object.values(LifeDocSubcategoryEnum).map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>

          {state.defaultSubcategory === LifeDocSubcategoryEnum.CUSTOM && (
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontWeight: 700 }}>Default custom subcategory</div>
              <input
                value={state.defaultCustomSubcategory || ""}
                onChange={(e) =>
                  setState((s) => ({
                    ...s,
                    defaultCustomSubcategory: e.target.value,
                  }))
                }
                placeholder="e.g. Vehicle Registration"
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid var(--border-primary)",
                  background: "var(--bg-primary)",
                  color: "var(--text-primary)",
                }}
              />
              <div style={{ color: "var(--text-tertiary)", fontSize: 13 }}>
                Used when creating new Life Docs with Subcategory = Custom.
              </div>
            </label>
          )}
        </div>

        <div
          style={{
            marginTop: 16,
            display: "flex",
            gap: 10,
            justifyContent: "flex-end",
            flexWrap: "wrap",
          }}
        >
          <button className="btn btn-secondary" type="button" onClick={reset}>
            Reset
          </button>
          <button className="btn btn-primary" type="button" onClick={save}>
            Save
          </button>
        </div>

        <div
          style={{ marginTop: 12, color: "var(--text-tertiary)", fontSize: 13 }}
        >
          These settings are encrypted with your Vault key and saved locally in
          this browser.
        </div>
      </div>
    </div>
  );
};
