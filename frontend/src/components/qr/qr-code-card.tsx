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
    <Card className="overflow-hidden p-0 rounded-[2rem] bg-[#F8FAFC] dark:bg-[#050505] border-slate-200 dark:border-zinc-900 font-sans">
      <div className="bg-gradient-to-br from-slate-900 via-[#1A1A1A] to-[#0A0A0A] px-6 py-8 text-white">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/70">
          {modeLabel}
        </p>
        <div className="mt-4 space-y-1">
          <h2 className="text-2xl font-bold tracking-tight">
            {persona.fullName}
          </h2>
          <p className="text-sm text-white/75 font-mono">
            {persona.jobTitle} at {persona.companyName}
          </p>
        </div>
      </div>

      <div className="space-y-6 px-6 py-8">
        <div className="mx-auto flex w-full max-w-[18rem] justify-center rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
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

        <div className="space-y-4 rounded-3xl border border-slate-200 dark:border-zinc-800 bg-white/50 dark:bg-black/50 p-5">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500 dark:text-zinc-400">
              Share link
            </p>
            <p className="mt-2 break-all text-sm leading-6 text-slate-900 dark:text-white font-mono">
              {qr.url}
            </p>
          </div>

          {isQuickConnectQr(qr) ? (
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-zinc-400">
                  Expires
                </dt>
                <dd className="mt-1 text-slate-900 dark:text-white font-mono">
                  {new Date(qr.endsAt).toLocaleString()}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-zinc-400">
                  Max uses
                </dt>
                <dd className="mt-1 text-slate-900 dark:text-white font-mono">
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
