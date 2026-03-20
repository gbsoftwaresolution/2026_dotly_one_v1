import { Card } from "@/components/shared/card";
import { StatusBadge } from "@/components/shared/status-badge";
import type { ResolvedQr } from "@/types/persona";

interface PublicQrPreviewCardProps {
  qr: ResolvedQr;
}

export function PublicQrPreviewCard({ qr }: PublicQrPreviewCardProps) {
  const isQuickConnect = qr.type === "quick_connect";

  return (
    <Card className="overflow-hidden p-0 shadow-sm">
      <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-blue-900 px-6 py-7 text-white">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-3">
            <StatusBadge
              label={isQuickConnect ? "Quick Connect QR" : "Profile QR"}
              tone="neutral"
            />
            <div className="space-y-1">
              <h1 className="text-3xl font-semibold tracking-tight text-white">
                {qr.persona.fullName}
              </h1>
              <p className="text-base text-white/75">
                {[qr.persona.jobTitle, qr.persona.companyName]
                  .filter(Boolean)
                  .join(" at ")}
              </p>
            </div>
          </div>
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-white/10 text-2xl font-semibold text-white">
            {qr.persona.fullName.charAt(0).toUpperCase()}
          </div>
        </div>
      </div>

      <div className="space-y-5 px-6 py-6">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
            About
          </p>
          <p className="text-base leading-7 text-foreground">
            {qr.persona.tagline || "No public tagline available."}
          </p>
        </div>

        <dl className="grid gap-4 rounded-3xl border border-border bg-slate-50/70 p-4 text-sm">
          <div className="space-y-1">
            <dt className="text-xs font-medium uppercase tracking-[0.18em] text-muted">
              Username
            </dt>
            <dd className="text-foreground">@{qr.persona.username}</dd>
          </div>
          {isQuickConnect ? (
            <div className="space-y-1">
              <dt className="text-xs font-medium uppercase tracking-[0.18em] text-muted">
                Access type
              </dt>
              <dd className="text-foreground">
                Temporary, permissioned access
              </dd>
            </div>
          ) : null}
        </dl>
      </div>
    </Card>
  );
}
