"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { QrCodeCard } from "@/components/qr/qr-code-card";
import { QrModeToggle, type QrMode } from "@/components/qr/qr-mode-toggle";
import { Card } from "@/components/shared/card";
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

  return (
    <div className="space-y-4 font-sans">
      <Card className="space-y-5 bg-[#F8FAFC] dark:bg-[#050505] border-slate-200 dark:border-zinc-900 text-slate-900 dark:text-white rounded-[2rem]">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500 dark:text-zinc-400">
            Persona
          </p>
          <select
            value={selectedPersonaId}
            onChange={(event) => setSelectedPersonaId(event.target.value)}
            className="min-h-[60px] w-full rounded-2xl border border-slate-200 dark:border-zinc-900 bg-white dark:bg-[#0A0A0A] px-4 text-sm outline-none transition focus:border-black dark:focus:border-white text-slate-900 dark:text-white font-mono"
          >
            {personas.map((persona) => (
              <option key={persona.id} value={persona.id}>
                {persona.fullName} - @{persona.username}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500 dark:text-zinc-400">
            Mode
          </p>
          <QrModeToggle value={mode} onChange={setMode} />
        </div>

        {mode === "quick_connect" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm font-medium text-slate-900 dark:text-white">
              <span>Duration hours</span>
              <input
                type="number"
                min={1}
                max={168}
                value={durationHours}
                onChange={(event) => setDurationHours(event.target.value)}
                className="min-h-[60px] w-full rounded-2xl border border-slate-200 dark:border-zinc-900 bg-white dark:bg-[#0A0A0A] px-4 text-sm outline-none transition focus:border-black dark:focus:border-white font-mono"
              />
            </label>

            <label className="space-y-2 text-sm font-medium text-slate-900 dark:text-white">
              <span>Max uses</span>
              <input
                type="number"
                min={1}
                value={maxUses}
                onChange={(event) => setMaxUses(event.target.value)}
                placeholder="Optional"
                className="min-h-[60px] w-full rounded-2xl border border-slate-200 dark:border-zinc-900 bg-white dark:bg-[#0A0A0A] px-4 text-sm outline-none transition focus:border-black dark:focus:border-white font-mono"
              />
            </label>
          </div>
        ) : null}

        {error ? (
          <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </p>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2 pt-2">
          <PrimaryButton
            type="button"
            className="w-full py-5 h-[60px] active:scale-95 text-sm font-bold"
            disabled={isSubmitting || !selectedPersonaId}
            onClick={() => void handleGenerate()}
          >
            {isSubmitting ? "Generating..." : "Generate QR"}
          </PrimaryButton>

          <SecondaryButton
            type="button"
            className="w-full py-5 h-[60px] active:scale-95 text-sm font-bold"
            disabled={!generatedQr}
            onClick={() => void handleCopyLink()}
          >
            Copy share link
          </SecondaryButton>
        </div>

        {copyState === "success" ? (
          <p className="text-sm text-emerald-700 font-mono">
            Share link copied.
          </p>
        ) : null}
        {copyState === "error" ? (
          <p className="text-sm text-amber-700 font-mono">
            Unable to copy the link right now.
          </p>
        ) : null}
      </Card>

      {generatedQr && selectedPersona ? (
        <QrCodeCard
          persona={selectedPersona}
          qr={generatedQr}
          modeLabel={mode === "standard" ? "Standard QR" : "Quick Connect QR"}
        />
      ) : (
        <Card className="border-dashed bg-[#F8FAFC] dark:bg-[#050505] border-slate-200 dark:border-zinc-800 text-center rounded-[2rem]">
          <div className="space-y-2 py-10">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Generate a shareable QR
            </h2>
            <p className="text-sm leading-6 text-slate-500 dark:text-zinc-400 max-w-sm mx-auto">
              Choose a persona, pick a mode, and create a QR code to share your
              safe public preview.
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
