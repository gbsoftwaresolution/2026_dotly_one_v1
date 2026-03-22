"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Shield,
  QrCode,
  Check,
  ArrowRight,
  Lock,
  Sparkles,
} from "lucide-react";

import { PrimaryButton } from "@/components/shared/primary-button";
import { SecondaryButton } from "@/components/shared/secondary-button";
import { dotlyPositioning } from "@/lib/constants/positioning";

const fadeInY = {
  hidden: { opacity: 0, y: 24, filter: "blur(4px)" },
  visible: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.8 } }
};

const stagger = {
  visible: { transition: { staggerChildren: 0.1 } }
};

const problemPoints = ["no control", "no context", "no memory", "too much spam"];

const solutionPoints = [
  "Approve or reject access.",
  "Connect instantly when you want.",
  "Keep context for every relationship.",
];

const steps = [
  "Share Dotly",
  "They request or connect",
  "You stay in control",
];

const smartCardPoints = [
  "One-tap connect.",
  "Keep the connection when it matters.",
  "Share the next step only when you choose to.",
];

const realWorldExamples = ["Events", "Meetings", "Networking"];

export default function LandingPage() {
  return (
    <div className="relative w-full overflow-x-hidden">
      <div className="absolute inset-0 z-[-1] pointer-events-none -mx-10">
        <div className="absolute top-[5%] right-[-10%] w-[250px] h-[250px] rounded-full bg-brandCyan/20 blur-[80px] mix-blend-screen" />
        <div className="absolute top-[20%] left-[-10%] w-[300px] h-[300px] rounded-full bg-brandViolet/15 blur-[100px] mix-blend-screen" />
        <div className="absolute top-[50%] right-[10%] w-[200px] h-[200px] rounded-full bg-brandRose/15 blur-[80px] mix-blend-screen" />
      </div>

      <motion.section 
        initial="hidden" 
        animate="visible" 
        variants={stagger}
        className="space-y-12 pb-8"
      >
        <div className="space-y-7 pt-6 text-center">
          <motion.div variants={fadeInY} className="space-y-4">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.24em] text-muted">
              {dotlyPositioning.category}
            </p>
            <h1 className="mx-auto max-w-[11ch] text-[2.75rem] font-black leading-[1.02] tracking-[-0.05em] text-foreground sm:text-[3.35rem]">
              {dotlyPositioning.headline}
            </h1>
            <p className="mx-auto max-w-[34ch] text-[1rem] leading-relaxed text-muted sm:text-[1.05rem]">
              {dotlyPositioning.subheadline}
            </p>
          </motion.div>
          
          <motion.div variants={fadeInY} className="flex flex-col gap-3 pt-1 sm:flex-row sm:justify-center">
            <Link href="/signup" className="group rounded-pill">
              <div className="relative flex items-center justify-center gap-2 rounded-pill bg-foreground px-6 py-3.5 text-sm font-bold text-background transition-all duration-300 hover:scale-[1.02] hover:shadow-glow active:scale-[0.98]">
                <span>{dotlyPositioning.cta.primary}</span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </div>
            </Link>
            <Link href="#how-it-works" className="block sm:min-w-[160px]">
              <SecondaryButton fullWidth>{dotlyPositioning.cta.secondary}</SecondaryButton>
            </Link>
          </motion.div>

          <motion.div
            variants={fadeInY}
            className="glass-strong mx-auto max-w-[420px] rounded-[2rem] border border-border/60 p-5 text-left shadow-shell"
          >
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.35rem] bg-brandRose/12 text-brandRose dark:bg-brandCyan/12 dark:text-brandCyan">
                <Sparkles className="h-6 w-6" />
              </div>
              <div className="space-y-2">
                <h2 className="text-lg font-semibold tracking-tight text-foreground">
                  Identity for real-world connection.
                </h2>
                <p className="text-sm leading-6 text-muted">
                  {dotlyPositioning.shortExplainer}
                </p>
              </div>
            </div>
          </motion.div>
        </div>

        <motion.div variants={stagger} className="grid gap-4">
          <motion.div variants={fadeInY} className="rounded-[1.75rem] border border-black/[0.05] bg-white p-6 shadow-card-light dark:border-white/[0.08] dark:bg-surface1 dark:shadow-card">
            <div className="space-y-4">
              <div className="w-10 h-10 rounded-2xl bg-brandRose/10 text-brandRose dark:bg-brandCyan/12 dark:text-brandCyan flex items-center justify-center">
                <Lock className="w-5 h-5" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-bold tracking-tight text-foreground">
                  Sharing your number gives permanent access to everyone.
                </h2>
                <div className="grid gap-2 sm:grid-cols-2">
                  {problemPoints.map((point) => (
                    <div
                      key={point}
                      className="rounded-[1.1rem] border border-black/[0.05] bg-background/70 px-4 py-3 text-sm font-medium capitalize text-foreground/80 dark:border-white/[0.06]"
                    >
                      {point}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div variants={fadeInY} className="rounded-[1.75rem] border border-black/[0.05] bg-white p-6 shadow-card-light dark:border-white/[0.08] dark:bg-surface1 dark:shadow-card">
            <div className="space-y-4">
              <div className="w-10 h-10 rounded-2xl bg-brandViolet/10 text-brandViolet flex items-center justify-center">
                <Shield className="w-5 h-5" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-bold tracking-tight text-foreground">
                  Dotly gives you control over who can contact you.
                </h2>
                <div className="space-y-2">
                  {solutionPoints.map((point) => (
                    <div key={point} className="rounded-[1.1rem] border border-black/[0.05] bg-background/70 px-4 py-3 text-sm text-foreground/80 dark:border-white/[0.06]">
                      {point}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div id="how-it-works" variants={fadeInY} className="rounded-[1.75rem] border border-black/[0.05] bg-white p-6 shadow-card-light dark:border-white/[0.08] dark:bg-surface1 dark:shadow-card">
            <div className="space-y-4">
              <div className="w-10 h-10 rounded-2xl bg-brandCyan/10 text-brandCyan flex items-center justify-center">
                <QrCode className="w-5 h-5" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-bold tracking-tight text-foreground">How it works</h2>
                <div className="grid gap-3 sm:grid-cols-3">
                  {steps.map((step, index) => (
                    <div key={step} className="rounded-[1.1rem] border border-black/[0.05] bg-background/70 px-4 py-4 dark:border-white/[0.06]">
                      <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
                        0{index + 1}
                      </p>
                      <p className="mt-2 text-sm font-semibold text-foreground">{step}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>

        <motion.div variants={stagger} className="grid gap-4 md:grid-cols-3">
          <motion.div variants={fadeInY} className="rounded-[1.75rem] border border-black/[0.05] bg-white p-6 shadow-card-light dark:border-white/[0.08] dark:bg-surface1 dark:shadow-card md:col-span-2">
            <div className="space-y-4">
              <h2 className="text-xl font-bold tracking-tight text-foreground">
                Be reachable on your terms
              </h2>
              <div className="grid gap-3 sm:grid-cols-3">
                {smartCardPoints.map((point) => (
                  <div key={point} className="rounded-[1.1rem] border border-black/[0.05] bg-background/70 px-4 py-4 text-sm text-foreground/80 dark:border-white/[0.06]">
                    {point}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          <motion.div variants={fadeInY} className="rounded-[1.75rem] border border-black/[0.05] bg-white p-6 shadow-card-light dark:border-white/[0.08] dark:bg-surface1 dark:shadow-card">
            <div className="space-y-4">
              <h2 className="text-xl font-bold tracking-tight text-foreground">
                Verified identity before access
              </h2>
              <p className="text-sm leading-6 text-muted">
                Trust is built in before the next step is shared.
              </p>
            </div>
          </div>

          <motion.div variants={fadeInY} className="rounded-[1.75rem] border border-black/[0.05] bg-white p-6 shadow-card-light dark:border-white/[0.08] dark:bg-surface1 dark:shadow-card md:col-span-3">
            <div className="space-y-4">
              <h2 className="text-xl font-bold tracking-tight text-foreground">
                Built for real interactions
              </h2>
              <div className="flex flex-wrap gap-2">
                {realWorldExamples.map((example) => (
                  <span key={example} className="rounded-full border border-black/[0.06] bg-background/70 px-4 py-2 text-sm font-medium text-foreground/80 dark:border-white/[0.08]">
                    {example}
                  </span>
                ))}
              </div>
              <p className="text-sm leading-6 text-muted">
                Know who you met, when, and why.
              </p>
            </div>
          </motion.div>
        </motion.div>

        <motion.div variants={fadeInY} className="relative overflow-hidden rounded-[2rem] border border-black/[0.05] bg-white p-8 shadow-lg dark:border-white/[0.08] dark:bg-surface1 dark:shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.06)_inset]">
          <div aria-hidden className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-brandCyan/[0.08] blur-3xl dark:bg-brandCyan/[0.12]" />
          <div aria-hidden className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-brandRose/[0.08] blur-3xl dark:bg-brandRose/[0.12]" />
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

          <div className="relative text-center space-y-6">
            <div className="space-y-2">
              <h2 className="text-2xl font-black tracking-tight text-foreground">
                Start with your Dotly identity
              </h2>
              <p className="mx-auto max-w-[30ch] text-sm leading-relaxed text-muted">
                {dotlyPositioning.supportingPoints.join(" ")}
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <Link href="/signup" className="block w-full">
                <PrimaryButton fullWidth size="lg">
                  {dotlyPositioning.cta.primary}
                </PrimaryButton>
              </Link>
              <Link href="/login" className="block w-full">
                <SecondaryButton fullWidth size="md">
                  Open your Dotly
                </SecondaryButton>
              </Link>
            </div>
          </div>
        </motion.div>

      </motion.section>
    </div>
  );
}
