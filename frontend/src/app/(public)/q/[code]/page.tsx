import type { Metadata } from "next";

import { QuickConnectFlow } from "@/components/qr/quick-connect-flow";
import { PublicQrPreviewCard } from "@/components/qr/public-qr-preview-card";
import { Card } from "@/components/shared/card";
import { qrApi } from "@/lib/api";
import { personaApi } from "@/lib/api/persona-api";
import { ApiError } from "@/lib/api/client";
import { getServerAccessToken } from "@/lib/auth/server-session";
import { routes } from "@/lib/constants/routes";
import { headers } from "next/headers";

export const metadata: Metadata = {
  title: "Dotly Profile",
};

function getQrErrorCopy(error: ApiError) {
  const loweredMessage = error.message.toLowerCase();

  if (error.status === 404) {
    return {
      title: "QR not found",
      description: "This QR code does not exist or is no longer valid.",
    };
  }

  if (loweredMessage.includes("usage limit")) {
    return {
      title: "QR exhausted",
      description: "This QR link has reached its usage limit.",
    };
  }

  if (loweredMessage.includes("disabled")) {
    return {
      title: "QR disabled",
      description:
        "This QR code has been disabled and can no longer be opened.",
    };
  }

  if (loweredMessage.includes("not active yet")) {
    return {
      title: "QR not active yet",
      description:
        "This QR code is not active yet. Try opening it again later.",
    };
  }

  if (loweredMessage.includes("expired")) {
    return {
      title: "QR expired",
      description: "This QR code has expired and can no longer be opened.",
    };
  }

  return {
    title: "QR no longer available",
    description: error.message,
  };
}

function ErrorState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="w-full h-full flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-[2rem] border border-rose-200 dark:border-rose-900/50 bg-rose-50/80 dark:bg-rose-950/20 text-center p-8 space-y-3">
        <h1 className="text-2xl font-bold tracking-tight text-rose-700 dark:text-rose-400">
          {title}
        </h1>
        <p className="text-sm leading-6 text-rose-700/90 dark:text-rose-400/80">
          {description}
        </p>
      </div>
    </div>
  );
}

function LoginPrompt({
  code,
  hostName,
  hostJobTitle,
  hostCompany,
  invalidSession = false,
}: {
  code: string;
  hostName: string;
  hostJobTitle: string;
  hostCompany: string;
  invalidSession?: boolean;
}) {
  const loginUrl = `${routes.public.login}?next=${encodeURIComponent(`/q/${code}`)}`;

  return (
    <Card className="space-y-5 rounded-[2rem] border-border/70 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
      <div className="space-y-2">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-muted">
          Connect
        </p>
        <h2 className="font-sans text-xl font-bold text-foreground">
          Continue with {hostName}
        </h2>
        <p className="font-sans text-sm text-muted">
          {hostJobTitle} at {hostCompany}
        </p>
      </div>

      <p className="font-sans text-sm leading-6 text-muted">
        {invalidSession
          ? "Your session expired. Log in again to continue."
          : "Log in or get your Dotly to continue."}
      </p>

      <div className="space-y-3">
        <a
          href={loginUrl}
          className="inline-flex w-full items-center justify-center rounded-2xl bg-brandRose py-5 px-5 text-sm font-bold text-white transition-all hover:opacity-90 active:scale-95 dark:bg-brandCyan dark:text-zinc-950 focus:outline-none focus:ring-2 focus:ring-brandRose dark:focus:ring-brandCyan focus:ring-offset-2"
        >
          Log in to continue
        </a>
        <a
          href={`${routes.public.signup}?next=${encodeURIComponent(`/q/${code}`)}`}
          className="inline-flex w-full items-center justify-center rounded-2xl border border-border bg-white py-5 px-5 text-sm font-semibold text-foreground transition-all hover:bg-slate-50 active:scale-95 dark:bg-zinc-950 dark:hover:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-border focus:ring-offset-2"
        >
          Get your Dotly
        </a>
      </div>
    </Card>
  );
}

