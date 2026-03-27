"use client";

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
