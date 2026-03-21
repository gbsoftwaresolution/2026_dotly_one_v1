"use client";

import type { ReactNode } from "react";

import { useId, useState } from "react";

import { Eye, EyeOff } from "lucide-react";

import { cn } from "@/lib/utils/cn";

const INPUT_CLASSES =
  "min-h-12 w-full rounded-2xl border border-border bg-surface px-4 pr-12 text-sm font-medium text-foreground outline-none backdrop-blur-xl transition-all focus:border-brandRose focus:ring-2 focus:ring-brandRose/20 dark:focus:border-brandCyan dark:focus:ring-brandCyan/20 placeholder:text-muted/50";

interface PasswordFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  autoComplete: string;
  minLength?: number;
  maxLength?: number;
  error?: string | null;
  footer?: ReactNode;
}

export function PasswordField({
  id,
  label,
  value,
  onChange,
  placeholder,
  autoComplete,
  minLength,
  maxLength,
  error,
  footer,
}: PasswordFieldProps) {
  const [isVisible, setIsVisible] = useState(false);
  const footerId = useId();
  const errorId = useId();
  const describedBy = [footer ? footerId : null, error ? errorId : null]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="space-y-1.5">
      <label className="label-xs" htmlFor={id}>
        {label}
      </label>

      <div className="relative">
        <input
          id={id}
          required
          minLength={minLength}
          maxLength={maxLength}
          autoComplete={autoComplete}
          className={cn(
            INPUT_CLASSES,
            error &&
              "border-rose-500/60 focus:border-rose-500 focus:ring-rose-500/20 dark:focus:border-rose-400 dark:focus:ring-rose-400/20",
          )}
          placeholder={placeholder}
          type={isVisible ? "text" : "password"}
          value={value}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          onChange={(event) => onChange(event.target.value)}
        />

        <button
          type="button"
          aria-label={`${isVisible ? "Hide" : "Show"} ${label.toLowerCase()}`}
          className="absolute inset-y-0 right-0 inline-flex items-center justify-center px-4 text-muted transition-colors hover:text-foreground"
          onClick={() => setIsVisible((current) => !current)}
        >
          {isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>

      {footer ? (
        <div id={footerId} className="text-xs leading-5 text-muted">
          {footer}
        </div>
      ) : null}

      {error ? (
        <p id={errorId} className="text-xs font-medium text-rose-500 dark:text-rose-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}