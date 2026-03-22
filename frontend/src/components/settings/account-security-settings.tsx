"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Fingerprint,
  KeyRound,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Smartphone,
  Waypoints,
} from "lucide-react";

import { VerificationStatusBadge } from "@/components/auth/verification-status-badge";
import { TrustSignalCard } from "@/components/settings/trust-signal-card";
import { PrimaryButton } from "@/components/shared/primary-button";
import { SecondaryButton } from "@/components/shared/secondary-button";
import { authApi } from "@/lib/api";
import { routes } from "@/lib/constants/routes";
import { cn } from "@/lib/utils/cn";
import type { RequestMobileOtpResult, SessionListResult } from "@/types/auth";
import { classifyAuthError } from "@/lib/utils/auth-errors";
import type {
  UserMobileOtpEnrollment,
  UserProfile,
  UserSessionSummary,
  UserTrustFactor,
} from "@/types/user";

type FeedbackState = {
  tone: "success" | "error" | "warning";
  message: string;
} | null;

type MobileOtpViewState =
  | "not_enrolled"
  | "code_sent"
  | "verifying"
  | "verified"
  | "resend_blocked";

function createOtpRequestState(
  enrollment: UserMobileOtpEnrollment | null,
  deliveryAvailable: boolean,
): RequestMobileOtpResult | null {
  if (!enrollment) {
    return null;
  }

  return {
    status: "sent",
    challengeId: enrollment.challengeId,
    purpose: enrollment.purpose,
    phoneNumber: enrollment.maskedPhoneNumber,
    resendAvailableAt: enrollment.resendAvailableAt,
    expiresAt: enrollment.expiresAt,
    deliveryAvailable,
  };
}

function getInitialMobileOtpViewState(user: UserProfile): MobileOtpViewState {
  if (user.security.phoneVerificationStatus === "verified") {
    return "verified";
  }

  if (user.security.mobileOtpEnrollment) {
    return user.security.mobileOtpEnrollment.canResend
      ? "code_sent"
      : "resend_blocked";
  }

  return "not_enrolled";
}

function formatMobileOtpTime(isoTimestamp: string | undefined): string | null {
  if (!isoTimestamp) {
    return null;
  }

  const parsed = new Date(isoTimestamp);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function getResendFeedback(error: unknown): FeedbackState {
  if (classifyAuthError(error).kind === "throttled") {
    return {
      tone: "warning",
      message:
        "Check the latest message from Dotly and wait about a minute before requesting another verification email.",
    };
  }

  return {
    tone: "error",
    message:
      "Dotly could not resend your verification email right now. Please try again shortly.",
  };
}

function getOtpFeedback(error: unknown): FeedbackState {
  const classifiedError = classifyAuthError(error);

  if (classifiedError.kind === "throttled") {
    return {
      tone: "warning",
      message:
        "Please wait for the resend cooldown to finish before requesting another code.",
    };
  }

  if (classifiedError.kind === "unauthorized") {
    return {
      tone: "warning",
      message: "Your session expired. Sign in again to continue security changes.",
    };
  }

  return {
    tone: "error",
    message:
      classifiedError.kind !== "unknown"
        ? classifiedError.message
        : "Dotly could not complete mobile verification right now.",
  };
}

function TrustStateBadge({ isVerified }: { isVerified: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.16em]",
        isVerified
          ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
          : "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300",
      )}
    >
      {isVerified ? "Trust ready" : "Trust building"}
    </span>
  );
}

function FactorStatusBadge({ status }: { status: UserTrustFactor["status"] }) {
  const copy =
    status === "active"
      ? "Active"
      : status === "inactive"
        ? "Inactive"
        : "Planned";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.16em]",
        status === "active" &&
          "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
        status === "inactive" &&
          "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300",
        status === "planned" &&
          "border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300",
      )}
    >
      {copy}
    </span>
  );
}

function SectionCard({
  title,
  eyebrow,
  children,
  className,
}: {
  title: string;
  eyebrow: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "glass rounded-[28px] border border-border bg-surface p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.24)]",
        className,
      )}
    >
      <div className="space-y-1.5 pb-4">
        <p className="label-xs text-muted">{eyebrow}</p>
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

function ActionList({
  title,
  items,
  emptyState,
  tone,
}: {
  title: string;
  items: string[];
  emptyState: string;
  tone: "success" | "warning";
}) {
  return (
    <div
      className={cn(
        "rounded-[22px] border p-4",
        tone === "success"
          ? "border-emerald-500/20 bg-emerald-500/10"
          : "border-amber-500/20 bg-amber-500/10",
      )}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-foreground/70">
        {title}
      </p>
      <div className="mt-3 space-y-2">
        {items.length > 0 ? (
          items.map((item) => (
            <p key={item} className="text-sm leading-6 text-foreground/85">
              {item}
            </p>
          ))
        ) : (
          <p className="text-sm leading-6 text-muted">{emptyState}</p>
        )}
      </div>
    </div>
  );
}

