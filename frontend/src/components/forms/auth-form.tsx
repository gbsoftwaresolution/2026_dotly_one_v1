"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { PasswordField } from "@/components/forms/password-field";
import { PrimaryButton } from "@/components/shared/primary-button";
import { authApi } from "@/lib/api";
import {
  getFriendlyAuthError,
  type AuthMode,
} from "@/lib/auth/auth-error-messages";
import { routes } from "@/lib/constants/routes";
import { cn } from "@/lib/utils/cn";
import { motion, AnimatePresence } from "framer-motion";

interface AuthFormProps {
  mode: AuthMode;
  redirectTo?: string;
  initialEmail?: string;
}

const INPUT_CLASSES =
  "peer min-h-[54px] w-full rounded-[16px] border border-black/10 dark:border-white/10 bg-white/50 dark:bg-white/[0.03] px-4 pt-4 pb-1.5 text-[15px] font-medium text-foreground outline-none backdrop-blur-2xl transition-all duration-300 hover:border-black/20 dark:hover:border-white/20 hover:bg-white/70 dark:hover:bg-white/[0.05] focus:bg-white dark:focus:bg-black focus:border-brandRose focus:ring-[3px] focus:ring-brandRose/15 dark:focus:border-brandCyan dark:focus:ring-brandCyan/15 placeholder:text-transparent shadow-sm";

const LABEL_CLASSES =
  "absolute left-4 top-4 z-10 origin-[0] -translate-y-2.5 scale-[0.85] transform text-[13px] text-muted-foreground duration-200 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-focus:-translate-y-2.5 peer-focus:scale-[0.85] peer-focus:text-brandRose dark:peer-focus:text-brandCyan pointer-events-none";

const SIGNUP_PASSWORD_HELPER =
  "Recommended: use 12+ characters with a mix of letters, numbers, and symbols. Avoid reusing a password from another service.";

function sanitizeRedirectPath(path: string): string {
  if (!path.startsWith("/") || path.startsWith("//")) {
    return routes.app.home;
  }

  return path;
}

function getPasswordStrength(password: string): {
  label: string;
  className: string;
} | null {
  if (!password) {
    return null;
  }

  let score = 0;

  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  if (score <= 2) {
    return {
      label: "Needs work",
      className:
        "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-300",
    };
  }

  if (score <= 4) {
    return {
      label: "Good",
      className:
        "border-brandRose/25 bg-brandRose/10 text-brandRose dark:border-brandCyan/25 dark:bg-brandCyan/10 dark:text-brandCyan",
    };
  }

  return {
    label: "Strong",
    className:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
  };
}

