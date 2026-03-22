"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { PrimaryButton } from "@/components/shared/primary-button";
import { personaApi } from "@/lib/api";
import { isApiError } from "@/lib/api/client";
import { routes } from "@/lib/constants/routes";
import {
  personaSharingModeOptions,
  personaSmartCardPrimaryActionOptions,
} from "@/lib/persona/labels";
import { cn } from "@/lib/utils/cn";
import type {
  PersonaSharingMode,
  PersonaSmartCardConfig,
  PersonaSmartCardPrimaryAction,
  PersonaSummary,
} from "@/types/persona";

interface PersonaSharingSettingsFormProps {
  persona: PersonaSummary;
}

type PrimaryActionValue = PersonaSmartCardPrimaryAction | "";

type ToggleKey = "allowCall" | "allowWhatsapp" | "allowEmail" | "allowVcard";

interface FormState {
  sharingMode: PersonaSharingMode;
  primaryAction: PrimaryActionValue;
  allowCall: boolean;
  allowWhatsapp: boolean;
  allowEmail: boolean;
  allowVcard: boolean;
}

const defaultSmartCardState = {
  primaryAction: "",
  allowCall: false,
  allowWhatsapp: false,
  allowEmail: false,
  allowVcard: false,
} satisfies Omit<FormState, "sharingMode">;

const smartCardToggleOptions: Array<{ key: ToggleKey; label: string }> = [
  { key: "allowCall", label: "Allow Call" },
  { key: "allowWhatsapp", label: "Allow WhatsApp" },
  { key: "allowEmail", label: "Allow Email" },
  { key: "allowVcard", label: "Allow Save Contact" },
];

function createFormState(persona: PersonaSummary): FormState {
  const smartCardConfig = persona.smartCardConfig;

  return {
    sharingMode: persona.sharingMode ?? "controlled",
    primaryAction: smartCardConfig?.primaryAction ?? "",
    allowCall: smartCardConfig?.allowCall ?? false,
    allowWhatsapp: smartCardConfig?.allowWhatsapp ?? false,
    allowEmail: smartCardConfig?.allowEmail ?? false,
    allowVcard: smartCardConfig?.allowVcard ?? false,
  };
}

function buildSmartCardConfig(
  formState: FormState,
): PersonaSmartCardConfig | null {
  if (formState.sharingMode !== "smart_card") {
    return null;
  }

  if (!formState.primaryAction) {
    return null;
  }

  return {
    primaryAction: formState.primaryAction,
    allowCall: formState.allowCall,
    allowWhatsapp: formState.allowWhatsapp,
    allowEmail: formState.allowEmail,
    allowVcard: formState.allowVcard,
  };
}

