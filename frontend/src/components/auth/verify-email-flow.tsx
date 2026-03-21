"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

import { PrimaryButton } from "@/components/shared/primary-button";
import { authApi } from "@/lib/api";
import { ApiError } from "@/lib/api/client";
import { routes } from "@/lib/constants/routes";
import { ShieldCheck, Mail, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";

const INPUT_CLASSES =
  "peer min-h-[54px] w-full rounded-[16px] border border-black/10 dark:border-white/10 bg-white/50 dark:bg-white/[0.03] px-4 pt-4 pb-1.5 text-[15px] font-medium text-foreground outline-none backdrop-blur-2xl transition-all duration-300 hover:border-black/20 dark:hover:border-white/20 hover:bg-white/70 dark:hover:bg-white/[0.05] focus:bg-white dark:focus:bg-black focus:border-brandRose focus:ring-[3px] focus:ring-brandRose/15 dark:focus:border-brandCyan dark:focus:ring-brandCyan/15 placeholder:text-transparent shadow-sm";

const LABEL_CLASSES =
  "absolute left-4 top-4 z-10 origin-[0] -translate-y-2.5 scale-[0.85] transform text-[13px] text-muted-foreground duration-200 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-focus:-translate-y-2.5 peer-focus:scale-[0.85] peer-focus:text-brandRose dark:peer-focus:text-brandCyan pointer-events-none";

function getResendErrorMessage(error: unknown): string {
  if (
    error instanceof ApiError &&
    (error.status === 429 || /wait|too many/i.test(error.message))
  ) {
    return "Please wait a minute before asking for another verification email.";
  }

  return "We couldn't send another verification email right now. Please try again shortly.";
}

type VerificationStatus = "ready" | "verifying" | "success" | "invalid";

export function VerifyEmailFlow({
  initialToken,
  initialEmail = "",
}: {
  initialToken?: string;
  initialEmail?: string;
}) {
  const [status, setStatus] = useState<VerificationStatus>(
    initialToken ? "verifying" : "ready",
  );
  const [email, setEmail] = useState(initialEmail);
  const [verifiedEmail, setVerifiedEmail] = useState(initialEmail);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    if (!initialToken) {
      return;
    }

    let cancelled = false;

    setStatus("verifying");
    setError(null);
    setFeedback(null);

    void authApi
      .verifyEmail(initialToken)
      .then((result) => {
        if (cancelled) {
          return;
        }

        setVerifiedEmail(result.user.email);
        setStatus("success");
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        setStatus("invalid");
        setError(
          "This link is invalid or expired. Request a fresh one below.",
        );
      });

    return () => {
      cancelled = true;
    };
  }, [initialToken]);

  async function handleResend(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedEmail = email.trim().toLowerCase();
    setEmail(normalizedEmail);
    setFeedback(null);
    setError(null);

    if (!normalizedEmail) {
      setError("Enter the email address you used for Dotly.");
      return;
    }

    setIsResending(true);

    try {
      const result = await authApi.resendVerificationEmail({
        email: normalizedEmail,
      });

      setFeedback(
        result.verificationEmailSent
          ? "A new link is on the way. Check your inbox and spam folder."
          : result.mailDeliveryAvailable
            ? "Verification is still pending. Check your inbox for the latest message from Dotly."
            : "Delivery is disabled in this environment, but the resend flow is ready for production mail.",
      );
    } catch (resendError) {
      setError(getResendErrorMessage(resendError));
    } finally {
      setIsResending(false);
    }
  }

  const loginHref = verifiedEmail
    ? `${routes.public.login}?email=${encodeURIComponent(verifiedEmail)}&verified=1`
    : `${routes.public.login}?verified=1`;

  return (
    <section className="relative flex w-full flex-col items-center justify-center overflow-x-hidden py-12 sm:py-24">
      {/* Immersive Background */}
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

      <div className="w-full max-w-[400px] flex flex-col gap-6 px-4">
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="relative overflow-hidden rounded-[2rem] border border-white/50 dark:border-white/10 bg-white/70 dark:bg-black/50 p-6 sm:p-8 shadow-[0_8px_40px_rgba(0,0,0,0.06)] dark:shadow-[0_8px_40px_rgba(0,0,0,0.4)] backdrop-blur-2xl"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent dark:via-white/20"
          />

          <AnimatePresence mode="wait">
            {status === "verifying" && (
              <motion.div
                key="verifying"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex flex-col items-center text-center space-y-6"
              >
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brandRose/10 text-brandRose dark:bg-brandCyan/10 dark:text-brandCyan">
                  <RefreshCw className="h-8 w-8 animate-spin" />
                </div>
                <div className="space-y-2">
                  <h1 className="text-2xl font-extrabold tracking-tight text-foreground text-balance">
                    Verifying email...
                  </h1>
                  <p className="text-[15px] leading-relaxed text-muted-foreground text-balance px-2">
                    Hang tight! Checking your link.
                  </p>
                </div>
              </motion.div>
            )}

            {status === "success" && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex flex-col items-center text-center space-y-6"
              >
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <div className="space-y-2">
                  <h1 className="text-2xl font-extrabold tracking-tight text-foreground text-balance">
                    Email verified!
                  </h1>
                  <p className="text-[15px] leading-relaxed text-muted-foreground text-balance px-2">
                    Verified sharing and trust-based access are now unlocked.
                  </p>
                </div>
                <Link href={loginHref} className="w-full">
                  <PrimaryButton className="w-full rounded-2xl">Continue to app</PrimaryButton>
                </Link>
              </motion.div>
            )}

            {(status === "ready" || status === "invalid") && (
              <motion.div
                key="form"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex flex-col items-center space-y-6 w-full"
              >
                <div className="flex flex-col items-center text-center space-y-4">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-black/5 dark:border-white/10 bg-white/60 dark:bg-white/5 backdrop-blur-xl px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-foreground/70 shadow-sm">
                    {status === "invalid" ? (
                      <><AlertCircle className="h-3 w-3 text-amber-500" /> Link expired</>
                    ) : (
                      <><ShieldCheck className="h-3 w-3 text-brandRose dark:text-brandCyan" /> Account Security</>
                    )}
                  </span>
                  
                  <div className="space-y-2">
                    <h1 className="text-2xl font-extrabold tracking-tight text-foreground text-balance">
                      {status === "invalid" ? "Need a new link?" : "Verify your email"}
                    </h1>
                    <p className="text-[15px] leading-relaxed text-muted-foreground text-balance px-1">
                      {status === "invalid"
                        ? "Verification links expire. Request a fresh one to unlock features."
                        : "Enter your email and Dotly will send another link if needed."}
                    </p>
                  </div>
                </div>

                <div className="w-full space-y-4">
                  <AnimatePresence>
                    {error && (
                      <motion.div
                        initial={{ opacity: 0, height: 0, y: -10 }}
                        animate={{ opacity: 1, height: "auto", y: 0 }}
                        exit={{ opacity: 0, height: 0, y: -10 }}
                        className="rounded-[1rem] border border-rose-500/20 bg-rose-500/5 px-4 py-3"
                      >
                        <p className="text-[13px] font-medium text-rose-600 dark:text-rose-400">
                          {error}
                        </p>
                      </motion.div>
                    )}

                    {feedback && (
                      <motion.div
                        initial={{ opacity: 0, height: 0, y: -10 }}
                        animate={{ opacity: 1, height: "auto", y: 0 }}
                        exit={{ opacity: 0, height: 0, y: -10 }}
                        className="rounded-[1rem] border border-emerald-500/20 bg-emerald-500/5 px-4 py-3"
                      >
                        <p className="text-[13px] font-medium text-emerald-600 dark:text-emerald-400">
                          {feedback}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <form className="space-y-4 w-full" onSubmit={handleResend}>
                    <div className="relative">
                      <input
                        id="verification-email"
                        required
                        autoComplete="email"
                        placeholder="name@example.com"
                        type="email"
                        value={email}
                        onChange={(event) => {
                          setEmail(event.target.value);
                          if (error) setError(null);
                        }}
                        className={INPUT_CLASSES}
                      />
                      <label htmlFor="verification-email" className={LABEL_CLASSES}>
                        Email Address
                      </label>
                    </div>

                    <PrimaryButton
                      type="submit"
                      className="w-full rounded-2xl"
                      disabled={isResending}
                      isLoading={isResending}
                    >
                      Resend link
                    </PrimaryButton>
                  </form>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Action Link Footer */}
        {status !== "success" && status !== "verifying" && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="flex justify-center"
          >
            <Link
              href={routes.public.login}
              className="text-[14px] font-medium text-muted-foreground hover:text-foreground transition-colors underline-offset-4 hover:underline"
            >
              Back to login
            </Link>
          </motion.div>
        )}
      </div>
    </section>
  );
}
