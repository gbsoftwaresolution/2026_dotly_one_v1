"use client";

import type { ReactNode } from "react";

import { useId, useState } from "react";

import { Eye, EyeOff } from "lucide-react";

import { cn } from "@/lib/utils/cn";

const INPUT_CLASSES =
  "min-h-[56px] w-full rounded-[16px] bg-foreground/[0.03] px-4 pr-12 pt-1 text-[16px] font-medium text-foreground outline-none transition-all duration-300 shadow-inner ring-1 ring-black/5 placeholder:text-muted/50 focus:bg-foreground/[0.045] focus:ring-2 focus:ring-foreground/15 focus:shadow-md dark:bg-white/[0.045] dark:ring-white/10 dark:focus:bg-white/[0.07]";

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
    <div className="space-y-2">
      <label className="text-[13px] font-medium text-muted ml-4" htmlFor={id}>
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
              "bg-status-error/5 ring-status-error/40 focus:ring-status-error",
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
          className="absolute inset-y-0 right-0 inline-flex items-center justify-center px-4 text-muted/70 transition-colors hover:text-foreground tap-feedback"
          onClick={() => setIsVisible((current) => !current)}
        >
          {isVisible ? (
            <EyeOff className="h-5 w-5" strokeWidth={1.5} />
          ) : (
            <Eye className="h-5 w-5" strokeWidth={1.5} />
          )}
        </button>
      </div>

      {footer ? (
        <div
          id={footerId}
          className="text-[13px] leading-relaxed text-muted px-1"
        >
          {footer}
        </div>
      ) : null}

      {error ? (
        <p
          id={errorId}
          className="text-[13px] font-medium text-status-error px-1"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