export function PersonaSharingSettingsForm({
  persona,
}: PersonaSharingSettingsFormProps) {
  const router = useRouter();
  const [formState, setFormState] = useState<FormState>(() =>
    createFormState(persona),
  );
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!successMessage) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setSuccessMessage(null);
    }, 3200);

    return () => window.clearTimeout(timeoutId);
  }, [successMessage]);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setSuccessMessage(null);
    setFormState((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function setSharingMode(nextMode: PersonaSharingMode) {
    setError(null);
    setFieldError(null);
    setSuccessMessage(null);
    setFormState((current) => ({
      ...current,
      sharingMode: nextMode,
    }));
  }

  function validate(): PersonaSmartCardConfig | null {
    if (formState.sharingMode === "controlled") {
      return null;
    }

    if (!formState.primaryAction) {
      setFieldError("Choose a primary action before saving Smart Card Mode.");
      return null;
    }

    setFieldError(null);
    return buildSmartCardConfig(formState);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const smartCardConfig = validate();

    if (formState.sharingMode === "smart_card" && !smartCardConfig) {
      return;
    }

    setIsSubmitting(true);

    try {
      const updatedPersona = await personaApi.updateSharing(persona.id, {
        sharingMode: formState.sharingMode,
        smartCardConfig,
      });

      setFormState(createFormState(updatedPersona));
      setSuccessMessage("Sharing settings saved.");
      router.refresh();
    } catch (submissionError) {
      if (isApiError(submissionError) && submissionError.status === 401) {
        router.replace(
          `/login?next=${encodeURIComponent(routes.app.personaSettings(persona.id))}&reason=expired`,
        );
        router.refresh();
        return;
      }

      setError(
        isApiError(submissionError)
          ? submissionError.message
          : "Unable to update sharing settings right now. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const inputCls =
    "min-h-14 w-full rounded-2xl border border-border bg-background px-4 text-sm font-medium text-foreground outline-none transition-all placeholder:text-muted/50 focus:border-brandRose focus:ring-2 focus:ring-brandRose/15 dark:focus:border-brandCyan dark:focus:ring-brandCyan/20";

  const smartCardSelected = formState.sharingMode === "smart_card";
  const isSmartCardInvalid = smartCardSelected && !formState.primaryAction;
  const isSaveDisabled = isSubmitting || isSmartCardInvalid;

  return (
    <>
      <form className="space-y-6" onSubmit={handleSubmit}>
        <fieldset className="space-y-3">
          <legend className="sr-only">How people can access you</legend>

          <div className="flex flex-col gap-3">
            {personaSharingModeOptions.map((option) => {
              const isSelected = formState.sharingMode === option.value;

              return (
                <label
                  key={option.value}
                  className={cn(
                    "flex min-h-[4.75rem] cursor-pointer items-start gap-4 rounded-3xl border px-4 py-4 transition-all focus-within:ring-2 focus-within:ring-brandRose/20 dark:focus-within:ring-brandCyan/30",
                    isSelected
                      ? "border-brandRose/40 bg-brandRose/8 shadow-[0_12px_30px_rgba(255,51,102,0.08)] dark:border-brandCyan/50 dark:bg-brandCyan/10"
                      : "border-border bg-background hover:border-border/80",
                  )}
                >
                  <input
                    type="radio"
                    name="sharing-mode"
                    className="mt-1 h-5 w-5 accent-brandRose dark:accent-brandCyan"
                    checked={isSelected}
                    onChange={() => setSharingMode(option.value)}
                  />

                  <span className="space-y-1">
                    <span className="block text-base font-semibold text-foreground">
                      {option.label}
                    </span>
                    <span className="block text-sm leading-6 text-muted">
                      {option.description}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        {smartCardSelected ? (
          <section className="space-y-5 rounded-3xl border border-border bg-surface/40 p-4 sm:p-5">
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-foreground">
                Smart Card config
              </h2>
              <p className="text-sm leading-6 text-muted">
                Choose the first action people see, then enable the direct options you want to offer.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="label-xs text-muted" htmlFor="primary-action">
                Primary Action
              </label>
              <select
                id="primary-action"
                className={inputCls}
                value={formState.primaryAction}
                onChange={(event) => {
                  setFieldError(null);
                  updateField(
                    "primaryAction",
                    event.target.value as PrimaryActionValue,
                  );
                }}
                aria-invalid={fieldError ? "true" : "false"}
                aria-describedby={fieldError ? "primary-action-error" : undefined}
              >
                <option value="">Select primary action</option>
                {personaSmartCardPrimaryActionOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {fieldError ? (
                <p
                  id="primary-action-error"
                  className="text-sm text-rose-500 dark:text-rose-400"
                >
                  {fieldError}
                </p>
              ) : null}
            </div>

            <div className="space-y-3">
              <p className="label-xs text-muted">Direct options</p>

              <div className="grid gap-3">
                {smartCardToggleOptions.map((option) => (
                  <label
                    key={option.key}
                    className="flex min-h-16 cursor-pointer items-center justify-between gap-4 rounded-2xl border border-border bg-background px-4 py-3"
                  >
                    <span className="text-sm font-medium text-foreground">
                      {option.label}
                    </span>
                    <input
                      type="checkbox"
                      className="h-5 w-5 accent-brandRose dark:accent-brandCyan"
                      checked={formState[option.key]}
                      onChange={(event) =>
                        updateField(option.key, event.target.checked)
                      }
                    />
                  </label>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3">
            <p className="font-mono text-sm text-rose-500 dark:text-rose-400">
              {error}
            </p>
          </div>
        ) : null}

        <div className="sticky bottom-0 z-10 -mx-5 border-t border-border/70 bg-background/95 px-5 pb-[calc(env(safe-area-inset-bottom,0px)+0.25rem)] pt-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          {smartCardSelected && isSmartCardInvalid && !fieldError ? (
            <p className="mb-3 text-sm text-muted">
              Select a primary action to save Smart Card Mode.
            </p>
          ) : null}

          <PrimaryButton
            type="submit"
            fullWidth
            isLoading={isSubmitting}
            disabled={isSaveDisabled}
          >
            Save settings
          </PrimaryButton>
        </div>
      </form>

      {successMessage ? (
        <div className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex justify-center sm:inset-x-auto sm:right-6 sm:left-6">
          <div
            role="status"
            aria-live="polite"
            className="w-full max-w-sm rounded-2xl border border-emerald-500/25 bg-emerald-500 px-4 py-3 text-sm font-semibold text-white shadow-[0_16px_48px_rgba(16,185,129,0.28)]"
          >
            {successMessage}
          </div>
        </div>
      ) : null}
    </>
  );
}