function FeedbackBanner({ feedback }: { feedback: FeedbackState }) {
  if (!feedback) {
    return null;
  }

  return (
    <div
      className={cn(
        "rounded-[22px] border px-4 py-3",
        feedback.tone === "success" &&
          "border-emerald-500/25 bg-emerald-500/10",
        feedback.tone === "warning" && "border-amber-500/25 bg-amber-500/10",
        feedback.tone === "error" && "border-rose-500/25 bg-rose-500/10",
      )}
    >
      <p className="text-sm leading-6 text-foreground/85">{feedback.message}</p>
    </div>
  );
}

function RequirementStatusBadge({
  unlocked,
}: {
  unlocked: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.16em]",
        unlocked
          ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
          : "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300",
      )}
    >
      {unlocked ? "Unlocked" : "Restricted"}
    </span>
  );
}

function TrustOverviewCard({ user }: { user: UserProfile }) {
  const emailSignal = {
    status: user.isVerified ? "Verified" : "Pending",
    tone: user.isVerified ? ("success" as const) : ("warning" as const),
    description: user.isVerified
      ? "Email is currently accepted as an active trust factor for this account."
      : user.security.mailDeliveryAvailable
        ? "Verify this inbox to unlock trust-sensitive networking and sharing actions."
        : "Mail delivery is off in this environment, so the email trust step is visible but cannot deliver live messages yet.",
  };
  const mobileSignal = {
    status:
      user.security.phoneVerificationStatus === "verified"
        ? "Verified"
        : user.security.phoneVerificationStatus === "pending"
          ? "Pending"
          : "Planned",
    tone:
      user.security.phoneVerificationStatus === "verified"
        ? ("success" as const)
        : user.security.phoneVerificationStatus === "pending"
          ? ("warning" as const)
          : ("info" as const),
    description:
      user.security.phoneVerificationStatus === "verified"
        ? "Mobile OTP is active and ready to support recovery and future step-up checks."
        : user.security.phoneVerificationStatus === "pending"
          ? "A mobile number is waiting for code confirmation before it becomes an active trust factor."
          : user.security.smsDeliveryAvailable
            ? "Mobile OTP is the next trust factor you can enroll for stronger recovery posture."
            : "Mobile OTP is planned here, but SMS delivery is unavailable until the environment is configured.",
  };
  const unlockedRequirementCount = user.security.requirements.filter(
    (requirement) => requirement.unlocked,
  ).length;

  return (
    <SectionCard
      eyebrow="Trust Overview"
      title="Security, verification, and account trust"
      className="md:col-span-2"
    >
      <div className="space-y-5">
        <div className="rounded-[24px] border border-border bg-[radial-gradient(circle_at_top_left,rgba(255,51,102,0.16),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.18),transparent_32%)] p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <TrustStateBadge isVerified={user.isVerified} />
                <VerificationStatusBadge isVerified={user.isVerified} />
                {user.security.phoneVerificationStatus === "verified" ? (
                  <span className="inline-flex items-center rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-400">
                    Mobile OTP active
                  </span>
                ) : null}
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {user.email}
                </p>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-foreground/80">
                  {user.security.explanation}
                </p>
              </div>
            </div>

            <div className="grid gap-3 rounded-[20px] border border-black/5 bg-white/70 px-4 py-3 dark:border-white/10 dark:bg-white/[0.04]">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
                  Verification destination
                </p>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {user.security.maskedEmail}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted">
                  Your verification email is sent to this account address.
                </p>
              </div>
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
                  Mobile factor
                </p>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {user.security.maskedPhoneNumber ?? "Not enrolled yet"}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted">
                  {user.security.phoneVerificationStatus === "verified"
                    ? "Your mobile OTP factor is active for trust and recovery readiness."
                    : user.security.phoneVerificationStatus === "pending"
                      ? "A mobile number is pending confirmation. Enter the latest code to activate it."
                      : "Add a phone number to activate the next trust factor for your account."}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <TrustSignalCard
            title="Email trust status"
            status={emailSignal.status}
            tone={emailSignal.tone}
            description={emailSignal.description}
            detail={user.security.maskedEmail}
            icon={<Mail className="h-4 w-4 text-brandRose dark:text-brandCyan" />}
          />
          <TrustSignalCard
            title="Mobile OTP status"
            status={mobileSignal.status}
            tone={mobileSignal.tone}
            description={mobileSignal.description}
            detail={user.security.maskedPhoneNumber ?? "No mobile number enrolled"}
            icon={
              <Smartphone className="h-4 w-4 text-brandRose dark:text-brandCyan" />
            }
          />
          <TrustSignalCard
            title="Trust-sensitive access"
            status={
              user.security.restrictedActions.length === 0
                ? "Unlocked"
                : "Restricted"
            }
            tone={
              user.security.restrictedActions.length === 0 ? "success" : "warning"
            }
            description={
              user.security.restrictedActions.length === 0
                ? "All current trust-sensitive actions are available on this account."
                : `${unlockedRequirementCount} trust requirements are already satisfied. Remaining actions still need a verified trust factor.`
            }
            detail={`${user.security.restrictedActions.length} action${user.security.restrictedActions.length === 1 ? "" : "s"} still gated`}
            icon={
              <ShieldCheck className="h-4 w-4 text-brandRose dark:text-brandCyan" />
            }
          />
          <div className="rounded-[22px] border border-border bg-white/60 p-4 dark:bg-white/[0.03]">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-foreground/70">
              Trust requirements
            </p>
            <div className="mt-3 space-y-2">
              {user.security.requirements.map((requirement) => (
                <div
                  key={requirement.key}
                  className="flex items-center justify-between gap-3 rounded-[18px] border border-black/5 px-3 py-2 dark:border-white/10"
                >
                  <p className="text-sm text-foreground/85">{requirement.label}</p>
                  <RequirementStatusBadge unlocked={requirement.unlocked} />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <ActionList
            title="Unlocked now"
            items={user.security.unlockedActions}
            emptyState="Basic account access stays available, but current trust-sensitive networking actions remain restricted until one active trust factor is verified."
            tone="success"
          />
          <ActionList
            title="Verification required"
            items={user.security.restrictedActions}
            emptyState="All current trust-sensitive actions are available on this account."
            tone="warning"
          />
        </div>
      </div>
    </SectionCard>
  );
}

function VerificationManagementCard({
  user,
  feedback,
  isResending,
  onResend,
}: {
  user: UserProfile;
  feedback: FeedbackState;
  isResending: boolean;
  onResend: () => Promise<void>;
}) {
  return (
    <SectionCard eyebrow="Email Trust" title="Manage email verification">
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-[22px] border border-border bg-white/60 p-4 dark:bg-white/[0.03]">
          <Mail className="mt-0.5 h-5 w-5 text-brandRose dark:text-brandCyan" />
          <div className="space-y-1.5">
            <p className="text-sm font-semibold text-foreground">
              {user.isVerified
                ? "Verified email on file"
                : "Verification pending"}
            </p>
            <p className="text-sm leading-6 text-muted">
              {user.isVerified
                ? "Dotly recognizes this inbox as an active trust factor for your account today."
                : "Use the latest verification email from Dotly to unlock restricted trust-sensitive actions."}
            </p>
            <p className="font-mono text-xs text-muted">
              {user.security.maskedEmail}
            </p>
          </div>
        </div>

        {!user.security.mailDeliveryAvailable ? (
          <div className="rounded-[22px] border border-amber-500/25 bg-amber-500/10 px-4 py-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600 dark:text-amber-300" />
              <p className="text-sm leading-6 text-foreground/80">
                Email delivery is unavailable in this environment. The
                verification surface is ready, and Dotly will send real messages
                as soon as mail is configured.
              </p>
            </div>
          </div>
        ) : null}

        <FeedbackBanner feedback={feedback} />

        {!user.isVerified ? (
          <div className="space-y-3">
            <SecondaryButton
              type="button"
              fullWidth
              isLoading={isResending}
              onClick={() => void onResend()}
            >
              Resend verification email
            </SecondaryButton>

            <div className="rounded-[22px] border border-dashed border-border px-4 py-3">
              <p className="text-sm font-semibold text-foreground">
                Didn&apos;t receive it?
              </p>
              <p className="mt-1 text-sm leading-6 text-muted">
                Check spam or promotions, confirm this inbox can receive
                external mail, and open the most recent message before asking
                for another link.
              </p>
              <Link
                href={`${routes.public.verifyEmail}?email=${encodeURIComponent(user.email)}`}
                className="mt-3 inline-flex text-sm font-semibold text-brandRose transition-colors hover:text-brandRose/80 dark:text-brandCyan dark:hover:text-brandCyan/80"
              >
                Open verification help
              </Link>
            </div>
          </div>
        ) : (
          <div className="rounded-[22px] border border-emerald-500/25 bg-emerald-500/10 px-4 py-3">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <p className="text-sm leading-6 text-foreground/85">
                Your email is already verified. Trust-sensitive networking, QR
                sharing, and current event discovery controls are available for
                this account.
              </p>
            </div>
          </div>
        )}
      </div>
    </SectionCard>
  );
}

function PasswordRecoveryCard({ user }: { user: UserProfile }) {
  return (
    <SectionCard eyebrow="Password" title="Password and recovery">
      <div className="space-y-3">
        <div className="rounded-[22px] border border-border bg-white/60 p-4 dark:bg-white/[0.03]">
          <div className="flex items-start gap-3">
            <KeyRound className="mt-0.5 h-5 w-5 text-brandRose dark:text-brandCyan" />
            <div>
              <p className="text-sm font-semibold text-foreground">
                Forgot your password?
              </p>
              <p className="mt-1 text-sm leading-6 text-muted">
                {user.security.passwordResetAvailable
                  ? "Use the public recovery flow to request a secure reset link and finish the reset from your email."
                  : "Recovery is visible here, but reset email delivery is unavailable in this environment until mail is configured."}
              </p>
              <Link
                href={routes.public.forgotPassword}
                className="mt-3 inline-flex text-sm font-semibold text-brandRose transition-colors hover:text-brandRose/80 dark:text-brandCyan dark:hover:text-brandCyan/80"
              >
                Open password recovery
              </Link>
            </div>
          </div>
        </div>
        <div className="rounded-[22px] border border-dashed border-border px-4 py-3">
          <p className="text-sm font-semibold text-foreground">
            Recovery behavior
          </p>
          <p className="mt-1 text-sm leading-6 text-muted">
            Reset links are one-time, hashed, time-limited, and revoke older
            reset attempts. Completing a reset signs every device out.
          </p>
        </div>
      </div>
    </SectionCard>
  );
}

function ChangePasswordCard() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setFeedback(null);

    try {
      await authApi.changePassword({
        currentPassword,
        newPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      const nextFeedback = {
        tone: "success" as const,
        message:
          "Password updated. Dotly signed your other devices out so this credential change takes effect everywhere.",
      };
      setFeedback(nextFeedback);
    } catch (error) {
      const classifiedError = classifyAuthError(error);

      setFeedback({
        tone: classifiedError.kind === "unauthorized" ? "warning" : "error",
        message:
          classifiedError.kind !== "unknown"
            ? classifiedError.kind === "unauthorized"
              ? "Your session expired. Sign in again to change your password."
              : classifiedError.message
            : "Unable to change your password right now.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <SectionCard eyebrow="Password" title="Change password">
      <form className="space-y-3" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <label
            className="text-sm font-semibold text-foreground"
            htmlFor="current-password"
          >
            Current password
          </label>
          <input
            id="current-password"
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            className="min-h-[52px] w-full rounded-[16px] border border-black/10 bg-white/60 px-4 text-sm text-foreground outline-none transition focus:border-brandRose focus:ring-[3px] focus:ring-brandRose/15 dark:border-white/10 dark:bg-white/[0.03] dark:focus:border-brandCyan dark:focus:ring-brandCyan/15"
            autoComplete="current-password"
            maxLength={72}
            required
          />
        </div>
        <div className="space-y-2">
          <label
            className="text-sm font-semibold text-foreground"
            htmlFor="new-password"
          >
            New password
          </label>
          <input
            id="new-password"
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            className="min-h-[52px] w-full rounded-[16px] border border-black/10 bg-white/60 px-4 text-sm text-foreground outline-none transition focus:border-brandRose focus:ring-[3px] focus:ring-brandRose/15 dark:border-white/10 dark:bg-white/[0.03] dark:focus:border-brandCyan dark:focus:ring-brandCyan/15"
            autoComplete="new-password"
            minLength={10}
            maxLength={72}
            required
          />
          <p className="text-xs leading-5 text-muted">
            Use 10+ characters with upper and lowercase letters, a number, and a
            symbol.
          </p>
        </div>

        <FeedbackBanner feedback={feedback} />

        <PrimaryButton
          type="submit"
          fullWidth
          isLoading={isSubmitting}
          disabled={!currentPassword.trim() || !newPassword.trim()}
        >
          Update password
        </PrimaryButton>
      </form>
    </SectionCard>
  );
}

function MobileOtpCard({
  user,
}: {
  user: UserProfile;
}) {
  const initialOtpState = createOtpRequestState(
    user.security.mobileOtpEnrollment,
    user.security.smsDeliveryAvailable,
  );
  const [phoneNumber, setPhoneNumber] = useState("");
  const [code, setCode] = useState("");
  const [otpState, setOtpState] = useState<RequestMobileOtpResult | null>(
    initialOtpState,
  );
  const [verifiedPhoneNumber, setVerifiedPhoneNumber] = useState<string | null>(
    user.security.phoneVerificationStatus === "verified"
      ? user.security.maskedPhoneNumber
      : null,
  );
  const [viewState, setViewState] = useState<MobileOtpViewState>(
    getInitialMobileOtpViewState(user),
  );
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [isRequesting, setIsRequesting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const resendAvailableLabel = formatMobileOtpTime(
    otpState?.resendAvailableAt ?? user.security.mobileOtpEnrollment?.resendAvailableAt,
  );
  const activeChallengeId =
    otpState?.challengeId ?? user.security.mobileOtpEnrollment?.challengeId;
  const displayedPhoneNumber =
    verifiedPhoneNumber ??
    otpState?.phoneNumber ??
    user.security.mobileOtpEnrollment?.maskedPhoneNumber ??
    user.security.maskedPhoneNumber ??
    "No number enrolled";

  let statusLabel = "Not enrolled";
  let statusTitle = "No mobile factor yet";
  let statusDescription =
    "Add a mobile number and confirm the code to activate the next trust factor in Dotly.";

  if (viewState === "code_sent") {
    statusLabel = "Code sent";
    statusTitle = "Code sent to your number";
    statusDescription =
      "Enter the latest six-digit code to complete mobile enrollment for account verification.";
  } else if (viewState === "verifying") {
    statusLabel = "Verifying";
    statusTitle = "Verifying your code";
    statusDescription =
      "Dotly is confirming the latest code against your active enrollment challenge.";
  } else if (viewState === "verified") {
    statusLabel = "Verified";
    statusTitle = "Mobile OTP verified";
    statusDescription =
      "Your mobile number is now part of your active trust model and can support future step-up flows.";
  } else if (viewState === "resend_blocked") {
    statusLabel = "Resend blocked";
    statusTitle = "Cooldown active";
    statusDescription = resendAvailableLabel
      ? `Your last code is still active. You can request another one after ${resendAvailableLabel}.`
      : "Your last code is still active. Wait for the resend cooldown before requesting a fresh one.";
  } else if (user.security.phoneVerificationStatus === "pending") {
    statusLabel = "Code sent";
    statusTitle = "Verification in progress";
    statusDescription =
      "A mobile number is pending confirmation. Enter the latest code to complete enrollment.";
  }

  async function handleRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsRequesting(true);
    setFeedback(null);

    try {
      const result = await authApi.requestMobileOtp({ phoneNumber });
      setOtpState(result);
      setVerifiedPhoneNumber(null);
      setCode("");
      setPhoneNumber("");
      setViewState("code_sent");
      setFeedback({
        tone: result.deliveryAvailable ? "success" : "warning",
        message: result.deliveryAvailable
          ? `A six-digit code was sent to ${result.phoneNumber}.`
          : "Twilio delivery is not configured in this environment, but the enrollment flow is wired and ready.",
      });
    } catch (error) {
      const classifiedError = classifyAuthError(error);

      if (classifiedError.kind === "throttled") {
        setViewState("resend_blocked");
      }

      setFeedback(getOtpFeedback(error));
    } finally {
      setIsRequesting(false);
    }
  }

  async function handleVerify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!activeChallengeId) {
      setFeedback({
        tone: "warning",
        message: "Request a fresh verification code before trying to verify it.",
      });
      return;
    }

    setIsVerifying(true);
    setViewState("verifying");
    setFeedback(null);

    try {
      const result = await authApi.verifyMobileOtp({
        challengeId: activeChallengeId,
        code,
      });
      setCode("");
      setOtpState(null);
      setVerifiedPhoneNumber(result.phoneNumber);
      setViewState("verified");
      const nextFeedback = {
        tone: "success" as const,
        message: `Mobile OTP is now active for ${result.phoneNumber}.`,
      };
      setFeedback(nextFeedback);
    } catch (error) {
      setViewState(
        otpState?.resendAvailableAt &&
          new Date(otpState.resendAvailableAt).getTime() > Date.now()
          ? "resend_blocked"
          : otpState || user.security.mobileOtpEnrollment
            ? "code_sent"
            : "not_enrolled",
      );
      setFeedback(getOtpFeedback(error));
    } finally {
      setIsVerifying(false);
    }
  }

  return (
    <SectionCard eyebrow="Mobile OTP" title="Enroll your next trust factor">
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-[22px] border border-border bg-white/60 p-4 dark:bg-white/[0.03]">
          <Smartphone className="mt-0.5 h-5 w-5 text-brandRose dark:text-brandCyan" />
          <div className="space-y-1.5">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
              State: {statusLabel}
            </p>
            <p className="text-sm font-semibold text-foreground">
              {statusTitle}
            </p>
            <p className="text-sm leading-6 text-muted">
              {statusDescription}
            </p>
            <p className="font-mono text-xs text-muted">
              {displayedPhoneNumber}
            </p>
          </div>
        </div>

        {!user.security.smsDeliveryAvailable ? (
          <div className="rounded-[22px] border border-amber-500/25 bg-amber-500/10 px-4 py-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600 dark:text-amber-300" />
              <p className="text-sm leading-6 text-foreground/80">
                Twilio is not configured in this environment yet. You can still
                review the security surface, and real SMS delivery will start
                once credentials are present.
              </p>
            </div>
          </div>
        ) : null}

        <FeedbackBanner feedback={feedback} />

        <form className="space-y-3" onSubmit={handleRequest}>
          <label
            className="text-sm font-semibold text-foreground"
            htmlFor="mobile-phone"
          >
            Mobile number
          </label>
          <input
            id="mobile-phone"
            type="tel"
            value={phoneNumber}
            onChange={(event) => setPhoneNumber(event.target.value)}
            placeholder="+14155550199"
            className="min-h-[52px] w-full rounded-[16px] border border-black/10 bg-white/60 px-4 text-sm text-foreground outline-none transition focus:border-brandRose focus:ring-[3px] focus:ring-brandRose/15 dark:border-white/10 dark:bg-white/[0.03] dark:focus:border-brandCyan dark:focus:ring-brandCyan/15"
            required
          />
          <p className="text-xs leading-5 text-muted">
            Use international format so this factor can work globally later.
          </p>
          <SecondaryButton type="submit" fullWidth isLoading={isRequesting}>
            {otpState ? "Send new verification code" : "Send verification code"}
          </SecondaryButton>
        </form>

        {viewState === "resend_blocked" ? (
          <div className="rounded-[22px] border border-amber-500/25 bg-amber-500/10 px-4 py-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600 dark:text-amber-300" />
              <p className="text-sm leading-6 text-foreground/85">
                {resendAvailableLabel
                  ? `Resend blocked until ${resendAvailableLabel}. Use the latest code Dotly sent to finish enrollment.`
                  : "Resend blocked for now. Use the latest code Dotly sent to finish enrollment."}
              </p>
            </div>
          </div>
        ) : null}

        {otpState || user.security.mobileOtpEnrollment ? (
          <form
            className="space-y-3 rounded-[22px] border border-dashed border-border px-4 py-4"
            onSubmit={handleVerify}
          >
            <div>
              <p className="text-sm font-semibold text-foreground">
                {viewState === "verifying"
                  ? "Verifying code"
                  : "Enter the latest code"}
              </p>
              <p className="mt-1 text-sm leading-6 text-muted">
                Codes expire in about 10 minutes and older codes are invalidated
                when you request a fresh one.
              </p>
            </div>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="123456"
              className="min-h-[52px] w-full rounded-[16px] border border-black/10 bg-white/60 px-4 text-sm tracking-[0.3em] text-foreground outline-none transition focus:border-brandRose focus:ring-[3px] focus:ring-brandRose/15 dark:border-white/10 dark:bg-white/[0.03] dark:focus:border-brandCyan dark:focus:ring-brandCyan/15"
              required
            />
            {otpState ? (
              <p className="text-xs leading-5 text-muted">
                Current destination: {otpState.phoneNumber}
              </p>
            ) : user.security.mobileOtpEnrollment ? (
              <p className="text-xs leading-5 text-muted">
                Current destination: {user.security.mobileOtpEnrollment.maskedPhoneNumber}
              </p>
            ) : null}
            <PrimaryButton type="submit" fullWidth isLoading={isVerifying}>
              Verify mobile OTP
            </PrimaryButton>
          </form>
        ) : null}
      </div>
    </SectionCard>
  );
}

function SessionCard({
  session,
  onRevoke,
  isRevoking,
}: {
  session: UserSessionSummary;
  onRevoke: (sessionId: string) => Promise<void>;
  isRevoking: boolean;
}) {
  return (
    <div className="rounded-[22px] border border-border bg-white/60 p-4 dark:bg-white/[0.03]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-foreground">
              {session.deviceLabel}
            </p>
            {session.isCurrent ? (
              <span className="inline-flex items-center rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-400">
                Current device
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-muted">{session.platformLabel}</p>
          <p className="mt-2 text-xs leading-5 text-muted">
            Last active {new Date(session.lastActiveAt).toLocaleString()} ·
            Started {new Date(session.createdAt).toLocaleString()}
          </p>
        </div>
        {!session.isCurrent ? (
          <SecondaryButton
            type="button"
            size="sm"
            isLoading={isRevoking}
            onClick={() => void onRevoke(session.id)}
          >
            Sign out
          </SecondaryButton>
        ) : null}
      </div>
    </div>
  );
}

function SessionsCard() {
  const [sessions, setSessions] = useState<UserSessionSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [isRevokingOthers, setIsRevokingOthers] = useState(false);

  async function loadSessions() {
    setIsLoading(true);

    try {
      const result: SessionListResult = await authApi.listSessions();
      setSessions(result.sessions);
    } catch (error) {
      const classifiedError = classifyAuthError(error);

      setFeedback({
        tone: classifiedError.kind === "unauthorized" ? "warning" : "error",
        message:
          classifiedError.kind !== "unknown"
            ? classifiedError.kind === "unauthorized"
              ? "Your session expired. Sign in again to load active sessions."
              : classifiedError.message
            : "Unable to load active sessions right now.",
      });
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadSessions();
  }, []);

  async function handleRevoke(sessionId: string) {
    setRevokingId(sessionId);
    setFeedback(null);

    try {
      await authApi.revokeSession({ sessionId });
      setFeedback({
        tone: "success",
        message: "That device has been signed out remotely.",
      });
      await loadSessions();
    } catch (error) {
      const classifiedError = classifyAuthError(error);

      setFeedback({
        tone: classifiedError.kind === "unauthorized" ? "warning" : "error",
        message:
          classifiedError.kind !== "unknown"
            ? classifiedError.kind === "unauthorized"
              ? "Your session expired. Sign in again to manage device sign-outs."
              : classifiedError.message
            : "Unable to sign out that device right now.",
      });
    } finally {
      setRevokingId(null);
    }
  }

  async function handleRevokeOthers() {
    setIsRevokingOthers(true);
    setFeedback(null);

    try {
      const result = await authApi.revokeOtherSessions();
      setFeedback({
        tone: "success",
        message:
          result.revokedCount && result.revokedCount > 0
            ? `Signed ${result.revokedCount} other session${result.revokedCount === 1 ? "" : "s"} out.`
            : "No other active sessions were found.",
      });
      await loadSessions();
    } catch (error) {
      const classifiedError = classifyAuthError(error);

      setFeedback({
        tone: classifiedError.kind === "unauthorized" ? "warning" : "error",
        message:
          classifiedError.kind !== "unknown"
            ? classifiedError.kind === "unauthorized"
              ? "Your session expired. Sign in again to manage other sessions."
              : classifiedError.message
            : "Unable to sign out your other sessions right now.",
      });
    } finally {
      setIsRevokingOthers(false);
    }
  }

  return (
    <SectionCard
      eyebrow="Sessions"
      title="Active sessions and devices"
      className="md:col-span-2"
    >
      <div className="space-y-4">
        <div className="flex flex-col gap-3 rounded-[22px] border border-border bg-white/60 p-4 dark:bg-white/[0.03] lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">
              Session registry is now active
            </p>
            <p className="mt-1 text-sm leading-6 text-muted">
              Each login creates a revocable session record, so password
              changes, resets, and remote sign-out all work from one security
              model.
            </p>
          </div>
          <SecondaryButton
            type="button"
            size="sm"
            isLoading={isRevokingOthers}
            onClick={() => void handleRevokeOthers()}
          >
            Sign out all other devices
          </SecondaryButton>
        </div>

        <FeedbackBanner feedback={feedback} />

        {isLoading ? (
          <p className="text-sm text-muted">Loading active sessions…</p>
        ) : sessions.length > 0 ? (
          <div className="space-y-3">
            {sessions.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                onRevoke={handleRevoke}
                isRevoking={revokingId === session.id}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">No active sessions found.</p>
        )}
      </div>
    </SectionCard>
  );
}

function TrustFactorsCard({ user }: { user: UserProfile }) {
  const roadmapFactors: UserTrustFactor[] = [
    ...user.security.trustFactors.map((factor) =>
      factor.key === "mobile_otp_verified" &&
      user.security.phoneVerificationStatus === "not_enrolled" &&
      factor.status !== "active"
        ? {
            ...factor,
            status: "planned" as const,
          }
        : factor,
    ),
    {
      key: "linked_auth_methods",
      label: "Linked sign-in methods",
      status: "planned",
      description:
        "Reserved for future provider linking, passkeys, and higher-confidence account recovery.",
    },
  ];

  const iconMap: Record<string, React.ReactNode> = {
    email_verified: (
      <Mail className="h-4 w-4 text-brandRose dark:text-brandCyan" />
    ),
    mobile_otp_verified: (
      <Smartphone className="h-4 w-4 text-brandRose dark:text-brandCyan" />
    ),
    linked_auth_methods: (
      <Waypoints className="h-4 w-4 text-brandRose dark:text-brandCyan" />
    ),
  };

  return (
    <SectionCard
      eyebrow="Trust Factors"
      title="Current and planned identity factors"
    >
      <div className="space-y-3">
        {roadmapFactors.map((factor) => (
          <div
            key={factor.key}
            className="flex items-start justify-between gap-3 rounded-[22px] border border-border bg-white/60 p-4 dark:bg-white/[0.03]"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-full border border-border p-2">
                {iconMap[factor.key] ?? (
                  <Fingerprint className="h-4 w-4 text-brandRose dark:text-brandCyan" />
                )}
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {factor.label}
                </p>
                <p className="mt-1 text-sm leading-6 text-muted">
                  {factor.description}
                </p>
              </div>
            </div>
            <FactorStatusBadge status={factor.status} />
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

function SecurityFoundationCard({ user }: { user: UserProfile }) {
  const controls = useMemo(
    () => [
      {
        title: "Password reset email",
        description: user.security.passwordResetAvailable
          ? "Recovery links can be requested from the public login flow and are delivered through Dotly mail."
          : "Password reset mail is disabled in this environment until the reset URL and mail provider are configured.",
        icon: (
          <LockKeyhole className="h-4 w-4 text-brandRose dark:text-brandCyan" />
        ),
        status: user.security.passwordResetAvailable ? "Live" : "Setup needed",
      },
      {
        title: "Mobile OTP enrollment",
        description: user.security.smsDeliveryAvailable
          ? "Twilio-backed SMS codes are ready for enrollment and future step-up trust checks."
          : "Add Twilio credentials to deliver real SMS codes in this environment.",
        icon: (
          <Smartphone className="h-4 w-4 text-brandRose dark:text-brandCyan" />
        ),
        status: user.security.smsDeliveryAvailable ? "Live" : "Setup needed",
      },
      {
        title: "Revocable sessions",
        description:
          "Each login now creates a tracked device session that can be reviewed and remotely signed out from settings.",
        icon: (
          <ShieldCheck className="h-4 w-4 text-brandRose dark:text-brandCyan" />
        ),
        status: "Live",
      },
    ],
    [user.security.passwordResetAvailable, user.security.smsDeliveryAvailable],
  );

  return (
    <SectionCard
      eyebrow="Security Center"
      title="Rollout state and recovery posture"
    >
      <div className="space-y-3">
        {controls.map((item) => (
          <div
            key={item.title}
            className="rounded-[22px] border border-dashed border-border px-4 py-4"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-full border border-border p-2">
                {item.icon}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">
                    {item.title}
                  </p>
                  <span className="inline-flex items-center rounded-full border border-sky-500/20 bg-sky-500/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-sky-700 dark:text-sky-300">
                    {item.status}
                  </span>
                </div>
                <p className="mt-1 text-sm leading-6 text-muted">
                  {item.description}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

export function AccountSecuritySettings({ user }: { user: UserProfile }) {
  const [isResending, setIsResending] = useState(false);
  const [resendFeedback, setResendFeedback] = useState<FeedbackState>(null);

  async function handleResend() {
    setResendFeedback(null);
    setIsResending(true);

    try {
      const result = await authApi.resendCurrentUserVerificationEmail();
      setResendFeedback({
        tone: result.verificationEmailSent ? "success" : "warning",
        message: result.verificationEmailSent
          ? "A fresh verification email is on the way. Open the latest Dotly message and check spam if you still do not see it."
          : result.mailDeliveryAvailable
            ? "Verification is still pending. Open the latest message from Dotly before asking for another email."
            : "Email delivery is currently unavailable in this environment, but this verification flow is ready for live mail once configured.",
      });
    } catch (error) {
      setResendFeedback(getResendFeedback(error));
    } finally {
      setIsResending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-[28px] border border-border bg-[linear-gradient(135deg,rgba(255,255,255,0.9),rgba(255,255,255,0.72))] p-5 dark:bg-[linear-gradient(135deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))]">
        <p className="label-xs text-muted">Account Trust</p>
        <h2 className="mt-2 text-xl font-bold tracking-tight text-foreground">
          Dotly security center
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
          Manage active trust factors, recover credentials, enroll a mobile
          factor, and review every active device from one coherent security
          surface.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <TrustOverviewCard user={user} />
        <VerificationManagementCard
          user={user}
          feedback={resendFeedback}
          isResending={isResending}
          onResend={handleResend}
        />
        <ChangePasswordCard />
        <PasswordRecoveryCard user={user} />
        <MobileOtpCard user={user} />
        <TrustFactorsCard user={user} />
        <SessionsCard />
        <SecurityFoundationCard user={user} />
      </div>
    </div>
  );
}
