import Image from "next/image";

import { Card } from "@/components/shared/card";
import type {
  PersonaSummary,
  QrTokenSummary,
  QuickConnectQrSummary,
} from "@/types/persona";

interface QrCodeCardProps {
  persona: PersonaSummary;
  qr: QrTokenSummary | QuickConnectQrSummary;
  qrImageSrc: string;
  modeLabel: string;
}

function isQuickConnectQr(
  qr: QrTokenSummary | QuickConnectQrSummary,
): qr is QuickConnectQrSummary {
  return "startsAt" in qr;
}

export function QrCodeCard({
  persona,
  qr,
  qrImageSrc,
  modeLabel,
}: QrCodeCardProps) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-blue-900 px-6 py-6 text-white">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/70">
          {modeLabel}
        </p>
        <div className="mt-3 space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight">
            {persona.fullName}
          </h2>
          <p className="text-sm text-white/75">
            {persona.jobTitle} at {persona.companyName}
          </p>
        </div>
      </div>

      <div className="space-y-5 px-6 py-6">
        <div className="mx-auto flex w-full max-w-[19rem] justify-center rounded-[2rem] border border-border bg-white p-5 shadow-sm">
          <Image
            src={qrImageSrc}
            alt={`QR code for ${persona.fullName}`}
            width={288}
            height={288}
            className="h-auto w-full"
            unoptimized
          />
        </div>

        <div className="space-y-3 rounded-3xl border border-border bg-slate-50/80 p-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
              Share link
            </p>
            <p className="mt-2 break-all text-sm leading-6 text-foreground">
              {qr.url}
            </p>
          </div>

          {isQuickConnectQr(qr) ? (
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium uppercase tracking-[0.18em] text-muted">
                  Expires
                </dt>
                <dd className="mt-1 text-foreground">
                  {new Date(qr.endsAt).toLocaleString()}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-[0.18em] text-muted">
                  Max uses
                </dt>
                <dd className="mt-1 text-foreground">
                  {qr.maxUses ?? "Unlimited"}
                </dd>
              </div>
            </dl>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
