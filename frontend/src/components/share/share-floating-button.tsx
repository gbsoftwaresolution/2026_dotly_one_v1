"use client";

import { useEffect, useState } from "react";
import { QrCode, X } from "lucide-react";

import { prefetchMyFastShare } from "@/lib/share-fast-store";

import { InstantShareExperience } from "./instant-share-experience";

export function ShareFloatingButton() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    void prefetchMyFastShare().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    void prefetchMyFastShare().catch(() => undefined);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-[calc(env(safe-area-inset-bottom)+5.75rem)] right-4 z-[60] inline-flex min-h-14 items-center gap-2 rounded-full border border-black/10 bg-black px-5 text-sm font-semibold text-white shadow-[0_18px_45px_rgba(15,23,42,0.25)] transition-transform duration-200 hover:scale-[1.01] active:scale-[0.98] dark:border-white/10 dark:bg-white dark:text-black sm:right-6"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls="instant-share-sheet"
      >
        <QrCode className="h-4 w-4" aria-hidden />
        <span>Show QR</span>
      </button>

      {isOpen ? (
        <div
          className="fixed inset-0 z-[80] bg-black/45 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        >
          <div
            id="instant-share-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Instant share"
            className="absolute inset-0 overflow-y-auto"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-black/[0.06] bg-white/85 px-4 py-4 backdrop-blur-2xl dark:border-white/[0.08] dark:bg-bgOnyx/85 sm:px-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-zinc-500">
                  Share
                </p>
                <h2 className="text-xl font-semibold tracking-tight text-slate-950 dark:text-white">
                  Show your QR
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/10 text-slate-600 transition-colors hover:bg-black/5 dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/5"
                aria-label="Close share"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>

            <div className="mx-auto max-w-2xl px-4 py-4 sm:px-6 sm:py-6">
              <InstantShareExperience />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
