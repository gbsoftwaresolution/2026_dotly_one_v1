"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { PasswordField } from "@/components/forms/password-field";
import { PrimaryButton } from "@/components/shared/primary-button";
import { authApi } from "@/lib/api";
import {
  APP_DATA_WARM_ROUTES,
  prefetchAppCoreData,
} from "@/lib/app-data-store";
import {
  getFriendlyAuthError,
  type AuthMode,
} from "@/lib/auth/auth-error-messages";
import { ACCESS_TOKEN_COOKIE } from "@/lib/auth/constants";
import { dotlyPositioning } from "@/lib/constants/positioning";
import { E2E_MOCK_ACCESS_TOKEN } from "@/lib/e2e/mock-data";
import { isE2eMockMode } from "@/lib/e2e/mock-mode";
import { routes } from "@/lib/constants/routes";
import { prefetchMyFastShare } from "@/lib/share-fast-store";
import { cn } from "@/lib/utils/cn";
import { motion, AnimatePresence } from "framer-motion";

interface AuthFormProps {
  mode: AuthMode;
  redirectTo?: string;
  initialEmail?: string;
  referralCode?: string;
}

const INPUT_CLASSES =
  "peer min-h-[56px] w-full rounded-[16px] bg-foreground/[0.03] px-4 pt-5 pb-2 text-[16px] font-medium text-foreground outline-none transition-all duration-300 shadow-inner ring-1 ring-black/5 placeholder:text-transparent focus:bg-foreground/[0.045] focus:ring-2 focus:ring-foreground/15 focus:shadow-md dark:bg-white/[0.045] dark:ring-white/10 dark:focus:bg-white/[0.07]";

const LABEL_CLASSES =
  "absolute left-4 top-4 z-10 origin-[0] -translate-y-2 scale-[0.80] transform text-[13px] font-medium text-muted transition-all duration-200 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-placeholder-shown:text-muted/70 peer-focus:-translate-y-2 peer-focus:scale-[0.80] peer-focus:text-accent pointer-events-none";

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
        "border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-300",
    };
  }

  if (score <= 4) {
    return {
      label: "Good",
      className: "border border-accent/20 bg-accent/10 text-accent",
    };
  }

  return {
    label: "Strong",
    className:
      "border border-status-success/30 bg-status-success/10 text-status-success",
  };
}

export function AuthForm({
  mode,
  redirectTo = routes.app.home,
  initialEmail = "",
  referralCode,
}: AuthFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmPasswordError, setConfirmPasswordError] = useState<
    string | null
  >(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const content = useMemo(
    () =>
      mode === "login"
        ? {
            submitLabel: "Log in",
            alternateLabel: "Need an account?",
            alternateHref: routes.public.signup,
            alternateAction: "Sign up",
          }
        : {
            submitLabel: dotlyPositioning.cta.primary,
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

  function completeLoginRedirect(nextPath: string) {
    for (const route of APP_DATA_WARM_ROUTES) {
      router.prefetch(route);
    }

    router.prefetch(nextPath);
    void prefetchMyFastShare({ force: true }).catch(() => undefined);
    void prefetchAppCoreData({ force: true }).catch(() => undefined);
    router.replace(nextPath);
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
        const result = await authApi.signup({
          email: normalizedEmail,
          password,
          ...(referralCode ? { referralCode } : {}),
        });
        const deliveryState = result.verificationEmailSent
          ? "sent"
          : "disabled";

        setSuccessMessage(
          result.verificationEmailSent
            ? "Confirmation email sent. Redirecting you to login..."
            : "Account created. Verification is still required, but email delivery is not configured in this environment.",
        );
        router.push(
          `${routes.public.login}?email=${encodeURIComponent(normalizedEmail)}&created=1&delivery=${deliveryState}`,
        );
        return;
      }

      const nextPath = sanitizeRedirectPath(redirectTo);

      if (isE2eMockMode()) {
        document.cookie = `${ACCESS_TOKEN_COOKIE}=${E2E_MOCK_ACCESS_TOKEN}; path=/; SameSite=Lax`;
        completeLoginRedirect(nextPath);
        return;
      }

      await authApi.login({ email: normalizedEmail, password });
      completeLoginRedirect(nextPath);
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
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-6"
      onSubmit={handleSubmit}
    >
      <div className="relative group">
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
                        "inline-flex rounded-full px-2.5 py-1 font-sans text-[11px] font-bold uppercase tracking-[0.12em]",
                        passwordStrength.className,
                      )}
                    >
                      {passwordStrength.label}
                    </span>
                  </div>
                ) : null}
              </div>
            ) : null
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
            footer={
              <p>Match your password exactly before creating the account.</p>
            }
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

      {mode === "login" ? (
        <div className="-mt-1 flex justify-end">
          <Link
            href={routes.public.forgotPassword}
            className="text-sm font-medium text-accent transition-colors hover:text-accent/80"
          >
            Forgot password?
          </Link>
        </div>
      ) : null}

      <AnimatePresence mode="popLayout">
        {error ? (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className="rounded-[16px] bg-status-error/10 px-4 py-3.5 ring-1 ring-status-error/20 backdrop-blur-md"
          >
            <p className="text-[14px] font-medium text-status-error">{error}</p>
          </motion.div>
        ) : null}

        {successMessage ? (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className="rounded-[16px] bg-status-success/10 px-4 py-3.5 ring-1 ring-status-success/20 backdrop-blur-md"
          >
            <p className="text-[14px] font-medium text-status-success">
              {successMessage}
            </p>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="pt-4">
        <PrimaryButton
          type="submit"
          className="w-full h-[56px] rounded-full text-[17px] font-semibold bg-foreground text-background transition-transform hover:scale-[0.98] tap-feedback shadow-float"
          disabled={isSubmitting}
          isLoading={isSubmitting}
          isSuccess={Boolean(successMessage) && !isSubmitting}
        >
          {successMessage && !isSubmitting
            ? "Account ready"
            : content.submitLabel}
        </PrimaryButton>
      </div>

      {mode === "signup" ? (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-center text-[13px] leading-relaxed text-muted mt-6"
        >
          By creating an account, you agree to Dotly&apos;s{" "}
          <Link
            href={routes.public.terms}
            className="font-medium text-foreground hover:text-accent underline-offset-4 hover:underline transition-colors"
          >
            Terms
          </Link>{" "}
          and acknowledge the{" "}
          <Link
            href={routes.public.privacy}
            className="font-medium text-foreground hover:text-accent underline-offset-4 hover:underline transition-colors"
          >
            Privacy Policy
          </Link>
          .
        </motion.p>
      ) : null}

      <p className="text-center text-[15px] font-medium text-muted pt-4">
        {content.alternateLabel}{" "}
        <Link
          href={content.alternateHref}
          className="font-semibold text-foreground hover:text-accent transition-colors ml-1"
        >
          {content.alternateAction}
        </Link>
      </p>
    </motion.form>
  );
}
