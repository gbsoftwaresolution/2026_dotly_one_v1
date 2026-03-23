"use client";

import { useState } from "react";

import { PrimaryButton } from "@/components/shared/primary-button";
import { StatusBadge } from "@/components/shared/status-badge";
import { qrApi } from "@/lib/api";
import { ApiError } from "@/lib/api/client";
import { routes } from "@/lib/constants/routes";
import type { ConnectQuickConnectQrResult } from "@/types/persona";
import type { PersonaSummary } from "@/types/persona";

interface QuickConnectFlowProps {
  code: string;
  personas: PersonaSummary[];
  hostName: string;
  hostJobTitle: string;
  hostCompany: string;
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
      return "Quick Connect requires a verified email or mobile verification.";
    return "You are not allowed to use this Quick Connect.";
  }
  if (msg.includes("usage limit") || msg.includes("exhausted"))
    return "This Quick Connect QR has reached its usage limit and can no longer be used.";
  if (msg.includes("expired"))
    return "This Quick Connect QR has expired and can no longer be used.";
  if (msg.includes("already"))
    return "You already have an active Quick Connect relationship with this person.";
  if (error.status === 404) return "This QR code no longer exists.";
  return error.message || "Something went wrong. Please try again.";
}

type FlowState =
  | { type: "selecting" }
  | { type: "connecting" }
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
          "This person cannot be reached through Quick Connect because one side has blocked the other.",
      };
    if (msg.includes("verified"))
      return {
        type: "error",
        title: "Verification required",
        message:
          "Verify your email or complete mobile verification before using Quick Connect.",
      };
    return {
      type: "error",
      title: "Access denied",
      message: "You are not allowed to use this Quick Connect.",
    };
  }

  if (msg.includes("usage limit") || msg.includes("exhausted"))
    return {
      type: "error",
      title: "QR exhausted",
      message:
        "This Quick Connect QR has reached its usage limit and can no longer be used.",
    };

  if (msg.includes("not active yet"))
    return {
      type: "error",
      title: "Cooldown active",
      message:
        "This Quick Connect QR is not active yet. Please try again later.",
    };

  if (msg.includes("expired"))
    return {
      type: "error",
      title: "QR expired",
      message: "This Quick Connect QR has expired and can no longer be used.",
    };

  if (msg.includes("active instant access relationship already exists"))
    return {
      type: "error",
      title: "Already Connected",
      message:
        "You already have an active instant access connection with this person.",
    };

  if (msg.includes("contact relationship already exists"))
    return {
      type: "error",
      title: "Already Connected",
      message: "You already have an approved relationship with this contact.",
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
  const hostFirstName = getFirstName(hostName);
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>(
    personas[0]?.id ?? "",
  );
  const [flowState, setFlowState] = useState<FlowState>({ type: "selecting" });

  async function handleConnect() {
    if (!selectedPersonaId) return;
    setFlowState({ type: "connecting" });
    try {
      const result = await qrApi.connectQuick(code, {
        fromPersonaId: selectedPersonaId,
      });
      setFlowState({ type: "success", result });
    } catch (error) {
      setFlowState(
        error instanceof ApiError
          ? getConnectErrorState(error)
          : {
              type: "error",
              title: "Connection failed",
              message: "Something went wrong. Please try again.",
            },
      );
    }
  }

  function handleRetry() {
    setFlowState({ type: "selecting" });
  }

  if (flowState.type === "success") {
    const { result } = flowState;
    const target = result.targetPersona;

    return (
      <div className="glass rounded-3xl border border-border bg-surface p-6 space-y-6">
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
              Connected instantly
            </h2>
            <p className="text-sm text-muted">
              {target.jobTitle} at {target.companyName}
            </p>
            <p className="text-sm text-muted">
              This introduction is now saved with a live connection window.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-surface/60 p-4 space-y-3">
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
          className="inline-flex w-full items-center justify-center rounded-2xl bg-brandRose py-5 px-5 text-sm font-bold text-white transition-all hover:opacity-90 active:scale-95 focus:outline-none focus:ring-2 focus:ring-brandRose/40 dark:bg-brandCyan dark:text-zinc-950 dark:focus:ring-brandCyan/40"
        >
          View connection
        </a>
      </div>
    );
  }

  if (flowState.type === "error") {
    return (
      <div className="glass rounded-3xl border border-rose-500/30 bg-rose-500/10 p-6 space-y-4">
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
          className="inline-flex w-full items-center justify-center rounded-2xl border border-rose-500/30 bg-transparent py-4 px-5 text-sm font-semibold text-rose-500 transition-all hover:bg-rose-500/10 active:scale-95 dark:text-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-400/40"
        >
          Try again
        </button>
      </div>
    );
  }

  const isConnecting = flowState.type === "connecting";

  return (
    <div className="glass rounded-3xl border border-border bg-surface p-6 space-y-6">
      <div className="space-y-4">
        <div className="rounded-[28px] border border-border/70 bg-background/80 p-4 shadow-[0_16px_36px_rgba(15,23,42,0.06)] dark:bg-surface/60 dark:shadow-none">
          <div className="flex items-center gap-4 text-left">
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-lg font-bold text-white"
              style={{ background: avatarGradient(hostName) }}
            >
              {hostName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 space-y-1">
              <p className="label-xs text-brandRose dark:text-brandCyan">
                Quick Connect
              </p>
              <h2 className="text-lg font-semibold text-foreground">
                {hostName}
              </h2>
              <p className="text-sm text-muted">
                {hostJobTitle} at {hostCompany}
              </p>
            </div>
          </div>
          <p className="mt-4 text-left text-sm leading-6 text-muted">
            Start a temporary connection while this introduction is still fresh.
          </p>
        </div>

        <div className="space-y-1 rounded-2xl border border-border bg-surface/50 px-4 py-3">
          <p className="label-xs text-muted">What happens next</p>
          <p className="text-left text-sm leading-6 text-muted">
            Choose the persona that matches how you met {hostFirstName}. We will
            save that context with the connection.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <p className="label-xs text-muted">Choose your persona</p>
        <div className="flex flex-col gap-2">
          {personas.map((persona) => {
            const isSelected = selectedPersonaId === persona.id;
            return (
              <button
                key={persona.id}
                type="button"
                disabled={isConnecting}
                onClick={() => setSelectedPersonaId(persona.id)}
                className={`w-full rounded-2xl border px-4 py-3 text-left transition-all focus:outline-none focus:ring-2 focus:ring-brandRose dark:focus:ring-brandCyan focus:ring-offset-2 ${
                  isSelected
                    ? "border-brandRose bg-brandRose/5 dark:border-brandCyan dark:bg-brandCyan/5"
                    : "border-border bg-surface hover:bg-surface/80"
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
                      @{persona.username} &middot;{" "}
                      {persona.type.charAt(0).toUpperCase() +
                        persona.type.slice(1)}
                    </p>
                  </div>
                  {isSelected && (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className="h-5 w-5 shrink-0 text-brandRose dark:text-brandCyan"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <PrimaryButton
        onClick={() => void handleConnect()}
        disabled={isConnecting || !selectedPersonaId}
        className="w-full h-[60px] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isConnecting ? "Connecting..." : "Start temporary access"}
      </PrimaryButton>
    </div>
  );
}
