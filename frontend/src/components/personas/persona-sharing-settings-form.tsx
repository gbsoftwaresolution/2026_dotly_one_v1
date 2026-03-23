"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { PersonaSharingSummary } from "@/components/personas/persona-sharing-summary";
import { PrimaryButton } from "@/components/shared/primary-button";
import { SecondaryButton } from "@/components/shared/secondary-button";
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
  publicPhone: string;
  publicWhatsappNumber: string;
  publicEmail: string;
  allowCall: boolean;
  allowWhatsapp: boolean;
  allowEmail: boolean;
  allowVcard: boolean;
}

interface ValidationErrors {
  primaryAction?: string;
  publicPhone?: string;
  publicWhatsappNumber?: string;
  publicEmail?: string;
  directActions?: string;
}

const defaultSmartCardState = {
  primaryAction: "",
  publicPhone: "",
  publicWhatsappNumber: "",
  publicEmail: "",
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
    publicPhone: persona.publicPhone ?? "",
    publicWhatsappNumber: persona.publicWhatsappNumber ?? "",
    publicEmail: persona.publicEmail ?? "",
    allowCall: smartCardConfig?.allowCall ?? false,
    allowWhatsapp: smartCardConfig?.allowWhatsapp ?? false,
    allowEmail: smartCardConfig?.allowEmail ?? false,
    allowVcard: smartCardConfig?.allowVcard ?? false,
  };
}

function trimToNull(value: string): string | null {
  const normalizedValue = value.trim();
  return normalizedValue.length > 0 ? normalizedValue : null;
}

function isPhoneLikeValue(value: string): boolean {
  const trimmedValue = value.trim();

  if (!/^[0-9+().\-\s]{7,32}$/.test(trimmedValue)) {
    return false;
  }

  const digits = trimmedValue.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15;
}

