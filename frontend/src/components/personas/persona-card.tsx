"use client";

import Link from "next/link";
import { formatAccessMode } from "@/lib/persona/labels";
import { routes } from "@/lib/constants/routes";
import type { PersonaSummary } from "@/types/persona";

interface PersonaCardProps {
  persona: PersonaSummary;
}

export function PersonaCard({ persona }: PersonaCardProps) {
  const isPubliclyVisible = persona.accessMode === "open";

  return (
    <div className="rounded-3xl border border-slate-200 bg-white/50 p-5 shadow-sm backdrop-blur-xl transition-all dark:border-zinc-900 dark:bg-bgOnyx/50">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="font-sans text-lg font-bold text-slate-900 dark:text-white">
            {persona.fullName}
          </h2>
          <p className="font-mono text-xs text-slate-500 dark:text-zinc-400">
            dotly.id/{persona.username}
          </p>
        </div>
        <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 font-mono text-[10px] font-black uppercase tracking-widest text-slate-600 dark:bg-zinc-800 dark:text-brandCyan">
          {formatAccessMode(persona.accessMode)}
        </span>
      </div>

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div className="space-y-1">
          <dt className="font-sans text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500">
            Role
          </dt>
          <dd className="font-sans font-medium text-slate-800 dark:text-zinc-200">
            {persona.jobTitle}
          </dd>
        </div>
        <div className="space-y-1">
          <dt className="font-sans text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500">
            Company
          </dt>
          <dd className="font-sans font-medium text-slate-800 dark:text-zinc-200">
            {persona.companyName}
          </dd>
        </div>
      </dl>

      <div className="mt-6 space-y-2">
        <Link
          href={routes.app.personaDetail(persona.id)}
          className="inline-flex w-full items-center justify-center rounded-xl border border-slate-200 bg-white/70 py-5 font-sans text-sm font-bold text-slate-900 transition-all active:scale-95 hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-white dark:hover:bg-zinc-800"
        >
          Edit Persona
        </Link>
        {isPubliclyVisible ? (
          <Link
            href={`/${persona.username}`}
            className="inline-flex w-full items-center justify-center rounded-xl bg-brandRose py-5 font-sans text-sm font-bold text-white transition-all active:scale-95 hover:opacity-90 dark:bg-white dark:text-bgOnyx"
          >
            Open Public Profile
          </Link>
        ) : (
          <div className="inline-flex w-full items-center justify-center rounded-xl bg-slate-200 py-5 font-sans text-sm font-bold text-slate-600 dark:bg-zinc-900 dark:text-zinc-400">
            Not Publicly Visible
          </div>
        )}
        {!isPubliclyVisible ? (
          <p className="text-xs text-muted">
            Set access mode to open if you want this persona to resolve at
            {" "}
            dotly.id/{persona.username}.
          </p>
        ) : null}
      </div>
    </div>
  );
}
