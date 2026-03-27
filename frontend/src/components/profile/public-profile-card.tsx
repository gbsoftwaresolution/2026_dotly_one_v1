import { ArrowUpRight, Check } from "lucide-react";

import { ExternalImage } from "@/components/shared/external-image";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatPrimaryAction } from "@/lib/persona/labels";
import { getPublicTrustPresentation } from "@/lib/persona/public-trust";
import { getPublicSmartCardDirectActions } from "@/lib/persona/smart-card";

import { Card } from "@/components/shared/card";
import { dotlyPositioning } from "@/lib/constants/positioning";
import { getCanonicalPublicSlug } from "@/lib/persona/public-profile-path";
import {
  formatPublicHandle,
  getPublicIdentityLine,
} from "@/lib/persona/routing-ux";
import type { PublicProfile } from "@/types/persona";

interface PublicProfileCardProps {
  profile: PublicProfile;
}

export function PublicProfileCard({ profile }: PublicProfileCardProps) {
  const publicIdentifier =
    profile.publicIdentifier?.trim().toLowerCase() ||
    getCanonicalPublicSlug(profile.publicUrl, profile.username);
  const avatarHue = ((publicIdentifier.charCodeAt(0) ?? 72) * 137) % 360;
  const trustPresentation = getPublicTrustPresentation(profile.trust);
  const fullName = profile.fullName?.trim() || "Profile";
  const publicHandle = formatPublicHandle(publicIdentifier);
  const publicIdentityLine = getPublicIdentityLine(profile);
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
              return "Save contact card";
          }
        },
      )
    : [];

  return (
    <Card className="rounded-[32px] overflow-hidden bg-white/60 backdrop-blur-3xl p-0 shadow-[0_40px_80px_-15px_rgba(0,0,0,0.1)] ring-1 ring-black/5 dark:bg-zinc-900/60 dark:ring-white/10">
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
                {publicHandle}
              </h2>
              {publicIdentityLine ? (
                <p className="text-sm font-medium leading-6 text-white/72">
                  {publicIdentityLine}
                </p>
              ) : null}
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
            <ExternalImage
              src={profile.profilePhotoUrl}
              alt={profile.fullName}
              width={80}
              height={80}
              sizes="80px"
              priority
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
          <div className="space-y-3 rounded-[24px] bg-white/50 backdrop-blur-md p-4 ring-1 ring-inset ring-black/5 dark:bg-zinc-800/50 dark:ring-white/10">
            <div className="space-y-1">
              <p className="label-xs text-muted">Connect with me</p>
              <p className="text-sm leading-6 text-foreground/80">
                {profile.smartCard
                  ? "Use the main button for the best next step, without starting with a phone number."
                  : "This profile is unavailable right now."}
              </p>
            </div>

            {profile.smartCard ? (
              <div className="space-y-2">
                <p className="label-xs text-muted">Curated ways to connect</p>
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
          <div className="space-y-3 rounded-[24px] bg-white/50 backdrop-blur-md p-5 ring-1 ring-inset ring-black/5 dark:bg-zinc-800/50 dark:ring-white/10">
            <div className="space-y-1">
              <p className="label-xs text-muted">Curated access</p>
              <p className="text-sm leading-6 text-muted">
                {dotlyPositioning.publicProfile.controlledHelper}
              </p>
            </div>
            <div className="grid gap-3 rounded-[20px] bg-white/50 backdrop-blur-md p-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)] ring-1 ring-black/5 sm:grid-cols-[1fr_auto] sm:items-center dark:bg-zinc-800/50 dark:ring-white/[0.06]">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">
                  A better first step than sharing a number
                </p>
                <p className="text-sm leading-6 text-muted">
                  Start with this Dotly, then the owner can share closer access
                  privately with the right people.
                </p>
              </div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                Share {publicHandle} for a premium first impression.
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
      </div>
    </Card>
  );
}
