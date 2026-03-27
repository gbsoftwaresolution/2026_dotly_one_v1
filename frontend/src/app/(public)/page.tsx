"use client";

import Link from "next/link";
import { ArrowRight, Check, QrCode, Shield, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

import { PrimaryButton } from "@/components/shared/primary-button";
import { SecondaryButton } from "@/components/shared/secondary-button";
import { dotlyPositioning } from "@/lib/constants/positioning";

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 30, filter: "blur(8px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: {
      duration: 0.8,
      ease: [0.16, 1, 0.3, 1] as const,
    },
  },
};

const steps = [
  {
    label: "Keep one identity",
    detail:
      "A single premium layer for calls, messages, requests, and introductions.",
    icon: QrCode,
  },
  {
    label: "Share access",
    detail:
      "Let people reach you the right way without handing over your private number.",
    icon: ArrowRight,
  },
  {
    label: "Follow up with signal",
    detail:
      "Built for meetings, events, intros, and the moments worth continuing.",
    icon: Shield,
  },
];

const trustPoints = [
  "A premium alternative to exchanging phone numbers",
  "One trusted QR and identity for high-signal sharing",
  "Better for intros, meetings, events, and warm follow-up",
];

export default function LandingPage() {
  return (
    <div className="relative flex min-h-[100dvh] w-full flex-col selection:bg-accent selection:text-white overflow-x-hidden">
      {/* Ambient Background Glow - Multi-layered Apple Grade */}
      <div className="fixed inset-0 z-[-1] pointer-events-none flex items-center justify-center overflow-hidden">
        <div className="absolute top-[-10%] right-[-5%] h-[1000px] w-[1000px] rounded-full bg-accent/10 blur-[150px] mix-blend-normal opacity-60" />
        <div className="absolute bottom-[-10%] left-[-10%] h-[800px] w-[800px] rounded-full bg-accent/5 blur-[120px] mix-blend-normal opacity-40" />
      </div>

      {/* PAGE CONTENT CONTAINER */}
      <main className="flex-1 w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 pb-32 pt-32 md:pt-40">
        {/* HERO SECTION */}
        <motion.section
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="flex flex-col items-center text-center pb-20 md:pb-32"
        >
          <motion.div variants={fadeUp} className="mb-8 md:mb-10">
            <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-black/5 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] backdrop-blur-xl shadow-[0_4px_14px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_14px_rgba(0,0,0,0.1)]">
              <Sparkles className="w-4 h-4 text-foreground" strokeWidth={2.5} />
              <span className="text-[13px] font-bold tracking-[0.15em] text-foreground uppercase">
                {dotlyPositioning.category}
              </span>
            </div>
          </motion.div>

          <motion.h1
            variants={fadeUp}
            className="text-5xl sm:text-7xl md:text-[6.5rem] font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-black to-black/70 dark:from-white dark:to-white/70 max-w-[14ch] md:max-w-4xl text-balance leading-[1.02] mb-6 pb-2"
            style={{ WebkitFontSmoothing: "antialiased" }}
          >
            {dotlyPositioning.headline}
          </motion.h1>

          <motion.p
            variants={fadeUp}
            className="text-[20px] md:text-[24px] text-muted font-medium max-w-[28ch] text-balance mb-12 leading-snug tracking-tight"
          >
            {dotlyPositioning.subheadline}
          </motion.p>

          <motion.div
            variants={fadeUp}
            className="flex flex-col sm:flex-row items-center justify-center gap-5 w-full sm:w-auto mt-2"
          >
            <Link
              href="/signup"
              className="w-full sm:w-[220px] block tap-feedback"
            >
              <PrimaryButton
                size="lg"
                className="w-full rounded-full font-semibold text-[17px] px-8 h-14 bg-foreground text-background shadow-[0_8px_30px_rgb(0,0,0,0.12)] dark:shadow-[0_8px_30px_rgba(255,255,255,0.12)] hover:scale-[0.98] transition-all duration-300 ease-out"
              >
                {dotlyPositioning.cta.primary}
              </PrimaryButton>
            </Link>
            <Link
              href="/login"
              className="w-full sm:w-[220px] block tap-feedback"
            >
              <SecondaryButton
                size="lg"
                className="w-full rounded-full font-semibold text-[17px] px-8 h-14 text-foreground hover:bg-black/5 dark:hover:bg-white/5 hover:scale-[0.98] transition-all duration-300 ease-out !border-0 bg-black/[0.03] dark:bg-white/[0.03] backdrop-blur-md ring-1 ring-black/10 dark:ring-white/10"
              >
                Sign in
              </SecondaryButton>
            </Link>
          </motion.div>
        </motion.section>

        {/* BENTO GRID SECTION */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          className="space-y-6 relative z-10"
        >
          {/* Main Feature Banner */}
          <motion.div
            variants={fadeUp}
            className="relative overflow-hidden rounded-[2.5rem] md:rounded-[3rem] p-10 md:p-16 border border-black/5 dark:border-white/10 bg-gradient-to-br from-black/[0.03] dark:from-white/5 to-transparent backdrop-blur-3xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.2)]"
          >
            <div className="absolute top-0 right-0 p-8 opacity-[0.03] dark:opacity-[0.05] pointer-events-none mix-blend-overlay">
              <QrCode
                className="w-[18rem] h-[18rem] text-foreground"
                strokeWidth={0.2}
              />
            </div>

            <div className="relative z-10 max-w-2xl">
              <p className="text-xs font-bold text-muted uppercase tracking-[0.2em] mb-5">
                Premium positioning
              </p>
              <h2 className="text-[2.5rem] md:text-5xl font-bold tracking-tighter text-foreground mb-6 leading-[1.05]">
                Keep your number private.
                <br className="hidden md:block" />
                Let Dotly carry the introduction.
              </h2>
              <p className="text-[19px] md:text-xl text-muted font-medium leading-relaxed max-w-[34ch]">
                Dotly gives you one calm, high-trust identity to share in
                person, so the next step feels intentional from the start.
              </p>
            </div>
          </motion.div>

          {/* 3 Steps Row */}
          <div className="grid md:grid-cols-3 gap-6 md:gap-8">
            {steps.map((step) => {
              const Icon = step.icon;
              return (
                <motion.div
                  key={step.label}
                  variants={fadeUp}
                  className="rounded-[2rem] p-8 flex flex-col items-center text-center md:items-start md:text-left border border-black/5 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] backdrop-blur-xl shadow-[0_4px_24px_rgba(0,0,0,0.02)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.1)]"
                >
                  <div className="h-16 w-16 rounded-2xl bg-gradient-to-b from-black/5 dark:from-white/10 to-transparent flex items-center justify-center mb-6 ring-1 ring-black/5 dark:ring-white/10 shadow-inner">
                    <Icon
                      className="h-8 w-8 text-foreground"
                      strokeWidth={1.5}
                    />
                  </div>
                  <h3 className="text-[22px] font-bold text-foreground mb-3 tracking-tight">
                    {step.label}
                  </h3>
                  <p className="text-[17px] text-muted font-medium leading-relaxed">
                    {step.detail}
                  </p>
                </motion.div>
              );
            })}
          </div>

          {/* Bottom Split Row */}
          <div className="grid md:grid-cols-2 gap-6 md:gap-8">
            {/* Why It Wins */}
            <motion.div
              variants={fadeUp}
              className="rounded-[2.5rem] p-10 md:p-14 border border-black/5 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] backdrop-blur-xl shadow-[0_4px_24px_rgba(0,0,0,0.02)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.1)]"
            >
              <p className="text-xs font-bold text-muted uppercase tracking-[0.2em] mb-5">
                Why it wins
              </p>
              <h2 className="text-[2rem] md:text-[2.5rem] font-bold tracking-tighter text-foreground mb-10 leading-[1.1]">
                Richer than a contact card.
                <br />
                More private than a phone number.
              </h2>
              <div className="space-y-6">
                {trustPoints.map((point) => (
                  <div key={point} className="flex items-center gap-5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-black/5 dark:from-white/10 to-transparent ring-1 ring-black/5 dark:ring-white/10 shadow-inner">
                      <Check
                        className="h-5 w-5 text-foreground"
                        strokeWidth={2}
                      />
                    </div>
                    <p className="text-[19px] font-medium text-foreground tracking-tight">
                      {point}
                    </p>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Explainer Card (High Contrast Inverted) */}
            <motion.div
              variants={fadeUp}
              className="rounded-[2.5rem] bg-foreground text-background p-10 md:p-14 flex flex-col justify-center relative overflow-hidden group shadow-2xl"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/20 dark:from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000 ease-out" />
              <div className="relative z-10">
                <Shield
                  className="h-12 w-12 mb-10 opacity-90"
                  strokeWidth={1.5}
                />
                <h3 className="text-[2rem] md:text-[2.5rem] font-bold tracking-tighter mb-6 leading-[1.05]">
                  {dotlyPositioning.shortExplainer}
                </h3>
                <p className="text-[19px] opacity-80 font-medium leading-relaxed max-w-[28ch]">
                  Designed for intros, meetings, events, requests, and the kind
                  of follow-up that should feel polished.
                </p>
              </div>
            </motion.div>
          </div>
        </motion.section>
      </main>
    </div>
  );
}
