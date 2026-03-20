"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";

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
  const [qrImageSrc, setQrImageSrc] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "success" | "error">(
    "idle",
  );

  const selectedPersona = useMemo(
    () => personas.find((persona) => persona.id === selectedPersonaId) ?? null,
    [personas, selectedPersonaId],
  );

  async function generateQrImage(url: string) {
    return QRCode.toDataURL(url, {
      margin: 1,
      width: 512,
      color: {
        dark: "#0f172a",
        light: "#ffffff",
      },
    });
  }

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

      const nextImageSrc = await generateQrImage(nextQr.url);

      setGeneratedQr(nextQr);
      setQrImageSrc(nextImageSrc);
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
    <div className="space-y-4">
      <Card className="space-y-5">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
            Persona
          </p>
          <select
            value={selectedPersonaId}
            onChange={(event) => setSelectedPersonaId(event.target.value)}
            className="min-h-12 w-full rounded-2xl border border-border bg-surface px-4 text-sm outline-none transition focus:border-accent"
          >
            {personas.map((persona) => (
              <option key={persona.id} value={persona.id}>
                {persona.fullName} - @{persona.username}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
            Mode
          </p>
          <QrModeToggle value={mode} onChange={setMode} />
        </div>

        {mode === "quick_connect" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm font-medium text-foreground">
              <span>Duration hours</span>
              <input
                type="number"
                min={1}
                max={168}
                value={durationHours}
                onChange={(event) => setDurationHours(event.target.value)}
                className="min-h-12 w-full rounded-2xl border border-border bg-surface px-4 text-sm outline-none transition focus:border-accent"
              />
            </label>

            <label className="space-y-2 text-sm font-medium text-foreground">
              <span>Max uses</span>
              <input
                type="number"
                min={1}
                value={maxUses}
                onChange={(event) => setMaxUses(event.target.value)}
                placeholder="Optional"
                className="min-h-12 w-full rounded-2xl border border-border bg-surface px-4 text-sm outline-none transition focus:border-accent"
              />
            </label>
          </div>
        ) : null}

        {error ? (
          <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </p>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <PrimaryButton
            type="button"
            className="w-full"
            disabled={isSubmitting || !selectedPersonaId}
            onClick={() => void handleGenerate()}
          >
            {isSubmitting ? "Generating..." : "Generate QR"}
          </PrimaryButton>

          <SecondaryButton
            type="button"
            className="w-full"
            disabled={!generatedQr}
            onClick={() => void handleCopyLink()}
          >
            Copy share link
          </SecondaryButton>
        </div>

        {copyState === "success" ? (
          <p className="text-sm text-emerald-700">Share link copied.</p>
        ) : null}
        {copyState === "error" ? (
          <p className="text-sm text-amber-700">
            Unable to copy the link right now.
          </p>
        ) : null}
      </Card>

      {generatedQr && qrImageSrc && selectedPersona ? (
        <QrCodeCard
          persona={selectedPersona}
          qr={generatedQr}
          qrImageSrc={qrImageSrc}
          modeLabel={mode === "standard" ? "Standard QR" : "Quick Connect QR"}
        />
      ) : (
        <Card className="border-dashed bg-white/30 text-center">
          <div className="space-y-2 py-8">
            <h2 className="text-lg font-semibold text-foreground">
              Generate a shareable QR
            </h2>
            <p className="text-sm leading-6 text-muted">
              Choose a persona, pick a mode, and create a QR code to share your
              safe public preview.
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
