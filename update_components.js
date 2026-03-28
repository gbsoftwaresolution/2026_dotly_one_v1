const fs = require('fs');
const path = require('path');

const basePath = path.join(process.cwd(), 'frontend/src/components/shared');

const files = {
  'primary-button.tsx': `import type { ButtonHTMLAttributes, PropsWithChildren } from "react";
import { Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type PrimaryButtonProps = PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement> & {
    isLoading?: boolean;
    isSuccess?: boolean;
    loadingLabel?: string;
    fullWidth?: boolean;
    size?: "sm" | "md" | "lg";
  }
>;

export function PrimaryButton({
  children,
  className,
  isLoading,
  isSuccess,
  loadingLabel,
  disabled,
  fullWidth,
  size = "md",
  ...props
}: PrimaryButtonProps) {
  const sizeClasses = {
    sm: "h-10 px-4 text-[13px] rounded-full",
    md: "h-12 px-6 text-[15px] rounded-full",
    lg: "h-[56px] px-8 text-[17px] rounded-full",
  };

  return (
    <button
      disabled={disabled || isLoading}
      className={cn(
        // Base
        "relative inline-flex items-center justify-center font-semibold tracking-wide overflow-hidden",
        "select-none no-select tap-feedback",
        "transition-all duration-500 hover:-translate-y-0.5",
        "shadow-[0_8px_16px_-6px_rgba(0,0,0,0.05)]",
        // Size
        sizeClasses[size],
        // Width
        fullWidth && "w-full",
        // Default state
        !isSuccess &&
          !isLoading && [
            "bg-foreground text-background",
            "active:scale-[0.96] active:shadow-sm",
            "focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 dark:focus-visible:ring-offset-bgOnyx",
          ],
        // Loading state
        isLoading && [
          "bg-foreground/50 text-background/60",
          "cursor-not-allowed",
        ],
        // Success state
        isSuccess && [
          "bg-status-success text-white dark:text-bgOnyx",
          "scale-[1.01]",
        ],
        // Disabled state
        disabled && !isLoading && "opacity-40 cursor-not-allowed",
        className,
      )}
      {...props}
    >
      {isLoading ? (
        <span className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
          <span>{loadingLabel ?? "Processing..."}</span>
        </span>
      ) : isSuccess ? (
        <span className="flex items-center gap-2">
          <Check className="h-4 w-4" strokeWidth={2.5} />
          <span>{children}</span>
        </span>
      ) : (
        children
      )}
    </button>
  );
}
`,
  'secondary-button.tsx': `import type { ButtonHTMLAttributes, PropsWithChildren } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type SecondaryButtonProps = PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement> & {
    isLoading?: boolean;
    isSuccess?: boolean;
    fullWidth?: boolean;
    size?: "sm" | "md" | "lg";
  }
>;

export function SecondaryButton({
  children,
  className,
  isLoading,
  isSuccess,
  disabled,
  fullWidth,
  size = "md",
  ...props
}: SecondaryButtonProps) {
  const sizeClasses = {
    sm: "h-10 px-4 text-[13px] rounded-full",
    md: "h-12 px-6 text-[15px] rounded-full",
    lg: "h-[56px] px-8 text-[17px] rounded-full",
  };

  return (
    <button
      disabled={disabled || isLoading}
      className={cn(
        // Base
        "relative inline-flex items-center justify-center font-medium tracking-wide overflow-hidden",
        "bg-white/60 backdrop-blur-3xl dark:bg-zinc-900/60 ring-1 ring-black/5 dark:ring-white/10",
        "shadow-[0_8px_16px_-6px_rgba(0,0,0,0.05)]",
        "transition-all duration-500 hover:-translate-y-0.5",
        "select-none no-select tap-feedback",
        // Size
        sizeClasses[size],
        // Width
        fullWidth && "w-full",
        // Default state
        !isSuccess &&
          !isLoading && [
            "text-foreground",
            "active:scale-[0.96] active:shadow-none",
            "focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 dark:focus-visible:ring-offset-bgOnyx",
          ],
        // Loading state
        isLoading && [
          "text-foreground/40",
          "cursor-not-allowed",
        ],
        // Success state
        isSuccess && [
          "ring-status-success/30 bg-status-success/10 text-status-success",
        ],
        // Disabled
        disabled && !isLoading && "opacity-40 cursor-not-allowed",
        className,
      )}
      {...props}
    >
      {isLoading ? (
        <span className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
          <span>Processing…</span>
        </span>
      ) : (
        children
      )}
    </button>
  );
}
`,
  'card.tsx': `import type { PropsWithChildren } from "react";
import { cn } from "@/lib/utils/cn";

interface CardProps extends PropsWithChildren {
  className?: string;
  /** Elevates the card surface one level */
  elevated?: boolean;
  /** Adds a subtle glow on hover */
  interactive?: boolean;
}

export function Card({
  children,
  className,
  elevated,
  interactive,
}: CardProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[24px]",
        "bg-white/60 backdrop-blur-3xl dark:bg-zinc-900/60 ring-1 ring-black/5 dark:ring-white/10",
        elevated ? "shadow-[0_20px_40px_-10px_rgba(0,0,0,0.1)]" : "shadow-[0_8px_16px_-6px_rgba(0,0,0,0.05)]",
        interactive &&
          "cursor-pointer transition-all duration-500 hover:-translate-y-0.5 hover:shadow-[0_20px_40px_-10px_rgba(0,0,0,0.1)] active:scale-[0.99]",
        "before:absolute before:inset-x-0 before:top-0 before:h-px",
        "before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent",
        "dark:before:via-white/[0.08]",
        className,
      )}
    >
      <div className="relative z-10 p-5">{children}</div>
    </div>
  );
}
`,
  'empty-state.tsx': `import type { ReactNode } from "react";
import { FolderOpen } from "lucide-react";

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex animate-fade-in flex-col items-center justify-center space-y-5 rounded-[24px] bg-white/60 backdrop-blur-3xl dark:bg-zinc-900/60 ring-1 ring-black/5 dark:ring-white/10 shadow-[0_8px_16px_-6px_rgba(0,0,0,0.05)] px-6 py-14 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-black/[0.03] dark:bg-white/[0.04] ring-1 ring-black/5 dark:ring-white/10 shadow-[0_8px_16px_-6px_rgba(0,0,0,0.05)]">
        <FolderOpen
          className="h-6 w-6 text-muted"
          strokeWidth={1.5}
          aria-hidden
        />
      </div>

      <div className="max-w-[260px] space-y-2">
        <h2 className="font-sans text-base font-semibold text-foreground">
          {title}
        </h2>
        <p className="text-sm leading-relaxed text-muted">{description}</p>
      </div>

      {action ? (
        <div className="w-full max-w-[240px] pt-1">{action}</div>
      ) : null}
    </div>
  );
}
`,
  'custom-select.tsx': `"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils/cn";

export interface SelectOption {
  label: string;
  value: string;
}

interface CustomSelectProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  className?: string;
  disabled?: boolean;
}

export function CustomSelect({
  id,
  value,
  onChange,
  options,
  className,
  disabled = false,
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    function updateViewportMode() {
      setIsMobile(window.innerWidth < 640);
    }

    updateViewportMode();
    window.addEventListener("resize", updateViewportMode);

    return () => window.removeEventListener("resize", updateViewportMode);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  const selectedOption = options.find((opt) => opt.value === value);

  function handleSelect(nextValue: string) {
    onChange(nextValue);
    setIsOpen(false);
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          "flex w-full items-center justify-between text-left rounded-[16px]",
          "bg-white/60 backdrop-blur-3xl dark:bg-zinc-900/60 ring-1 ring-black/5 dark:ring-white/10",
          "shadow-[0_8px_16px_-6px_rgba(0,0,0,0.05)]",
          "transition-all duration-500 hover:-translate-y-0.5 px-4 py-3",
          disabled && "cursor-not-allowed opacity-60",
          className,
        )}
      >
        <span className="block truncate font-medium">
          {selectedOption?.label ?? "Select..."}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted transition-transform duration-500",
            isOpen && "rotate-180",
          )}
          strokeWidth={2}
        />
      </button>

      <AnimatePresence>
        {isOpen && !disabled ? (
          isMobile ? (
            <>
              <motion.button
                type="button"
                aria-label="Close select menu"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{
                  duration: 0.18,
                  ease: [0.16, 1, 0.3, 1] as const,
                }}
                className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
                onClick={() => setIsOpen(false)}
              />
              <motion.div
                initial={{ opacity: 0, y: 32 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 24 }}
                transition={{
                  duration: 0.24,
                  ease: [0.16, 1, 0.3, 1] as const,
                }}
                className="fixed inset-x-0 bottom-0 z-50 rounded-t-[32px] bg-white/60 backdrop-blur-3xl px-4 pb-[max(env(safe-area-inset-bottom),1rem)] pt-3 shadow-[0_20px_40px_-10px_rgba(0,0,0,0.1)] ring-1 ring-black/5 dark:bg-zinc-900/60 dark:ring-white/10"
              >
                <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-black/10 dark:bg-white/15" />
                <div className="mb-3 flex items-start justify-between gap-3 px-1">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                      Select option
                    </p>
                    <p className="mt-1 text-sm text-muted">
                      Choose an option from the list.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="rounded-full bg-white/60 backdrop-blur-3xl dark:bg-zinc-900/60 px-3 py-1.5 text-xs font-semibold text-foreground ring-1 ring-black/5 dark:ring-white/10 shadow-[0_8px_16px_-6px_rgba(0,0,0,0.05)] transition-all duration-500 hover:-translate-y-0.5"
                  >
                    Done
                  </button>
                </div>
                <div className="max-h-[min(60vh,28rem)] space-y-2 overflow-auto pb-1">
                  {options.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleSelect(option.value)}
                      className={cn(
                        "relative flex min-h-[56px] w-full items-center justify-between rounded-[20px] px-4 py-3 text-left text-[16px] font-medium transition-all duration-500 active:scale-[0.985] hover:-translate-y-0.5",
                        option.value === value
                          ? "bg-foreground/5 text-foreground ring-1 ring-black/5 dark:bg-white/10 dark:ring-white/10 shadow-[0_8px_16px_-6px_rgba(0,0,0,0.05)]"
                          : "bg-transparent text-foreground/85 hover:bg-foreground/5 dark:hover:bg-white/5",
                      )}
                    >
                      <span className="block truncate pr-3">
                        {option.label}
                      </span>
                      {option.value === value ? (
                        <Check className="h-4 w-4 shrink-0 text-foreground" strokeWidth={2} />
                      ) : null}
                    </button>
                  ))}
                </div>
              </motion.div>
            </>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.98 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] as const }}
              className="absolute z-50 mt-2 max-h-60 w-full overflow-auto rounded-[24px] bg-white/60 backdrop-blur-3xl p-2 shadow-[0_20px_40px_-10px_rgba(0,0,0,0.1)] ring-1 ring-black/5 dark:bg-zinc-900/60 dark:ring-white/10"
            >
              {options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelect(option.value)}
                  className={cn(
                    "relative flex w-full items-center justify-between rounded-[16px] px-3 py-2.5 text-left text-[14px] font-medium transition-all duration-500 active:scale-[0.98] hover:-translate-y-0.5",
                    option.value === value
                      ? "bg-foreground/5 text-foreground dark:bg-white/10 ring-1 ring-black/5 dark:ring-white/10 shadow-[0_8px_16px_-6px_rgba(0,0,0,0.05)]"
                      : "text-foreground/80 hover:bg-foreground/5 hover:text-foreground dark:hover:bg-white/5",
                  )}
                >
                  <span className="block truncate">{option.label}</span>
                  {option.value === value ? (
                    <Check className="h-4 w-4 shrink-0 text-foreground" strokeWidth={2} />
                  ) : null}
                </button>
              ))}
            </motion.div>
          )
        ) : null}
      </AnimatePresence>
    </div>
  );
}
`,
  'confirm-modal.tsx': `"use client";

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
`,
  'bottom-sheet.tsx': `"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils/cn";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export function BottomSheet({
  open,
  onClose,
  title,
  children,
}: BottomSheetProps) {
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

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 z-[190] bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{
              type: "spring",
              damping: 25,
              stiffness: 200,
              mass: 0.8,
            }}
            drag="y"
            dragConstraints={{ top: 0 }}
            dragElastic={0.05}
            onDragEnd={(e, info) => {
              if (info.offset.y > 100 || info.velocity.y > 500) {
                onClose();
              }
            }}
            className={cn(
              "fixed inset-x-0 bottom-0 z-[200] flex flex-col items-center",
              "w-full max-w-[600px] mx-auto overflow-hidden rounded-t-[32px]",
              "bg-white/60 backdrop-blur-3xl dark:bg-zinc-900/60 ring-1 ring-black/5 dark:ring-white/10",
              "shadow-[0_20px_40px_-10px_rgba(0,0,0,0.1)]",
            )}
          >
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent pointer-events-none" />

            <div className="w-full flex justify-center pt-3 pb-1 cursor-grab active:cursor-grabbing">
              <div className="w-12 h-1.5 rounded-full bg-black/15 dark:bg-white/20" />
            </div>

            {title && (
              <div className="w-full px-6 pt-2 pb-4 text-center border-b border-black/5 dark:border-white/5">
                <h3 className="text-[17px] font-semibold tracking-[-0.43px] text-foreground">
                  {title}
                </h3>
              </div>
            )}

            <div className="w-full px-6 py-6 overflow-y-auto max-h-[75vh] safe-pb">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
`
};

for (const [filename, content] of Object.entries(files)) {
  fs.writeFileSync(path.join(basePath, filename), content);
  console.log(`Updated ${filename}`);
}
