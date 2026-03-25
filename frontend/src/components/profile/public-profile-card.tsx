import { ArrowUpRight, Check } from "lucide-react";

import { StatusBadge } from "@/components/shared/status-badge";
import { formatPrimaryAction } from "@/lib/persona/labels";
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
  const trustPresentation = getPublicTrustPresentation(profile.trust);
  const fullName = profile.fullName?.trim() || "Profile";
  const tagline = profile.tagline?.trim() || null;
  const companyName = profile.companyName?.trim() || null;
  const websiteUrl = profile.websiteUrl?.trim() || null;
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
    <Card className="overflow-hidden p-0 shadow-shell">
      <div
        className="relative overflow-hidden px-6 py-7"
        style={{
          background: `linear-gradient(135deg, hsl(${avatarHue},60%,18%) 0%, hsl(${(avatarHue + 40) % 360},55%,12%) 100%)`,
        }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.14),transparent_45%)]" />
        <div className="flex items-start justify-between gap-4">
          <div className="relative space-y-3">
            {profile.isVerified !== false && trustPresentation ? (
              <p className="inline-flex items-center gap-1.5 rounded-full border border-white/18 bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/92">
                <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                {trustPresentation.shortLabel}
              </p>
            ) : null}
            <div className="space-y-2">
              <h2 className="text-3xl font-bold tracking-tight text-white">
                {fullName}
              </h2>
              {tagline ? (
                <p className="max-w-[32ch] text-sm leading-6 text-white/78">
                  {tagline}
                </p>
              ) : null}
              {(companyName || websiteUrl) && (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {companyName ? (
                    <span className="inline-flex items-center rounded-full border border-white/14 bg-white/10 px-3 py-1 text-xs font-medium text-white/82">
                      {companyName}
                    </span>
                  ) : null}
                  {websiteUrl ? (
                    <a
                      href={websiteUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/16 bg-white/10 px-3 py-1 text-xs font-semibold text-white/90 transition hover:bg-white/14"
                    >
                      Website
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </a>
                  ) : null}
                </div>
              )}
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
              {fullName.charAt(0).toUpperCase() || "P"}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-5 px-6 py-6">
        <div className="flex flex-wrap gap-2">
          {profile.smartCard?.primaryAction ? (
            <StatusBadge
              label={formatPrimaryAction(profile.smartCard.primaryAction)}
              tone="info"
            />
          ) : null}
        </div>

        {profile.sharingMode === "smart_card" ? (
          <div className="space-y-3 rounded-3xl bg-foreground/[0.03] p-4 shadow-inner ring-1 ring-inset ring-black/5 dark:bg-white/[0.045] dark:ring-white/5">
            <div className="space-y-1">
              <p className="label-xs text-muted">Next</p>
              <p className="text-sm leading-6 text-foreground/80">
                {profile.smartCard
                  ? "Tap the main button to continue with this person."
                  : "This profile is unavailable right now."}
              </p>
            </div>

            {profile.smartCard ? (
              <div className="space-y-2">
                <p className="label-xs text-muted">Ways to connect</p>
                {enabledSmartCardActions.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {enabledSmartCardActions.map((label) => (
                      <StatusBadge key={label} label={label} tone="cyan" />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm leading-6 text-foreground/80">
                    No contact actions are available right now.
                  </p>
                )}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="space-y-3 rounded-3xl bg-foreground/[0.03] p-5 shadow-inner ring-1 ring-inset ring-black/5 dark:bg-white/[0.045] dark:ring-white/5">
            <div className="space-y-1">
              <p className="label-xs text-muted">Request access</p>
              <p className="text-sm leading-6 text-muted">
                {dotlyPositioning.publicProfile.controlledHelper}
              </p>
            </div>
            <div className="grid gap-3 rounded-[1.4rem] bg-white/80 p-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)] ring-1 ring-black/5 sm:grid-cols-[1fr_auto] sm:items-center dark:bg-zinc-950/80 dark:ring-white/[0.06]">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">
                  Clear identity, calm gatekeeping
                </p>
                <p className="text-sm leading-6 text-muted">
                  This profile keeps the first impression minimal, then lets the
                  owner approve who gets closer access.
                </p>
              </div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                @{profile.username}
              </p>
            </div>
          </div>
        )}

        {!tagline && trustPresentation ? (
          <div className="rounded-3xl bg-emerald-500/[0.06] p-4 ring-1 ring-inset ring-emerald-500/15">
            <p className="text-sm leading-6 text-foreground/82">
              {trustPresentation.detail}
            </p>
          </div>
        ) : null}

        {!tagline && !companyName && !websiteUrl ? null : (
          <dl className="grid gap-4 rounded-3xl bg-foreground/[0.03] p-4 text-sm shadow-inner ring-1 ring-inset ring-black/5 dark:bg-white/[0.045] dark:ring-white/5">
            <div className="space-y-1">
              <dt className="label-xs text-muted">Username</dt>
              <dd className="font-mono text-foreground">@{profile.username}</dd>
            </div>
          </dl>
        )}
      </div>
    </Card>
  );
}
