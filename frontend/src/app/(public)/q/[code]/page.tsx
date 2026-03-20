import type { Metadata } from "next";

import { PublicQrPreviewCard } from "@/components/qr/public-qr-preview-card";
import { qrApi } from "@/lib/api";
import { ApiError } from "@/lib/api/client";

export const metadata: Metadata = {
  title: "Identity Card",
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
      description: "This Quick Connect QR has reached its usage limit.",
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

export default async function QrLandingPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  try {
    const qr = await qrApi.resolveQr(code);
    const isQuickConnect = qr.type === "quick_connect";

    return (
      <main className="relative flex min-h-screen w-full flex-col bg-[#F8FAFC] dark:bg-[#050505] text-slate-900 dark:text-white selection:bg-black selection:text-white dark:selection:bg-white dark:selection:text-black">
        {isQuickConnect && (
          <div className="flex w-full items-center justify-center bg-amber-400 px-4 py-2 text-xs font-bold uppercase tracking-widest text-black">
            LIT - Quick Connect
          </div>
        )}
        <div className="flex flex-1 items-center justify-center p-4 sm:p-6 lg:p-8">
          <div className="w-full max-w-md">
            <PublicQrPreviewCard qr={qr} />
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
