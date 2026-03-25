"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Clock3, LifeBuoy, Mail, ShieldAlert } from "lucide-react";

import { PrimaryButton } from "@/components/shared/primary-button";
import { SecondaryButton } from "@/components/shared/secondary-button";
import { showToast } from "@/components/shared/toast-viewport";
import { ApiError } from "@/lib/api/client";
import { supportApi } from "@/lib/api/support-api";
import { routes } from "@/lib/constants/routes";

const supportEmail = "support@dotly.one";
const DRAFT_STORAGE_KEY = "dotly.support-form.draft";

const sections = [
  {
    title: "Account help",
    description:
      "Trouble logging in, verifying your email, or getting back into your account? Include the email address tied to your Dotly account and a short description of what happened.",
    icon: LifeBuoy,
  },
  {
    title: "Bug reports",
    description:
      "If something feels broken, send the page you were on, what you expected, and what Dotly did instead. Screenshots help when you can share them safely.",
    icon: ShieldAlert,
  },
  {
    title: "Response expectations",
    description:
      "Support requests are reviewed by email. For urgent access or verification problems, mention that in the subject line so the team can triage faster.",
    icon: Clock3,
  },
] as const;

const topics = [
  "Account access",
  "Verification help",
  "Bug report",
  "Profile or QR issue",
  "Privacy request",
  "Other",
] as const;

type SupportTopic = (typeof topics)[number];

interface SupportDraft {
  name: string;
  email: string;
  topic: SupportTopic;
  details: string;
  challengeToken: string;
  website: string;
}

function createEmptyDraft(): SupportDraft {
  return {
    name: "",
    email: "",
    topic: topics[0],
    details: "",
    challengeToken: String(Date.now()),
    website: "",
  };
}

function buildMailtoHref(subject: string, body: string): string {
  const search = new URLSearchParams();

  if (subject.trim()) {
    search.set("subject", subject.trim());
  }

  if (body.trim()) {
    search.set("body", body.trim());
  }

  const query = search.toString();

  return `mailto:${supportEmail}${query ? `?${query}` : ""}`;
}

function isSupportTopic(value: string): value is SupportTopic {
  return topics.includes(value as SupportTopic);
}

function loadDraft(): SupportDraft {
  if (typeof window === "undefined") {
    return createEmptyDraft();
  }

  try {
    const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);

    if (!raw) {
      return createEmptyDraft();
    }

    const parsed = JSON.parse(raw) as Partial<SupportDraft>;

    return {
      name: typeof parsed.name === "string" ? parsed.name : "",
      email: typeof parsed.email === "string" ? parsed.email : "",
      topic:
        typeof parsed.topic === "string" && isSupportTopic(parsed.topic)
          ? parsed.topic
          : topics[0],
      details: typeof parsed.details === "string" ? parsed.details : "",
      challengeToken:
        typeof parsed.challengeToken === "string"
          ? parsed.challengeToken
          : String(Date.now()),
      website: typeof parsed.website === "string" ? parsed.website : "",
    };
  } catch {
    return createEmptyDraft();
  }
}

