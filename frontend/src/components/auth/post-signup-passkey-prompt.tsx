"use client";

import { Fingerprint, ShieldCheck, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { PrimaryButton } from "@/components/shared/primary-button";
import { SecondaryButton } from "@/components/shared/secondary-button";
import { authApi } from "@/lib/api";
import { getPasskeyErrorMessage } from "@/lib/passkeys/errors";
import { POST_SIGNUP_PASSKEY_QUERY_PARAM } from "@/lib/passkeys/post-signup-enrollment";
import { usePasskeyFlow } from "@/lib/passkeys/use-passkey-flow";

type FeedbackTone = "success" | "warning" | "error";

type FeedbackState = {
  tone: FeedbackTone;
  message: string;
} | null;

function buildPromptQueryString(searchParams: { toString(): string }): string {
  const nextParams = new URLSearchParams(searchParams.toString());

  nextParams.delete(POST_SIGNUP_PASSKEY_QUERY_PARAM);

  const query = nextParams.toString();

  return query ? `?${query}` : "";
}

export function PostSignupPasskeyPrompt({
  initialPasskeyCount,
}: {
  initialPasskeyCount?: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { supported, isRegistering, register } = usePasskeyFlow();
  const [isOpen, setIsOpen] = useState(false);
  const [passkeyCount, setPasskeyCount] = useState(initialPasskeyCount ?? 0);
  const [isRefreshingPasskeys, setIsRefreshingPasskeys] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [hasCompletedRegistration, setHasCompletedRegistration] =
    useState(false);

  const promptRequested =
    searchParams.get(POST_SIGNUP_PASSKEY_QUERY_PARAM) === "1";
  const hasPasskey = passkeyCount > 0;

  const cleanedPath = useMemo(() => {
    const query = buildPromptQueryString(searchParams);
    return `${pathname}${query}`;
  }, [pathname, searchParams]);

  useEffect(() => {
    setPasskeyCount(initialPasskeyCount ?? 0);
  }, [initialPasskeyCount]);

  useEffect(() => {
    if (!promptRequested) {
      setHasCompletedRegistration(false);
      setFeedback(null);
    }
  }, [promptRequested]);

  useEffect(() => {
    if (!promptRequested || (hasPasskey && !hasCompletedRegistration)) {
      setIsOpen(false);
      return;
    }

    setIsOpen(true);
  }, [hasCompletedRegistration, hasPasskey, promptRequested]);

  useEffect(() => {
    if (!promptRequested || initialPasskeyCount !== undefined) {
      return;
    }

    let isMounted = true;

    async function loadPasskeys() {
      setIsRefreshingPasskeys(true);

      try {
        const result = await authApi.listPasskeys();

        if (!isMounted) {
          return;
        }

        setPasskeyCount(result.passkeys.length);
      } catch {
        if (!isMounted) {
          return;
        }

        setFeedback({
          tone: "warning",
          message:
            "Unable to check your passkeys right now. You can still finish setup from Settings.",
        });
      } finally {
        if (isMounted) {
          setIsRefreshingPasskeys(false);
        }
      }
    }

    void loadPasskeys();

    return () => {
      isMounted = false;
    };
  }, [initialPasskeyCount, promptRequested]);

  function closePrompt() {
    setHasCompletedRegistration(false);
    setIsOpen(false);
    router.replace(cleanedPath, { scroll: false });
  }

  async function handleEnroll() {
    setFeedback(null);

    try {
      const result = await register("Dotly passkey 1");
      setHasCompletedRegistration(true);
      setPasskeyCount((current) => Math.max(current, 1));
      setFeedback({
        tone: "success",
        message: `Passkey added. ${result.passkey.name} is ready for your next sign-in.`,
      });
      window.setTimeout(() => {
        closePrompt();
      }, 700);
    } catch (error) {
      setFeedback({
        tone: supported ? "warning" : "error",
        message:
          error instanceof Error && error.message
            ? error.message
            : getPasskeyErrorMessage(error),
      });
    }
  }

  if (
    !promptRequested ||
    (!hasCompletedRegistration && hasPasskey) ||
    !isOpen
  ) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[210] flex items-end justify-center bg-[rgba(7,11,18,0.46)] px-4 pb-4 pt-12 backdrop-blur-xl sm:items-center sm:p-6">
      <div
        aria-hidden="true"
        className="absolute inset-0"
        onClick={closePrompt}
      />

      <section className="relative w-full max-w-[30rem] overflow-hidden rounded-[2rem] border border-white/50 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(244,247,251,0.94))] p-6 shadow-[0_28px_90px_rgba(7,11,18,0.28)] ring-1 ring-black/5 dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(17,20,26,0.98),rgba(10,12,17,0.96))] dark:ring-white/10 sm:p-7">
        <div className="absolute inset-x-8 top-0 h-24 rounded-full bg-[radial-gradient(circle,rgba(90,143,255,0.18),transparent_72%)] blur-2xl" />
        <button
          type="button"
          aria-label="Dismiss passkey setup"
          className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/[0.04] text-foreground/70 transition hover:bg-black/[0.06] hover:text-foreground dark:bg-white/[0.06] dark:hover:bg-white/[0.1]"
          onClick={closePrompt}
        >
          <X className="h-4 w-4" />
        </button>

        <div className="relative space-y-5">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-[1.25rem] bg-[linear-gradient(135deg,rgba(20,33,61,0.96),rgba(59,94,155,0.88))] text-white shadow-[0_16px_40px_rgba(20,33,61,0.28)]">
            <Fingerprint className="h-5 w-5" />
          </div>

          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-black/[0.04] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/70 dark:bg-white/[0.06] dark:text-white/70">
              <Sparkles className="h-3.5 w-3.5" />
              Finish setup
            </div>
            <div className="space-y-2">
              <h2 className="text-[1.7rem] font-semibold tracking-tight text-foreground">
                Add your Dotly passkey now
              </h2>
              <p className="max-w-[30ch] text-sm leading-6 text-muted">
                You&apos;re signed in. One quick passkey setup makes your next
                Dotly return faster, calmer, and device-trusted.
              </p>
            </div>
          </div>

          <div className="grid gap-3 rounded-[1.5rem] bg-black/[0.03] p-4 ring-1 ring-black/5 dark:bg-white/[0.04] dark:ring-white/10">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-4.5 w-4.5 text-foreground/75" />
              <p className="text-sm leading-6 text-foreground/85">
                Use Face ID, Touch ID, your phone, or a security key with
                Dotly&apos;s existing passkey flow.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 h-4.5 w-4.5 text-foreground/75" />
              <p className="text-sm leading-6 text-foreground/85">
                Skip for now if you need to keep moving. You can always add one
                later in Settings.
              </p>
            </div>
          </div>

          {feedback ? (
            <div
              className={[
                "rounded-[1.25rem] px-4 py-3 text-sm leading-6 ring-1",
                feedback.tone === "success"
                  ? "bg-status-success/10 text-status-success ring-status-success/20"
                  : null,
                feedback.tone === "warning"
                  ? "bg-status-warning/10 text-status-warning ring-status-warning/20"
                  : null,
                feedback.tone === "error"
                  ? "bg-status-error/10 text-status-error ring-status-error/20"
                  : null,
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {feedback.message}
            </div>
          ) : null}

          {!supported ? (
            <div className="rounded-[1.25rem] bg-status-warning/10 px-4 py-3 text-sm leading-6 text-status-warning ring-1 ring-status-warning/20">
              This browser or device can&apos;t create a passkey here yet. You
              can dismiss this and add one later from a supported device.
            </div>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row">
            <PrimaryButton
              type="button"
              size="lg"
              className="w-full"
              onClick={() => void handleEnroll()}
              disabled={!supported || isRefreshingPasskeys}
              isLoading={isRegistering}
            >
              Add passkey
            </PrimaryButton>
            <SecondaryButton
              type="button"
              size="lg"
              className="w-full"
              onClick={closePrompt}
              disabled={isRegistering}
            >
              Maybe later
            </SecondaryButton>
          </div>
        </div>
      </section>
    </div>
  );
}
