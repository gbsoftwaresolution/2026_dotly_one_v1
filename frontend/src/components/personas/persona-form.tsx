"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { PersonaSharingSummary } from "@/components/personas/persona-sharing-summary";
import { PrimaryButton } from "@/components/shared/primary-button";
import { SecondaryButton } from "@/components/shared/secondary-button";
import { personaApi } from "@/lib/api";
import { isApiError } from "@/lib/api/client";
import { routes } from "@/lib/constants/routes";
import {
  personaAccessModeOptions,
  personaTypeOptions,
} from "@/lib/persona/labels";
import type { CreatePersonaInput, PersonaSummary } from "@/types/persona";

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

export function PersonaForm() {
  const router = useRouter();
  const [formState, setFormState] =
    useState<CreatePersonaInput>(initialFormState);
  const [createdPersona, setCreatedPersona] = useState<PersonaSummary | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateField<K extends keyof CreatePersonaInput>(
    key: K,
    value: CreatePersonaInput[K],
  ) {
    setFormState((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
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

      setCreatedPersona(persona);
    } catch (submissionError) {
      if (isApiError(submissionError) && submissionError.status === 401) {
        router.replace("/login?next=/app/personas/create&reason=expired");
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
    "min-h-12 w-full rounded-2xl border border-border bg-surface px-4 text-sm font-normal text-foreground outline-none transition-all placeholder:text-muted/50 focus:border-brandRose focus:ring-2 focus:ring-brandRose/20 dark:focus:border-brandCyan dark:focus:ring-brandCyan/20";

  if (createdPersona) {
    return (
      <div className="space-y-5">
        <section className="space-y-2 rounded-3xl border border-border bg-surface/45 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
            Ready to share
          </p>
          <h2 className="text-xl font-semibold text-foreground">
            Your persona is ready to share
          </h2>
          <p className="text-sm leading-6 text-muted">
            We set up the sharing basics already, so you can start with a clear
            first impression and refine it later.
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
          <Link className="sm:flex-1" href={routes.app.personas}>
            <PrimaryButton fullWidth>View personas</PrimaryButton>
          </Link>
          <Link
            className="sm:flex-1"
            href={routes.app.personaSettings(createdPersona.id)}
          >
            <SecondaryButton fullWidth>Edit sharing settings</SecondaryButton>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      {/* Identity type + access mode */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="label-xs" htmlFor="persona-type">
            Type
          </label>
          <select
            id="persona-type"
            className={inputCls}
            value={formState.type}
            onChange={(event) =>
              updateField(
                "type",
                event.target.value as CreatePersonaInput["type"],
              )
            }
          >
            {personaTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="label-xs" htmlFor="persona-access">
            Profile visibility
          </label>
          <select
            id="persona-access"
            className={inputCls}
            value={formState.accessMode}
            onChange={(event) =>
              updateField(
                "accessMode",
                event.target.value as CreatePersonaInput["accessMode"],
              )
            }
          >
            {personaAccessModeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Username */}
      <div className="space-y-1.5">
        <label className="label-xs" htmlFor="persona-username">
          Username
        </label>
        <input
          id="persona-username"
          required
          minLength={3}
          maxLength={30}
          pattern="^[a-z0-9_-]+$"
          className={inputCls}
          placeholder="jane-doe"
          value={formState.username}
          onChange={(event) => updateField("username", event.target.value)}
        />
        <p className="text-sm leading-6 text-muted">
          This becomes your public Dotly link when the persona is shareable.
        </p>
      </div>

      {/* Full name */}
      <div className="space-y-1.5">
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

      {/* Job + Company */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
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

        <div className="space-y-1.5">
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
            onChange={(event) => updateField("companyName", event.target.value)}
          />
        </div>
      </div>

      {/* Tagline */}
      <div className="space-y-1.5">
        <label className="label-xs" htmlFor="persona-tagline">
          What should people remember?
        </label>
        <textarea
          id="persona-tagline"
          maxLength={120}
          rows={3}
          className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm font-normal text-foreground outline-none transition-all placeholder:text-muted/50 focus:border-brandRose focus:ring-2 focus:ring-brandRose/20 dark:focus:border-brandCyan dark:focus:ring-brandCyan/20 resize-none"
          placeholder="Designing thoughtful identity experiences for modern teams."
          value={formState.tagline}
          onChange={(event) => updateField("tagline", event.target.value)}
        />
        <p className="text-sm leading-6 text-muted">
          Keep it short enough that someone can recognize you later.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <div className="space-y-1.5">
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
            onChange={(event) => updateField("websiteUrl", event.target.value)}
          />
          <p className="text-sm leading-6 text-muted">
            Optional. Adds one clean external link to your public card.
          </p>
        </div>

        <label className="flex items-start gap-3 rounded-2xl border border-border bg-surface px-4 py-3 cursor-pointer sm:min-w-[220px]">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded accent-brandRose dark:accent-brandCyan"
            checked={formState.isVerified ?? false}
            onChange={(event) =>
              updateField("isVerified", event.target.checked)
            }
          />
          <span className="space-y-0.5">
            <span className="block text-sm font-medium text-foreground">
              Show verified badge
            </span>
            <span className="block text-xs text-muted">
              Adds a visible trust cue to the public profile when enabled.
            </span>
          </span>
        </label>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3">
          <p className="font-mono text-sm text-rose-500 dark:text-rose-400">
            {error}
          </p>
        </div>
      ) : null}

      <PrimaryButton type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Creating persona..." : "Create persona"}
      </PrimaryButton>
    </form>
  );
}
