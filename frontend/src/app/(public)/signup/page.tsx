"use client";

import { use } from "react";
import { motion } from "framer-motion";
import { QrCode, Shield, Zap } from "lucide-react";

import { AuthForm } from "@/components/forms/auth-form";
import { dotlyPositioning } from "@/lib/constants/positioning";
import { routes } from "@/lib/constants/routes";

const features = [
  {
    icon: QrCode,
    title: "Your identity, scannable.",
    description: "Get your personal QR instantly. No app required.",
  },
  {
    icon: Shield,
    title: "Privacy by design.",
    description: "Share only what you want, when you want.",
  },
  {
    icon: Zap,
    title: "Context that lasts.",
    description: "Organize who you met, when, and why it mattered.",
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 15 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const },
  },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

export default function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const resolvedSearchParams = use(searchParams);
  const redirectTo = resolvedSearchParams.next || routes.app.home;

  return (
    <div className="relative w-full min-h-screen flex flex-col pt-20 pb-12 overflow-x-hidden md:pt-32">
      {/* Immersive ambient background */}
      <div className="fixed inset-0 z-[-1] pointer-events-none flex items-center justify-center overflow-hidden">
        <div className="absolute top-[0%] left-[-10%] h-[800px] w-[800px] rounded-full bg-accent/5 blur-[130px] mix-blend-normal opacity-60" />
        <div className="absolute bottom-[-10%] right-[-10%] h-[600px] w-[600px] rounded-full bg-accent/5 blur-[120px] mix-blend-normal opacity-40" />
      </div>

      <div className="w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 flex-1 flex flex-col md:justify-center">
        <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-8 lg:gap-24 items-start md:items-center flex-1">
          {/* Mobile-First Header Stack (Shows on top on mobile, left on desktop) */}
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="flex flex-col max-w-2xl lg:max-w-none mx-auto lg:mx-0 w-full pt-4 md:pt-0 text-center lg:text-left"
          >
            <motion.div variants={fadeUp} className="mb-8 md:mb-10">
              <h1
                className="text-4xl sm:text-5xl lg:text-[4.5rem] font-bold tracking-tight text-foreground leading-[1.05] mb-4 md:mb-6"
                style={{ letterSpacing: "-0.03em" }}
              >
                Claim your <br className="hidden md:block" /> identity.
              </h1>
              <p className="text-[17px] sm:text-[19px] text-muted font-medium leading-relaxed max-w-[32ch] md:max-w-[38ch] mx-auto lg:mx-0">
                {dotlyPositioning.auth.signupDescription}
              </p>
            </motion.div>

            {/* Feature List - Hidden on small mobile, visible on tablet/desktop to keep the form accessible instantly */}
            <motion.div
              variants={fadeUp}
              className="hidden sm:block space-y-6 md:space-y-8 w-full border-t border-border-subtle pt-8 md:pt-10"
            >
              {features.map((feature, idx) => {
                const Icon = feature.icon;
                return (
                  <div
                    key={idx}
                    className="flex flex-col md:flex-row items-center md:items-start gap-4 md:gap-5 group text-center md:text-left"
                  >
                    <div className="flex h-12 w-12 md:h-14 md:w-14 shrink-0 items-center justify-center rounded-[14px] md:rounded-[18px] bg-foreground/[0.03] dark:bg-foreground/[0.05] ring-1 ring-black/5 dark:ring-white/10 transition-transform duration-500 group-hover:scale-105">
                      <Icon
                        className="h-5 w-5 md:h-6 md:w-6 text-foreground"
                        strokeWidth={1.5}
                      />
                    </div>
                    <div className="pt-1">
                      <h3 className="text-[16px] md:text-[18px] font-semibold text-foreground tracking-tight mb-1">
                        {feature.title}
                      </h3>
                      <p className="text-[14px] md:text-[15px] text-muted font-medium leading-relaxed max-w-[32ch] md:max-w-[36ch] mx-auto md:mx-0">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </motion.div>
          </motion.div>

          {/* Right Column / Mobile Bottom: The Form */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.6,
              ease: [0.16, 1, 0.3, 1] as const,
              delay: 0.2,
            }}
            className="w-full max-w-[480px] mx-auto lg:mx-0 lg:ml-auto relative z-10"
          >
            <div className="premium-card rounded-[2rem] md:rounded-[2.5rem] p-6 sm:p-8 md:p-12 shadow-[0_12px_40px_-10px_rgba(0,0,0,0.1)] dark:shadow-[0_12px_40px_-10px_rgba(0,0,0,0.5)]">
              <div className="mb-6 md:mb-8 space-y-1.5 text-center md:text-left">
                <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                  Create your account
                </h2>
                <p className="text-[14px] md:text-[15px] text-muted font-medium">
                  Join Dotly in seconds.
                </p>
              </div>
              <AuthForm mode="signup" redirectTo={redirectTo} />
            </div>

            {/* Mobile-only feature scroll (shows below form on smallest screens) */}
            <div className="sm:hidden mt-12 space-y-6 pb-8">
              {features.map((feature, idx) => {
                const Icon = feature.icon;
                return (
                  <div
                    key={idx}
                    className="flex gap-4 items-start bg-foreground/[0.02] p-4 rounded-[1.25rem]"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-foreground/[0.05] ring-1 ring-black/5 dark:ring-white/10">
                      <Icon
                        className="h-5 w-5 text-foreground"
                        strokeWidth={1.5}
                      />
                    </div>
                    <div className="pt-0.5">
                      <h3 className="text-[15px] font-semibold text-foreground tracking-tight mb-0.5">
                        {feature.title}
                      </h3>
                      <p className="text-[13px] text-muted font-medium leading-relaxed">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
