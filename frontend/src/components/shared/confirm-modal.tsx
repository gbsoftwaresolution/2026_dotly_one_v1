"use client";

import { useEffect, useRef } from "react";

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
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) return;

    if (open) {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else {
      if (dialog.open) {
        dialog.close();
      }
    }
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-xl sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-zinc-950 border border-border p-6 space-y-5 mx-4 mb-4 sm:mb-0 shadow-2xl">
        <div className="space-y-2">
          <h2 className="font-sans text-lg font-bold text-foreground">
            {title}
          </h2>
          <p className="font-sans text-sm leading-6 text-muted">
            {description}
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={onConfirm}
            disabled={isConfirming}
            className={cn(
              "inline-flex h-12 items-center justify-center rounded-2xl px-5 text-sm font-bold transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-zinc-950 disabled:opacity-50 disabled:cursor-not-allowed",
              destructive
                ? "bg-rose-500 text-white hover:bg-rose-600 focus:ring-rose-500 dark:bg-cyan-500 dark:text-zinc-950 dark:hover:bg-cyan-400 dark:focus:ring-cyan-500"
                : "bg-brandRose text-white focus:ring-brandRose dark:bg-brandCyan dark:text-bgOnyx dark:focus:ring-brandCyan",
            )}
          >
            {isConfirming ? "Please wait..." : confirmLabel}
          </button>

          <button
            onClick={onCancel}
            disabled={isConfirming}
            className="inline-flex h-12 items-center justify-center rounded-2xl bg-transparent px-5 text-sm font-medium text-muted transition-all hover:text-foreground hover:bg-slate-50 dark:hover:bg-zinc-900 active:scale-95 focus:outline-none focus:ring-2 focus:ring-border focus:ring-offset-2 dark:focus:ring-offset-zinc-950 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
