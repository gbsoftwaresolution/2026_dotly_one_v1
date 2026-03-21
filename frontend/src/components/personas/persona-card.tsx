"use client";

import Link from "next/link";

import { routes } from "@/lib/constants/routes";
import { formatAccessMode } from "@/lib/persona/labels";
import { cn } from "@/lib/utils/cn";
import type { PersonaSummary } from "@/types/persona";

interface PersonaCardProps {
  persona: PersonaSummary;
}

/** Deterministic gradient from username — gives each persona a unique feel */
function getPersonaGradient(username: string): string {
  const gradients = [
    "from-cyan-500 to-blue-600",
    "from-violet-500 to-purple-700",
    "from-rose-500 to-pink-600",
    "from-emerald-500 to-teal-600",
    "from-amber-500 to-orange-600",
    "from-sky-500 to-indigo-600",
    "from-fuchsia-500 to-violet-600",
    "from-teal-500 to-cyan-600",
  ];
  const idx =
    username.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) %
    gradients.length;
  return gradients[idx];
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
  const gradient = getPersonaGradient(persona.username);
  const initials = getInitials(persona.fullName);

  return (
    <article
      className={cn(
        "relative rounded-card overflow-hidden",
        // Dark: glass surface
        "dark:bg-surface1 dark:border dark:border-white/[0.07]",
        // Light: white card
        "bg-white border border-black/[0.06]",
        "shadow-[0_1px_3px_rgba(0,0,0,0.08)] dark:shadow-card",
        "transition-all duration-300 ease-spring",
        "hover:-translate-y-0.5 hover:dark:border-white/[0.12] hover:shadow-[0_6px_24px_rgba(0,0,0,0.12)] dark:hover:shadow-card-lg",
        "active:translate-y-0 active:scale-[0.99]",
      )}
    >
      {/* Top edge highlight */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent pointer-events-none"
      />

      <div className="p-5 space-y-4">
        {/* ── Identity row ────────────────────────────── */}
        <div className="flex items-center gap-4">
          {/* Gradient avatar with initials */}
          <div
            className={cn(
              "h-12 w-12 rounded-xl flex-shrink-0 flex items-center justify-center",
              "bg-gradient-to-br",
              gradient,
              "shadow-[0_4px_12px_rgba(0,0,0,0.25)]",
            )}
            aria-hidden
          >
            <span className="font-sans text-sm font-black text-white tracking-tight">
              {initials}
            </span>
          </div>

          {/* Name + handle */}
          <div className="flex-1 min-w-0">
            <h2 className="font-sans text-[17px] font-bold text-foreground leading-tight truncate">
              {persona.fullName}
            </h2>
            <p className="font-mono text-[11px] text-muted mt-0.5 truncate">
              dotly.id/{persona.username}
            </p>
          </div>

          {/* Access mode chip */}
          <span
            className={cn(
              "flex-shrink-0 inline-flex items-center rounded-pill px-2.5 py-1",
              "font-mono text-[9px] font-black uppercase tracking-[0.10em]",
              "border",
              isOpen
                ? "dark:bg-brandCyan/10 dark:text-brandCyan dark:border-brandCyan/25 bg-cyan-50 text-cyan-700 border-cyan-200"
                : "dark:bg-white/[0.06] dark:text-white/40 dark:border-white/[0.08] bg-slate-100 text-slate-500 border-slate-200",
            )}
          >
            {isOpen ? (
              <span
                aria-hidden
                className="mr-1 h-1.5 w-1.5 rounded-full bg-current flex-shrink-0"
              />
            ) : null}
            {formatAccessMode(persona.accessMode)}
          </span>
        </div>

        {/* ── Metadata grid ───────────────────────────── */}
        {persona.jobTitle || persona.companyName ? (
          <dl className="grid grid-cols-2 gap-3">
            {persona.jobTitle ? (
              <div className="space-y-0.5">
                <dt className="font-mono text-[9px] font-black uppercase tracking-[0.12em] text-muted/60 dark:text-zinc-600">
                  Role
                </dt>
                <dd className="font-sans text-sm font-semibold text-foreground truncate">
                  {persona.jobTitle}
                </dd>
              </div>
            ) : null}
            {persona.companyName ? (
              <div className="space-y-0.5">
                <dt className="font-mono text-[9px] font-black uppercase tracking-[0.12em] text-muted/60 dark:text-zinc-600">
                  Company
                </dt>
                <dd className="font-sans text-sm font-semibold text-foreground truncate">
                  {persona.companyName}
                </dd>
              </div>
            ) : null}
          </dl>
        ) : null}

        {/* ── Divider ─────────────────────────────────── */}
        <div className="divider" />

        {/* ── Actions ─────────────────────────────────── */}
        <div className="flex flex-col gap-2.5">
          <Link
            href={routes.app.personaDetail(persona.id)}
            className={cn(
              "relative inline-flex h-12 w-full items-center justify-center rounded-xl overflow-hidden",
              "font-sans text-sm font-bold",
              "dark:bg-white/[0.06] dark:border dark:border-white/[0.08] dark:text-white",
              "bg-slate-100 border border-black/[0.06] text-slate-900",
              "transition-all duration-250 ease-spring",
              "hover:dark:bg-white/[0.10] hover:bg-slate-200",
              "active:scale-[0.97]",
              "no-select",
            )}
          >
            <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
            Edit Persona
          </Link>

          {isOpen ? (
            <Link
              href={`/${persona.username}`}
              className={cn(
                "relative inline-flex h-12 w-full items-center justify-center rounded-xl overflow-hidden",
                "font-sans text-sm font-bold",
                // Dark: cyan gradient
                "dark:bg-gradient-cyan dark:text-bgOnyx dark:shadow-[0_0_0_1px_rgba(0,212,255,0.3),0_4px_16px_rgba(0,212,255,0.15)]",
                // Light: rose gradient
                "bg-gradient-rose text-white shadow-[0_0_0_1px_rgba(255,51,102,0.3),0_4px_16px_rgba(255,51,102,0.15)]",
                "transition-all duration-250 ease-spring",
                "hover:opacity-95 hover:-translate-y-px",
                "active:scale-[0.97] active:translate-y-0",
                "no-select",
              )}
            >
              <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
              View Public Profile
            </Link>
          ) : (
            <div
              className={cn(
                "inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl",
                "font-sans text-sm font-medium",
                "dark:bg-white/[0.03] dark:border dark:border-white/[0.05] dark:text-zinc-600",
                "bg-slate-50 border border-slate-100 text-slate-400",
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
          <p className="text-[11px] text-muted/60 dark:text-zinc-700 leading-relaxed">
            Set access mode to{" "}
            <strong className="font-semibold text-muted">open</strong> to
            publish at dotly.id/{persona.username}
          </p>
        ) : null}
      </div>
    </article>
  );
}
