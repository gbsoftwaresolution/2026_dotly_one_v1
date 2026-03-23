"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils/cn";

type ToastTone = "success" | "error" | "neutral";

type ToastDetail = {
  message: string;
  tone?: ToastTone;
  duration?: number;
};

type ToastItem = {
  id: number;
  message: string;
  tone: ToastTone;
  exiting: boolean;
};

const TOAST_EVENT = "dotly:toast";
const DEFAULT_TOAST_DURATION_MS = 1800;
const EXIT_DURATION_MS = 180;

export function showToast(detail: string | ToastDetail) {
  if (typeof window === "undefined") {
    return;
  }

  const payload =
    typeof detail === "string"
      ? { message: detail }
      : detail;

  window.dispatchEvent(
    new CustomEvent<ToastDetail>(TOAST_EVENT, {
      detail: payload,
    }),
  );
}

export function ToastViewport() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextIdRef = useRef(0);

  useEffect(() => {
    const dismissToast = (id: number) => {
      setToasts((current) =>
        current.map((toast) =>
          toast.id === id ? { ...toast, exiting: true } : toast,
        ),
      );

      window.setTimeout(() => {
        setToasts((current) => current.filter((toast) => toast.id !== id));
      }, EXIT_DURATION_MS);
    };

    const handleToast = (event: Event) => {
      const customEvent = event as CustomEvent<ToastDetail>;
      const message = customEvent.detail?.message?.trim();

      if (!message) {
        return;
      }

      nextIdRef.current += 1;

      const toast: ToastItem = {
        id: nextIdRef.current,
        message,
        tone: customEvent.detail?.tone ?? "success",
        exiting: false,
      };

      setToasts((current) => [...current.slice(-2), toast]);

      window.setTimeout(() => {
        dismissToast(toast.id);
      }, customEvent.detail?.duration ?? DEFAULT_TOAST_DURATION_MS);
    };

    window.addEventListener(TOAST_EVENT, handleToast as EventListener);

    return () => {
      window.removeEventListener(TOAST_EVENT, handleToast as EventListener);
    };
  }, []);

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[80] flex justify-center px-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] sm:px-6">
      <div className="flex w-full max-w-sm flex-col items-center gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            aria-live="polite"
            role="status"
            className={cn(
              "w-full rounded-full border px-4 py-3 text-center text-sm font-medium shadow-[0_20px_50px_rgba(15,23,42,0.18)] backdrop-blur-xl",
              "transition-[opacity,transform] duration-[180ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
              toast.exiting ? "translate-y-2 opacity-0" : "translate-y-0 opacity-100",
              toast.tone === "error"
                ? "border-rose-500/20 bg-rose-500/92 text-white"
                : toast.tone === "neutral"
                  ? "border-black/10 bg-white/92 text-foreground dark:border-white/10 dark:bg-zinc-950/92 dark:text-white"
                  : "border-emerald-500/20 bg-emerald-500/92 text-white dark:bg-emerald-400 dark:text-slate-950",
            )}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  );
}