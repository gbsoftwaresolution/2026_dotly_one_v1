"use client";

import { AuthForm } from "@/components/forms/auth-form";
import { routes } from "@/lib/constants/routes";
import { Sparkles, Fingerprint, QrCode, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";
import { use } from "react";

export default function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const resolvedSearchParams = use(searchParams);
  const redirectTo = resolvedSearchParams.next || routes.app.home;
  
  const signupHighlights = [
    {
      title: "Persona-first identity",
      description: "Separate work and personal profiles.",
      icon: Fingerprint,
    },
    {
      title: "Instant QR sharing",
      description: "Scan-ready sharing that stays controlled.",
      icon: QrCode,
    },
    {
      title: "Permission-based",
      description: "Share only what each connection should see.",
      icon: ShieldCheck,
    },
  ] as const;

  return (
    <section className="relative flex min-h-[100dvh] w-full flex-col items-center justify-center overflow-x-hidden px-4 py-8 sm:py-12">
      {/* Immersive Mobile Background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden isolate -z-10 bg-background">
        <motion.div
          animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-[10%] -left-[10%] w-[120%] h-[50%] bg-brandRose/20 blur-[100px] rounded-[100%]"
        />
        <motion.div
           animate={{ scale: [1, 1.15, 1], opacity: [0.2, 0.4, 0.2] }}
           transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
           className="absolute -bottom-[10%] -right-[10%] w-[120%] h-[50%] bg-brandCyan/20 blur-[100px] rounded-[100%]"
        />
      </div>

      <div className="w-full max-w-[400px] flex flex-col gap-8 pb-10">
        {/* Mobile Header */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col items-center text-center space-y-5 mt-4"
        >
          <motion.span 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="inline-flex items-center gap-1.5 rounded-full border border-black/5 dark:border-white/10 bg-white/60 dark:bg-black/40 backdrop-blur-xl px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-foreground/70 shadow-sm"
          >
            <Sparkles className="h-3 w-3 text-brandRose dark:text-brandCyan" />
            Join Dotly
          </motion.span>
          
          <div className="space-y-2">
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl text-balance">
              Your safe sharing identity.
            </h1>
            <p className="text-[15px] leading-relaxed text-muted-foreground text-balance px-2">
              Create a secure account for personas, QR sharing, and controlled connections.
            </p>
          </div>
        </motion.div>

        {/* Mobile Form Container - Super minimal */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full"
        >
          <div className="relative overflow-hidden rounded-[2rem] border border-white/50 dark:border-white/10 bg-white/70 dark:bg-black/50 p-6 sm:p-8 shadow-[0_8px_40px_rgba(0,0,0,0.06)] dark:shadow-[0_8px_40px_rgba(0,0,0,0.4)] backdrop-blur-2xl">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent dark:via-white/20"
            />
            <AuthForm mode="signup" redirectTo={redirectTo} />
          </div>
        </motion.div>

        {/* Mobile Highlights List */}
        <motion.div 
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0 },
            visible: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.5 } }
          }}
          className="flex flex-col gap-3 px-2"
        >
          {signupHighlights.map(({ title, description, icon: Icon }) => (
            <motion.div
              variants={{
                hidden: { opacity: 0, y: 10 },
                visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
              }}
              key={title}
              className="flex items-center gap-4 rounded-[1.25rem] border border-white/30 dark:border-white/5 bg-white/30 dark:bg-white/[0.02] p-4 backdrop-blur-md"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[0.85rem] bg-white shadow-sm dark:bg-white/10 text-brandRose dark:text-brandCyan">
                <Icon className="h-4.5 w-4.5" />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[14.5px] font-semibold tracking-tight text-foreground">{title}</span>
                <span className="text-[12.5px] text-muted-foreground opacity-90">{description}</span>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
