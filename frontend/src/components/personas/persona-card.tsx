"use client";

import Link from "next/link";
import {
  Check,
  QrCode,
  Settings,
  ExternalLink,
  Globe,
  Star,
} from "lucide-react";

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
  const companyName = persona.companyName?.trim() || null;
  const websiteUrl = persona.websiteUrl?.trim() || null;
  const publicProfilePath = getCanonicalPublicProfilePath(
    persona.publicUrl,
    persona.username,
  );

  return (
    <article
      className={cn(
        "group relative flex flex-col justify-between overflow-hidden rounded-[32px] p-7 transition-all duration-500 ease-out hover:-translate-y-1 hover:shadow-[0_40px_80px_-15px_rgba(0,0,0,0.2)] dark:hover:shadow-[0_40px_80px_-15px_rgba(0,0,0,0.6)]",
        "bg-white/60 dark:bg-zinc-900/60 backdrop-blur-3xl",
        "shadow-[0_40px_80px_-15px_rgba(0,0,0,0.1)]",
        persona.isPrimary
          ? "ring-1 ring-inset ring-blue-500/50 dark:ring-blue-400/50 bg-gradient-to-b from-blue-50/50 to-transparent dark:from-blue-500/5"
          : "ring-1 ring-inset ring-black/5 dark:ring-white/10",
      )}
    >
      <div className="relative z-10 flex flex-col h-full">
        {/* Top Section */}
        <div className="flex justify-between items-start gap-4 mb-6">
          {/* Avatar Area */}
          <div className="relative flex h-[72px] w-[72px] flex-shrink-0 items-center justify-center rounded-[24px] bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 shadow-inner ring-1 ring-black/5 dark:ring-white/10 transition-transform duration-500 group-hover:scale-105">
            <span className="text-[24px] font-bold tracking-tight text-foreground">
              {initials}
            </span>
            {persona.isPrimary && (
              <div className="absolute -top-2 -right-2 flex h-[24px] w-[24px] items-center justify-center rounded-full bg-blue-500 dark:bg-blue-500 shadow-md ring-2 ring-white dark:ring-[#1A1A1A]">
                <Star className="h-[12px] w-[12px] text-white fill-white" />
              </div>
            )}
          </div>

          <div className="flex flex-col items-end gap-2.5">
            <SetDefaultPersonaButton
              personaId={persona.id}
              isPrimary={persona.isPrimary}
            />
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.15em] ring-1 backdrop-blur-md shadow-sm",
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
            <h3 className="text-[26px] font-bold tracking-tight text-foreground leading-none">
              {persona.fullName}
            </h3>
            {persona.isVerified && (
              <span className="inline-flex h-[20px] w-[20px] items-center justify-center rounded-full bg-blue-500 text-white shadow-sm">
                <Check className="h-3 w-3" strokeWidth={3} />
              </span>
            )}
          </div>

          <p className="text-[17px] font-medium text-foreground/50 tracking-tight mt-1.5">
            @{persona.username}
          </p>

          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2 mt-5 text-[15px] font-medium text-foreground/60">
            {persona.jobTitle && (
              <span className="text-foreground/80">{persona.jobTitle}</span>
            )}
            {persona.jobTitle && companyName && (
              <span className="text-foreground/30">•</span>
            )}
            {companyName && (
              <span className="text-foreground/80">{companyName}</span>
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
                <Globe className="h-4 w-4" />
                {websiteUrl.replace(/^https?:\/\//, "")}
              </a>
            )}
          </div>
        </div>

        <div className="mt-auto">
          {/* Action Row */}
          <div className="flex items-center gap-3">
            <Link
              href={routes.app.personaDetail(persona.id)}
              className="flex-1 flex h-[52px] items-center justify-center gap-2 rounded-[20px] bg-black/[0.04] dark:bg-white/[0.06] px-6 text-[15px] font-semibold text-foreground transition-all duration-300 hover:bg-black/[0.08] dark:hover:bg-white/[0.1] active:scale-[0.98]"
            >
              <Settings className="h-[18px] w-[18px] opacity-70" />
              Manage
            </Link>

            {isOpen && (
              <Link
                href={publicProfilePath}
                className="flex-1 flex h-[52px] items-center justify-center gap-2 rounded-[20px] bg-black/[0.04] dark:bg-white/[0.06] px-6 text-[15px] font-semibold text-foreground transition-all duration-300 hover:bg-black/[0.08] dark:hover:bg-white/[0.1] active:scale-[0.98]"
              >
                <ExternalLink className="h-[18px] w-[18px] opacity-70" />
                Profile
              </Link>
            )}

            <Link
              href={routes.app.qr}
              className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[20px] bg-foreground text-background transition-transform duration-300 hover:scale-105 active:scale-95 shadow-[0_8px_16px_rgba(0,0,0,0.1)] dark:shadow-[0_8px_16px_rgba(255,255,255,0.1)]"
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
