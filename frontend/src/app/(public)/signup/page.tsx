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

const onboardingSteps = [
  "Create account",
  "Set first persona",
  "Open your QR",
] as const;

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
  searchParams: Promise<{ next?: string; ref?: string }>;
}) {
  const resolvedSearchParams = use(searchParams);
  const redirectTo = resolvedSearchParams.next || routes.app.home;
  const referralCode = resolvedSearchParams.ref?.trim().toUpperCase();

  return (
    <div className="relative w-full min-h-screen flex flex-col pt-20 pb-12 overflow-x-hidden md:pt-32">
      {/* Immersive ambient background */}
      <div className="fixed inset-0 z-[-1] pointer-events-none flex items-center justify-center overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] h-[1000px] w-[1000px] rounded-full bg-accent/10 blur-[150px] mix-blend-normal opacity-60" />
        <div className="absolute bottom-[-10%] right-[-10%] h-[800px] w-[800px] rounded-full bg-accent/5 blur-[120px] mix-blend-normal opacity-40" />
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
                className="text-4xl sm:text-5xl lg:text-[5.5rem] font-bold tracking-tighter text-foreground leading-[1.05] mb-4 md:mb-6"
                style={{ WebkitFontSmoothing: "antialiased" }}
              >
                Claim your <br className="hidden md:block" /> identity.
              </h1>
              <p className="text-[17px] sm:text-[21px] text-muted font-medium leading-relaxed max-w-[32ch] md:max-w-[38ch] mx-auto lg:mx-0">
                {dotlyPositioning.auth.signupDescription}
              </p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-2 lg:justify-start">
                {onboardingSteps.map((step, index) => (
                  <div
                    key={step}
                    className="inline-flex items-center gap-2 rounded-full border border-black/5 bg-black/[0.03] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground dark:border-white/10 dark:bg-white/[0.04]"
                  >
                    <span className="text-muted">0{index + 1}</span>
                    <span>{step}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Feature List - Hidden on small mobile, visible on tablet/desktop to keep the form accessible instantly */}
            <motion.div
              variants={fadeUp}
              className="hidden sm:block space-y-6 md:space-y-8 w-full border-t border-black/5 dark:border-white/10 pt-8 md:pt-10"
            >
              {features.map((feature, idx) => {
                const Icon = feature.icon;
                return (
                  <div
                    key={idx}
                    className="flex flex-col md:flex-row items-center md:items-start gap-4 md:gap-5 group text-center md:text-left"
                  >
                    <div className="flex h-12 w-12 md:h-16 md:w-16 shrink-0 items-center justify-center rounded-[16px] md:rounded-[22px] bg-gradient-to-br from-black/5 dark:from-white/10 to-transparent shadow-inner ring-1 ring-black/5 dark:ring-white/10 transition-all duration-500 ease-out group-hover:scale-[1.03] group-hover:bg-black/[0.04] dark:group-hover:bg-white/[0.08]">
                      <Icon
                        className="h-5 w-5 md:h-7 md:w-7 text-foreground"
                        strokeWidth={1.5}
                      />
                    </div>
                    <div className="pt-2">
                      <h3 className="text-[17px] md:text-[20px] font-bold text-foreground tracking-tight mb-1">
                        {feature.title}
                      </h3>
                      <p className="text-[15px] md:text-[17px] text-muted font-medium leading-relaxed max-w-[32ch] md:max-w-[36ch] mx-auto md:mx-0">
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
            <div className="rounded-[2.5rem] md:rounded-[3rem] p-8 sm:p-10 md:p-14 border border-black/5 dark:border-white/10 bg-black/[0.02] dark:bg-black/[0.02] dark:bg-white/[0.02] backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.2)]">
              <div className="mb-8 md:mb-10 space-y-2 text-center md:text-left">
                <h2 className="text-[28px] md:text-[32px] font-bold tracking-tighter text-foreground leading-[1.1]">
                  Create your account
                </h2>
                <p className="text-[16px] md:text-[17px] text-muted font-medium">
                  {referralCode
                    ? `Invite code ${referralCode} is already applied.`
                    : "Create the account now. Persona setup and QR come next."}
                </p>
              </div>
              <AuthForm
                mode="signup"
                redirectTo={redirectTo}
                referralCode={referralCode}
              />
            </div>

            {/* Mobile-only feature scroll (shows below form on smallest screens) */}
            <div className="sm:hidden mt-12 space-y-6 pb-8">
              {features.map((feature, idx) => {
                const Icon = feature.icon;
                return (
                  <div
                    key={idx}
                    className="flex gap-5 items-start bg-black/[0.02] dark:bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/10 backdrop-blur-md p-5 rounded-[1.5rem] shadow-[0_4px_24px_rgba(0,0,0,0.02)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.1)]"
                  >
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-black/5 dark:from-white/10 to-transparent ring-1 ring-black/5 dark:ring-white/10 shadow-inner">
                      <Icon
                        className="h-6 w-6 text-foreground"
                        strokeWidth={1.5}
                      />
                    </div>
                    <div className="pt-0.5">
                      <h3 className="text-[17px] font-bold text-foreground tracking-tight mb-1">
                        {feature.title}
                      </h3>
                      <p className="text-[15px] text-muted font-medium leading-relaxed">
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
