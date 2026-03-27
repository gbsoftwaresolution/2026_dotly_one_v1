"use client";

import Link from "next/link";
import { Check, QrCode, Settings, ExternalLink, Globe } from "lucide-react";

import { routes } from "@/lib/constants/routes";
import { getCanonicalPublicProfilePath } from "@/lib/persona/public-profile-path";
import { formatAccessMode } from "@/lib/persona/labels";
import { cn } from "@/lib/utils/cn";
import type { PersonaSummary } from "@/types/persona";
import { SetDefaultPersonaButton } from "@/components/dashboard/set-default-persona-button";

interface PersonaCardProps {
  persona: PersonaSummary;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export function PersonaCard({ persona }: PersonaCardProps) {
  const isOpen = persona.accessMode === "open";
  const initials = getInitials(persona.fullName);
  const tagline = persona.tagline?.trim() || null;
  const companyName = persona.companyName?.trim() || null;
  const websiteUrl = persona.websiteUrl?.trim() || null;
  const publicProfilePath = getCanonicalPublicProfilePath(
    persona.publicUrl,
    persona.username,
  );

  return (
    <article
      className={cn(
        "group relative flex flex-col justify-between overflow-hidden rounded-[2.5rem] p-7 transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_32px_64px_-12px_rgba(0,0,0,0.14)] dark:hover:shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5)]",
        "bg-gradient-to-b from-white/80 to-white/40 dark:from-white/[0.08] dark:to-transparent",
        "backdrop-blur-[40px] saturate-[150%]",
        "shadow-[0_24px_48px_-12px_rgba(0,0,0,0.08)] dark:shadow-[0_24px_48px_-12px_rgba(0,0,0,0.3)]",
        persona.isPrimary
          ? "ring-[1.5px] ring-inset ring-foreground/10 dark:ring-white/20"
          : "ring-1 ring-inset ring-black/[0.06] dark:ring-white/[0.08] hover:ring-black/[0.12] dark:hover:ring-white/[0.15]",
      )}
    >
      {/* Immersive Inner Glow (Apple-style specular highlight) */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/40 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100 pointer-events-none dark:from-white/10" />

      {isOpen && (
        <div className="absolute -inset-1/2 bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-transparent blur-3xl rounded-full opacity-0 pointer-events-none transition-opacity duration-700 group-hover:opacity-100" />
      )}

      <div className="relative z-10 flex flex-col h-full">
        {/* Top Section */}
        <div className="flex justify-between items-start gap-4 mb-6">
          <div className="flex h-[60px] w-[60px] flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-foreground/80 to-foreground shadow-lg ring-[4px] ring-white/50 dark:ring-black/50 backdrop-blur-md transition-transform duration-500 group-hover:scale-105">
            <span className="text-[20px] font-bold tracking-tight text-background">
              {initials}
            </span>
          </div>

          <div className="flex flex-col items-end gap-2.5">
            <SetDefaultPersonaButton
              personaId={persona.id}
              isPrimary={persona.isPrimary}
            />
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.15em] ring-1 backdrop-blur-md shadow-sm",
                isOpen
                  ? "bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:text-emerald-400 dark:ring-emerald-400/20"
                  : "bg-black/5 text-foreground/60 ring-black/10 dark:bg-white/10 dark:text-white/70 dark:ring-white/20",
              )}
            >
              {formatAccessMode(persona.accessMode)}
            </span>
          </div>
        </div>

        {/* Identity Details */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-[28px] font-bold tracking-tight text-foreground leading-none">
              @{persona.username}
            </h3>
            {persona.isVerified && (
              <span className="inline-flex h-[22px] w-[22px] items-center justify-center rounded-full bg-blue-500 text-white shadow-sm">
                <Check className="h-3.5 w-3.5" strokeWidth={3} />
              </span>
            )}
          </div>

          <h4 className="text-[19px] font-semibold text-foreground/80 mt-2 tracking-tight">
            {persona.fullName}
          </h4>

          {tagline && (
            <p className="mt-3 text-[15px] text-foreground/60 leading-relaxed max-w-[90%] font-medium">
              {tagline}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mt-5 text-[14px] font-medium text-foreground/50">
            {persona.jobTitle && (
              <span className="text-foreground/70">{persona.jobTitle}</span>
            )}
            {persona.jobTitle && companyName && (
              <span className="text-foreground/30">•</span>
            )}
            {companyName && (
              <span className="text-foreground/70">{companyName}</span>
            )}
            {(persona.jobTitle || companyName) && websiteUrl && (
              <span className="text-foreground/30">•</span>
            )}
            {websiteUrl && (
              <a
                href={websiteUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
              >
                <Globe className="h-3.5 w-3.5" />
                {websiteUrl.replace(/^https?:\/\//, "")}
              </a>
            )}
          </div>
        </div>

        <div className="mt-auto">
          <hr className="border-black/[0.06] dark:border-white/[0.08] mb-6" />

          {/* Action Row */}
          <div className="flex items-center gap-3">
            <Link
              href={routes.app.personaDetail(persona.id)}
              className="flex-1 flex h-[48px] items-center justify-center gap-2 rounded-full bg-black/[0.04] dark:bg-white/[0.06] px-6 text-[15px] font-semibold text-foreground transition-all duration-300 hover:bg-black/[0.08] dark:hover:bg-white/[0.1] active:scale-[0.98]"
            >
              <Settings className="h-[18px] w-[18px] opacity-70" />
              Manage
            </Link>

            {isOpen && (
              <Link
                href={publicProfilePath}
                className="flex-1 flex h-[48px] items-center justify-center gap-2 rounded-full bg-black/[0.04] dark:bg-white/[0.06] px-6 text-[15px] font-semibold text-foreground transition-all duration-300 hover:bg-black/[0.08] dark:hover:bg-white/[0.1] active:scale-[0.98]"
              >
                <ExternalLink className="h-[18px] w-[18px] opacity-70" />
                Profile
              </Link>
            )}

            <Link
              href={routes.app.qr}
              className="flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-full bg-foreground text-background transition-transform duration-300 hover:scale-105 active:scale-95 shadow-[0_8px_16px_rgba(0,0,0,0.1)] dark:shadow-[0_8px_16px_rgba(255,255,255,0.1)]"
              title="Show QR"
            >
              <QrCode className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