function NoPersonasPrompt() {
  return (
    <Card className="space-y-4 rounded-[2rem] border-border/70 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
      <div className="space-y-2">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-muted">
          Connect
        </p>
        <h2 className="font-sans text-lg font-semibold text-foreground">
          Get your Dotly first
        </h2>
        <p className="font-sans text-sm leading-6 text-muted">
          You need a Dotly before you can continue this introduction.
        </p>
      </div>
      <a
        href={routes.app.createPersona}
        className="inline-flex w-full items-center justify-center rounded-2xl bg-brandRose py-5 px-5 text-sm font-bold text-white transition-all hover:opacity-90 active:scale-95 dark:bg-brandCyan dark:text-zinc-950 focus:outline-none focus:ring-2 focus:ring-brandRose dark:focus:ring-brandCyan focus:ring-offset-2"
      >
        Get your Dotly
      </a>
    </Card>
  );
}

export default async function QrLandingPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  try {
    const requestHeaders = await headers();
    const qr = await qrApi.resolveQr(code, {
      "user-agent": requestHeaders.get("user-agent") ?? "",
      "accept-language": requestHeaders.get("accept-language") ?? "",
      "x-forwarded-for": requestHeaders.get("x-forwarded-for") ?? "",
      "x-idempotency-key": requestHeaders.get("x-idempotency-key") ?? "",
    });
    const isQuickConnect = qr.type === "quick_connect";

    // For profile QRs preserve Phase 2 behavior unchanged
    if (!isQuickConnect) {
      return (
        <main className="relative flex min-h-screen w-full flex-col bg-[#F8FAFC] dark:bg-[#050505] text-slate-900 dark:text-white selection:bg-black selection:text-white dark:selection:bg-white dark:selection:text-black">
          <div className="flex flex-1 items-center justify-center p-4 sm:p-6 lg:p-8">
            <div className="w-full max-w-lg">
              <PublicQrPreviewCard qr={qr} />
            </div>
          </div>
        </main>
      );
    }

    // Connect flow: detect auth state
    const accessToken = await getServerAccessToken();
    const isAuthenticated = !!accessToken;
    let hasValidSession = isAuthenticated;

    let personas: Awaited<ReturnType<typeof personaApi.list>> = [];

    if (isAuthenticated) {
      try {
        personas = await personaApi.list(accessToken);
      } catch {
        hasValidSession = false;
        personas = [];
      }
    }

    const { persona } = qr;

    return (
      <main className="relative flex min-h-screen w-full flex-col bg-[#F8FAFC] dark:bg-[#050505] text-slate-900 dark:text-white selection:bg-black selection:text-white dark:selection:bg-white dark:selection:text-black">
        <div className="flex flex-1 items-center justify-center p-4 sm:p-6 lg:p-8">
          <div className="w-full max-w-5xl">
            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)] md:items-start">
              <PublicQrPreviewCard qr={qr} />

              {!hasValidSession ? (
                <LoginPrompt
                  code={code}
                  hostName={persona.fullName}
                  hostJobTitle={persona.jobTitle}
                  hostCompany={persona.companyName}
                  invalidSession={isAuthenticated}
                />
              ) : personas.length === 0 ? (
                <NoPersonasPrompt />
              ) : (
                <QuickConnectFlow
                  code={code}
                  personas={personas}
                  hostName={persona.fullName}
                  hostJobTitle={persona.jobTitle}
                  hostCompany={persona.companyName}
                />
              )}
            </div>
          </div>
        </div>
      </main>
    );
  } catch (error) {
    if (error instanceof ApiError) {
      const errorCopy = getQrErrorCopy(error);

      return (
        <main className="relative flex min-h-screen w-full flex-col bg-[#F8FAFC] dark:bg-[#050505]">
          <ErrorState
            title={errorCopy.title}
            description={errorCopy.description}
          />
        </main>
      );
    }

    return (
      <main className="relative flex min-h-screen w-full flex-col bg-[#F8FAFC] dark:bg-[#050505]">
        <ErrorState
          title="QR no longer available"
          description="We could not load this QR preview right now. Please try again later."
        />
      </main>
    );
  }
}
