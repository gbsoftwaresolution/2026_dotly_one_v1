"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Shield, QrCode, Clock, Grid, ArrowRight, Lock, Repeat } from "lucide-react";

import { PrimaryButton } from "@/components/shared/primary-button";
import { SecondaryButton } from "@/components/shared/secondary-button";
import { StatusBadge } from "@/components/shared/status-badge";

const fadeInY = {
  hidden: { opacity: 0, y: 24, filter: "blur(4px)" },
  visible: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.8 } }
};

const stagger = {
  visible: { transition: { staggerChildren: 0.1 } }
};

export default function LandingPage() {
  return (
    <div className="relative w-full overflow-x-hidden">
      {/* Dynamic ambient background blobs */}
      <div className="absolute inset-0 z-[-1] pointer-events-none -mx-10">
        <div className="absolute top-[5%] right-[-10%] w-[250px] h-[250px] rounded-full bg-brandCyan/20 blur-[80px] mix-blend-screen" />
        <div className="absolute top-[20%] left-[-10%] w-[300px] h-[300px] rounded-full bg-brandViolet/15 blur-[100px] mix-blend-screen" />
        <div className="absolute top-[50%] right-[10%] w-[200px] h-[200px] rounded-full bg-brandRose/15 blur-[80px] mix-blend-screen" />
      </div>

      <motion.section 
        initial="hidden" 
        animate="visible" 
        variants={stagger}
        className="space-y-12"
      >
        {/* ── Hero ─────────────────────────────────────── */}
        <div className="space-y-6 pt-8 text-center flex flex-col items-center">
          <motion.div variants={fadeInY}>
            <StatusBadge label="Dotly 1.0 is Live" tone="cyan" dot />
          </motion.div>

          <motion.div variants={fadeInY} className="space-y-4">
            <h1 className="text-[2.75rem] font-black leading-[1.1] tracking-[-0.04em] text-foreground max-w-[400px]">
              Your identity, <br />
              <span className="text-gradient-brand">permissioned.</span>
            </h1>
            <p className="text-[1.05rem] leading-relaxed text-muted max-w-[340px] mx-auto font-medium">
              Create dynamic personas, control exactly who sees what, and share frictionlessly.
            </p>
          </motion.div>
          
          <motion.div variants={fadeInY} className="w-full flex justify-center pt-2">
            <Link href="/signup" className="group rounded-pill">
              <div className="relative flex items-center justify-center gap-2 rounded-pill bg-foreground px-6 py-3.5 text-sm font-bold text-background transition-all duration-300 hover:scale-[1.02] hover:shadow-glow active:scale-[0.98]">
                <span>Claim your link</span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </div>
            </Link>
          </motion.div>
        </div>

        {/* ── Bento Grid ───────────────────────────────── */}
        <motion.div variants={stagger} className="grid grid-cols-2 gap-4">
          
          {/* Card 1: Personas - Full width */}
          <motion.div variants={fadeInY} className="col-span-2 relative overflow-hidden rounded-[1.5rem] dark:bg-surface1 bg-white border dark:border-white/[0.08] border-black/[0.05] p-6 shadow-card-light dark:shadow-card group">
            <div className="absolute top-0 right-0 p-6 opacity-20 group-hover:opacity-40 transition-opacity duration-500">
               <Grid className="w-16 h-16 text-brandViolet" />
            </div>
            <div className="relative z-10 space-y-3">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-brandViolet/10 text-brandViolet">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold tracking-tight text-foreground">Infinite Personas</h3>
                <p className="text-sm text-muted mt-1 leading-relaxed max-w-[240px]">
                  Work, dating, or friends. Route connections to the right profile automatically.
                </p>
              </div>
            </div>
          </motion.div>

          {/* Card 2: QR Share */}
          <motion.div variants={fadeInY} className="relative overflow-hidden rounded-[1.5rem] dark:bg-surface1 bg-white border dark:border-white/[0.08] border-black/[0.05] p-5 shadow-card-light dark:shadow-card">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-brandCyan/10 text-brandCyan">
                <QrCode className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold tracking-tight text-foreground">Instant Scan</h3>
                <p className="text-xs text-muted mt-1 leading-relaxed">
                  Share your context instantly with one scan.
                </p>
              </div>
            </div>
          </motion.div>

          {/* Card 3: Time Limits */}
          <motion.div variants={fadeInY} className="relative overflow-hidden rounded-[1.5rem] dark:bg-surface1 bg-white border dark:border-white/[0.08] border-black/[0.05] p-5 shadow-card-light dark:shadow-card">
             <div className="space-y-3">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-amber-500/10 text-amber-500">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold tracking-tight text-foreground">Ephemeral</h3>
                <p className="text-xs text-muted mt-1 leading-relaxed">
                  Grant access that self-destructs over time.
                </p>
              </div>
            </div>
          </motion.div>

        </motion.div>

        {/* ── Premium CTA card ─────────────────────────── */}
        <motion.div variants={fadeInY} className="relative overflow-hidden rounded-[2rem] dark:bg-surface1 dark:border-white/[0.08] bg-white border border-black/[0.05] p-8 shadow-lg dark:shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.06)_inset]">
          
          <div aria-hidden className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-brandCyan/[0.08] blur-3xl dark:bg-brandCyan/[0.12]" />
          <div aria-hidden className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-brandRose/[0.08] blur-3xl dark:bg-brandRose/[0.12]" />
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

          <div className="relative text-center space-y-6">
            <div className="space-y-2">
              <p className="font-mono text-[11px] font-black uppercase tracking-[0.15em] text-brandCyan">
                Join the vanguard
              </p>
              <h2 className="text-2xl font-black tracking-tight text-foreground">
                Take back your data.
              </h2>
              <p className="text-sm leading-relaxed text-muted max-w-[280px] mx-auto">
                No ads. No tracking algorithms. Just you and exactly who you choose to let in.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <Link href="/signup" className="block w-full">
                <PrimaryButton fullWidth size="lg">
                  Start your setup
                </PrimaryButton>
              </Link>
              <Link href="/login" className="block w-full">
                <SecondaryButton fullWidth size="md">
                  Sign in to dashboard
                </SecondaryButton>
              </Link>
            </div>
          </div>
        </motion.div>

        {/* ── Trust line ───────────────────────────────── */}
        <motion.div variants={fadeInY} className="pb-8">
          <p className="flex items-center justify-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted/50">
            <Lock className="w-3 h-3" /> End-to-end encrypted design
          </p>
        </motion.div>

      </motion.section>
    </div>
  );
}
