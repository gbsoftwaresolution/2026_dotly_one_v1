"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Check, QrCode, Shield, Sparkles } from "lucide-react";

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
      ease: [0.16, 1, 0.3, 1] as const, // Apple ease
    },
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
    <div className="relative w-full min-h-[100dvh] overflow-x-hidden selection:bg-accent selection:text-white">
      {/* Ambient Background Glow - Kept ultra subtle */}
      <div className="fixed inset-0 z-[-1] pointer-events-none flex items-center justify-center overflow-hidden">
        <div className="absolute top-[-20%] h-[800px] w-[800px] rounded-full bg-accent/5 blur-[120px] mix-blend-normal opacity-50" />
      </div>

      <main className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 pb-32">
        {/* HERO SECTION */}
        <motion.section
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="pt-28 pb-20 md:pt-40 md:pb-32 flex flex-col items-center text-center"
        >
          <motion.div variants={fadeUp} className="mb-8">
            <div className="premium-card inline-flex items-center gap-2 px-5 py-2.5 rounded-full">
              <Sparkles className="w-4 h-4 text-accent" strokeWidth={2} />
              <span className="text-[13px] font-semibold tracking-wide text-foreground uppercase">
                {dotlyPositioning.category}
              </span>
            </div>
          </motion.div>

          <motion.h1
            variants={fadeUp}
            className="text-5xl sm:text-7xl md:text-[5.5rem] font-bold tracking-tight text-foreground max-w-5xl text-balance leading-[1.05] mb-8"
            style={{ letterSpacing: "-0.03em" }}
          >
            {dotlyPositioning.headline}
          </motion.h1>

          <motion.p
            variants={fadeUp}
            className="text-xl md:text-2xl text-muted font-medium max-w-[32ch] text-balance mb-12 leading-relaxed"
          >
            {dotlyPositioning.subheadline}
          </motion.p>

          <motion.div
            variants={fadeUp}
            className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto"
          >
            <Link
              href="/signup"
              className="w-full sm:w-auto block tap-feedback"
            >
              <PrimaryButton
                size="lg"
                className="w-full sm:w-auto rounded-full font-semibold text-[17px] px-8 h-14 bg-foreground text-background shadow-float hover:scale-[0.98] transition-transform"
              >
                {dotlyPositioning.cta.primary}
              </PrimaryButton>
            </Link>
            <Link href="/login" className="w-full sm:w-auto block tap-feedback">
              <SecondaryButton
                size="lg"
                className="premium-card w-full sm:w-auto rounded-full font-semibold text-[17px] px-8 h-14 text-foreground hover:scale-[0.98] transition-transform !border-0"
              >
                Log in
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
            className="premium-card relative overflow-hidden rounded-[2.5rem] p-8 md:p-16"
          >
            <div className="absolute top-0 right-0 p-8 opacity-[0.03] dark:opacity-10 pointer-events-none">
              <QrCode className="w-64 h-64 text-foreground" strokeWidth={0.5} />
            </div>

            <div className="relative z-10 max-w-2xl">
              <p className="label-xs text-muted uppercase tracking-widest mb-4">
                3-second explanation
              </p>
              <h2 className="text-4xl md:text-5xl font-semibold tracking-tight text-foreground mb-6 leading-[1.1]">
                Show your QR.
                <br className="hidden md:block" />
                Let Dotly handle the connection.
              </h2>
              <p className="text-lg md:text-xl text-muted font-medium leading-relaxed max-w-[40ch]">
                Dotly is the fastest way to share your contact in real life
                without giving away too much too soon.
              </p>
            </div>
          </motion.div>

          {/* 3 Steps Row */}
          <div className="grid md:grid-cols-3 gap-6">
            {steps.map((step, i) => {
              const Icon = step.icon;
              return (
                <motion.div
                  key={step.label}
                  variants={fadeUp}
                  className="premium-card rounded-[2rem] p-8 flex flex-col"
                >
                  <div className="h-14 w-14 rounded-2xl bg-foreground/5 flex items-center justify-center mb-6 ring-1 ring-black/5 dark:ring-white/10">
                    <Icon
                      className="h-7 w-7 text-foreground"
                      strokeWidth={1.5}
                    />
                  </div>
                  <h3 className="text-xl font-semibold text-foreground mb-3 tracking-tight">
                    {step.label}
                  </h3>
                  <p className="text-[16px] text-muted font-medium leading-relaxed">
                    {step.detail}
                  </p>
                </motion.div>
              );
            })}
          </div>

          {/* Bottom Split Row */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Why It Wins */}
            <motion.div
              variants={fadeUp}
              className="premium-card rounded-[2rem] p-8 md:p-12"
            >
              <p className="label-xs text-muted uppercase tracking-widest mb-4">
                Why it wins
              </p>
              <h2 className="text-3xl font-semibold tracking-tight text-foreground mb-8">
                Clear to use. Better after the first interaction.
              </h2>
              <div className="space-y-5">
                {trustPoints.map((point) => (
                  <div key={point} className="flex items-center gap-4">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-foreground/5 ring-1 ring-black/5 dark:ring-white/10">
                      <Check
                        className="h-4 w-4 text-foreground"
                        strokeWidth={2.5}
                      />
                    </div>
                    <p className="text-[17px] font-medium text-foreground">
                      {point}
                    </p>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Explainer Card (High Contrast Inverted) */}
            <motion.div
              variants={fadeUp}
              className="rounded-[2rem] bg-[#111111] dark:bg-[#FFFFFF] text-white dark:text-black p-8 md:p-12 flex flex-col justify-center relative overflow-hidden group shadow-2xl ring-1 ring-black/10 dark:ring-white/10"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
              <div className="relative z-10">
                <Shield
                  className="h-10 w-10 mb-8 opacity-80"
                  strokeWidth={1.5}
                />
                <h3 className="text-2xl md:text-3xl font-semibold tracking-tight mb-4 leading-snug">
                  {dotlyPositioning.shortExplainer}
                </h3>
                <p className="text-[17px] opacity-80 font-medium leading-relaxed max-w-[30ch]">
                  Built for intros, meetings, events, and the moment after you
                  meet someone.
                </p>
              </div>
            </motion.div>
          </div>
        </motion.section>
      </main>
    </div>
  );
}
