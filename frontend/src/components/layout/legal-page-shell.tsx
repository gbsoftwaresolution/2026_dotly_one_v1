"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { routes } from "@/lib/constants/routes";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";

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
    <section className="relative flex w-full flex-col items-center justify-center overflow-x-hidden pt-12 pb-20 sm:pt-20 sm:pb-32 min-h-[100dvh]">
      {/* Immersive Apple-Grade Background Glow */}
      <div className="fixed inset-0 z-[-1] pointer-events-none flex items-center justify-center overflow-hidden bg-background">
        <div className="absolute top-[-10%] h-[800px] w-[800px] rounded-full bg-accent/5 blur-[120px] mix-blend-normal opacity-50" />
      </div>

      <div className="w-full max-w-[800px] flex flex-col gap-8 px-4 sm:px-6">
        {/* Header Box */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] as const }}
          className="relative text-center flex flex-col items-center mb-6"
        >
          <motion.span
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="mb-6 inline-flex items-center rounded-full border border-black/5 dark:border-white/10 bg-foreground/5 px-4 py-1.5 font-sans text-[11px] font-bold uppercase tracking-[0.12em] text-foreground"
          >
            {eyebrow}
          </motion.span>

          <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-foreground text-balance mb-6 leading-[1.1]">
            {title}
          </h1>
          <p className="text-[17px] leading-relaxed text-muted font-medium text-balance max-w-[50ch] mb-8">
            {intro}
          </p>

          <div className="flex items-center justify-center gap-6 w-full">
            <span className="text-[14px] font-medium text-muted">
              Updated {lastUpdated}
            </span>
            <span className="text-border-subtle">•</span>
            <Link
              href={routes.public.signup}
              className="inline-flex items-center gap-2 text-[14px] font-semibold text-foreground hover:text-accent transition-colors tap-feedback"
            >
              <ArrowLeft className="h-4 w-4" strokeWidth={2.5} />
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
            visible: {
              opacity: 1,
              transition: { staggerChildren: 0.1, delayChildren: 0.3 },
            },
          }}
          className="flex flex-col gap-6"
        >
          {sections.map((section) => (
            <motion.article
              variants={{
                hidden: { opacity: 0, y: 15 },
                visible: {
                  opacity: 1,
                  y: 0,
                  transition: { type: "spring", stiffness: 100, damping: 20 },
                },
              }}
              key={section.title}
              className="premium-card rounded-[2rem] p-8 md:p-12 transition-transform duration-500 hover:scale-[1.01]"
            >
              <div className="relative space-y-4">
                <h2 className="text-2xl font-semibold tracking-tight text-foreground mb-6">
                  {section.title}
                </h2>
                <div className="space-y-5 text-[16px] leading-relaxed text-muted font-medium prose-p:mb-3 last:prose-p:mb-0 prose-a:text-foreground prose-a:font-semibold prose-a:underline prose-a:underline-offset-4 hover:prose-a:text-accent prose-a:transition-colors">
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
