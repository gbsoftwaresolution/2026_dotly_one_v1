import { StatusBadge } from "@/components/shared/status-badge";
import {
  formatPublicHandle,
  getPublicIdentityLine,
} from "@/lib/persona/routing-ux";
import { getShareInstruction } from "@/lib/persona/share-copy";
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
  const fullName = qr.persona.fullName?.trim() || "Profile";
  const publicIdentifier = qr.persona.publicIdentifier ?? qr.persona.username;
  const publicHandle = formatPublicHandle(publicIdentifier);
  const publicIdentityLine = getPublicIdentityLine({
    username: publicIdentifier,
    fullName,
    companyName: qr.persona.companyName,
  });
  const fallbackInitial = fullName.charAt(0).toUpperCase() || "P";
  const roleLine = [qr.persona.jobTitle, qr.persona.companyName]
    .filter(Boolean)
    .join(" at ");
  const scanInstruction = isQuickConnect
    ? "Scan to open my Dotly, then tap Connect with me."
    : getShareInstruction(qr.type);

  return (
    <div className="overflow-hidden rounded-[32px] bg-white/60 backdrop-blur-3xl shadow-[0_40px_80px_-15px_rgba(0,0,0,0.1)] ring-1 ring-black/5 dark:bg-zinc-900/60 dark:ring-white/10">
      <div
        className="relative px-6 py-7"
        style={{
          background:
            "linear-gradient(180deg, rgba(20,20,20,0.98) 0%, rgba(42,42,42,0.94) 100%)",
        }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-3">
            <StatusBadge
              label={isQuickConnect ? "Connect with me" : "My Dotly"}
              tone="neutral"
            />
            <div className="space-y-1">
              <h1 className="text-3xl font-semibold tracking-tight text-white">
                {publicHandle}
              </h1>
              {publicIdentityLine ? (
                <p className="text-base text-white/82">{publicIdentityLine}</p>
              ) : null}
              {roleLine ? (
                <p className="text-base text-white/75">{roleLine}</p>
              ) : null}
            </div>
          </div>
          <div
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl text-xl font-bold text-white shadow-lg"
            style={{ background: avatarGradient(fullName) }}
          >
            {fallbackInitial}
          </div>
        </div>
      </div>

      <div className="space-y-5 px-6 py-6">
        <div className="space-y-1 rounded-[24px] bg-white/50 backdrop-blur-md p-4 ring-1 ring-inset ring-black/5 dark:bg-zinc-800/50 dark:ring-white/10">
          <p className="label-xs text-muted">
            {isQuickConnect ? "Ready to connect" : "Premium first impression"}
          </p>
          <p className="text-sm font-semibold text-foreground">
            {scanInstruction}
          </p>
          <p className="text-sm leading-6 text-muted">
            {isQuickConnect
              ? "You will see my Dotly first so you can confirm who I am before connecting."
              : "You are about to open my Dotly instead of starting with a phone number."}
          </p>
        </div>

        <div className="space-y-2">
          <p className="label-xs text-muted">About</p>
          <p className="text-base leading-7 text-foreground">
            {qr.persona.tagline || "A private, curated way to connect."}
          </p>
        </div>

        <dl className="grid gap-4 rounded-[24px] bg-white/50 backdrop-blur-md p-4 text-sm ring-1 ring-inset ring-black/5 dark:bg-zinc-800/50 dark:ring-white/10">
          <div className="space-y-1">
            <dt className="label-xs text-muted">Public handle</dt>
            <dd className="text-foreground">{publicHandle}</dd>
          </div>
          {isQuickConnect ? (
            <div className="space-y-1">
              <dt className="label-xs text-muted">Primary action</dt>
              <dd className="text-foreground">Connect with me</dd>
            </div>
          ) : null}
        </dl>
      </div>
    </div>
  );
}
