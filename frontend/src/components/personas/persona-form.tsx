"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { PersonaSharingSummary } from "@/components/personas/persona-sharing-summary";
import { CustomSelect } from "@/components/shared/custom-select";
import { PrimaryButton } from "@/components/shared/primary-button";
import { SecondaryButton } from "@/components/shared/secondary-button";
import { personaApi } from "@/lib/api";
import { isApiError } from "@/lib/api/client";
import { routes } from "@/lib/constants/routes";
import { upsertPersonaFastShare } from "@/lib/share-fast-store";
import {
  personaAccessModeOptions,
  personaTypeOptions,
} from "@/lib/persona/labels";
import type {
  CreatePersonaInput,
  PersonaSummary,
  PersonaUsernameAvailability,
} from "@/types/persona";

const initialFormState: CreatePersonaInput = {
  type: "professional",
  username: "",
  fullName: "",
  jobTitle: "",
  companyName: "",
  tagline: "",
  websiteUrl: "",
  accessMode: "request",
  isVerified: false,
};

const USERNAME_STANDARD_MIN_LENGTH = 6;

function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

function getUsernameTone(
  availability: PersonaUsernameAvailability | null,
): "neutral" | "success" | "warning" | "danger" {
  if (!availability) {
    return "neutral";
  }

  if (availability.available) {
    return "success";
  }

  if (availability.requiresClaim) {
    return "warning";
  }

  return "danger";
}

