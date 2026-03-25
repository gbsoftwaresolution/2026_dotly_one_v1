"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { contactsApi } from "@/lib/api";
import { ApiError } from "@/lib/api/client";
import { cn } from "@/lib/utils/cn";

const MAX_NOTE_LENGTH = 2000;
const MAX_TEXTAREA_HEIGHT = 240;
const AUTO_SAVE_DELAY_MS = 450;

interface NoteEditorProps {
  relationshipId: string;
  initialNote: string | null;
  disabled?: boolean;
}

function toCanonicalValue(value: string) {
  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : "";
}

export function NoteEditor({
  relationshipId,
  initialNote,
  disabled = false,
}: NoteEditorProps) {
  const [value, setValue] = useState(initialNote ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const savedValueRef = useRef(initialNote ?? "");
  const saveTimeoutRef = useRef<number | null>(null);
  const lastAttemptedValueRef = useRef<string | null>(null);

  const clearScheduledSave = useCallback(() => {
    if (saveTimeoutRef.current !== null) {
      window.clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
  }, []);

  const resizeTextarea = useCallback(() => {
    const textarea = textareaRef.current;

    if (!textarea) {
      return;
    }

    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`;
    textarea.style.overflowY =
      textarea.scrollHeight > MAX_TEXTAREA_HEIGHT ? "auto" : "hidden";
  }, []);

  useEffect(() => {
    const canonicalValue = initialNote ?? "";
    setValue(canonicalValue);
    savedValueRef.current = canonicalValue;
    lastAttemptedValueRef.current = null;
  }, [initialNote]);

  useEffect(() => {
    resizeTextarea();
  }, [resizeTextarea, value]);

  useEffect(() => clearScheduledSave, [clearScheduledSave]);

  useEffect(() => {
    if (feedback?.tone === "success") {
      const timer = setTimeout(() => setFeedback(null), 2000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  const handleSave = useCallback(
    async (force = false) => {
      if (isSaving || disabled) {
        return;
      }

      const canonicalValue = toCanonicalValue(value);
      const note = canonicalValue === "" ? null : canonicalValue;

      if (canonicalValue === savedValueRef.current) {
        setValue(canonicalValue);
        setFeedback(null);
        return;
      }

      if (!force && canonicalValue === lastAttemptedValueRef.current) {
        return;
      }

      setFeedback(null);
      setIsSaving(true);
      lastAttemptedValueRef.current = canonicalValue;

      try {
        const result = await contactsApi.updateNote(relationshipId, { note });
        const nextValue = result.note ?? "";
        setValue(nextValue);
        savedValueRef.current = nextValue;
        setFeedback({ tone: "success", message: "Saved" });
      } catch (error) {
        setFeedback({
          tone: "error",
          message:
            error instanceof ApiError ? error.message : "Not saved. Try again.",
        });
      } finally {
        setIsSaving(false);
      }
    },
    [disabled, isSaving, relationshipId, value],
  );

  useEffect(() => {
    const canonicalValue = toCanonicalValue(value);

    if (
      disabled ||
      isSaving ||
      canonicalValue === savedValueRef.current ||
      canonicalValue === lastAttemptedValueRef.current
    ) {
      return;
    }

    clearScheduledSave();
    saveTimeoutRef.current = window.setTimeout(() => {
      saveTimeoutRef.current = null;
      void handleSave();
    }, AUTO_SAVE_DELAY_MS);

    return clearScheduledSave;
  }, [clearScheduledSave, disabled, handleSave, isSaving, value]);

  const statusMessage =
    isSaving || feedback?.tone === "success"
      ? isSaving
        ? { tone: "success" as const, message: "Saving..." }
        : feedback
      : null;

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <label htmlFor="contact-note" className="sr-only">
          Private note
        </label>
        <textarea
          ref={textareaRef}
          id="contact-note"
          aria-label="Private note"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            lastAttemptedValueRef.current = null;
            setFeedback(null);
          }}
          onBlur={() => {
            clearScheduledSave();
            void handleSave(true);
          }}
          disabled={disabled}
          placeholder="Jot the one detail you will want later"
          rows={4}
          maxLength={MAX_NOTE_LENGTH}
          className={cn(
            "max-h-[240px] min-h-[112px] w-full resize-none rounded-2xl bg-foreground/[0.03] px-4 py-3 font-sans text-base leading-7 text-foreground placeholder:text-muted/60 shadow-inner ring-1 ring-inset ring-black/5 transition-all focus:bg-foreground/[0.05] focus:outline-none focus:ring-black/10 dark:bg-white/[0.045] dark:ring-white/5 dark:focus:bg-white/[0.06]",
            disabled ? "cursor-not-allowed opacity-70" : "",
          )}
        />
        <div className="flex items-center justify-between gap-3 px-1">
          <p className="font-sans text-xs text-muted">
            Private to you. Saved automatically.
          </p>
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted">
            {value.length}/{MAX_NOTE_LENGTH}
          </p>
        </div>
      </div>

      {feedback?.tone === "error" ? (
        <div className="rounded-2xl bg-rose-500/5 px-4 py-3 ring-1 ring-inset ring-rose-500/20">
          <p className="text-sm text-rose-600 dark:text-rose-400">
            {feedback.message}
          </p>
        </div>
      ) : disabled ? (
        <div className="rounded-2xl bg-amber-500/5 px-4 py-3 ring-1 ring-inset ring-amber-500/20">
          <p className="font-sans text-sm text-amber-600 dark:text-amber-400">
            This private note is locked because the connection window has
            closed.
          </p>
        </div>
      ) : null}

      <div className="min-h-5 px-1">
        {statusMessage ? (
          <p
            role="status"
            className={cn(
              "text-sm transition-colors",
              feedback?.tone === "error"
                ? "text-rose-600 dark:text-rose-400"
                : "text-muted",
            )}
          >
            {statusMessage.message}
          </p>
        ) : null}
      </div>
    </div>
  );
}
