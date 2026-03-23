import { StatusBadge } from "@/components/shared/status-badge";
import type { ResolvedQr } from "@/types/persona";

interface PublicQrPreviewCardProps {
  qr: ResolvedQr;
}

function avatarGradient(name: string): string {
  const hue = (name.charCodeAt(0) * 137) % 360;
  const hue2 = (hue + 40) % 360;
  return `linear-gradient(135deg, hsl(${hue},60%,45%), hsl(${hue2},60%,55%))`;
}

export function PublicQrPreviewCard({ qr }: PublicQrPreviewCardProps) {
  const isQuickConnect = qr.type === "quick_connect";

  return (
    <div className="glass overflow-hidden rounded-3xl border border-border bg-surface">
      {/* Header band — brand gradient */}
      <div
        className="relative px-6 py-7"
        style={{
          background:
            "linear-gradient(135deg, hsl(330,70%,25%) 0%, hsl(330,60%,18%) 60%, hsl(200,60%,15%) 100%)",
        }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-3">
            <StatusBadge
              label={isQuickConnect ? "Quick Connect" : "Profile"}
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
          <div
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl text-xl font-bold text-white shadow-lg"
            style={{ background: avatarGradient(qr.persona.fullName) }}
          >
            {qr.persona.fullName.charAt(0).toUpperCase()}
          </div>
        </div>
      </div>

      <div className="space-y-5 px-6 py-6">
        <div className="space-y-1 rounded-3xl border border-border bg-surface/60 p-4">
          <p className="label-xs text-muted">
            {isQuickConnect ? "Who shared this QR" : "Profile preview"}
          </p>
          <p className="text-sm leading-6 text-muted">
            {isQuickConnect
              ? "Confirm who shared this QR, then connect from the persona you are using right now."
              : "Scanning this QR opens the public profile so they can choose the next step."}
          </p>
        </div>

        <div className="space-y-2">
          <p className="label-xs text-muted">About</p>
          <p className="text-base leading-7 text-foreground">
            {qr.persona.tagline || "No public tagline available."}
          </p>
        </div>

        <dl className="grid gap-4 rounded-3xl border border-border bg-surface/60 p-4 text-sm">
          <div className="space-y-1">
            <dt className="label-xs text-muted">Username</dt>
            <dd className="text-foreground">@{qr.persona.username}</dd>
          </div>
          {isQuickConnect ? (
            <div className="space-y-1">
              <dt className="label-xs text-muted">Access type</dt>
              <dd className="text-foreground">Temporary intro</dd>
            </div>
          ) : null}
        </dl>
      </div>
    </div>
  );
}
