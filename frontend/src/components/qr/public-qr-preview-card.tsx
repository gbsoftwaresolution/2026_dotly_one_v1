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
  const publicHandle = formatPublicHandle(qr.persona.username);
  const publicIdentityLine = getPublicIdentityLine({
    username: qr.persona.username,
    fullName,
    companyName: qr.persona.companyName,
  });
  const fallbackInitial = fullName.charAt(0).toUpperCase() || "P";
  const roleLine = [qr.persona.jobTitle, qr.persona.companyName]
    .filter(Boolean)
    .join(" at ");
  const scanInstruction = isQuickConnect
    ? "Scan to open their profile, then tap Connect."
    : getShareInstruction(qr.type);

  return (
    <div className="overflow-hidden rounded-3xl bg-white/95 shadow-[0_18px_50px_rgba(15,23,42,0.08)] ring-1 ring-black/[0.05] dark:bg-zinc-950/92 dark:ring-white/[0.06]">
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
              label={isQuickConnect ? "Connect" : "Contact"}
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
        <div className="space-y-1 rounded-3xl bg-foreground/[0.03] p-4 shadow-inner ring-1 ring-inset ring-black/5 dark:bg-white/[0.045] dark:ring-white/5">
          <p className="label-xs text-muted">
            {isQuickConnect ? "Ready to connect" : "Contact preview"}
          </p>
          <p className="text-sm font-semibold text-foreground">
            {scanInstruction}
          </p>
          <p className="text-sm leading-6 text-muted">
            {isQuickConnect
              ? "You will see this profile first so you can confirm the person before connecting."
              : "You are about to open this person's contact and choose the next step."}
          </p>
        </div>

        <div className="space-y-2">
          <p className="label-xs text-muted">About</p>
          <p className="text-base leading-7 text-foreground">
            {qr.persona.tagline || "No public tagline available."}
          </p>
        </div>

        <dl className="grid gap-4 rounded-3xl bg-foreground/[0.03] p-4 text-sm shadow-inner ring-1 ring-inset ring-black/5 dark:bg-white/[0.045] dark:ring-white/5">
          <div className="space-y-1">
            <dt className="label-xs text-muted">Public handle</dt>
            <dd className="text-foreground">{publicHandle}</dd>
          </div>
          {isQuickConnect ? (
            <div className="space-y-1">
              <dt className="label-xs text-muted">Primary action</dt>
              <dd className="text-foreground">Connect</dd>
            </div>
          ) : null}
        </dl>
      </div>
    </div>
  );
}
