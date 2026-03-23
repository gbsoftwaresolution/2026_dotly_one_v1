"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { PrimaryButton } from "@/components/shared/primary-button";
import { contactsApi } from "@/lib/api";
import { ApiError } from "@/lib/api/client";
import { cn } from "@/lib/utils/cn";

const MAX_NOTE_LENGTH = 1000;

interface NoteEditorProps {
  relationshipId: string;
  initialNote: string | null;
  disabled?: boolean;
}

export function NoteEditor({
  relationshipId,
  initialNote,
  disabled = false,
}: NoteEditorProps) {
  const router = useRouter();
  const [value, setValue] = useState(initialNote ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);

  const savedValueRef = useRef(initialNote ?? "");
  const isDirty = value !== savedValueRef.current;

  useEffect(() => {
    if (feedback?.tone === "success") {
      const timer = setTimeout(() => setFeedback(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  const handleSave = useCallback(async () => {
    if (!isDirty || isSaving || disabled) return;
    setFeedback(null);
    setIsSaving(true);

    try {
      const note = value.trim() === "" ? null : value.trim();
      const result = await contactsApi.updateNote(relationshipId, { note });
      const canonicalValue = result.note ?? "";
      setValue(canonicalValue);
      savedValueRef.current = canonicalValue;
      setFeedback({ tone: "success", message: "Note saved" });
    } catch (error) {
      setFeedback({
        tone: "error",
        message:
          error instanceof ApiError
            ? error.message
            : "Could not save your note right now.",
      });
    } finally {
      setIsSaving(false);
    }
  }, [disabled, isDirty, isSaving, relationshipId, router, value]);

  const charsLeft = MAX_NOTE_LENGTH - value.length;
  const isOverLimit = charsLeft < 0;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label
          htmlFor="contact-note"
          className="font-mono text-[10px] font-semibold uppercase tracking-widest text-brandRose dark:text-brandCyan"
        >
          Connection note
        </label>
        <textarea
          id="contact-note"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setFeedback(null);
          }}
          disabled={disabled}
          placeholder="Add a memory or context note..."
          rows={5}
          maxLength={MAX_NOTE_LENGTH + 1} // allow typing past limit to show error
          className={cn(
            "w-full resize-none rounded-2xl border border-border bg-surface px-4 py-4 font-sans text-sm leading-6 text-foreground placeholder:text-muted/60 transition-all focus:border-brandRose focus:outline-none focus:ring-2 focus:ring-brandRose/20 dark:focus:border-brandCyan dark:focus:ring-brandCyan/20",
            isOverLimit
              ? "border-rose-300 focus:ring-rose-400 dark:border-rose-800"
              : "",
          )}
        />
        <div className="flex items-center justify-between gap-3 px-1">
          <span
            className={cn(
              "font-mono text-[10px] uppercase tracking-widest",
              isOverLimit ? "text-rose-500" : "text-muted",
            )}
          >
            {isOverLimit
              ? `${Math.abs(charsLeft)} chars over`
              : `${charsLeft} chars remaining`}
          </span>
        </div>
      </div>

      {feedback?.tone === "error" ? (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3">
          <p className="font-mono text-sm text-rose-500 dark:text-rose-400">
            {feedback.message}
          </p>
        </div>
      ) : disabled ? (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <p className="font-sans text-sm text-amber-600 dark:text-amber-400">
            Notes are locked because this connection window has closed.
          </p>
        </div>
      ) : null}

      <div className="pt-2">
        {feedback?.tone === "success" ? (
          <div className="flex h-[60px] w-full items-center justify-center rounded-2xl bg-brandRose/10 px-5 font-sans text-sm font-bold text-brandRose dark:bg-brandCyan/10 dark:text-brandCyan">
            {feedback.message}
          </div>
        ) : isDirty && !isOverLimit ? (
          <PrimaryButton
            type="button"
            disabled={isSaving}
            onClick={() => void handleSave()}
            className="h-[60px] w-full"
          >
            {isSaving ? "Saving..." : "Save note"}
          </PrimaryButton>
        ) : null}
      </div>
    </div>
  );
}