function isEmailValue(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function getEnabledDirectActionCount(
  formState: Pick<
    FormState,
    | "allowCall"
    | "allowWhatsapp"
    | "allowEmail"
    | "allowVcard"
    | "publicPhone"
    | "publicWhatsappNumber"
    | "publicEmail"
  >,
): number {
  let count = 0;

  if (formState.allowCall && trimToNull(formState.publicPhone)) {
    count += 1;
  }

  if (formState.allowWhatsapp && trimToNull(formState.publicWhatsappNumber)) {
    count += 1;
  }

  if (formState.allowEmail && trimToNull(formState.publicEmail)) {
    count += 1;
  }

  if (formState.allowVcard) {
    count += 1;
  }

  return count;
}

function getValidationErrors(formState: FormState): ValidationErrors {
  const errors: ValidationErrors = {};

  const publicPhone = trimToNull(formState.publicPhone);
  const publicWhatsappNumber = trimToNull(formState.publicWhatsappNumber);
  const publicEmail = trimToNull(formState.publicEmail);

  if (publicPhone && !isPhoneLikeValue(publicPhone)) {
    errors.publicPhone = "Phone must be a valid phone-like number";
  }

  if (publicWhatsappNumber && !isPhoneLikeValue(publicWhatsappNumber)) {
    errors.publicWhatsappNumber =
      "WhatsApp number must be a valid phone-like number";
  }

  if (publicEmail && !isEmailValue(publicEmail)) {
    errors.publicEmail = "Email must be a valid email address";
  }

  if (formState.sharingMode !== "smart_card") {
    return errors;
  }

  if (!formState.primaryAction) {
    errors.primaryAction = "Choose a primary action before saving Smart Card.";
  }

  if (formState.allowCall && !publicPhone) {
    errors.publicPhone = "Phone is required to enable Call";
  }

  if (formState.allowWhatsapp && !publicWhatsappNumber) {
    errors.publicWhatsappNumber =
      "WhatsApp number is required to enable WhatsApp";
  }

  if (formState.allowEmail && !publicEmail) {
    errors.publicEmail = "Email is required to enable Email";
  }

  if (
    formState.primaryAction === "contact_me" &&
    getEnabledDirectActionCount(formState) === 0
  ) {
    errors.directActions =
      "At least one direct action is required for Contact directly.";
  }

  return errors;
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

function getPrimaryActionAvailability(persona: PersonaSummary) {
  return {
    request_access:
      persona.sharingCapabilities?.primaryActions.requestAccess ??
      persona.accessMode !== "private",
    instant_connect:
      persona.sharingCapabilities?.primaryActions.instantConnect ?? false,
    contact_me: persona.sharingCapabilities?.primaryActions.contactMe ?? true,
  } satisfies Record<PersonaSmartCardPrimaryAction, boolean>;
}

function isPrimaryActionSupported(
  primaryAction: PrimaryActionValue,
  availability: Record<PersonaSmartCardPrimaryAction, boolean>,
): boolean {
  return primaryAction === "" ? false : availability[primaryAction];
}

function getAvailablePrimaryActionOptions(persona: PersonaSummary) {
  const availability = getPrimaryActionAvailability(persona);

  return personaSmartCardPrimaryActionOptions.filter(
    (option) => availability[option.value],
  );
}

function getRecommendedPrimaryAction(
  persona: PersonaSummary,
  formState: Pick<
    FormState,
    | "allowCall"
    | "allowWhatsapp"
    | "allowEmail"
    | "allowVcard"
    | "publicPhone"
    | "publicWhatsappNumber"
    | "publicEmail"
  >,
): PrimaryActionValue {
  const availability = getPrimaryActionAvailability(persona);

  if (availability.instant_connect) {
    return "instant_connect";
  }

  if (getEnabledDirectActionCount(formState) > 0) {
    return "contact_me";
  }

  if (availability.request_access) {
    return "request_access";
  }

  return "contact_me";
}

function getPrimaryActionHint(persona: PersonaSummary): string | null {
  const availability = getPrimaryActionAvailability(persona);

  if (!availability.request_access && !availability.instant_connect) {
    return "This persona is private, so Smart Card mode can only offer direct contact actions.";
  }

  if (!availability.instant_connect) {
    return "Connect instantly appears after you activate a profile QR code for this persona.";
  }

  return null;
}

export function PersonaSharingSettingsForm({
  persona,
}: PersonaSharingSettingsFormProps) {
  const router = useRouter();
  const [formState, setFormState] = useState<FormState>(() =>
    createFormState(persona),
  );
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [sharingConfigSource, setSharingConfigSource] = useState(
    persona.sharingConfigSource ?? null,
  );

  useEffect(() => {
    if (formState.sharingMode !== "smart_card") {
      return;
    }

    const availability = getPrimaryActionAvailability(persona);

    if (isPrimaryActionSupported(formState.primaryAction, availability)) {
      return;
    }

    setFormState((current) => ({
      ...current,
      primaryAction: getRecommendedPrimaryAction(persona, current),
    }));
  }, [formState.primaryAction, formState.sharingMode, persona]);

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
    setError(null);
    setSuccessMessage(null);
    setFormState((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function setSharingMode(nextMode: PersonaSharingMode) {
    setError(null);
    setSuccessMessage(null);
    setFormState((current) => ({
      ...current,
      sharingMode: nextMode,
      primaryAction:
        nextMode === "smart_card"
          ? isPrimaryActionSupported(
              current.primaryAction,
              getPrimaryActionAvailability(persona),
            )
            ? current.primaryAction
            : getRecommendedPrimaryAction(persona, current)
          : current.primaryAction,
    }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const validationErrors = getValidationErrors(formState);
    const smartCardConfig = buildSmartCardConfig(formState);

    if (
      formState.sharingMode === "smart_card" &&
      (Object.keys(validationErrors).length > 0 || !smartCardConfig)
    ) {
      return;
    }

    setIsSubmitting(true);

    try {
      const updatedPersona = await personaApi.updateSharing(persona.id, {
        sharingMode: formState.sharingMode,
        smartCardConfig,
        publicPhone:
          formState.sharingMode === "smart_card"
            ? trimToNull(formState.publicPhone)
            : undefined,
        publicWhatsappNumber:
          formState.sharingMode === "smart_card"
            ? trimToNull(formState.publicWhatsappNumber)
            : undefined,
        publicEmail:
          formState.sharingMode === "smart_card"
            ? trimToNull(formState.publicEmail)
            : undefined,
      });

      setFormState(createFormState(updatedPersona));
      setSharingConfigSource(updatedPersona.sharingConfigSource ?? null);
      setSuccessMessage("Sharing settings saved.");
      setIsExpanded(false);
    } catch (submissionError) {
      if (isApiError(submissionError) && submissionError.status === 401) {
        router.replace(
          `/login?next=${encodeURIComponent(routes.app.personaSettings(persona.id))}&reason=expired`,
        );
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
  const validationErrors = getValidationErrors(formState);
  const isSmartCardInvalid =
    smartCardSelected && Object.keys(validationErrors).length > 0;
  const isSaveDisabled = isSubmitting || isSmartCardInvalid;
  const primaryActionOptions = getAvailablePrimaryActionOptions(persona);
  const primaryActionHint = getPrimaryActionHint(persona);

  const publicFieldHint = "Only shown if the matching action is enabled";

  return (
    <>
      <form className="space-y-6" onSubmit={handleSubmit}>
        <div className="space-y-4">
          <PersonaSharingSummary
            sharingMode={formState.sharingMode}
            primaryAction={formState.primaryAction}
            publicPhone={formState.publicPhone}
            publicWhatsappNumber={formState.publicWhatsappNumber}
            publicEmail={formState.publicEmail}
            allowCall={formState.allowCall}
            allowWhatsapp={formState.allowWhatsapp}
            allowEmail={formState.allowEmail}
            allowVcard={formState.allowVcard}
            sharingConfigSource={sharingConfigSource}
          />

          <div className="flex justify-start">
            <SecondaryButton
              type="button"
              size="sm"
              onClick={() => setIsExpanded((current) => !current)}
            >
              {isExpanded ? "Hide settings" : "Customize"}
            </SecondaryButton>
          </div>
        </div>

        {isExpanded ? (
          <>
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
                    Decide what someone sees first on your Smart Card. Only
                    enabled actions appear, and you do not need to turn them all
                    on.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label
                    className="label-xs text-muted"
                    htmlFor="primary-action"
                  >
                    Primary Action
                  </label>
                  <select
                    id="primary-action"
                    className={inputCls}
                    value={formState.primaryAction}
                    onChange={(event) => {
                      updateField(
                        "primaryAction",
                        event.target.value as PrimaryActionValue,
                      );
                    }}
                    aria-invalid={
                      validationErrors.primaryAction ? "true" : "false"
                    }
                    aria-describedby={
                      validationErrors.primaryAction
                        ? "primary-action-error"
                        : undefined
                    }
                  >
                    {primaryActionOptions.length > 1 ? (
                      <option value="">Select primary action</option>
                    ) : null}
                    {primaryActionOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {primaryActionHint ? (
                    <p className="text-sm text-muted">{primaryActionHint}</p>
                  ) : null}
                  {validationErrors.primaryAction ? (
                    <p
                      id="primary-action-error"
                      className="text-sm text-rose-500 dark:text-rose-400"
                    >
                      {validationErrors.primaryAction}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-3 rounded-2xl border border-border/80 bg-background/80 p-4">
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-foreground">
                      Public contact values
                    </h3>
                    <p className="text-sm leading-6 text-muted">
                      These values appear on the card when the matching actions
                      are enabled.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label
                      className="label-xs text-muted"
                      htmlFor="public-phone"
                    >
                      Public phone
                    </label>
                    <input
                      id="public-phone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      className={inputCls}
                      value={formState.publicPhone}
                      onChange={(event) =>
                        updateField("publicPhone", event.target.value)
                      }
                      placeholder="+1 555 123 4567"
                      aria-invalid={
                        validationErrors.publicPhone ? "true" : "false"
                      }
                      aria-describedby={
                        validationErrors.publicPhone
                          ? "public-phone-error"
                          : "public-phone-hint"
                      }
                    />
                    <p id="public-phone-hint" className="text-sm text-muted">
                      {publicFieldHint}
                    </p>
                    {validationErrors.publicPhone ? (
                      <p
                        id="public-phone-error"
                        className="text-sm text-rose-500 dark:text-rose-400"
                      >
                        {validationErrors.publicPhone}
                      </p>
                    ) : null}
                  </div>

                  <div className="space-y-1.5">
                    <label
                      className="label-xs text-muted"
                      htmlFor="public-whatsapp-number"
                    >
                      Public WhatsApp number
                    </label>
                    <input
                      id="public-whatsapp-number"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      className={inputCls}
                      value={formState.publicWhatsappNumber}
                      onChange={(event) =>
                        updateField("publicWhatsappNumber", event.target.value)
                      }
                      placeholder="+1 555 123 4567"
                      aria-invalid={
                        validationErrors.publicWhatsappNumber ? "true" : "false"
                      }
                      aria-describedby={
                        validationErrors.publicWhatsappNumber
                          ? "public-whatsapp-error"
                          : "public-whatsapp-hint"
                      }
                    />
                    <p id="public-whatsapp-hint" className="text-sm text-muted">
                      {publicFieldHint}
                    </p>
                    {validationErrors.publicWhatsappNumber ? (
                      <p
                        id="public-whatsapp-error"
                        className="text-sm text-rose-500 dark:text-rose-400"
                      >
                        {validationErrors.publicWhatsappNumber}
                      </p>
                    ) : null}
                  </div>

                  <div className="space-y-1.5">
                    <label
                      className="label-xs text-muted"
                      htmlFor="public-email"
                    >
                      Public email
                    </label>
                    <input
                      id="public-email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      className={inputCls}
                      value={formState.publicEmail}
                      onChange={(event) =>
                        updateField("publicEmail", event.target.value)
                      }
                      placeholder="you@example.com"
                      aria-invalid={
                        validationErrors.publicEmail ? "true" : "false"
                      }
                      aria-describedby={
                        validationErrors.publicEmail
                          ? "public-email-error"
                          : "public-email-hint"
                      }
                    />
                    <p id="public-email-hint" className="text-sm text-muted">
                      {publicFieldHint}
                    </p>
                    {validationErrors.publicEmail ? (
                      <p
                        id="public-email-error"
                        className="text-sm text-rose-500 dark:text-rose-400"
                      >
                        {validationErrors.publicEmail}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <p className="label-xs text-muted">Direct actions</p>
                    <p className="text-sm leading-6 text-muted">
                      Turn on only the actions you want people to use
                      immediately.
                    </p>
                  </div>

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

                  {validationErrors.directActions ? (
                    <p className="text-sm text-rose-500 dark:text-rose-400">
                      {validationErrors.directActions}
                    </p>
                  ) : null}
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
              {smartCardSelected ? (
                <p className="mb-3 text-sm text-muted">
                  Keep this focused. The best Smart Cards lead with one obvious
                  next step.
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
          </>
        ) : null}
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
