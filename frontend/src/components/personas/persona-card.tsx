"use client";

import Link from "next/link";
import { ArrowUpRight, Check } from "lucide-react";

import { routes } from "@/lib/constants/routes";
import {
  getCanonicalPublicProfilePath,
  getCanonicalPublicSlug,
} from "@/lib/persona/public-profile-path";
import {
  formatPublicHandle,
  getInternalRouteHeadline,
  getInternalRouteLabel,
  getInternalRouteSummary,
} from "@/lib/persona/routing-ux";
import { formatAccessMode } from "@/lib/persona/labels";
import { cn } from "@/lib/utils/cn";
import type { PersonaSummary } from "@/types/persona";

interface PersonaCardProps {
  persona: PersonaSummary;
}

/** Initials from fullName */
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
  const publicSlug = getCanonicalPublicSlug(persona.publicUrl, persona.username);
  const publicProfilePath = getCanonicalPublicProfilePath(
    persona.publicUrl,
    persona.username,
  );
  const publicHandle = formatPublicHandle(persona.username);
  const hasInternalRoutingContext = Boolean(
    persona.routingDisplayName || persona.routingKey || persona.isDefaultRouting,
  );
  const routeHeadline = getInternalRouteHeadline(persona);
  const routeSummary = getInternalRouteSummary(persona);
  const routeLabel = getInternalRouteLabel(persona);

  return (
    <article
      className={cn(
        "relative overflow-hidden rounded-[2rem] bg-white/40 p-5 sm:p-6 backdrop-blur-[40px] saturate-[200%] shadow-sm ring-1 ring-black/5 transition-all hover:bg-white/50 dark:bg-zinc-900/40 dark:ring-white/10 dark:hover:bg-zinc-800/50",
      )}
    >
      {/* Optional subtle glow behind content for active or open personas */}
      {isOpen && (
        <div className="absolute -inset-1/2 bg-gradient-to-br from-indigo-500/5 via-purple-500/5 to-transparent blur-3xl rounded-full opacity-50 pointer-events-none" />
      )}

      <div className="relative z-10 space-y-5 sm:space-y-6">
        <div className="flex items-start gap-4">
          <div
            className={cn(
              "flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-white/60 shadow-sm ring-1 ring-inset ring-black/5 dark:bg-zinc-800/60 dark:ring-white/10 backdrop-blur-md",
            )}
            aria-hidden
          >
            <span className="text-sm font-semibold tracking-tight text-foreground">
              {initials}
            </span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="min-w-0 truncate text-[17px] font-semibold leading-tight tracking-tight text-foreground">
                {persona.fullName}
              </h2>
              {persona.isVerified ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-700 ring-1 ring-emerald-500/20 dark:text-emerald-300 dark:ring-emerald-400/20">
                  <Check className="h-3 w-3" strokeWidth={2.5} />
                  Verified
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-[11px] font-medium text-muted truncate">
              Public handle {publicHandle}
            </p>
            <p className="mt-1 text-[11px] font-medium text-muted truncate">
              dotly.id/{publicSlug}
            </p>
          </div>

          <span
            className={cn(
              "inline-flex flex-shrink-0 items-center rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ring-1",
              isOpen
                ? "bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:text-emerald-300 dark:ring-emerald-400/20"
                : "bg-foreground/[0.04] text-muted ring-black/5 dark:bg-white/[0.06] dark:ring-white/10",
            )}
          >
            {formatAccessMode(persona.accessMode)}
          </span>
        </div>

        {tagline ? (
          <p className="line-clamp-2 text-sm leading-6 text-muted">{tagline}</p>
        ) : null}

        {persona.jobTitle || companyName || websiteUrl ? (
          <dl className="grid gap-2 sm:grid-cols-2 sm:gap-3">
            {persona.jobTitle ? (
              <div className="rounded-2xl bg-white/50 px-4 py-3.5 shadow-sm ring-1 ring-black/5 dark:bg-zinc-800/50 dark:ring-white/10 backdrop-blur-md">
                <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
                  Role
                </dt>
                <dd className="mt-1 truncate text-sm font-semibold text-foreground">
                  {persona.jobTitle}
                </dd>
              </div>
            ) : null}
            {companyName ? (
              <div className="rounded-2xl bg-white/50 px-4 py-3.5 shadow-sm ring-1 ring-black/5 dark:bg-zinc-800/50 dark:ring-white/10 backdrop-blur-md">
                <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
                  Company
                </dt>
                <dd className="mt-1 truncate text-sm font-semibold text-foreground">
                  {companyName}
                </dd>
              </div>
            ) : null}
            {websiteUrl ? (
              <div className="rounded-2xl bg-white/50 px-4 py-3.5 shadow-sm ring-1 ring-black/5 dark:bg-zinc-800/50 dark:ring-white/10 backdrop-blur-md sm:col-span-2">
                <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
                  Website
                </dt>
                <dd className="mt-1">
                  <a
                    href={websiteUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex max-w-full items-center gap-1 truncate text-sm font-semibold text-foreground transition hover:opacity-70"
                  >
                    <span className="truncate">
                      {websiteUrl.replace(/^https?:\/\//, "")}
                    </span>
                    <ArrowUpRight className="h-3.5 w-3.5 flex-shrink-0" />
                  </a>
                </dd>
              </div>
            ) : null}
          </dl>
        ) : null}

        {hasInternalRoutingContext ? (
          <div className="rounded-2xl bg-white/50 px-4 py-3.5 shadow-sm ring-1 ring-black/5 dark:bg-zinc-800/50 dark:ring-white/10 backdrop-blur-md">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
              {routeSummary}
            </p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {routeHeadline}
            </p>
            <p className="mt-1 text-xs font-medium text-muted">{routeLabel}</p>
          </div>
        ) : null}

        <div className="flex flex-col gap-3">
          <Link
            href={routes.app.personaDetail(persona.id)}
            className={cn(
              "inline-flex h-[52px] w-full items-center justify-center rounded-2xl bg-white/50 text-[15px] font-medium text-foreground shadow-sm ring-1 ring-black/5 backdrop-blur-md transition-all hover:bg-white/80 active:scale-[0.98] dark:bg-zinc-800/50 dark:ring-white/10 dark:hover:bg-zinc-800/80",
            )}
          >
            Edit Persona
          </Link>

          {isOpen ? (
            <Link
              href={publicProfilePath}
              className={cn(
                "inline-flex h-[52px] w-full items-center justify-center rounded-2xl bg-foreground text-[15px] font-medium text-background shadow-xl transition-all hover:scale-[0.995] active:scale-[0.98]",
              )}
            >
              View Public Profile
            </Link>
          ) : (
            <div
              className={cn(
                "inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-white/30 text-[15px] font-medium text-muted ring-1 ring-black/5 backdrop-blur-md dark:bg-zinc-800/30 dark:ring-white/10",
              )}
            >
              <svg
                viewBox="0 0 16 16"
                fill="none"
                className="h-4 w-4"
                aria-hidden
              >
                <path
                  d="M2 8h12M8 2l6 6-6 6"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Not publicly visible
            </div>
          )}
        </div>

        {!isOpen ? (
          <p className="text-[11px] leading-relaxed text-muted">
            Set access mode to{" "}
            <strong className="font-semibold text-foreground/80">open</strong>{" "}
            to publish {publicHandle} at dotly.id/{publicSlug}
          </p>
        ) : null}
      </div>
    </article>
  );
}
