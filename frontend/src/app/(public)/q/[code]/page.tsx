import type { Metadata } from "next";

import { PublicQrPreviewCard } from "@/components/qr/public-qr-preview-card";
import { Card } from "@/components/shared/card";
import { qrApi } from "@/lib/api";
import { ApiError } from "@/lib/api/client";

export const metadata: Metadata = {
  title: "QR Preview",
};

function ErrorState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="w-full max-w-md">
      <Card className="border-rose-200 bg-rose-50/80 text-center">
        <div className="space-y-2 py-8">
          <h1 className="text-xl font-semibold text-rose-700">{title}</h1>
          <p className="text-sm leading-6 text-rose-700/90">{description}</p>
        </div>
      </Card>
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

    return (
      <main className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md space-y-4">
          <PublicQrPreviewCard qr={qr} />
        </div>
      </main>
    );
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 404) {
        return (
          <main className="flex min-h-screen items-center justify-center p-4">
            <ErrorState
              title="QR not found"
              description="This QR code does not exist or is no longer valid."
            />
          </main>
        );
      }

      const loweredMessage = error.message.toLowerCase();

      if (loweredMessage.includes("expired")) {
        return (
          <main className="flex min-h-screen items-center justify-center p-4">
            <ErrorState
              title="QR expired"
              description="This QR code has expired and can no longer be opened."
            />
          </main>
        );
      }

      return (
        <main className="flex min-h-screen items-center justify-center p-4">
          <ErrorState
            title="QR no longer available"
            description={error.message}
          />
        </main>
      );
    }

    return (
      <main className="flex min-h-screen items-center justify-center p-4">
        <ErrorState
          title="QR no longer available"
          description="We could not load this QR preview right now. Please try again later."
        />
      </main>
    );
  }
}
