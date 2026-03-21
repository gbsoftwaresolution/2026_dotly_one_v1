"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { QrCodeCard } from "@/components/qr/qr-code-card";
import { QrModeToggle, type QrMode } from "@/components/qr/qr-mode-toggle";
import { PrimaryButton } from "@/components/shared/primary-button";
import { SecondaryButton } from "@/components/shared/secondary-button";
import { isApiError } from "@/lib/api/client";
import { qrApi } from "@/lib/api/qr-api";
import { routes } from "@/lib/constants/routes";
import type {
  PersonaSummary,
  QrTokenSummary,
  QuickConnectQrSummary,
} from "@/types/persona";

interface QrGeneratorPanelProps {
  personas: PersonaSummary[];
}

type GeneratedQr = QrTokenSummary | QuickConnectQrSummary;

export function QrGeneratorPanel({ personas }: QrGeneratorPanelProps) {
  const router = useRouter();
  const [selectedPersonaId, setSelectedPersonaId] = useState(
    personas[0]?.id ?? "",
  );
  const [mode, setMode] = useState<QrMode>("standard");
  const [durationHours, setDurationHours] = useState("24");
  const [maxUses, setMaxUses] = useState("50");
  const [generatedQr, setGeneratedQr] = useState<GeneratedQr | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "success" | "error">(
    "idle",
  );

  const selectedPersona = useMemo(
    () => personas.find((persona) => persona.id === selectedPersonaId) ?? null,
    [personas, selectedPersonaId],
  );

  async function handleGenerate() {
    if (!selectedPersonaId) {
      setError("Select a persona before generating a QR code.");
      return;
    }

    setError(null);
    setCopyState("idle");
    setIsSubmitting(true);

    try {
      const nextQr =
        mode === "standard"
          ? await qrApi.createProfileQr(selectedPersonaId)
          : await qrApi.createQuickConnectQr(selectedPersonaId, {
              durationHours: Number(durationHours),
              ...(maxUses.trim() ? { maxUses: Number(maxUses) } : {}),
            });

      setGeneratedQr(nextQr);
    } catch (submissionError) {
      if (isApiError(submissionError) && submissionError.status === 401) {
        router.replace(
          `${routes.public.login}?next=${routes.app.qr}&reason=expired`,
        );
        router.refresh();
        return;
      }

      setError(
        isApiError(submissionError)
          ? submissionError.message
          : "Unable to generate this QR code right now. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCopyLink() {
    if (!generatedQr) {
      setCopyState("error");
      return;
    }

    try {
      await navigator.clipboard.writeText(generatedQr.url);
      setCopyState("success");
    } catch {
      setCopyState("error");
    }
  }

  const inputCls =
    "min-h-[60px] w-full rounded-2xl border border-border bg-surface px-4 text-sm text-foreground font-mono outline-none transition-all focus:border-brandRose focus:ring-2 focus:ring-brandRose/20 dark:focus:border-brandCyan dark:focus:ring-brandCyan/20";

  return (
    <div className="space-y-4 font-sans">
      <div className="glass rounded-3xl border border-border/60 p-6 shadow-shell space-y-5">
        {/* Persona selector */}
        <div className="space-y-1.5">
          <label className="label-xs text-muted" htmlFor="qr-persona">
            Persona
          </label>
          <select
            id="qr-persona"
            value={selectedPersonaId}
            onChange={(event) => setSelectedPersonaId(event.target.value)}
            className={inputCls}
          >
            {personas.map((persona) => (
              <option key={persona.id} value={persona.id}>
                {persona.fullName} - @{persona.username}
              </option>
            ))}
          </select>
        </div>

        {/* Mode */}
        <div className="space-y-1.5">
          <p className="label-xs text-muted">Mode</p>
          <QrModeToggle value={mode} onChange={setMode} />
        </div>

        {mode === "quick_connect" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="label-xs text-muted" htmlFor="qr-duration">
                Duration hours
              </label>
              <input
                id="qr-duration"
                type="number"
                min={1}
                max={168}
                value={durationHours}
                onChange={(event) => setDurationHours(event.target.value)}
                className={inputCls}
              />
            </div>

            <div className="space-y-1.5">
              <label className="label-xs text-muted" htmlFor="qr-maxuses">
                Max uses
              </label>
              <input
                id="qr-maxuses"
                type="number"
                min={1}
                value={maxUses}
                onChange={(event) => setMaxUses(event.target.value)}
                placeholder="Optional"
                className={inputCls}
              />
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3">
            <p className="font-mono text-sm text-rose-500 dark:text-rose-400">
              {error}
            </p>
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2 pt-2">
          <PrimaryButton
            type="button"
            className="w-full h-[60px]"
            disabled={isSubmitting || !selectedPersonaId}
            onClick={() => void handleGenerate()}
          >
            {isSubmitting ? "Generating..." : "Generate QR"}
          </PrimaryButton>

          <SecondaryButton
            type="button"
            className="w-full h-[60px]"
            disabled={!generatedQr}
            onClick={() => void handleCopyLink()}
          >
            Copy share link
          </SecondaryButton>
        </div>

        {copyState === "success" ? (
          <p className="text-sm font-mono text-emerald-600 dark:text-emerald-400">
            Share link copied.
          </p>
        ) : null}
        {copyState === "error" ? (
          <p className="text-sm font-mono text-amber-600 dark:text-amber-400">
            Unable to copy the link right now.
          </p>
        ) : null}
      </div>

      {generatedQr && selectedPersona ? (
        <QrCodeCard
          persona={selectedPersona}
          qr={generatedQr}
          modeLabel={mode === "standard" ? "Standard QR" : "Quick Connect QR"}
        />
      ) : (
        <div className="rounded-3xl border border-dashed border-border/60 bg-surface/40 text-center p-10 space-y-2">
          <h2 className="text-lg font-semibold text-foreground">
            Generate a shareable QR
          </h2>
          <p className="text-sm leading-6 text-muted max-w-sm mx-auto">
            Choose a persona, pick a mode, and create a QR code to share your
            safe public preview.
          </p>
        </div>
      )}
    </div>
  );
}
