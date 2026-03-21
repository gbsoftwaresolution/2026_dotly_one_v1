"use client";

import { useEffect } from "react";

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
  // Prevent body scroll when modal is open
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
    // Backdrop
    <div
      className="fixed inset-0 z-modal flex items-end justify-center sm:items-center animate-fade-in"
      style={{ background: "rgba(0,0,0,0.72)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      {/* Modal sheet */}
      <div
        className={cn(
          "w-full max-w-sm mx-4 mb-4 sm:mb-0 rounded-[1.75rem] overflow-hidden",
          // Glass surface
          "dark:bg-surface2 dark:border dark:border-white/[0.10]",
          "bg-white border border-black/[0.08]",
          "shadow-[0_24px_80px_rgba(0,0,0,0.5)]",
          "animate-slide-up sm:animate-scale-in",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Inner highlight */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />

        <div className="p-6 space-y-5">
          {/* Header */}
          <div className="space-y-2">
            <h2 className="font-sans text-lg font-bold text-foreground leading-tight">
              {title}
            </h2>
            <p className="font-sans text-sm leading-relaxed text-muted">
              {description}
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2.5">
            <button
              onClick={onConfirm}
              disabled={isConfirming}
              className={cn(
                "relative inline-flex h-14 items-center justify-center rounded-2xl px-5 text-sm font-bold",
                "transition-all duration-250 ease-spring overflow-hidden",
                "active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                destructive
                  ? [
                      "dark:bg-status-error/15 dark:text-status-error dark:border dark:border-status-error/30",
                      "bg-rose-50 text-rose-600 border border-rose-200",
                      "hover:dark:bg-status-error/25 hover:bg-rose-100",
                      "focus-visible:ring-status-error dark:focus-visible:ring-offset-surface2",
                    ]
                  : [
                      "dark:bg-gradient-cyan dark:text-bgOnyx",
                      "bg-gradient-rose text-white",
                      "hover:opacity-90",
                      "focus-visible:ring-accent dark:focus-visible:ring-offset-surface2",
                    ],
              )}
            >
              <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
              {isConfirming ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
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
                "inline-flex h-12 items-center justify-center rounded-2xl px-5 text-sm font-medium",
                "transition-all duration-250 ease-spring",
                "text-muted hover:text-foreground",
                "hover:dark:bg-white/[0.06] hover:bg-slate-100",
                "active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border",
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
