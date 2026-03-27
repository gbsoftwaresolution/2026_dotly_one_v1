"use client";

import { useEffect, useRef, useState } from "react";
import { Repeat2 } from "lucide-react";

import { PrimaryButton } from "@/components/shared/primary-button";
import { StatusBadge } from "@/components/shared/status-badge";
import { qrApi } from "@/lib/api";
import { ApiError } from "@/lib/api/client";
import { routes } from "@/lib/constants/routes";
import { buildRequestKey } from "@/lib/network/request-key";
import { useNetworkStatus } from "@/lib/network/use-network-status";
import { resolvePreferredPersonaId } from "@/lib/persona/default-persona";
import { getCanonicalPublicSlug } from "@/lib/persona/public-profile-path";
import { formatPublicHandle } from "@/lib/persona/routing-ux";
import type { ConnectQuickConnectQrResult } from "@/types/persona";
import type { PersonaSummary } from "@/types/persona";

interface QuickConnectFlowProps {
  code: string;
  personas: PersonaSummary[];
  hostName: string;
  hostJobTitle: string;
  hostCompany: string;
}

function getPersonaPublicHandle(persona: Pick<PersonaSummary, "publicUrl" | "username">) {
  return formatPublicHandle(
    getCanonicalPublicSlug(persona.publicUrl, persona.username),
  );
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function getConnectErrorCopy(error: ApiError): string {
  const msg = error.message.toLowerCase();

  if (error.status === 401)
    return "Your session has expired. Please log in again to connect.";
  if (error.status === 403) {
    if (msg.includes("blocked"))
      return "This connection is blocked and cannot be completed.";
    if (msg.includes("verified"))
      return "Verify your email or phone before you connect.";
    return "You are not allowed to connect here.";
  }
  if (msg.includes("usage limit") || msg.includes("exhausted"))
    return "This QR code has reached its limit and can no longer be used.";
  if (msg.includes("expired"))
    return "This QR code has expired and can no longer be used.";
  if (msg.includes("already"))
    return "You are already connected with this person.";
  if (error.status === 404) return "This QR code no longer exists.";
  return error.message || "Something went wrong. Please try again.";
}

type FlowState =
  | { type: "selecting" }
  | { type: "connecting" }
  | { type: "settling"; result: ConnectQuickConnectQrResult }
  | { type: "success"; result: ConnectQuickConnectQrResult }
  | { type: "error"; title: string; message: string };

function getConnectErrorState(error: ApiError): FlowState {
  const msg = error.message.toLowerCase();

  if (error.status === 401)
    return {
      type: "error",
      title: "Login required",
      message: "Your session has expired. Please log in again to connect.",
    };

  if (error.status === 403) {
    if (msg.includes("blocked"))
      return {
        type: "error",
        title: "Connection blocked",
        message:
          "This person cannot be reached because one side has blocked the other.",
      };
    if (msg.includes("verified"))
      return {
        type: "error",
        title: "Verification required",
        message: "Verify your email or phone before you connect.",
      };
    return {
      type: "error",
      title: "Access denied",
      message: "You are not allowed to connect here.",
    };
  }

  if (msg.includes("usage limit") || msg.includes("exhausted"))
    return {
      type: "error",
      title: "QR exhausted",
      message: "This QR code has reached its limit and can no longer be used.",
    };

  if (msg.includes("not active yet"))
    return {
      type: "error",
      title: "Cooldown active",
      message: "This QR code is not active yet. Please try again later.",
    };

  if (msg.includes("expired"))
    return {
      type: "error",
      title: "QR expired",
      message: "This QR code has expired and can no longer be used.",
    };

  if (msg.includes("active instant access relationship already exists"))
    return {
      type: "error",
      title: "Already connected",
      message: "You are already connected with this person.",
    };

  if (msg.includes("contact relationship already exists"))
    return {
      type: "error",
      title: "Already connected",
      message: "You are already connected with this contact.",
    };

  if (error.status === 404)
    return {
      type: "error",
      title: "QR Not Found",
      message: "This QR code no longer exists.",
    };

  return {
    type: "error",
    title: "Connection failed",
    message: getConnectErrorCopy(error),
  };
}

function avatarGradient(name: string): string {
  const hue = (name.charCodeAt(0) * 137) % 360;
  const hue2 = (hue + 40) % 360;
  return `linear-gradient(135deg, hsl(${hue},60%,45%), hsl(${hue2},60%,55%))`;
}

function getFirstName(name: string): string {
  const trimmed = name.trim();

  if (!trimmed) {
    return "them";
  }

  return trimmed.split(/\s+/)[0] || trimmed;
}

export function QuickConnectFlow({
  code,
  personas,
  hostName,
  hostJobTitle,
  hostCompany,
}: QuickConnectFlowProps) {
  const isOnline = useNetworkStatus();
  const hostFirstName = getFirstName(hostName);
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>(
    resolvePreferredPersonaId(personas),
  );
  const [showPersonaOptions, setShowPersonaOptions] = useState(false);
  const [flowState, setFlowState] = useState<FlowState>({ type: "selecting" });
  const pendingAbortRef = useRef<AbortController | null>(null);
  const requestKeyRef = useRef<string | null>(null);
  const slowFeedbackTimeoutRef = useRef<number | null>(null);
  const [showSlowFeedback, setShowSlowFeedback] = useState(false);
  const selectedPersona =
    personas.find((persona) => persona.id === selectedPersonaId) ?? null;

  useEffect(() => {
    if (flowState.type !== "settling") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setFlowState({ type: "success", result: flowState.result });
    }, 260);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [flowState]);

  useEffect(() => {
    return () => {
      pendingAbortRef.current?.abort();
      if (slowFeedbackTimeoutRef.current !== null) {
        window.clearTimeout(slowFeedbackTimeoutRef.current);
      }
    };
  }, []);

  async function handleConnect() {
    if (!selectedPersonaId) return;

    if (!isOnline) {
      setFlowState({
        type: "error",
        title: "Offline",
        message: "Reconnect to finish this connection.",
      });
      return;
    }

    pendingAbortRef.current?.abort();
    const controller = new AbortController();
    pendingAbortRef.current = controller;
    requestKeyRef.current ??= buildRequestKey(
      "quick-connect",
      code,
      selectedPersonaId,
    );
    setShowSlowFeedback(false);
    if (slowFeedbackTimeoutRef.current !== null) {
      window.clearTimeout(slowFeedbackTimeoutRef.current);
    }
    slowFeedbackTimeoutRef.current = window.setTimeout(() => {
      setShowSlowFeedback(true);
      slowFeedbackTimeoutRef.current = null;
    }, 2000);

    setFlowState({ type: "connecting" });
    try {
      const result = await qrApi.connectQuick(
        code,
        {
          fromPersonaId: selectedPersonaId,
        },
        {
          signal: controller.signal,
          requestKey: requestKeyRef.current,
        },
      );
      requestKeyRef.current = null;
      setFlowState({ type: "settling", result });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      setFlowState(
        error instanceof ApiError
          ? getConnectErrorState(error)
          : {
              type: "error",
              title: "Connection failed",
              message: "Something went wrong. Please try again.",
            },
      );
    } finally {
      if (slowFeedbackTimeoutRef.current !== null) {
        window.clearTimeout(slowFeedbackTimeoutRef.current);
        slowFeedbackTimeoutRef.current = null;
      }
      setShowSlowFeedback(false);
    }
  }

  function handleRetry() {
    requestKeyRef.current = null;
    setFlowState({ type: "selecting" });
  }

  if (flowState.type === "success") {
    const { result } = flowState;
    const target = result.targetPersona;

    return (
      <div className="rounded-3xl bg-white/82 p-6 space-y-6 shadow-[0_8px_32px_rgba(0,0,0,0.08)] ring-1 ring-black/[0.05] dark:bg-zinc-950/82 dark:ring-white/[0.06]">
        <div className="flex flex-col items-center gap-3 pt-2 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl border border-emerald-500/30 bg-emerald-500/10">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="h-8 w-8 text-emerald-600 dark:text-emerald-400"
            >
              <path
                fillRule="evenodd"
                d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z"
                clipRule="evenodd"
              />
            </svg>
          </div>

          <div className="space-y-1">
            <StatusBadge label="Connected" tone="success" />
            <h2 className="pt-1 text-xl font-bold text-foreground">
              You&apos;re connected
            </h2>
            <p className="text-sm text-muted">
              {target.jobTitle} at {target.companyName}
            </p>
            <p className="text-sm text-muted">
              {target.fullName} is now saved in your contacts.
            </p>
          </div>
        </div>

        <div className="rounded-2xl bg-foreground/[0.03] p-4 space-y-3 shadow-inner ring-1 ring-inset ring-black/5 dark:bg-white/[0.045] dark:ring-white/5">
          <p className="label-xs text-muted">Connection window</p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="space-y-0.5">
              <p className="label-xs text-muted">Starts</p>
              <p className="text-foreground">
                {formatDateTime(result.accessStartAt)}
              </p>
            </div>
            <div className="space-y-0.5">
              <p className="label-xs text-muted">Ends</p>
              <p className="text-foreground">
                {formatDateTime(result.accessEndAt)}
              </p>
            </div>
          </div>
        </div>

        <a
          href={routes.app.contactDetail(result.relationshipId)}
          className="inline-flex w-full items-center justify-center rounded-2xl bg-foreground py-5 px-5 text-sm font-bold text-background transition-all hover:scale-[0.995] active:scale-95 focus:outline-none focus:ring-2 focus:ring-foreground/20"
        >
          Open contact
        </a>
      </div>
    );
  }

  if (flowState.type === "error") {
    return (
      <div className="rounded-3xl bg-rose-500/5 p-6 space-y-4 ring-1 ring-inset ring-rose-500/20">
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-rose-500 dark:text-rose-400">
            {flowState.title}
          </h2>
          <p className="text-sm leading-6 text-rose-500/90 dark:text-rose-400/80">
            {flowState.message}
          </p>
        </div>
        <button
          type="button"
          onClick={handleRetry}
          className="inline-flex w-full items-center justify-center rounded-2xl bg-foreground/[0.04] py-4 px-5 text-sm font-semibold text-foreground shadow-inner ring-1 ring-black/5 transition-all hover:bg-foreground/[0.06] active:scale-95 dark:bg-white/[0.05] dark:ring-white/10"
        >
          Try again
        </button>
      </div>
    );
  }

  const isConnecting = flowState.type === "connecting";
  const isSettling = flowState.type === "settling";
  const isBusy = isConnecting || isSettling;

  return (
    <div className="rounded-[2rem] bg-white/82 p-6 sm:p-7 space-y-7 shadow-[0_8px_32px_rgba(0,0,0,0.08)] ring-1 ring-black/[0.05] dark:bg-zinc-950/82 dark:ring-white/[0.06]">
      <div className="space-y-5">
        <div className="rounded-[30px] bg-foreground/[0.03] p-5 shadow-inner ring-1 ring-inset ring-black/5 dark:bg-white/[0.045] dark:ring-white/5">
          <div className="flex items-center gap-4 text-left">
            <div
              className="flex h-[3.75rem] w-[3.75rem] shrink-0 items-center justify-center rounded-[1.35rem] text-lg font-bold text-white"
              style={{ background: avatarGradient(hostName) }}
            >
              {hostName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 space-y-1">
              <p className="label-xs text-muted">Connect</p>
              <h2 className="text-[1.15rem] font-semibold tracking-tight text-foreground">
                {hostName}
              </h2>
              <p className="text-sm text-muted">
                {hostJobTitle} at {hostCompany}
              </p>
            </div>
          </div>
          <p className="mt-4 text-left text-sm leading-6 text-muted">
            Tap Connect to save {hostFirstName} as a contact.
          </p>
        </div>

        <div className="space-y-1 rounded-[1.4rem] bg-foreground/[0.03] px-4 py-3.5 shadow-inner ring-1 ring-inset ring-black/5 dark:bg-white/[0.045] dark:ring-white/5">
          <p className="label-xs text-muted">What Connect does</p>
          <p className="text-left text-sm leading-6 text-muted">
            Uses the selected profile below and saves this contact instantly.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="label-xs text-muted">Connecting as</p>
          {personas.length > 1 ? (
            <button
              type="button"
              onClick={() => setShowPersonaOptions((current) => !current)}
              disabled={isBusy}
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted transition-colors hover:text-foreground"
            >
              <Repeat2 className="h-3.5 w-3.5" />
              Switch
            </button>
          ) : null}
        </div>
        {selectedPersona ? (
          <div className="rounded-[1.4rem] bg-foreground/[0.03] px-4 py-3.5 shadow-inner ring-1 ring-inset ring-black/5 dark:bg-white/[0.045] dark:ring-white/5">
            <div className="flex items-center gap-3">
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[1rem] text-sm font-bold text-white"
                style={{ background: avatarGradient(selectedPersona.fullName) }}
              >
                {selectedPersona.fullName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1 text-left">
                <p className="truncate text-sm font-semibold text-foreground">
                  {selectedPersona.fullName}
                </p>
                <p className="truncate font-mono text-xs text-muted">
                  {getPersonaPublicHandle(selectedPersona)}
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {showPersonaOptions && personas.length > 1 ? (
          <div className="flex flex-col gap-2">
            {personas.map((persona) => {
              const isSelected = selectedPersonaId === persona.id;
              return (
                <button
                  key={persona.id}
                  type="button"
                  disabled={isBusy}
                  onClick={() => {
                    setSelectedPersonaId(persona.id);
                    setShowPersonaOptions(false);
                  }}
                  className={`w-full rounded-2xl px-4 py-3 text-left transition-all ring-1 focus:outline-none focus:ring-2 focus:ring-foreground/15 ${
                    isSelected
                      ? "bg-foreground/[0.05] ring-black/10 dark:bg-white/[0.08] dark:ring-white/10"
                      : "bg-foreground/[0.03] ring-black/5 hover:bg-foreground/[0.05] dark:bg-white/[0.045] dark:ring-white/5 dark:hover:bg-white/[0.06]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white transition-all"
                      style={{ background: avatarGradient(persona.fullName) }}
                    >
                      {persona.fullName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {persona.fullName}
                      </p>
                      <p className="truncate font-mono text-xs text-muted">
                        {getPersonaPublicHandle(persona)} &middot;{" "}
                        {persona.type.charAt(0).toUpperCase() +
                          persona.type.slice(1)}
                      </p>
                    </div>
                    {isSelected ? (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className="h-5 w-5 shrink-0 text-foreground"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z"
                          clipRule="evenodd"
                        />
                      </svg>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      <PrimaryButton
        onClick={() => void handleConnect()}
        disabled={isBusy || !selectedPersonaId}
        className="w-full h-[60px] disabled:opacity-50 disabled:cursor-not-allowed"
        isLoading={isConnecting}
        isSuccess={isSettling}
        loadingLabel="Connecting..."
      >
        {isSettling ? "Connected ✓" : "Connect"}
      </PrimaryButton>

      {showSlowFeedback ? (
        <p className="text-center text-sm leading-6 text-muted">
          Still connecting. Keep this screen open.
        </p>
      ) : null}
      {!isOnline ? (
        <p className="text-center text-sm leading-6 text-amber-700 dark:text-amber-300">
          You are offline. Connect will resume once you retry online.
        </p>
      ) : null}
    </div>
  );
}