export function PersonaForm() {
  const router = useRouter();
  const [formState, setFormState] =
    useState<CreatePersonaInput>(initialFormState);
  const [createdPersona, setCreatedPersona] = useState<PersonaSummary | null>(
    null,
  );
  const [shareQrPrepared, setShareQrPrepared] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [usernameAvailability, setUsernameAvailability] =
    useState<PersonaUsernameAvailability | null>(null);
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [isUsernameHelpExpanded, setIsUsernameHelpExpanded] = useState(false);

  function updateField<K extends keyof CreatePersonaInput>(
    key: K,
    value: CreatePersonaInput[K],
  ) {
    setFormState((current) => ({
      ...current,
      [key]: value,
    }));
  }

  const normalizedUsername = useMemo(
    () => normalizeUsername(formState.username),
    [formState.username],
  );

  useEffect(() => {
    if (!normalizedUsername) {
      setUsernameAvailability(null);
      setIsCheckingUsername(false);
      return;
    }

    if (normalizedUsername.length < 3) {
      setUsernameAvailability({
        username: normalizedUsername,
        available: false,
        code: "too_short",
        message:
          "Use at least 3 characters to check a username. Standard usernames require 6 or more characters.",
        requiresClaim: false,
      });
      setIsCheckingUsername(false);
      return;
    }

    let isCancelled = false;
    const timeoutId = window.setTimeout(() => {
      setIsCheckingUsername(true);
      void personaApi
        .checkUsernameAvailability(normalizedUsername)
        .then((result) => {
          if (!isCancelled) {
            setUsernameAvailability(result);
          }
        })
        .catch(() => {
          if (!isCancelled) {
            setUsernameAvailability({
              username: normalizedUsername,
              available: false,
              code: "too_short",
              message:
                "We could not verify availability right now. Try again in a moment.",
              requiresClaim: false,
            });
          }
        })
        .finally(() => {
          if (!isCancelled) {
            setIsCheckingUsername(false);
          }
        });
    }, 300);

    return () => {
      isCancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [normalizedUsername]);

  useEffect(() => {
    if (!normalizedUsername) {
      setIsUsernameHelpExpanded(false);
      return;
    }

    if (usernameAvailability && !usernameAvailability.available) {
      setIsUsernameHelpExpanded(true);
    }
  }, [normalizedUsername, usernameAvailability]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!usernameAvailability?.available) {
      setError(
        usernameAvailability?.message ??
          "Choose an available username before creating your persona.",
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const persona = await personaApi.create({
        ...formState,
        username: formState.username.trim().toLowerCase(),
        fullName: formState.fullName.trim(),
        jobTitle: formState.jobTitle.trim(),
        companyName: formState.companyName.trim(),
        tagline: formState.tagline.trim(),
        websiteUrl: formState.websiteUrl?.trim(),
      });

      let preparedShare = false;

      try {
        const fastShare = await personaApi.getFastShare(persona.id);
        upsertPersonaFastShare(fastShare, { selected: true });
        preparedShare = true;
      } catch {
        preparedShare = false;
      }

      setShareQrPrepared(preparedShare);
      setCreatedPersona(persona);
    } catch (submissionError) {
      if (isApiError(submissionError) && submissionError.status === 401) {
        router.replace(
          `${routes.public.login}?next=${encodeURIComponent(routes.app.createPersona)}&reason=expired`,
        );
        return;
      }

      setError(
        isApiError(submissionError)
          ? submissionError.message
          : "Unable to create persona right now. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const inputCls =
    "w-full bg-transparent px-4 py-3.5 text-[17px] text-foreground outline-none placeholder:text-muted/50 tracking-tight";
  const sectionCls =
    "flex flex-col overflow-hidden rounded-[20px] bg-black/[0.03] dark:bg-white/[0.04] backdrop-blur-[40px] saturate-[200%]";
  const usernameTone = getUsernameTone(usernameAvailability);
  const usernameInputCls =
    usernameTone === "success"
      ? `${inputCls} ring-emerald-500/20 focus:ring-emerald-500/30`
      : usernameTone === "warning"
        ? `${inputCls} ring-amber-500/20 focus:ring-amber-500/30`
        : usernameTone === "danger"
          ? `${inputCls} ring-rose-500/20 focus:ring-rose-500/30`
          : inputCls;
  const usernameStatusClassName =
    usernameTone === "success"
      ? "text-sm font-medium text-emerald-600 dark:text-emerald-400"
      : usernameTone === "warning"
        ? "text-sm font-medium text-amber-700 dark:text-amber-300"
        : usernameTone === "danger"
          ? "text-sm font-medium text-rose-600 dark:text-rose-400"
          : "text-sm font-medium text-muted";

  if (createdPersona) {
    return (
      <div className="space-y-4 sm:space-y-5">
        <section className="space-y-2 rounded-[1.75rem] bg-foreground/[0.03] p-5 shadow-inner ring-1 ring-inset ring-black/5 dark:bg-white/[0.045] dark:ring-white/5 sm:rounded-3xl sm:p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
            Ready to share
          </p>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            Your persona is ready to share
          </h2>
          <p className="text-sm leading-6 text-muted">
            Open the share QR next so this persona is ready for introductions,
            events, and first follow-ups.{" "}
            {shareQrPrepared
              ? "Dotly already prepared the first live share for you."
              : "If the QR still needs a refresh, Dotly will finish preparing it there."}
          </p>
        </section>

        <PersonaSharingSummary
          sharingMode={createdPersona.sharingMode}
          primaryAction={createdPersona.smartCardConfig?.primaryAction}
          publicPhone={createdPersona.publicPhone}
          publicWhatsappNumber={createdPersona.publicWhatsappNumber}
          publicEmail={createdPersona.publicEmail}
          allowCall={createdPersona.smartCardConfig?.allowCall}
          allowWhatsapp={createdPersona.smartCardConfig?.allowWhatsapp}
          allowEmail={createdPersona.smartCardConfig?.allowEmail}
          allowVcard={createdPersona.smartCardConfig?.allowVcard}
          sharingConfigSource={createdPersona.sharingConfigSource ?? null}
        />

        <div className="flex flex-col gap-3 sm:flex-row">
          <Link className="sm:flex-1" href={routes.app.qr}>
            <PrimaryButton className="min-h-[54px] sm:min-h-12" fullWidth>
              Open share QR
            </PrimaryButton>
          </Link>
          <Link
            className="sm:flex-1"
            href={routes.app.personaSettings(createdPersona.id)}
          >
            <SecondaryButton className="min-h-[54px] sm:min-h-12" fullWidth>
              Edit sharing settings
            </SecondaryButton>
          </Link>
        </div>
        <div className="px-1">
          <Link
            className="text-sm font-medium text-muted transition-colors hover:text-foreground"
            href={routes.app.personas}
          >
            View all personas
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form className="space-y-4 sm:space-y-5" onSubmit={handleSubmit}>
      <section className={sectionCls}>
        <div className="space-y-1">
          <h3 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
            Handle and access
          </h3>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:space-y-1.5 z-20">
            <label className="label-xs" htmlFor="persona-type">
              Type
            </label>
            <CustomSelect
              id="persona-type"
              className={inputCls}
              value={formState.type}
              onChange={(value) =>
                updateField("type", value as CreatePersonaInput["type"])
              }
              options={personaTypeOptions}
            />
          </div>

          <div className="space-y-2 sm:space-y-1.5 z-10">
            <label className="label-xs" htmlFor="persona-access">
              Profile visibility
            </label>
            <CustomSelect
              id="persona-access"
              className={inputCls}
              value={formState.accessMode}
              onChange={(value) =>
                updateField(
                  "accessMode",
                  value as CreatePersonaInput["accessMode"],
                )
              }
              options={personaAccessModeOptions}
            />
          </div>
        </div>

        <div className="space-y-2 sm:space-y-1.5">
          <label className="label-xs" htmlFor="persona-username">
            Username
          </label>
          <input
            id="persona-username"
            required
            minLength={USERNAME_STANDARD_MIN_LENGTH}
            maxLength={30}
            pattern="^[a-z0-9_-]+$"
            className={usernameInputCls}
            placeholder="jane-doe"
            value={formState.username}
            onChange={(event) => updateField("username", event.target.value)}
          />
          <div className="space-y-2 rounded-2xl bg-foreground/[0.02] px-4 py-3.5 ring-1 ring-inset ring-black/5 dark:ring-white/5 sm:hidden">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm leading-6 text-muted">
                  This becomes your public Dotly link when the persona is
                  shareable.
                </p>
                <p className="text-xs leading-5 text-muted">
                  6-30 chars, starts with a letter, lowercase only.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsUsernameHelpExpanded((current) => !current)}
                className="shrink-0 rounded-full bg-foreground/[0.04] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground shadow-inner ring-1 ring-black/5 dark:bg-white/[0.08] dark:ring-white/10"
              >
                {isUsernameHelpExpanded ? "Less" : "Rules"}
              </button>
            </div>
            {normalizedUsername ? (
              <p className={usernameStatusClassName}>
                {isCheckingUsername
                  ? "Checking availability..."
                  : usernameAvailability?.message}
              </p>
            ) : null}
            {isUsernameHelpExpanded ? (
              <div className="space-y-2 border-t border-black/5 pt-2.5 dark:border-white/10">
                <p className="text-sm leading-6 text-muted">
                  Strong rules: start with a letter, use lowercase letters,
                  numbers, hyphens, or underscores, avoid double separators, and
                  keep it between 6 and 30 characters.
                </p>
                <p className="text-sm leading-6 text-muted">
                  Usernames below 6 characters are premium inventory. Protected
                  brand names like kfc or kfc_india require a verified claim
                  through support.
                </p>
                {usernameAvailability?.requiresClaim ? (
                  <p className="text-sm leading-6 text-muted">
                    Need this name? Email support@dotly.one with your brand,
                    region, and proof of ownership to begin a reserved username
                    claim.
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="hidden space-y-1.5 rounded-2xl bg-foreground/[0.02] px-4 py-3 ring-1 ring-inset ring-black/5 dark:ring-white/5 sm:block">
            <p className="text-sm leading-6 text-muted">
              This becomes your public Dotly link when the persona is shareable.
            </p>
            <p className="text-sm leading-6 text-muted">
              Strong rules: start with a letter, use lowercase letters, numbers,
              hyphens, or underscores, avoid double separators, and keep it
              between 6 and 30 characters.
            </p>
            <p className="text-sm leading-6 text-muted">
              Usernames below 6 characters are premium inventory. Protected
              brand names like kfc or kfc_india require a verified claim through
              support.
            </p>
            {normalizedUsername ? (
              <p className={usernameStatusClassName}>
                {isCheckingUsername
                  ? "Checking availability..."
                  : usernameAvailability?.message}
              </p>
            ) : null}
            {usernameAvailability?.requiresClaim ? (
              <p className="text-sm leading-6 text-muted">
                Need this name? Email support@dotly.one with your brand, region,
                and proof of ownership to begin a reserved username claim.
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <section className={sectionCls}>
        <div className="space-y-1">
          <h3 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
            Public identity
          </h3>
        </div>

        <div className="space-y-2 sm:space-y-1.5">
          <label className="label-xs" htmlFor="persona-fullname">
            Full name
          </label>
          <input
            id="persona-fullname"
            required
            minLength={1}
            maxLength={120}
            className={inputCls}
            placeholder="Jane Doe"
            value={formState.fullName}
            onChange={(event) => updateField("fullName", event.target.value)}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:space-y-1.5">
            <label className="label-xs" htmlFor="persona-jobtitle">
              Role
            </label>
            <input
              id="persona-jobtitle"
              required
              minLength={1}
              maxLength={120}
              className={inputCls}
              placeholder="Product designer"
              value={formState.jobTitle}
              onChange={(event) => updateField("jobTitle", event.target.value)}
            />
          </div>

          <div className="space-y-2 sm:space-y-1.5">
            <label className="label-xs" htmlFor="persona-company">
              Company
            </label>
            <input
              id="persona-company"
              required
              minLength={1}
              maxLength={120}
              className={inputCls}
              placeholder="Dotly"
              value={formState.companyName}
              onChange={(event) =>
                updateField("companyName", event.target.value)
              }
            />
          </div>
        </div>

        <div className="space-y-2 sm:space-y-1.5">
          <label className="label-xs" htmlFor="persona-tagline">
            What should people remember?
          </label>
          <textarea
            id="persona-tagline"
            maxLength={120}
            rows={3}
            className="w-full bg-transparent px-4 py-3.5 text-[17px] tracking-tight text-foreground outline-none placeholder:text-muted/50 resize-none"
            placeholder="Designing thoughtful identity experiences for modern teams."
            value={formState.tagline}
            onChange={(event) => updateField("tagline", event.target.value)}
          />
          <p className="text-sm leading-6 text-muted">
            Keep it short enough that someone can recognize you later.
          </p>
        </div>
      </section>

      <section className={sectionCls}>
        <div className="space-y-1">
          <h3 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
            Trust and links
          </h3>
        </div>

        <div className="space-y-4 sm:space-y-0 sm:grid sm:gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <div className="space-y-2 sm:space-y-1.5">
            <label className="label-xs" htmlFor="persona-website-url">
              Website
            </label>
            <input
              id="persona-website-url"
              type="url"
              inputMode="url"
              maxLength={500}
              className={inputCls}
              placeholder="https://your-site.com"
              value={formState.websiteUrl ?? ""}
              onChange={(event) =>
                updateField("websiteUrl", event.target.value)
              }
            />
            <p className="text-sm leading-6 text-muted">
              Optional. Adds one clean external link to your public card.
            </p>
          </div>

          <label className="flex w-full items-center justify-between gap-4 px-4 py-3.5 cursor-pointer transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">
            <span className="min-w-0 space-y-1 pr-2">
              <span className="block text-sm font-medium text-foreground">
                Show verified badge
              </span>
              <span className="block text-xs leading-5 text-muted">
                Adds a visible trust cue to the public profile when enabled.
              </span>
            </span>
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 shrink-0 rounded accent-black dark:accent-white"
              checked={formState.isVerified ?? false}
              onChange={(event) =>
                updateField("isVerified", event.target.checked)
              }
            />
          </label>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl bg-rose-500/5 px-4 py-3.5 ring-1 ring-inset ring-rose-500/20">
          <p className="font-mono text-sm text-rose-600 dark:text-rose-400">
            {error}
          </p>
        </div>
      ) : null}

      <PrimaryButton
        type="submit"
        className="min-h-[54px] w-full sm:min-h-12"
        disabled={
          isSubmitting || isCheckingUsername || !usernameAvailability?.available
        }
      >
        {isSubmitting ? "Creating persona..." : "Create persona"}
      </PrimaryButton>
    </form>
  );
}
