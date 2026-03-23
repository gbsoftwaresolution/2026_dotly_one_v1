import { StatusBadge } from "@/components/shared/status-badge";
import { formatPrimaryAction, formatSharingMode } from "@/lib/persona/labels";
import { getPublicTrustPresentation } from "@/lib/persona/public-trust";
import { getPublicSmartCardDirectActions } from "@/lib/persona/smart-card";

import { Card } from "@/components/shared/card";
import { dotlyPositioning } from "@/lib/constants/positioning";
import type { PublicProfile } from "@/types/persona";

interface PublicProfileCardProps {
  profile: PublicProfile;
}

export function PublicProfileCard({ profile }: PublicProfileCardProps) {
  const avatarHue = ((profile.username?.charCodeAt(0) ?? 72) * 137) % 360;
  const isSmartCard = profile.sharingMode === "smart_card";
  const trustPresentation = getPublicTrustPresentation(profile.trust);
  const enabledSmartCardActions = profile.smartCard
    ? getPublicSmartCardDirectActions(profile.smartCard, profile).map(
        (action) => {
          switch (action) {
            case "call":
              return "Call";
            case "whatsapp":
              return "WhatsApp";
            case "email":
              return "Email";
            case "vcard":
              return "Save contact";
          }
        },
      )
    : [];

  return (
    <Card className="overflow-hidden p-0 shadow-shell border-border/60">
      {/* Hero gradient band */}
      <div
        className="px-6 py-7"
        style={{
          background: `linear-gradient(135deg, hsl(${avatarHue},60%,18%) 0%, hsl(${(avatarHue + 40) % 360},55%,12%) 100%)`,
        }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-3">
            <div className="space-y-1">
              <h2 className="text-3xl font-bold tracking-tight text-white">
                {profile.fullName}
              </h2>
              <p className="text-base text-white/70">
                {[profile.jobTitle, profile.companyName]
                  .filter(Boolean)
                  .join(" at ")}
              </p>
              {trustPresentation ? (
                <div className="pt-2">
                  <p className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white">
                    {trustPresentation.shortLabel}
                  </p>
                  <p className="mt-2 max-w-[38ch] text-sm leading-6 text-white/72">
                    {trustPresentation.detail}
                  </p>
                </div>
              ) : null}
            </div>
          </div>
          {profile.profilePhotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.profilePhotoUrl}
              alt={profile.fullName}
              className="h-20 w-20 rounded-3xl object-cover ring-2 ring-white/20"
            />
          ) : (
            <div
              className="flex h-20 w-20 items-center justify-center rounded-3xl text-2xl font-bold text-white ring-2 ring-white/20"
              style={{
                background: `hsl(${avatarHue}, 60%, 45%)`,
              }}
            >
              {profile.fullName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-5 px-6 py-6">
        <div className="flex flex-wrap gap-2">
          <StatusBadge
            label={formatSharingMode(profile.sharingMode)}
            tone={isSmartCard ? "cyan" : "neutral"}
            dot
          />
          {profile.smartCard?.primaryAction ? (
            <StatusBadge
              label={formatPrimaryAction(profile.smartCard.primaryAction)}
              tone="info"
            />
          ) : null}
        </div>

        {isSmartCard ? (
          <div className="space-y-3 rounded-3xl border border-cyan-200 bg-cyan-50/70 p-4 dark:border-brandCyan/25 dark:bg-brandCyan/10">
            <div className="space-y-1">
              <p className="label-xs text-cyan-700 dark:text-brandCyan">
                Next step
              </p>
              <p className="text-sm leading-6 text-cyan-800 dark:text-white/80">
                {profile.smartCard
                  ? dotlyPositioning.publicProfile.smartCardHelper
                  : "This profile uses controlled access, but its public configuration is currently unavailable."}
              </p>
            </div>

            {profile.smartCard ? (
              <div className="space-y-2">
                <p className="label-xs text-cyan-700 dark:text-brandCyan">
                  Available actions
                </p>
                {enabledSmartCardActions.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {enabledSmartCardActions.map((label) => (
                      <StatusBadge key={label} label={label} tone="cyan" />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm leading-6 text-cyan-800 dark:text-white/80">
                    No direct contact actions are currently enabled on this
                    card.
                  </p>
                )}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="space-y-1 rounded-3xl border border-border bg-surface/60 p-4">
            <p className="label-xs text-muted">Request access</p>
            <p className="text-sm leading-6 text-muted">
              {dotlyPositioning.publicProfile.controlledHelper}
            </p>
          </div>
        )}

        {/* About */}
        <div className="space-y-2">
          <p className="label-xs text-muted">About</p>
          <p className="text-base leading-7 text-foreground">
            {profile.tagline || "No public tagline available."}
          </p>
        </div>

        {/* Meta */}
        <dl className="grid gap-4 rounded-3xl border border-border bg-surface/60 p-4 text-sm">
          <div className="space-y-1">
            <dt className="label-xs text-muted">Username</dt>
            <dd className="font-mono text-foreground">@{profile.username}</dd>
          </div>
        </dl>
      </div>
    </Card>
  );
}
