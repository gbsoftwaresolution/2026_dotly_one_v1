"use client";

import Link from "next/link";
import { ArrowUpRight, Check } from "lucide-react";

import { routes } from "@/lib/constants/routes";
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

  return (
    <article
      className={cn(
        "premium-card relative overflow-hidden rounded-[1.75rem] p-4 transition-all duration-500 ease-[0.16,1,0.3,1] sm:rounded-3xl sm:p-5",
        "motion-safe:animate-[fade-in_420ms_ease-out] hover:scale-[0.995] active:scale-[0.99]",
      )}
    >
      <div className="space-y-4 sm:space-y-5">
        <div className="flex items-start gap-4">
          <div
            className={cn(
              "flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-foreground/[0.06] shadow-inner ring-1 ring-inset ring-black/5 dark:bg-white/[0.08] dark:ring-white/10",
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
              dotly.id/{persona.username}
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
              <div className="rounded-2xl bg-white px-4 py-3.5 shadow-[0_2px_8px_rgba(0,0,0,0.04)] ring-1 ring-black/5 dark:bg-zinc-950 dark:ring-white/[0.06]">
                <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
                  Role
                </dt>
                <dd className="mt-1 truncate text-sm font-semibold text-foreground">
                  {persona.jobTitle}
                </dd>
              </div>
            ) : null}
            {companyName ? (
              <div className="rounded-2xl bg-white px-4 py-3.5 shadow-[0_2px_8px_rgba(0,0,0,0.04)] ring-1 ring-black/5 dark:bg-zinc-950 dark:ring-white/[0.06]">
                <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
                  Company
                </dt>
                <dd className="mt-1 truncate text-sm font-semibold text-foreground">
                  {companyName}
                </dd>
              </div>
            ) : null}
            {websiteUrl ? (
              <div className="rounded-2xl bg-white px-4 py-3.5 shadow-[0_2px_8px_rgba(0,0,0,0.04)] ring-1 ring-black/5 dark:bg-zinc-950 dark:ring-white/[0.06] sm:col-span-2">
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

        <div className="flex flex-col gap-2.5">
          <Link
            href={routes.app.personaDetail(persona.id)}
            className={cn(
              "inline-flex h-12 w-full items-center justify-center rounded-2xl bg-foreground/[0.04] text-sm font-semibold text-foreground shadow-inner ring-1 ring-black/5 transition-all hover:bg-foreground/[0.06] active:scale-[0.98] dark:bg-white/[0.06] dark:ring-white/10",
            )}
          >
            Edit Persona
          </Link>

          {isOpen ? (
            <Link
              href={`/${persona.username}`}
              className={cn(
                "inline-flex h-12 w-full items-center justify-center rounded-2xl bg-foreground text-sm font-semibold text-background shadow-[0_8px_24px_rgba(0,0,0,0.12)] transition-all hover:scale-[0.995] active:scale-[0.98]",
              )}
            >
              View Public Profile
            </Link>
          ) : (
            <div
              className={cn(
                "inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-foreground/[0.03] text-sm font-medium text-muted ring-1 ring-black/5 dark:bg-white/[0.04] dark:ring-white/10",
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
            to publish at dotly.id/{persona.username}
          </p>
        ) : null}
      </div>
    </article>
  );
}
