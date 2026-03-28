"use client";

import { startRegistration } from "@simplewebauthn/browser";
import { Fingerprint, KeyRound, Pencil, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { PrimaryButton } from "@/components/shared/primary-button";
import { SecondaryButton } from "@/components/shared/secondary-button";
import { authApi } from "@/lib/api";
import {
  browserSupportsPasskeys,
  getPasskeyErrorMessage,
} from "@/lib/passkeys/errors";
import { classifyAuthError } from "@/lib/utils/auth-errors";
import { cn } from "@/lib/utils/cn";
import type { UserPasskey } from "@/types/user";

type FeedbackState = {
  tone: "success" | "error" | "warning";
  message: string;
} | null;

function SectionCard({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[28px] bg-foreground/[0.03] p-5 shadow-inner ring-1 ring-inset ring-black/5 dark:bg-white/[0.045] dark:ring-white/5">
      <div className="space-y-1.5 pb-4">
        <p className="label-xs text-muted">{eyebrow}</p>
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

function FeedbackBanner({ feedback }: { feedback: FeedbackState }) {
  if (!feedback) {
    return null;
  }

  return (
    <div
      className={cn(
        "rounded-[22px] px-4 py-3 ring-1 ring-inset",
        feedback.tone === "success" && "bg-emerald-500/5 ring-emerald-500/20",
        feedback.tone === "warning" && "bg-amber-500/5 ring-amber-500/20",
        feedback.tone === "error" && "bg-rose-500/5 ring-rose-500/20",
      )}
    >
      <p className="text-sm leading-6 text-foreground/85">{feedback.message}</p>
    </div>
  );
}

function formatRelativeDate(value: string | null): string {
  if (!value) {
    return "Not used yet";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return date.toLocaleString();
}

function getPasskeyDescription(passkey: UserPasskey): string {
  const parts = [passkey.deviceType === "multiDevice" ? "Synced passkey" : null]
    .filter(Boolean)
    .map((value) => String(value));

  if (passkey.backedUp) {
    parts.push("Backed up");
  }

  return parts.length > 0
    ? parts.join(" • ")
    : "Passkey ready for Dotly sign-in";
}

export function PasskeyManagementCard({
  initialPasskeys,
}: {
  initialPasskeys?: UserPasskey[];
}) {
  const [passkeys, setPasskeys] = useState<UserPasskey[]>(
    initialPasskeys ?? [],
  );
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [savingRenameId, setSavingRenameId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const supported = browserSupportsPasskeys();

  const passkeyCountLabel = useMemo(() => {
    if (passkeys.length === 0) {
      return "No passkeys enrolled yet";
    }

    return `${passkeys.length} passkey${passkeys.length === 1 ? "" : "s"} enrolled`;
  }, [passkeys.length]);

  async function loadPasskeys() {
    setIsLoading(true);

    try {
      const result = await authApi.listPasskeys();
      setPasskeys(result.passkeys);
    } catch (loadError) {
      const classified = classifyAuthError(loadError);
      setFeedback({
        tone: classified.kind === "unauthorized" ? "warning" : "error",
        message:
          classified.kind === "unauthorized"
            ? "Your session expired. Sign in again to manage passkeys."
            : "Unable to load your passkeys right now.",
      });
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (!initialPasskeys) {
      void loadPasskeys();
    }
  }, [initialPasskeys]);

  async function handleAddPasskey() {
    setFeedback(null);
    setIsRegistering(true);

    try {
      const begin = await authApi.beginPasskeyRegistration({
        name: `Dotly passkey ${passkeys.length + 1}`,
      });
      const response = await startRegistration({
        optionsJSON: begin.options,
      });
      const result = await authApi.verifyPasskeyRegistration({
        response,
        name: `Dotly passkey ${passkeys.length + 1}`,
      });
      setPasskeys((current) => [result.passkey, ...current]);
      setFeedback({
        tone: "success",
        message: `Passkey added. ${result.passkey.name} is ready for your next sign-in.`,
      });
    } catch (registerError) {
      setFeedback({
        tone: "warning",
        message: getPasskeyErrorMessage(registerError),
      });
    } finally {
      setIsRegistering(false);
    }
  }

  async function handleRename(passkeyId: string) {
    const nextName = draftName.trim();

    if (!nextName) {
      setFeedback({
        tone: "warning",
        message: "Give the passkey a clear name.",
      });
      return;
    }

    setFeedback(null);
    setSavingRenameId(passkeyId);

    try {
      await authApi.renamePasskey(passkeyId, { name: nextName });
      setPasskeys((current) =>
        current.map((passkey) =>
          passkey.id === passkeyId
            ? {
                ...passkey,
                name: nextName,
              }
            : passkey,
        ),
      );
      setRenamingId(null);
      setDraftName("");
      setFeedback({ tone: "success", message: "Passkey name updated." });
    } catch {
      setFeedback({ tone: "error", message: "Unable to rename that passkey." });
    } finally {
      setSavingRenameId(null);
    }
  }

  async function handleRemove(passkeyId: string) {
    setRemovingId(passkeyId);
    setFeedback(null);

    try {
      await authApi.removePasskey(passkeyId);
      setPasskeys((current) =>
        current.filter((passkey) => passkey.id !== passkeyId),
      );
      setFeedback({ tone: "success", message: "Passkey removed." });
    } catch {
      setFeedback({ tone: "error", message: "Unable to remove that passkey." });
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <SectionCard eyebrow="Passkeys" title="Passkey access and device trust">
      <div className="space-y-4">
        <div className="rounded-[22px] bg-[linear-gradient(135deg,rgba(12,18,28,0.96),rgba(26,39,57,0.94))] p-5 text-white shadow-[0_16px_40px_rgba(12,18,28,0.25)] dark:bg-[linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
                Hero sign-in experience
              </p>
              <h3 className="text-lg font-semibold tracking-tight text-white">
                Make passkeys your default Dotly return.
              </h3>
              <p className="max-w-[42ch] text-sm leading-6 text-white/75">
                Passkeys keep sign-in premium, private, and fast across your
                trusted devices while passwords stay available for fallback.
              </p>
            </div>
            <PrimaryButton
              type="button"
              size="lg"
              className="bg-white text-slate-950"
              isLoading={isRegistering}
              disabled={!supported}
              onClick={() => void handleAddPasskey()}
            >
              Add a passkey
            </PrimaryButton>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 rounded-[22px] bg-white/80 p-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)] ring-1 ring-black/5 dark:bg-zinc-950/80 dark:ring-white/[0.06]">
          <div>
            <p className="text-sm font-semibold text-foreground">
              {passkeyCountLabel}
            </p>
            <p className="mt-1 text-sm leading-6 text-muted">
              Enroll this device, your phone, or a hardware key so passkey
              sign-in stays close in the moments you need Dotly quickly.
            </p>
          </div>
          <div className="rounded-full bg-foreground/[0.03] p-3 ring-1 ring-black/5 dark:bg-white/[0.05] dark:ring-white/10">
            <Fingerprint className="h-5 w-5 text-foreground" />
          </div>
        </div>

        <FeedbackBanner feedback={feedback} />

        {!supported ? (
          <div className="rounded-[22px] bg-amber-500/5 px-4 py-3 ring-1 ring-inset ring-amber-500/20">
            <p className="text-sm leading-6 text-foreground/85">
              This browser or device cannot create passkeys here yet. Password
              sign-in still works normally.
            </p>
          </div>
        ) : null}

        {isLoading ? (
          <p className="text-sm text-muted">Loading passkeys…</p>
        ) : passkeys.length > 0 ? (
          <div className="space-y-3">
            {passkeys.map((passkey) => (
              <div
                key={passkey.id}
                className="rounded-[22px] bg-white/80 p-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)] ring-1 ring-black/5 dark:bg-zinc-950/80 dark:ring-white/[0.06]"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="rounded-full bg-foreground/[0.03] p-2.5 ring-1 ring-black/5 dark:bg-white/[0.05] dark:ring-white/10">
                      <KeyRound className="h-4 w-4 text-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {passkey.name}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-muted">
                        {getPasskeyDescription(passkey)}
                      </p>
                      <p className="mt-2 text-xs leading-5 text-muted">
                        Added {formatRelativeDate(passkey.createdAt)}
                        {passkey.lastUsedAt
                          ? ` · Last used ${formatRelativeDate(passkey.lastUsedAt)}`
                          : ""}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <SecondaryButton
                      type="button"
                      size="sm"
                      onClick={() => {
                        setRenamingId(passkey.id);
                        setDraftName(passkey.name);
                      }}
                    >
                      <span className="inline-flex items-center gap-2">
                        <Pencil className="h-4 w-4" />
                        Rename
                      </span>
                    </SecondaryButton>
                    <SecondaryButton
                      type="button"
                      size="sm"
                      isLoading={removingId === passkey.id}
                      onClick={() => void handleRemove(passkey.id)}
                    >
                      <span className="inline-flex items-center gap-2">
                        <Trash2 className="h-4 w-4" />
                        Remove
                      </span>
                    </SecondaryButton>
                  </div>
                </div>

                {renamingId === passkey.id ? (
                  <div className="mt-4 space-y-3 rounded-[18px] bg-foreground/[0.03] p-4 ring-1 ring-inset ring-black/5 dark:bg-white/[0.05] dark:ring-white/10">
                    <label
                      htmlFor={`rename-${passkey.id}`}
                      className="text-sm font-semibold text-foreground"
                    >
                      Passkey name
                    </label>
                    <input
                      id={`rename-${passkey.id}`}
                      value={draftName}
                      onChange={(event) => setDraftName(event.target.value)}
                      className="min-h-[48px] w-full rounded-[16px] bg-white px-4 text-sm text-foreground outline-none ring-1 ring-black/5 dark:bg-zinc-950 dark:ring-white/10"
                      maxLength={80}
                    />
                    <div className="flex flex-wrap gap-2">
                      <PrimaryButton
                        type="button"
                        size="sm"
                        isLoading={savingRenameId === passkey.id}
                        onClick={() => void handleRename(passkey.id)}
                      >
                        Save name
                      </PrimaryButton>
                      <SecondaryButton
                        type="button"
                        size="sm"
                        onClick={() => {
                          setRenamingId(null);
                          setDraftName("");
                        }}
                      >
                        Cancel
                      </SecondaryButton>
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-[22px] bg-foreground/[0.03] px-4 py-4 shadow-inner ring-1 ring-inset ring-black/5 dark:bg-white/[0.05] dark:ring-white/10">
            <p className="text-sm font-semibold text-foreground">
              No passkeys yet
            </p>
            <p className="mt-1 text-sm leading-6 text-muted">
              Add your first passkey to turn future Dotly sign-ins into the hero
              path instead of a typed password moment.
            </p>
          </div>
        )}
      </div>
    </SectionCard>
  );
}