export function AuthForm({
  mode,
  redirectTo = routes.app.home,
  initialEmail = "",
}: AuthFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmPasswordError, setConfirmPasswordError] = useState<string | null>(
    null,
  );
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const content = useMemo(
    () =>
      mode === "login"
        ? {
            title: "Welcome back",
            description:
              "Sign in to manage your personas, QR sharing, and access controls.",
            submitLabel: "Log in",
            alternateLabel: "Need an account?",
            alternateHref: routes.public.signup,
            alternateAction: "Sign up",
          }
        : {
            title: "Create your account",
            description:
              "Create your Dotly account, confirm your email, and start sharing with the right level of access.",
            submitLabel: "Create account",
            alternateLabel: "Already have an account?",
            alternateHref: routes.public.login,
            alternateAction: "Log in",
          },
    [mode],
  );

  const passwordStrength =
    mode === "signup" ? getPasswordStrength(password) : null;

  function resetFormFeedback() {
    setError(null);
    setSuccessMessage(null);
  }

  function validateSignupFields(): boolean {
    const nextPasswordError =
      password.length < 6 ? "Use at least 6 characters." : null;
    const nextConfirmPasswordError =
      confirmPassword.length === 0
        ? "Confirm your password to continue."
        : password !== confirmPassword
          ? "Passwords must match to continue."
          : null;

    setPasswordError(nextPasswordError);
    setConfirmPasswordError(nextConfirmPasswordError);

    return !nextPasswordError && !nextConfirmPasswordError;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    resetFormFeedback();

    const normalizedEmail = email.trim();
    setEmail(normalizedEmail);

    if (mode === "signup" && !validateSignupFields()) {
      return;
    }

    setIsSubmitting(true);

    try {
      if (mode === "signup") {
        const result = await authApi.signup({ email: normalizedEmail, password });
        const deliveryState = result.verificationEmailSent ? "sent" : "disabled";

        setSuccessMessage(
          result.verificationEmailSent
            ? "Confirmation email sent. Redirecting you to login..."
            : "Account created. Verification is still required, but email delivery is not configured in this environment.",
        );
        router.push(
          `${routes.public.login}?email=${encodeURIComponent(normalizedEmail)}&created=1&delivery=${deliveryState}`,
        );
        router.refresh();
        return;
      }

      await authApi.login({ email: normalizedEmail, password });
      router.replace(sanitizeRedirectPath(redirectTo));
      router.refresh();
    } catch (submissionError) {
      setError(getFriendlyAuthError(mode, submissionError));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <motion.form 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6 form-apple" 
      onSubmit={handleSubmit}
    >
      <div className="space-y-1.5 text-center">
        <h2 className="text-[28px] font-bold tracking-tight text-foreground text-balance">
          {content.title}
        </h2>
        <p className="text-[15px] leading-relaxed text-muted-foreground/90 text-balance">
          {content.description}
        </p>
      </div>

      <div className="relative pt-2 group">
        <input
          id="email"
          required
          autoComplete="email"
          className={INPUT_CLASSES}
          placeholder="name@example.com"
          type="email"
          value={email}
          onChange={(event) => {
            resetFormFeedback();
            setEmail(event.target.value);
          }}
        />
        <label className={LABEL_CLASSES} htmlFor="email">
          Email
        </label>
      </div>

      <div className="pt-2">
      <PasswordField
        id="password"
        label="Password"
        value={password}
        minLength={6}
        maxLength={72}
        autoComplete={mode === "login" ? "current-password" : "new-password"}
        placeholder={
          mode === "signup" ? "Use a strong password" : "Enter your password"
        }
        error={passwordError}
        footer={
          mode === "signup" ? (
            <div className="space-y-2">
              <p>{SIGNUP_PASSWORD_HELPER}</p>
              {passwordStrength ? (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted/80">
                    Password strength
                  </span>
                  <span
                    className={cn(
                      "inline-flex rounded-full border px-2.5 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.12em]",
                      passwordStrength.className,
                    )}
                  >
                    {passwordStrength.label}
                  </span>
                </div>
              ) : null}
            </div>
          ) : (
            <p>Use the password associated with your Dotly account.</p>
          )
        }
        onChange={(nextPassword) => {
          resetFormFeedback();
          setPassword(nextPassword);

          if (passwordError) {
            setPasswordError(null);
          }

          if (confirmPasswordError && confirmPassword.length > 0) {
            setConfirmPasswordError(
              nextPassword === confirmPassword
                ? null
                : "Passwords must match to continue.",
            );
          }
        }}
      />
      </div>

      {mode === "signup" ? (
        <motion.div 
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="pt-2"
        >
        <PasswordField
          id="confirm-password"
          label="Confirm password"
          value={confirmPassword}
          minLength={6}
          maxLength={72}
          autoComplete="new-password"
          placeholder="Re-enter your password"
          error={confirmPasswordError}
          footer={<p>Match your password exactly before creating the account.</p>}
          onChange={(nextValue) => {
            resetFormFeedback();
            setConfirmPassword(nextValue);
            setConfirmPasswordError(
              nextValue.length === 0 || nextValue === password
                ? null
                : "Passwords must match to continue.",
            );
          }}
        />
        </motion.div>
      ) : null}

      <AnimatePresence mode="popLayout">
        {error ? (
          <motion.div 
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className="rounded-2xl border border-rose-500/20 bg-rose-500/5 px-4 py-3.5 shadow-sm backdrop-blur-md"
          >
            <p className="text-[14px] font-medium text-rose-600 dark:text-rose-400">
              {error}
            </p>
          </motion.div>
        ) : null}

        {successMessage ? (
          <motion.div 
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3.5 shadow-sm backdrop-blur-md"
          >
            <p className="text-[14px] font-medium text-emerald-600 dark:text-emerald-400">
              {successMessage}
            </p>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="pt-2">
      <PrimaryButton
        type="submit"
        className="w-full h-[52px] rounded-[14px] text-[15px] font-semibold tracking-wide shadow-md transition-all duration-300 hover:shadow-lg hover:-translate-y-[1px] active:translate-y-[1px] active:shadow-sm"
        disabled={isSubmitting}
        isLoading={isSubmitting}
        isSuccess={Boolean(successMessage) && !isSubmitting}
      >
        {successMessage && !isSubmitting ? "Account ready" : content.submitLabel}
      </PrimaryButton>
      </div>

      {mode === "signup" ? (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="space-y-6"
        >
          <p className="text-center text-[13px] leading-relaxed text-muted-foreground">
            By creating an account, you agree to Dotly&apos;s {" "}
            <Link
              href={routes.public.terms}
              className="font-semibold text-brandRose hover:text-brandRose/80 underline-offset-4 hover:underline dark:text-brandCyan dark:hover:text-brandCyan/80 transition-colors"
            >
              Terms
            </Link>{" "}
            and acknowledge the {" "}
            <Link
              href={routes.public.privacy}
              className="font-semibold text-brandRose hover:text-brandRose/80 underline-offset-4 hover:underline dark:text-brandCyan dark:hover:text-brandCyan/80 transition-colors"
            >
              Privacy Policy
            </Link>
            .
          </p>

          <div className="rounded-[1.25rem] border border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02] px-5 py-4 backdrop-blur-md">
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground/80">
              What happens next
            </p>
            <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">
              Create your account, confirm your email, log in, build your first
              persona, and start sharing with the right access level.
            </p>
          </div>
        </motion.div>
      ) : null}

      <p className="text-center text-[14px] font-medium text-muted-foreground pt-4">
        {content.alternateLabel}{" "}
        <Link
          href={content.alternateHref}
          className="font-semibold text-foreground hover:text-brandRose dark:hover:text-brandCyan transition-colors"
        >
          {content.alternateAction}
        </Link>
      </p>
    </motion.form>
  );
}