"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Check, QrCode, Shield } from "lucide-react";

import { PrimaryButton } from "@/components/shared/primary-button";
import { SecondaryButton } from "@/components/shared/secondary-button";
import { dotlyPositioning } from "@/lib/constants/positioning";

const fadeInY = {
  hidden: { opacity: 0, y: 20, filter: "blur(4px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.7 },
  },
};

const steps = [
  {
    label: "Open Dotly",
    detail: "Your QR is ready right away.",
    icon: QrCode,
  },
  {
    label: "Share once",
    detail: "People scan and take the next step fast.",
    icon: ArrowRight,
  },
  {
    label: "Stay in control",
    detail: "Dotly keeps your contact flow clean and private.",
    icon: Shield,
  },
];

const trustPoints = [
  "One clear QR share screen",
  "Instant connect when it makes sense",
  "Context and follow-up after you meet",
];

export default function LandingPage() {
  return (
    <div className="relative w-full overflow-x-hidden">
      <div className="absolute inset-0 z-[-1] pointer-events-none -mx-10">
        <div className="absolute top-[8%] right-[-8%] h-[260px] w-[260px] rounded-full bg-brandCyan/18 blur-[90px] mix-blend-screen" />
        <div className="absolute top-[22%] left-[-12%] h-[320px] w-[320px] rounded-full bg-brandRose/14 blur-[110px] mix-blend-screen" />
      </div>

      <motion.section
        initial="hidden"
        animate="visible"
        className="space-y-8 pb-10 pt-4"
      >
        <motion.div variants={fadeInY} className="space-y-5 text-center">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.24em] text-muted">
            {dotlyPositioning.category}
          </p>
          <h1 className="mx-auto max-w-[11ch] text-[2.9rem] font-black leading-[1.02] tracking-[-0.05em] text-foreground sm:text-[4rem]">
            {dotlyPositioning.headline}
          </h1>
          <p className="mx-auto max-w-[28ch] text-[1.02rem] leading-relaxed text-muted sm:text-[1.08rem]">
            {dotlyPositioning.subheadline}
          </p>
        </motion.div>

        <motion.div
          variants={fadeInY}
          className="mx-auto grid max-w-5xl gap-4 lg:grid-cols-[1.15fr_0.85fr]"
        >
          <div className="relative overflow-hidden rounded-[2.2rem] border border-black/[0.06] bg-white p-6 shadow-card-light dark:border-white/[0.08] dark:bg-surface1 dark:shadow-card sm:p-7">
            <div className="absolute inset-x-10 top-0 h-28 rounded-full bg-brandRose/10 blur-3xl dark:bg-brandCyan/10" />

            <div className="relative space-y-6">
              <div className="space-y-3">
                <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
                  3-second explanation
                </p>
                <h2 className="text-[1.9rem] font-black tracking-tight text-foreground sm:text-[2.2rem]">
                  Show your QR. Let Dotly handle the connection.
                </h2>
                <p className="max-w-[34ch] text-sm leading-6 text-muted sm:text-[15px]">
                  Dotly is the fastest way to share your contact in real life
                  without giving away too much too soon.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {steps.map((step) => {
                  const Icon = step.icon;

                  return (
                    <div
                      key={step.label}
                      className="rounded-[1.3rem] border border-black/[0.06] bg-background/70 p-4 dark:border-white/[0.08]"
                    >
                      <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brandRose/10 text-brandRose dark:bg-brandCyan/12 dark:text-brandCyan">
                        <Icon className="h-5 w-5" />
                      </span>
                      <p className="mt-3 text-sm font-semibold text-foreground">
                        {step.label}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-muted">
                        {step.detail}
                      </p>
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Link href="/signup" className="block flex-1">
                  <PrimaryButton fullWidth size="lg">
                    <span className="inline-flex items-center gap-2">
                      <span>{dotlyPositioning.cta.primary}</span>
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  </PrimaryButton>
                </Link>
                <Link href="/login" className="block flex-1">
                  <SecondaryButton fullWidth size="lg">
                    Log in
                  </SecondaryButton>
                </Link>
              </div>
            </div>
          </div>

          <div className="rounded-[2.2rem] border border-black/[0.06] bg-white p-6 shadow-card-light dark:border-white/[0.08] dark:bg-surface1 dark:shadow-card sm:p-7">
            <div className="space-y-5">
              <div className="space-y-2">
                <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
                  Why it wins
                </p>
                <h2 className="text-xl font-bold tracking-tight text-foreground">
                  Clear to use. Better after the first interaction.
                </h2>
              </div>

              <div className="space-y-3">
                {trustPoints.map((point) => (
                  <div
                    key={point}
                    className="flex items-start gap-3 rounded-[1.2rem] border border-black/[0.06] bg-background/70 px-4 py-3 dark:border-white/[0.08]"
                  >
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/12 text-emerald-700 dark:text-emerald-400">
                      <Check className="h-3.5 w-3.5" />
                    </span>
                    <p className="text-sm leading-6 text-foreground/85">
                      {point}
                    </p>
                  </div>
                ))}
              </div>

              <div className="rounded-[1.5rem] border border-black/[0.06] bg-black px-5 py-5 text-white dark:border-white/[0.08] dark:bg-white dark:text-black">
                <p className="text-sm font-semibold">
                  {dotlyPositioning.shortExplainer}
                </p>
                <p className="mt-2 text-sm leading-6 text-white/72 dark:text-black/70">
                  Built for intros, meetings, events, and the moment after you
                  meet someone.
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.section>
    </div>
  );
}
