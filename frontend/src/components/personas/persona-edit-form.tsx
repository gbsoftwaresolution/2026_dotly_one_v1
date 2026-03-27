"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { PrimaryButton } from "@/components/shared/primary-button";
import { personaApi } from "@/lib/api";
import { isApiError } from "@/lib/api/client";
import { personaAccessModeOptions } from "@/lib/persona/labels";
import { routes } from "@/lib/constants/routes";
import { cn } from "@/lib/utils/cn";
import type {
  PersonaAccessMode,
  PersonaSummary,
  UpdatePersonaInput,
} from "@/types/persona";

interface PersonaEditFormProps {
  persona: PersonaSummary;
}

export function PersonaEditForm({ persona }: PersonaEditFormProps) {
  const router = useRouter();
  const [formState, setFormState] = useState<UpdatePersonaInput>({
    fullName: persona.fullName,
    jobTitle: persona.jobTitle,
    companyName: persona.companyName ?? "",
    tagline: persona.tagline ?? "",
    websiteUrl: persona.websiteUrl ?? "",
    accessMode: persona.accessMode,
    verifiedOnly: persona.verifiedOnly,
    isVerified: persona.isVerified ?? false,
  });
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateField<K extends keyof UpdatePersonaInput>(
    key: K,
    value: UpdatePersonaInput[K],
  ) {
    setFormState((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      const updatedPersona = await personaApi.update(persona.id, {
        ...formState,
        fullName: formState.fullName?.trim(),
        jobTitle: formState.jobTitle?.trim(),
        companyName: formState.companyName?.trim(),
        tagline: formState.tagline?.trim(),
        websiteUrl: formState.websiteUrl?.trim(),
      });

      setFormState({
        fullName: updatedPersona.fullName,
        jobTitle: updatedPersona.jobTitle,
        companyName: updatedPersona.companyName ?? "",
        tagline: updatedPersona.tagline ?? "",
        websiteUrl: updatedPersona.websiteUrl ?? "",
        accessMode: updatedPersona.accessMode,
        verifiedOnly: updatedPersona.verifiedOnly,
        isVerified: updatedPersona.isVerified ?? false,
      });
      setSuccessMessage("Persona updated");
    } catch (submissionError) {
      if (isApiError(submissionError) && submissionError.status === 401) {
        router.replace(
          `/login?next=${encodeURIComponent(routes.app.personaDetail(persona.id))}&reason=expired`,
        );
        return;
      }

      setError(
        isApiError(submissionError)
          ? submissionError.message
          : "Unable to update persona right now. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const inputCls =
    "min-h-[52px] w-full rounded-2xl bg-white/50 backdrop-blur-md px-4 py-3.5 text-[15px] font-medium text-foreground shadow-sm ring-1 ring-inset ring-black/5 outline-none transition-all duration-500 placeholder:text-muted/50 focus:bg-white/80 focus:ring-black/10 dark:bg-zinc-800/50 dark:ring-white/10 dark:focus:bg-zinc-800/80 hover:-translate-y-1";
  const sectionCls =
    "space-y-4 flex flex-col p-6 overflow-hidden rounded-[32px] bg-white/60 backdrop-blur-3xl shadow-[0_40px_80px_-15px_rgba(0,0,0,0.1)] ring-1 ring-black/5 dark:bg-zinc-900/60 dark:ring-white/10 transition-all duration-500 hover:-translate-y-1 gap-2";

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <section className={sectionCls}>
        <div className="space-y-1">
          <p className="label-xs text-muted">Step 1</p>
          <p className="text-sm font-semibold tracking-tight text-foreground">
            Visibility protocol
          </p>
          <p className="text-xs leading-5 text-muted">
            Control how others can connect with this persona.
          </p>
        </div>

        <div className="flex flex-col gap-2 pt-1">
          {personaAccessModeOptions.map((option) => {
            const isSelected = formState.accessMode === option.value;
            return (
              <label
                key={option.value}
                className={cn(
                  "relative flex cursor-pointer items-start gap-3 rounded-2xl p-4 transition-all focus-within:ring-2 focus-within:ring-black/10",
                  isSelected
                    ? "bg-foreground/[0.05] ring-1 ring-black/10 dark:bg-white/[0.08] dark:ring-white/10"
                    : "bg-foreground/[0.03] ring-1 ring-black/5 hover:bg-foreground/[0.05] dark:bg-white/[0.04] dark:ring-white/10 dark:hover:bg-white/[0.06]",
                )}
              >
                <div className="flex h-5 items-center">
                  <input
                    type="radio"
                    name="accessMode"
                    value={option.value}
                    checked={isSelected}
                    onChange={(e) =>
                      updateField(
                        "accessMode",
                        e.target.value as PersonaAccessMode,
                      )
                    }
                    className="h-4 w-4 rounded accent-black focus:ring-0 dark:accent-white"
                  />
                </div>
                <div className="flex flex-col">
                  <span
                    className={cn(
                      "block text-sm font-semibold",
                      isSelected ? "text-foreground" : "text-muted",
                    )}
                  >
                    {option.label}
                  </span>
                  <span className="block text-xs text-muted mt-0.5">
                    {option.value === "open" &&
                      "Anyone can send you a contact request."}
                    {option.value === "request" &&
                      "People must send a request — you approve or reject it."}
                    {option.value === "private" &&
                      "No one can send you requests from this persona's public profile."}
                  </span>
                </div>
              </label>
            );
          })}
        </div>

        <label className="flex items-start gap-3 rounded-2xl bg-foreground/[0.03] px-4 py-3.5 shadow-inner ring-1 ring-inset ring-black/5 cursor-pointer dark:bg-white/[0.045] dark:ring-white/5">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded accent-black dark:accent-white"
            checked={formState.verifiedOnly ?? false}
            onChange={(event) =>
              updateField("verifiedOnly", event.target.checked)
            }
          />
          <span className="space-y-0.5">
            <span className="block text-sm font-medium text-foreground">
              Verified users only
            </span>
            <span className="block text-xs text-muted">
              Only allow contact requests from verified Dotly users.
            </span>
          </span>
        </label>
      </section>

      <section className={sectionCls}>
        <div className="space-y-1">
          <p className="label-xs text-muted">Step 2</p>
          <p className="text-sm font-semibold tracking-tight text-foreground">
            Profile info
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="label-xs" htmlFor="edit-fullname">
            Full name
          </label>
          <input
            id="edit-fullname"
            required
            minLength={1}
            maxLength={120}
            className={inputCls}
            value={formState.fullName ?? ""}
            onChange={(event) => updateField("fullName", event.target.value)}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="label-xs" htmlFor="edit-jobtitle">
              Job title
            </label>
            <input
              id="edit-jobtitle"
              required
              minLength={1}
              maxLength={120}
              className={inputCls}
              value={formState.jobTitle ?? ""}
              onChange={(event) => updateField("jobTitle", event.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <label className="label-xs" htmlFor="edit-company">
              Company
            </label>
            <input
              id="edit-company"
              maxLength={120}
              className={inputCls}
              value={formState.companyName ?? ""}
              onChange={(event) =>
                updateField("companyName", event.target.value)
              }
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="label-xs" htmlFor="edit-tagline">
            Tagline
          </label>
          <textarea
            id="edit-tagline"
            maxLength={120}
            rows={3}
            className="w-full resize-none rounded-2xl bg-white/50 backdrop-blur-md px-4 py-3.5 text-[15px] font-medium text-foreground shadow-sm ring-1 ring-inset ring-black/5 outline-none transition-all duration-500 placeholder:text-muted/50 focus:bg-white/80 focus:ring-black/10 dark:bg-zinc-800/50 dark:ring-white/10 dark:focus:bg-zinc-800/80 hover:-translate-y-1"
            value={formState.tagline ?? ""}
            onChange={(event) => updateField("tagline", event.target.value)}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <div className="space-y-1.5">
            <label className="label-xs" htmlFor="edit-website-url">
              Website
            </label>
            <input
              id="edit-website-url"
              type="url"
              inputMode="url"
              maxLength={500}
              className={inputCls}
              value={formState.websiteUrl ?? ""}
              onChange={(event) =>
                updateField("websiteUrl", event.target.value)
              }
            />
          </div>

          <label className="flex items-start gap-3 rounded-2xl bg-foreground/[0.03] px-4 py-3.5 shadow-inner ring-1 ring-inset ring-black/5 cursor-pointer dark:bg-white/[0.045] dark:ring-white/5 sm:min-w-[220px]">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded accent-black dark:accent-white"
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
                Adds the premium trust marker on the public profile.
              </span>
            </span>
          </label>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl bg-rose-500/5 px-4 py-3 ring-1 ring-inset ring-rose-500/20">
          <p className="font-mono text-sm text-rose-600 dark:text-rose-400">
            {error}
          </p>
        </div>
      ) : null}

      {successMessage ? (
        <div className="rounded-2xl bg-emerald-500/5 px-4 py-3 ring-1 ring-inset ring-emerald-500/20">
          <p className="font-mono text-sm text-emerald-600 dark:text-emerald-400">
            {successMessage}
          </p>
        </div>
      ) : null}

      <PrimaryButton type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Saving..." : "Save changes"}
      </PrimaryButton>
    </form>
  );
}
