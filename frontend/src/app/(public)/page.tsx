import Link from "next/link";

import { PrimaryButton } from "@/components/shared/primary-button";
import { SecondaryButton } from "@/components/shared/secondary-button";
import { StatusBadge } from "@/components/shared/status-badge";

export default function LandingPage() {
  return (
    <section className="space-y-8 animate-fade-up">
      {/* ── Hero ─────────────────────────────────────── */}
      <div className="space-y-6 pt-4">
        {/* Phase badge */}
        <div>
          <StatusBadge label="Phase 1 live" tone="cyan" dot />
        </div>

        {/* Headline */}
        <div className="space-y-3">
          <h1 className="text-[2.25rem] font-black leading-[1.08] tracking-[-0.03em] text-foreground">
            Your identity,{" "}
            <span
              className="text-gradient-brand"
              style={{ WebkitTextFillColor: "transparent" }}
            >
              permissioned.
            </span>
          </h1>
          <p className="text-base leading-relaxed text-muted max-w-[320px]">
            Create personas, control who sees what, and share only what you
            choose — all behind a single link.
          </p>
        </div>

        {/* Feature pills */}
        <ul className="flex flex-wrap gap-2" aria-label="Key features">
          {[
            "Permissioned profiles",
            "QR instant share",
            "Approval-only contacts",
            "Time-limited access",
          ].map((feat) => (
            <li
              key={feat}
              className="inline-flex items-center gap-1.5 rounded-pill border dark:border-white/[0.08] border-black/[0.07] dark:bg-white/[0.04] bg-white/80 px-3 py-1.5 font-sans text-[11px] font-semibold text-foreground/80"
            >
              <span
                aria-hidden
                className="h-1.5 w-1.5 rounded-full bg-brandCyan dark:bg-brandCyan"
              />
              {feat}
            </li>
          ))}
        </ul>
      </div>

      {/* ── CTA card ─────────────────────────────────── */}
      <div
        className={[
          "relative overflow-hidden rounded-[1.5rem]",
          "dark:bg-surface1 dark:border dark:border-white/[0.07]",
          "bg-white border border-black/[0.06]",
          "p-6 space-y-5",
          "shadow-[0_4px_24px_rgba(0,0,0,0.08)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.4),0_0_0_1px_rgba(255,255,255,0.04)_inset]",
        ].join(" ")}
      >
        {/* Background glow spot */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-16 -right-16 h-40 w-40 rounded-full bg-brandCyan/[0.06] blur-3xl dark:bg-brandCyan/[0.08]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"
        />

        <div className="relative space-y-1">
          <p className="font-mono text-[10px] font-black uppercase tracking-[0.14em] dark:text-zinc-600 text-slate-400">
            Get started free
          </p>
          <p className="font-sans text-sm leading-relaxed text-muted">
            Create your account and publish your first persona in under two
            minutes.
          </p>
        </div>

        <div className="relative flex flex-col gap-2.5">
          <Link href="/signup" className="block">
            <PrimaryButton fullWidth size="lg">
              Create your identity
            </PrimaryButton>
          </Link>
          <Link href="/login" className="block">
            <SecondaryButton fullWidth size="md">
              I already have an account
            </SecondaryButton>
          </Link>
        </div>
      </div>

      {/* ── Trust line ───────────────────────────────── */}
      <p className="text-center font-mono text-[10px] uppercase tracking-widest text-muted/40">
        No tracking &bull; No ads &bull; Your data stays yours
      </p>
    </section>
  );
}