export default function SupportPage() {
  const [draft, setDraft] = useState<SupportDraft>(() => createEmptyDraft());
  const [hasLoadedDraft, setHasLoadedDraft] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    referenceId: string;
    delivery: "sent" | "logged";
  } | null>(null);

  useEffect(() => {
    const storedDraft = loadDraft();
    setDraft(storedDraft);
    setHasLoadedDraft(true);
  }, []);

  useEffect(() => {
    if (!hasLoadedDraft || typeof window === "undefined") {
      return;
    }

    if (result) {
      window.localStorage.removeItem(DRAFT_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
  }, [draft, hasLoadedDraft, result]);

  const subject = useMemo(() => `Dotly support: ${draft.topic}`, [draft.topic]);
  const messageBody = useMemo(() => {
    const lines = [
      `Name: ${draft.name.trim() || ""}`,
      `Email: ${draft.email.trim() || ""}`,
      `Topic: ${draft.topic}`,
      "",
      "Details:",
      draft.details.trim(),
    ];

    return lines.join("\n").trim();
  }, [draft]);
  const mailtoHref = useMemo(
    () => buildMailtoHref(subject, messageBody),
    [messageBody, subject],
  );

  function updateDraft<K extends keyof SupportDraft>(
    key: K,
    value: SupportDraft[K],
  ) {
    setDraft((current) => ({ ...current, [key]: value }));
    setError(null);
  }

  async function handleCopyTemplate() {
    const message = `To: ${supportEmail}\nSubject: ${subject}\n\n${messageBody}`;

    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      showToast("Support message copied");
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      showToast({ message: "Could not copy support message", tone: "error" });
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!draft.email.trim()) {
      setError("Enter your reply email so support can get back to you.");
      return;
    }

    if (!draft.details.trim()) {
      setError("Add a few details so support can understand the issue.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await supportApi.create({
        name: draft.name.trim() || undefined,
        email: draft.email.trim(),
        topic: draft.topic,
        details: draft.details.trim(),
        challengeToken: draft.challengeToken,
        website: draft.website,
      });

      setResult({
        referenceId: response.referenceId,
        delivery: response.delivery,
      });
      setDraft(createEmptyDraft());
      window.localStorage.removeItem(DRAFT_STORAGE_KEY);
      showToast(
        response.delivery === "sent"
          ? "Support request sent"
          : "Support request saved",
      );
    } catch (submissionError) {
      setError(
        submissionError instanceof ApiError
          ? submissionError.message
          : "Unable to send your support request right now.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="relative overflow-hidden pt-28 pb-12 sm:pt-36 sm:pb-20 min-h-screen">
      <div className="fixed inset-0 z-[-1] pointer-events-none flex items-center justify-center overflow-hidden">
        <div className="absolute top-[-10%] h-[800px] w-[800px] rounded-full bg-accent/5 blur-[120px] mix-blend-normal opacity-50" />
      </div>

      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-8 px-4 sm:px-6">
        <div className="premium-card rounded-[2.5rem] p-8 md:p-12 relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="space-y-4 max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-black/5 dark:border-white/10 bg-foreground/5 px-4 py-1.5 font-sans text-[11px] font-bold uppercase tracking-[0.12em] text-foreground">
              <LifeBuoy className="h-3.5 w-3.5 text-accent" />
              Dotly support
            </span>
            <div className="space-y-4">
              <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl leading-[1.1]">
                Get help when something blocks the next step.
              </h1>
              <p className="text-[17px] leading-relaxed text-muted font-medium max-w-[40ch]">
                Send a support request directly from Dotly, or open an email
                draft if you prefer to continue in your mail app.
              </p>
            </div>
          </div>

          <a
            href={mailtoHref}
            className="inline-flex h-14 items-center justify-center gap-2 rounded-full bg-foreground px-8 text-[15px] font-semibold text-background transition-transform hover:scale-[0.98] shadow-md tap-feedback w-full md:w-auto shrink-0"
          >
            <Mail className="h-4 w-4" />
            Email {supportEmail}
          </a>
        </div>

        <div className="grid gap-6 md:grid-cols-3 relative z-10">
          {sections.map((section) => {
            const Icon = section.icon;

            return (
              <article
                key={section.title}
                className="premium-card rounded-[2rem] p-8 flex flex-col"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-foreground/5 ring-1 ring-black/5 dark:ring-white/10 mb-6">
                  <Icon className="h-6 w-6 text-foreground" strokeWidth={1.5} />
                </div>
                <h2 className="text-xl font-semibold tracking-tight text-foreground mb-3">
                  {section.title}
                </h2>
                <p className="text-[15px] leading-relaxed text-muted font-medium">
                  {section.description}
                </p>
              </article>
            );
          })}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr] relative z-10">
          <form
            className="premium-card rounded-[2.5rem] p-8 md:p-12"
            onSubmit={(event) => void handleSubmit(event)}
          >
            <div className="space-y-8">
              <div className="space-y-3">
                <h2 className="text-3xl font-semibold tracking-tight text-foreground">
                  Start your support request
                </h2>
                <p className="text-[16px] leading-relaxed text-muted font-medium">
                  Drafts are saved locally in this browser until you send or
                  clear them.
                </p>
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                <label className="space-y-2 flex flex-col">
                  <span className="text-[13px] font-semibold uppercase tracking-wider text-muted ml-2">
                    Name
                  </span>
                  <input
                    value={draft.name}
                    onChange={(event) =>
                      updateDraft("name", event.target.value)
                    }
                    placeholder="Your name"
                    className="min-h-[56px] w-full rounded-2xl bg-foreground/[0.03] px-4 text-[16px] font-medium text-foreground outline-none transition-all duration-300 shadow-inner ring-1 ring-black/5 placeholder:text-muted/50 focus:bg-foreground/[0.045] focus:ring-2 focus:ring-foreground/15 dark:bg-white/[0.045] dark:ring-white/10 dark:focus:bg-white/[0.07]"
                  />
                </label>

                <label className="space-y-2 flex flex-col">
                  <span className="text-[13px] font-semibold uppercase tracking-wider text-muted ml-2">
                    Reply email
                  </span>
                  <input
                    type="email"
                    value={draft.email}
                    onChange={(event) =>
                      updateDraft("email", event.target.value)
                    }
                    placeholder="you@example.com"
                    className="min-h-[56px] w-full rounded-2xl bg-foreground/[0.03] px-4 text-[16px] font-medium text-foreground outline-none transition-all duration-300 shadow-inner ring-1 ring-black/5 placeholder:text-muted/50 focus:bg-foreground/[0.045] focus:ring-2 focus:ring-foreground/15 dark:bg-white/[0.045] dark:ring-white/10 dark:focus:bg-white/[0.07]"
                  />
                </label>
              </div>

              <label className="space-y-2 flex flex-col">
                <span className="text-[13px] font-semibold uppercase tracking-wider text-muted ml-2">
                  Topic
                </span>
                <div className="relative">
                  <select
                    value={draft.topic}
                    onChange={(event) =>
                      updateDraft("topic", event.target.value as SupportTopic)
                    }
                    className="appearance-none min-h-[56px] w-full rounded-2xl bg-foreground/[0.03] px-4 pr-10 text-[16px] font-medium text-foreground outline-none transition-all duration-300 shadow-inner ring-1 ring-black/5 cursor-pointer focus:bg-foreground/[0.045] focus:ring-2 focus:ring-foreground/15 dark:bg-white/[0.045] dark:ring-white/10 dark:focus:bg-white/[0.07]"
                  >
                    {topics.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center">
                    <svg
                      className="h-4 w-4 text-muted"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M19 9l-7 7-7-7"
                      ></path>
                    </svg>
                  </div>
                </div>
              </label>

              <label className="space-y-2 flex flex-col">
                <span className="text-[13px] font-semibold uppercase tracking-wider text-muted ml-2">
                  Details
                </span>
                <textarea
                  value={draft.details}
                  onChange={(event) =>
                    updateDraft("details", event.target.value)
                  }
                  rows={6}
                  placeholder="What happened, where it happened, and what you expected instead"
                  className="w-full resize-none rounded-2xl bg-foreground/[0.03] px-4 py-4 text-[16px] font-medium text-foreground outline-none transition-all duration-300 shadow-inner ring-1 ring-black/5 placeholder:text-muted/50 focus:bg-foreground/[0.045] focus:ring-2 focus:ring-foreground/15 dark:bg-white/[0.045] dark:ring-white/10 dark:focus:bg-white/[0.07]"
                />
              </label>

              <label className="hidden" aria-hidden="true">
                <span>Website</span>
                <input
                  tabIndex={-1}
                  autoComplete="off"
                  value={draft.website}
                  onChange={(event) =>
                    updateDraft("website", event.target.value)
                  }
                />
              </label>

              <div className="rounded-2xl bg-foreground/[0.02] px-5 py-4 ring-1 ring-black/5 dark:ring-white/10 shadow-inner">
                <p className="text-[14px] font-medium text-muted">
                  Lightweight bot check is active for this form.
                </p>
              </div>

              {error ? (
                <div className="rounded-2xl bg-status-error/10 px-5 py-4 ring-1 ring-status-error/20">
                  <p className="text-[14px] font-medium text-status-error">
                    {error}
                  </p>
                </div>
              ) : null}

              {result ? (
                <div className="rounded-2xl bg-status-success/10 px-5 py-4 ring-1 ring-status-success/20 space-y-2">
                  <p className="text-[15px] font-semibold text-status-success">
                    Support request received
                  </p>
                  <p className="text-[14px] font-medium text-status-success/80">
                    Reference ID:{" "}
                    <span className="font-mono bg-status-success/10 px-2 py-0.5 rounded">
                      {result.referenceId}
                    </span>
                  </p>
                  <p className="text-[14px] font-medium text-status-success/80 mt-2">
                    {result.delivery === "sent"
                      ? "Your message was sent to the support inbox."
                      : "Your message was accepted and logged. If email delivery is delayed, you can still contact support@dotly.one directly."}
                  </p>
                </div>
              ) : null}

              <div className="flex flex-col gap-4 sm:flex-row pt-4">
                <PrimaryButton
                  type="submit"
                  fullWidth
                  className="h-14 text-[16px]"
                  isLoading={isSubmitting}
                >
                  Send support request
                </PrimaryButton>
                <div className="flex gap-4 flex-1">
                  <a href={mailtoHref} className="block flex-1">
                    <SecondaryButton
                      type="button"
                      fullWidth
                      className="h-14 text-[16px]"
                    >
                      Email draft
                    </SecondaryButton>
                  </a>
                  <SecondaryButton
                    type="button"
                    fullWidth
                    className="flex-1 h-14 text-[16px]"
                    onClick={() => void handleCopyTemplate()}
                  >
                    {copied ? "Copied" : "Copy"}
                  </SecondaryButton>
                </div>
              </div>
            </div>
          </form>

          <div className="flex flex-col gap-6">
            <article className="premium-card rounded-[2.5rem] p-8 md:p-10">
              <div className="space-y-6">
                <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                  What to include
                </h2>
                <div className="grid gap-3">
                  <div className="rounded-2xl bg-foreground/[0.02] px-5 py-4 text-[15px] font-medium text-foreground ring-1 ring-black/5 dark:ring-white/10 shadow-inner">
                    Your account email or public username
                  </div>
                  <div className="rounded-2xl bg-foreground/[0.02] px-5 py-4 text-[15px] font-medium text-foreground ring-1 ring-black/5 dark:ring-white/10 shadow-inner">
                    The page or flow where the issue happened
                  </div>
                  <div className="rounded-2xl bg-foreground/[0.02] px-5 py-4 text-[15px] font-medium text-foreground ring-1 ring-black/5 dark:ring-white/10 shadow-inner">
                    What you expected to happen
                  </div>
                  <div className="rounded-2xl bg-foreground/[0.02] px-5 py-4 text-[15px] font-medium text-foreground ring-1 ring-black/5 dark:ring-white/10 shadow-inner">
                    Any error message you saw
                  </div>
                </div>
              </div>
            </article>

            <article className="premium-card rounded-[2.5rem] p-8 md:p-10">
              <div className="space-y-6">
                <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                  Helpful links
                </h2>
                <div className="flex flex-col gap-3">
                  <Link
                    href={routes.public.forgotPassword}
                    className="rounded-2xl bg-foreground/[0.02] px-5 py-4 text-[15px] font-medium text-foreground ring-1 ring-black/5 dark:ring-white/10 transition-all hover:bg-foreground/[0.05] hover:scale-[0.98] active:scale-[0.96] tap-feedback shadow-inner"
                  >
                    Reset your password
                  </Link>
                  <Link
                    href={routes.public.verifyEmail}
                    className="rounded-2xl bg-foreground/[0.02] px-5 py-4 text-[15px] font-medium text-foreground ring-1 ring-black/5 dark:ring-white/10 transition-all hover:bg-foreground/[0.05] hover:scale-[0.98] active:scale-[0.96] tap-feedback shadow-inner"
                  >
                    Verify your email
                  </Link>
                  <Link
                    href={routes.public.privacy}
                    className="rounded-2xl bg-foreground/[0.02] px-5 py-4 text-[15px] font-medium text-foreground ring-1 ring-black/5 dark:ring-white/10 transition-all hover:bg-foreground/[0.05] hover:scale-[0.98] active:scale-[0.96] tap-feedback shadow-inner"
                  >
                    Privacy policy
                  </Link>
                  <Link
                    href={routes.public.terms}
                    className="rounded-2xl bg-foreground/[0.02] px-5 py-4 text-[15px] font-medium text-foreground ring-1 ring-black/5 dark:ring-white/10 transition-all hover:bg-foreground/[0.05] hover:scale-[0.98] active:scale-[0.96] tap-feedback shadow-inner"
                  >
                    Terms
                  </Link>
                </div>
              </div>
            </article>
          </div>
        </div>
      </div>
    </section>
  );
}
