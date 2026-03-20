"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { PrimaryButton } from "@/components/shared/primary-button";
import { personaApi } from "@/lib/api";
import { isApiError } from "@/lib/api/client";
import {
  personaAccessModeOptions,
  personaTypeOptions,
} from "@/lib/persona/labels";
import type { CreatePersonaInput } from "@/types/persona";

const initialFormState: CreatePersonaInput = {
  type: "professional",
  username: "",
  fullName: "",
  jobTitle: "",
  companyName: "",
  tagline: "",
  accessMode: "request",
};

export function PersonaForm() {
  const router = useRouter();
  const [formState, setFormState] =
    useState<CreatePersonaInput>(initialFormState);
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
      await personaApi.create({
        ...formState,
        username: formState.username.trim().toLowerCase(),
        fullName: formState.fullName.trim(),
        jobTitle: formState.jobTitle.trim(),
        companyName: formState.companyName.trim(),
        tagline: formState.tagline.trim(),
      });

      router.replace("/app/personas");
      router.refresh();
    } catch (submissionError) {
      if (isApiError(submissionError) && submissionError.status === 401) {
        router.replace("/login?next=/app/personas/create&reason=expired");
        router.refresh();
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

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2 text-sm font-medium text-foreground">
          <span>Type</span>
          <select
            className="min-h-12 w-full rounded-2xl border border-border bg-surface px-4 text-sm font-normal outline-none transition focus:border-accent"
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
        </label>

        <label className="space-y-2 text-sm font-medium text-foreground">
          <span>Access mode</span>
          <select
            className="min-h-12 w-full rounded-2xl border border-border bg-surface px-4 text-sm font-normal outline-none transition focus:border-accent"
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
        </label>
      </div>

      <label className="space-y-2 text-sm font-medium text-foreground">
        <span>Username</span>
        <input
          required
          minLength={3}
          maxLength={30}
          pattern="^[a-z0-9_-]+$"
          className="min-h-12 w-full rounded-2xl border border-border bg-surface px-4 text-sm font-normal outline-none transition focus:border-accent"
          placeholder="jane-doe"
          value={formState.username}
          onChange={(event) => updateField("username", event.target.value)}
        />
      </label>

      <label className="space-y-2 text-sm font-medium text-foreground">
        <span>Full name</span>
        <input
          required
          minLength={1}
          maxLength={120}
          className="min-h-12 w-full rounded-2xl border border-border bg-surface px-4 text-sm font-normal outline-none transition focus:border-accent"
          placeholder="Jane Doe"
          value={formState.fullName}
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
            placeholder="Product designer"
            value={formState.jobTitle}
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
            placeholder="Dotly"
            value={formState.companyName}
            onChange={(event) => updateField("companyName", event.target.value)}
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
          placeholder="Designing thoughtful identity experiences for modern teams."
          value={formState.tagline}
          onChange={(event) => updateField("tagline", event.target.value)}
        />
      </label>

      {error ? (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      <PrimaryButton type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Creating persona..." : "Create persona"}
      </PrimaryButton>
    </form>
  );
}
