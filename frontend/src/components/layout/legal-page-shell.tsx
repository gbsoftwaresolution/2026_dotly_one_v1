"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { routes } from "@/lib/constants/routes";
import { motion } from "framer-motion";
import { Sparkles, ArrowLeft } from "lucide-react";

interface LegalSection {
  title: string;
  body: ReactNode;
}

interface LegalPageShellProps {
  eyebrow: string;
  title: string;
  intro: string;
  lastUpdated: string;
  sections: readonly LegalSection[];
}

export function LegalPageShell({
  eyebrow,
  title,
  intro,
  lastUpdated,
  sections,
}: LegalPageShellProps) {
  return (
    <section className="relative flex w-full flex-col items-center justify-center overflow-x-hidden pt-4 pb-12 sm:pt-8 sm:pb-16">
      {/* Immersive Mobile Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden isolate -z-10 bg-background">
        <motion.div
          animate={{ scale: [1, 1.1, 1], opacity: [0.2, 0.4, 0.2] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-[10%] -left-[10%] w-[120%] h-[50%] bg-brandRose/15 blur-[100px] rounded-[100%]"
        />
        <motion.div
           animate={{ scale: [1, 1.15, 1], opacity: [0.15, 0.3, 0.15] }}
           transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
           className="absolute -bottom-[10%] -right-[10%] w-[120%] h-[50%] bg-brandCyan/15 blur-[100px] rounded-[100%]"
        />
      </div>

      <div className="w-full max-w-[600px] flex flex-col gap-8 px-4 sm:px-6">
        {/* Mobile Header Box */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="relative overflow-hidden rounded-[2rem] border border-white/50 dark:border-white/10 bg-white/70 dark:bg-black/50 p-6 sm:p-8 shadow-[0_8px_40px_rgba(0,0,0,0.06)] dark:shadow-[0_8px_40px_rgba(0,0,0,0.4)] backdrop-blur-2xl text-center flex flex-col items-center"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent dark:via-white/20"
          />
          <motion.span 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-black/5 dark:border-white/10 bg-white/60 dark:bg-white/5 backdrop-blur-xl px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-foreground/70 shadow-sm"
          >
            <Sparkles className="h-3 w-3 text-brandRose dark:text-brandCyan" />
            {eyebrow}
          </motion.span>
          
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl text-balance mb-3">
            {title}
          </h1>
          <p className="text-[15px] leading-relaxed text-muted-foreground text-balance px-2 mb-6">
            {intro}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full">
            <span className="rounded-full border border-black/10 dark:border-white/10 bg-background/50 px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
              Updated {lastUpdated}
            </span>
            <Link
              href={routes.public.signup}
              className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-foreground/80 hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
          </div>
        </motion.div>

        {/* Content Sections */}
        <motion.div 
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0 },
            visible: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.4 } }
          }}
          className="flex flex-col gap-4"
        >
          {sections.map((section) => (
            <motion.article
              variants={{
                hidden: { opacity: 0, y: 15 },
                visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
              }}
              key={section.title}
              className="group relative overflow-hidden rounded-[1.75rem] border border-white/40 dark:border-white/10 bg-white/40 dark:bg-white/[0.02] p-6 sm:p-8 backdrop-blur-xl shadow-sm transition-all duration-300 hover:bg-white/60 dark:hover:bg-white/[0.04]"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-brandRose/5 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100 dark:from-brandCyan/5" />
              <div className="relative space-y-3">
                <h2 className="text-[18px] font-bold tracking-tight text-foreground">
                  {section.title}
                </h2>
                <div className="space-y-4 text-[15px] leading-relaxed text-muted-foreground prose-p:mb-3 last:prose-p:mb-0">
                  {section.body}
                </div>
              </div>
            </motion.article>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
