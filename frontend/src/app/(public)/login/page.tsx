import Link from "next/link";
import { QrCode, Shield, Zap } from "lucide-react";

import { LoginAuthPanel } from "@/components/auth/login-auth-panel";
import { ResetSessionOnLoad } from "@/components/auth/reset-session-on-load";
import { dotlyPositioning } from "@/lib/constants/positioning";
import { routes } from "@/lib/constants/routes";

const features = [
  {
    icon: QrCode,
    title: "Your premium share layer.",
    description:
      "Return to the identity you use for QR, calls, messages, and requests.",
  },
  {
    icon: Shield,
    title: "Passkeys keep it calm.",
    description:
      "Unlock Dotly with the device you already trust, while password fallback stays available.",
  },
  {
    icon: Zap,
    title: "Made for better follow-up.",
    description: "Pick up where meetings, events, and introductions left off.",
  },
];

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    next?: string;
    email?: string;
    created?: string;
    delivery?: string;
    verified?: string;
    reason?: string;
  }>;
}) {
  const resolvedSearchParams = await searchParams;
  const redirectTo = resolvedSearchParams.next || routes.app.home;
  const initialEmail = resolvedSearchParams.email || "";
  const created = resolvedSearchParams.created === "1";
  const verificationDelivered = resolvedSearchParams.delivery !== "disabled";
  const verified = resolvedSearchParams.verified === "1";
  const passwordResetComplete =
    resolvedSearchParams.reason === "password-reset";
  const shouldResetSession = resolvedSearchParams.reason === "expired";
  const resendHref = initialEmail
    ? `${routes.public.verifyEmail}?email=${encodeURIComponent(initialEmail)}`
    : routes.public.verifyEmail;

  return (
    <div className="relative w-full min-h-[100dvh] flex flex-col pt-20 pb-12 overflow-x-hidden md:pt-32">
      {/* Immersive ambient background */}
      <div className="fixed inset-0 z-[-1] pointer-events-none flex items-center justify-center overflow-hidden">
        <div className="absolute top-[-20%] right-[-10%] h-[1000px] w-[1000px] rounded-full bg-accent/10 blur-[150px] mix-blend-normal opacity-60" />
        <div className="absolute bottom-[-10%] left-[-10%] h-[800px] w-[800px] rounded-full bg-accent/5 blur-[120px] mix-blend-normal opacity-40" />
      </div>

      <div className="w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 flex-1 flex flex-col md:justify-center">
        <ResetSessionOnLoad enabled={shouldResetSession} />

        <div className="grid lg:grid-cols-[1fr_1.1fr] gap-8 lg:gap-24 items-start md:items-center flex-1">
          {/* Mobile-First Header Stack (Shows on top on mobile, left on desktop) */}
          <div className="flex flex-col max-w-2xl lg:max-w-none mx-auto lg:mx-0 w-full pt-4 md:pt-0 text-center lg:text-left">
            <div className="mb-8 md:mb-10 animate-fade-up">
              <h1
                className="text-4xl sm:text-5xl lg:text-[5.5rem] font-bold tracking-tighter text-foreground leading-[1.05] mb-4 md:mb-6"
                style={{ WebkitFontSmoothing: "antialiased" }}
              >
                Welcome <br className="hidden md:block" /> back to Dotly.
              </h1>
              <p className="text-[17px] sm:text-[21px] text-muted font-medium leading-relaxed max-w-[32ch] md:max-w-[38ch] mx-auto lg:mx-0">
                {dotlyPositioning.auth.loginDescription}
              </p>
            </div>

            {/* Feature List - Hidden on small mobile, visible on tablet/desktop to keep the form accessible instantly */}
            <div
              className="hidden sm:block space-y-6 md:space-y-8 w-full border-t border-black/5 dark:border-white/10 pt-8 md:pt-10 animate-fade-up"
              style={{ animationDelay: "100ms" }}
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
            </div>
          </div>

          {/* Right Column / Mobile Bottom: The Form */}
          <div
            className="w-full max-w-[480px] mx-auto lg:mx-0 lg:mr-auto relative z-10 animate-scale-in"
            style={{ animationDelay: "150ms" }}
          >
            <div className="flex flex-col gap-4 mb-6">
              {shouldResetSession ? (
                <div className="rounded-[16px] bg-status-warning/10 px-5 py-4 ring-1 ring-status-warning/20">
                  <p className="text-[14px] font-medium text-status-warning">
                    Your session expired. Sign in again to return to your Dotly.
                  </p>
                </div>
              ) : null}
              {verified ? (
                <div className="rounded-[16px] bg-status-success/10 px-5 py-4 ring-1 ring-status-success/20">
                  <p className="text-[14px] font-medium text-status-success">
                    Email confirmed. Sign in to continue.
                  </p>
                </div>
              ) : null}
              {passwordResetComplete ? (
                <div className="rounded-[16px] bg-status-success/10 px-5 py-4 ring-1 ring-status-success/20">
                  <p className="text-[14px] font-medium text-status-success">
                    Password reset complete. Sign in with your new password.
                  </p>
                </div>
              ) : null}
              {created ? (
                <div className="rounded-[16px] bg-status-success/10 px-5 py-4 ring-1 ring-status-success/20">
                  {verificationDelivered ? (
                    <p className="text-[14px] leading-relaxed font-medium text-status-success">
                      Your Dotly is ready. Check your inbox, including spam, for
                      your confirmation email. You can still sign in now, but
                      verified-only sharing stays limited until you confirm it.
                      Sign in with your password once and Dotly will guide you
                      straight into passkey setup right after. Need another
                      link?{" "}
                      <Link
                        href={resendHref}
                        className="underline underline-offset-4 hover:opacity-80 transition-opacity"
                      >
                        Resend verification
                      </Link>
                      .
                    </p>
                  ) : (
                    <p className="text-[14px] leading-relaxed font-medium text-status-warning">
                      Your Dotly is ready. Email confirmation is still required,
                      but delivery is not configured in this environment. Sign
                      in with your password once and Dotly will guide you into
                      passkey setup right after. Use{" "}
                      <Link
                        href={resendHref}
                        className="underline underline-offset-4 hover:opacity-80 transition-opacity"
                      >
                        resend verification
                      </Link>{" "}
                      after email delivery is enabled.
                    </p>
                  )}
                </div>
              ) : null}
            </div>

            <div className="rounded-[2.5rem] md:rounded-[3rem] p-8 sm:p-10 md:p-14 border border-black/5 dark:border-white/10 bg-black/[0.02] dark:bg-black/[0.02] dark:bg-white/[0.02] backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.2)]">
              <div className="mb-8 md:mb-10 space-y-2 text-center md:text-left">
                <h2 className="text-[28px] md:text-[32px] font-bold tracking-tighter text-foreground leading-[1.1]">
                  Passkey-first sign in
                </h2>
                <p className="text-[16px] md:text-[17px] text-muted font-medium">
                  {created
                    ? "Start with a passkey. If you sign in with your password today, Dotly will guide you into passkey setup right after."
                    : "Start with a passkey. Password sign-in stays right underneath."}
                </p>
              </div>
              <LoginAuthPanel
                redirectTo={redirectTo}
                initialEmail={initialEmail}
                shouldPromptPasskeyEnrollment={created}
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
          </div>
        </div>
      </div>
    </div>
  );
}
