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
    companyName: persona.companyName,
    tagline: persona.tagline,
    accessMode: persona.accessMode,
    verifiedOnly: persona.verifiedOnly,
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
      await personaApi.update(persona.id, {
        ...formState,
        fullName: formState.fullName?.trim(),
        jobTitle: formState.jobTitle?.trim(),
        companyName: formState.companyName?.trim(),
        tagline: formState.tagline?.trim(),
      });

      setSuccessMessage("Persona updated");
      router.refresh();
    } catch (submissionError) {
      if (isApiError(submissionError) && submissionError.status === 401) {
        router.replace(
          `/login?next=${encodeURIComponent(routes.app.personaDetail(persona.id))}&reason=expired`,
        );
        router.refresh();
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

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      {/* Access mode — most important for Phase 5 */}
      <div className="space-y-3">
        <div className="space-y-1">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-muted">
            Visibility Protocol
          </p>
          <p className="font-sans text-xs text-muted">
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
                  "relative flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-all focus-within:ring-2 focus-within:ring-brandRose focus-within:ring-offset-2 dark:focus-within:ring-brandCyan dark:focus-within:ring-offset-bgOnyx",
                  isSelected
                    ? "border-brandRose bg-brandRose/5 dark:border-brandCyan dark:bg-brandCyan/5"
                    : "border-border bg-surface hover:bg-slate-50 dark:hover:bg-zinc-900",
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
                    className="h-4 w-4 border-slate-300 text-brandRose dark:text-brandCyan focus:ring-brandRose dark:focus:ring-brandCyan focus:ring-offset-0 bg-transparent"
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

        <label className="flex items-start gap-3 rounded-2xl border border-border bg-surface px-4 py-3 cursor-pointer">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded accent-brandRose dark:accent-brandCyan"
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
      </div>

      {/* Profile info */}
      <div className="space-y-3 pt-2">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-muted">
          Profile info
        </p>

        <label className="space-y-2 text-sm font-medium text-foreground">
          <span>Full name</span>
          <input
            required
            minLength={1}
            maxLength={120}
            className="min-h-12 w-full rounded-2xl border border-border bg-surface px-4 text-sm font-normal outline-none transition focus:border-accent"
            value={formState.fullName ?? ""}
            onChange={(event) => updateField("fullName", event.target.value)}
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-2 text-sm font-medium text-foreground">
            <span>Job title</span>
            <input
              required
              minLength={1}
              maxLength={120}
              className="min-h-12 w-full rounded-2xl border border-border bg-surface px-4 text-sm font-normal outline-none transition focus:border-accent"
              value={formState.jobTitle ?? ""}
              onChange={(event) => updateField("jobTitle", event.target.value)}
            />
          </label>

          <label className="space-y-2 text-sm font-medium text-foreground">
            <span>Company</span>
            <input
              required
              minLength={1}
              maxLength={120}
              className="min-h-12 w-full rounded-2xl border border-border bg-surface px-4 text-sm font-normal outline-none transition focus:border-accent"
              value={formState.companyName ?? ""}
              onChange={(event) =>
                updateField("companyName", event.target.value)
              }
            />
          </label>
        </div>

        <label className="space-y-2 text-sm font-medium text-foreground">
          <span>Tagline</span>
          <textarea
            required
            minLength={1}
            maxLength={160}
            rows={4}
            className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm font-normal outline-none transition focus:border-accent"
            value={formState.tagline ?? ""}
            onChange={(event) => updateField("tagline", event.target.value)}
          />
        </label>
      </div>

      {error ? (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      {successMessage ? (
        <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {successMessage}
        </p>
      ) : null}

      <PrimaryButton type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Saving..." : "Save changes"}
      </PrimaryButton>
    </form>
  );
}
