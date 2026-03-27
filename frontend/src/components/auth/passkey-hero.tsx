"use client";

import { Fingerprint, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { PrimaryButton } from "@/components/shared/primary-button";
import { SecondaryButton } from "@/components/shared/secondary-button";
import {
  APP_DATA_WARM_ROUTES,
  prefetchAppCoreData,
} from "@/lib/app-data-store";
import { routes } from "@/lib/constants/routes";
import { prefetchMyFastShare } from "@/lib/share-fast-store";
import { usePasskeyFlow } from "@/lib/passkeys/use-passkey-flow";

function sanitizeRedirectPath(path: string): string {
  if (!path.startsWith("/") || path.startsWith("//")) {
    return routes.app.home;
  }

  return path;
}

export function PasskeyHero({
  redirectTo,
  initialEmail,
  onUsePassword,
}: {
  redirectTo: string;
  initialEmail?: string;
  onUsePassword: () => void;
}) {
  const router = useRouter();
  const { supported, isAuthenticating, error, clearError, authenticate } =
    usePasskeyFlow();
  const [localMessage, setLocalMessage] = useState<string | null>(null);

  function completeLoginRedirect(nextPath: string) {
    for (const route of APP_DATA_WARM_ROUTES) {
      router.prefetch(route);
    }

    router.prefetch(nextPath);
    void prefetchMyFastShare({ force: true }).catch(() => undefined);
    void prefetchAppCoreData({ force: true }).catch(() => undefined);
    router.replace(nextPath);
  }

  async function handlePasskeySignIn() {
    clearError();
    setLocalMessage(null);

    try {
      await authenticate(initialEmail);
      completeLoginRedirect(sanitizeRedirectPath(redirectTo));
    } catch (passkeyError) {
      setLocalMessage(
        passkeyError instanceof Error
          ? passkeyError.message
          : "Passkey sign-in did not complete.",
      );
    }
  }

  return (
    <div className="mb-8 rounded-[2rem] border border-black/5 bg-[linear-gradient(135deg,rgba(12,18,28,0.96),rgba(26,39,57,0.94))] p-6 text-white shadow-[0_18px_60px_rgba(12,18,28,0.28)] dark:border-white/10 dark:bg-[linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/80">
            <Sparkles className="h-3.5 w-3.5" />
            Passkey first
          </div>
          <div>
            <h3 className="text-[24px] font-semibold tracking-tight text-white">
              Sign in the premium way.
            </h3>
            <p className="mt-2 max-w-[36ch] text-sm leading-6 text-white/75">
              Use a passkey for the calmest return to Dotly. Your password stays
              available whenever you need it.
            </p>
          </div>
        </div>
        <div className="rounded-2xl border border-white/12 bg-white/8 p-3">
          <Fingerprint className="h-7 w-7 text-white" strokeWidth={1.75} />
        </div>
      </div>

      <div className="mt-5 space-y-3">
        <PrimaryButton
          type="button"
          fullWidth
          size="lg"
          className="bg-white text-slate-950 hover:scale-[0.995]"
          isLoading={isAuthenticating}
          disabled={!supported}
          onClick={() => void handlePasskeySignIn()}
        >
          {supported ? "Continue with passkey" : "Passkeys unavailable here"}
        </PrimaryButton>

        <SecondaryButton
          type="button"
          fullWidth
          className="border border-white/12 bg-white/8 text-white hover:bg-white/12"
          onClick={onUsePassword}
        >
          Use email and password instead
        </SecondaryButton>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs text-white/65">
        <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1">
          Face ID and Touch ID ready
        </span>
        <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1">
          Password fallback preserved
        </span>
      </div>

      {error || localMessage ? (
        <p className="mt-4 text-sm leading-6 text-amber-100">
          {localMessage ?? error}
        </p>
      ) : null}
    </div>
  );
}
