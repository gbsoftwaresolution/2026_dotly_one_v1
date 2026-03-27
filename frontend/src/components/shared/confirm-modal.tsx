"use client";

import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface ConfirmModalProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  isConfirming?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  isConfirming = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-modal flex items-end justify-center sm:items-center animate-fade-in"
      style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(8px)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        className={cn(
          "w-full max-w-sm mx-4 mb-4 overflow-hidden rounded-[32px] sm:mb-0",
          "bg-white/60 backdrop-blur-3xl dark:bg-zinc-900/60 ring-1 ring-black/5 dark:ring-white/10",
          "shadow-[0_20px_40px_-10px_rgba(0,0,0,0.1)]",
          "animate-slide-up sm:animate-scale-in",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />

        <div className="p-6 space-y-5">
          <div className="space-y-2 text-center">
            <h2 className="font-sans text-lg font-bold text-foreground leading-tight">
              {title}
            </h2>
            <p className="font-sans text-sm leading-relaxed text-muted">
              {description}
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={onConfirm}
              disabled={isConfirming}
              className={cn(
                "relative inline-flex h-12 items-center justify-center rounded-[16px] px-5 text-sm font-bold",
                "transition-all duration-500 ease-spring overflow-hidden hover:-translate-y-0.5",
                "shadow-[0_8px_16px_-6px_rgba(0,0,0,0.05)]",
                "active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                destructive
                  ? "bg-rose-500 text-white hover:bg-rose-600 focus-visible:ring-rose-500"
                  : "bg-foreground text-background dark:bg-white dark:text-zinc-950 focus-visible:ring-foreground",
              )}
            >
              {isConfirming ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
                  <span>Please wait…</span>
                </span>
              ) : (
                confirmLabel
              )}
            </button>

            <button
              onClick={onCancel}
              disabled={isConfirming}
              className={cn(
                "inline-flex h-12 items-center justify-center rounded-[16px] px-5 text-sm font-medium",
                "bg-white/60 backdrop-blur-3xl dark:bg-zinc-900/60 ring-1 ring-black/5 dark:ring-white/10",
                "transition-all duration-500 ease-spring hover:-translate-y-0.5",
                "text-muted hover:text-foreground shadow-[0_8px_16px_-6px_rgba(0,0,0,0.05)]",
                "active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2",
                "disabled:opacity-50 disabled:cursor-not-allowed",
              )}
            >
              {cancelLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
