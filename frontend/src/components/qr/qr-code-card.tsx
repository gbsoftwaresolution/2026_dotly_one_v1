import { QRCodeSVG } from "qrcode.react";

import { Card } from "@/components/shared/card";
import type {
  PersonaSummary,
  QrTokenSummary,
  QuickConnectQrSummary,
} from "@/types/persona";

interface QrCodeCardProps {
  persona: PersonaSummary;
  qr: QrTokenSummary | QuickConnectQrSummary;
  modeLabel: string;
}

function isQuickConnectQr(
  qr: QrTokenSummary | QuickConnectQrSummary,
): qr is QuickConnectQrSummary {
  return "startsAt" in qr;
}

export function QrCodeCard({ persona, qr, modeLabel }: QrCodeCardProps) {
  return (
    <Card className="overflow-hidden p-0 rounded-3xl shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
      {/* Header band */}
      <div className="bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-950 px-6 py-8 text-white dark:from-zinc-950 dark:via-zinc-900 dark:to-black">
        <p className="label-xs text-white/60">{modeLabel}</p>
        <div className="mt-4 space-y-1">
          <h2 className="text-2xl font-bold tracking-tight">
            {persona.fullName}
          </h2>
          <p className="text-sm text-white/70 font-mono">
            {persona.jobTitle} at {persona.companyName}
          </p>
        </div>
      </div>

      {/* QR + details body */}
      <div className="space-y-6 px-6 py-8">
        <div className="mx-auto flex w-full max-w-[18rem] justify-center rounded-3xl bg-white p-6 shadow-inner ring-1 ring-inset ring-black/5">
          <QRCodeSVG
            value={qr.url}
            size={240}
            level="H"
            includeMargin={false}
            className="w-full h-auto"
            fgColor="#050505"
            bgColor="#ffffff"
          />
        </div>

        <div className="space-y-4 rounded-3xl bg-foreground/[0.03] p-5 shadow-inner ring-1 ring-inset ring-black/5 dark:bg-white/[0.045] dark:ring-white/5">
          <div>
            <p className="label-xs text-muted">Share link</p>
            <p className="mt-2 break-all text-sm leading-6 text-foreground font-mono">
              {qr.url}
            </p>
          </div>

          {isQuickConnectQr(qr) ? (
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="label-xs text-muted">Expires</dt>
                <dd className="mt-1 text-foreground font-mono">
                  {new Date(qr.endsAt).toLocaleString()}
                </dd>
              </div>
              <div>
                <dt className="label-xs text-muted">Max uses</dt>
                <dd className="mt-1 text-foreground font-mono">
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
