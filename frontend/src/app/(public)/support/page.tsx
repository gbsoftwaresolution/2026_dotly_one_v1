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
    <section className="relative overflow-hidden py-4 sm:py-8">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-[-10%] top-[8%] h-56 w-56 rounded-full bg-brandCyan/15 blur-[90px]" />
        <div className="absolute bottom-[10%] right-[-10%] h-64 w-64 rounded-full bg-brandRose/15 blur-[110px]" />
      </div>

      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
        <div className="overflow-hidden rounded-[2rem] border border-white/50 bg-white/75 p-6 shadow-[0_8px_40px_rgba(0,0,0,0.06)] backdrop-blur-2xl dark:border-white/10 dark:bg-black/45 dark:shadow-[0_8px_40px_rgba(0,0,0,0.4)] sm:p-8">
          <div className="space-y-4">
            <span className="inline-flex items-center gap-2 rounded-full border border-black/5 bg-white/70 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-foreground/70 dark:border-white/10 dark:bg-white/5">
              <LifeBuoy className="h-3.5 w-3.5 text-brandRose dark:text-brandCyan" />
              Dotly support
            </span>
            <div className="space-y-3">
              <h1 className="max-w-[14ch] text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
                Get help when something blocks the next step.
              </h1>
              <p className="max-w-2xl text-sm leading-7 text-muted sm:text-[15px]">
                Send a support request directly from Dotly, or open an email
                draft if you prefer to continue in your mail app.
              </p>
            </div>

            <a
              href={mailtoHref}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-pill bg-foreground px-5 text-sm font-bold text-background transition-all hover:opacity-90 sm:w-auto"
            >
              <Mail className="h-4 w-4" />
              Email {supportEmail}
            </a>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {sections.map((section) => {
            const Icon = section.icon;

            return (
              <article
                key={section.title}
                className="rounded-[1.75rem] border border-black/[0.05] bg-white/80 p-5 shadow-card-light backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface1/90 dark:shadow-card"
              >
                <div className="space-y-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brandRose/10 text-brandRose dark:bg-brandCyan/12 dark:text-brandCyan">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h2 className="text-lg font-bold tracking-tight text-foreground">
                    {section.title}
                  </h2>
                  <p className="text-sm leading-6 text-muted">
                    {section.description}
                  </p>
                </div>
              </article>
            );
          })}
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.25fr_0.95fr]">
          <form
            className="rounded-[1.75rem] border border-black/[0.05] bg-white/80 p-6 shadow-card-light backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface1/90 dark:shadow-card"
            onSubmit={(event) => void handleSubmit(event)}
          >
            <div className="space-y-5">
              <div className="space-y-2">
                <h2 className="text-xl font-bold tracking-tight text-foreground">
                  Start your support request
                </h2>
                <p className="text-sm leading-6 text-muted">
                  Drafts are saved locally in this browser until you send or
                  clear them.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2">
                  <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
                    Name
                  </span>
                  <input
                    value={draft.name}
                    onChange={(event) =>
                      updateDraft("name", event.target.value)
                    }
                    placeholder="Your name"
                    className="min-h-12 w-full rounded-2xl border border-border bg-surface px-4 text-sm text-foreground outline-none transition-all focus:border-brandRose focus:ring-2 focus:ring-brandRose/20 dark:focus:border-brandCyan dark:focus:ring-brandCyan/20"
                  />
                </label>

                <label className="space-y-2">
                  <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
                    Reply email
                  </span>
                  <input
                    type="email"
                    value={draft.email}
                    onChange={(event) =>
                      updateDraft("email", event.target.value)
                    }
                    placeholder="you@example.com"
                    className="min-h-12 w-full rounded-2xl border border-border bg-surface px-4 text-sm text-foreground outline-none transition-all focus:border-brandRose focus:ring-2 focus:ring-brandRose/20 dark:focus:border-brandCyan dark:focus:ring-brandCyan/20"
                  />
                </label>
              </div>

              <label className="space-y-2">
                <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
                  Topic
                </span>
                <select
                  value={draft.topic}
                  onChange={(event) =>
                    updateDraft("topic", event.target.value as SupportTopic)
                  }
                  className="min-h-12 w-full rounded-2xl border border-border bg-surface px-4 text-sm text-foreground outline-none transition-all focus:border-brandRose focus:ring-2 focus:ring-brandRose/20 dark:focus:border-brandCyan dark:focus:ring-brandCyan/20"
                >
                  {topics.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2">
                <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
                  Details
                </span>
                <textarea
                  value={draft.details}
                  onChange={(event) =>
                    updateDraft("details", event.target.value)
                  }
                  rows={7}
                  placeholder="What happened, where it happened, and what you expected instead"
                  className="w-full resize-none rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-foreground outline-none transition-all placeholder:text-muted/60 focus:border-brandRose focus:ring-2 focus:ring-brandRose/20 dark:focus:border-brandCyan dark:focus:ring-brandCyan/20"
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

              <div className="rounded-2xl border border-border/70 bg-background/70 px-4 py-3 text-sm text-muted">
                Lightweight bot check is active for this form.
              </div>

              {error ? (
                <div className="rounded-2xl border border-rose-400/30 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200">
                  {error}
                </div>
              ) : null}

              {result ? (
                <div className="rounded-2xl border border-emerald-400/30 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200">
                  <p className="font-semibold">Support request received</p>
                  <p>
                    Reference ID:{" "}
                    <span className="font-mono">{result.referenceId}</span>
                  </p>
                  <p>
                    {result.delivery === "sent"
                      ? "Your message was sent to the support inbox."
                      : "Your message was accepted and logged. If email delivery is delayed, you can still contact support@dotly.one directly."}
                  </p>
                </div>
              ) : null}

              <div className="flex flex-col gap-3 sm:flex-row">
                <PrimaryButton type="submit" fullWidth isLoading={isSubmitting}>
                  Send support request
                </PrimaryButton>
                <a href={mailtoHref} className="block flex-1">
                  <SecondaryButton type="button" fullWidth>
                    Open email draft
                  </SecondaryButton>
                </a>
                <SecondaryButton
                  type="button"
                  fullWidth
                  className="flex-1"
                  onClick={() => void handleCopyTemplate()}
                >
                  {copied ? "Copied" : "Copy message"}
                </SecondaryButton>
              </div>
            </div>
          </form>

          <div className="flex flex-col gap-4">
            <article className="rounded-[1.75rem] border border-black/[0.05] bg-white/80 p-6 shadow-card-light backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface1/90 dark:shadow-card">
              <div className="space-y-3">
                <h2 className="text-xl font-bold tracking-tight text-foreground">
                  What to include in your message
                </h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                  <div className="rounded-[1.1rem] border border-black/[0.05] bg-background/70 px-4 py-3 text-sm text-foreground/80 dark:border-white/[0.06]">
                    Your account email or public username
                  </div>
                  <div className="rounded-[1.1rem] border border-black/[0.05] bg-background/70 px-4 py-3 text-sm text-foreground/80 dark:border-white/[0.06]">
                    The page or flow where the issue happened
                  </div>
                  <div className="rounded-[1.1rem] border border-black/[0.05] bg-background/70 px-4 py-3 text-sm text-foreground/80 dark:border-white/[0.06]">
                    What you expected to happen
                  </div>
                  <div className="rounded-[1.1rem] border border-black/[0.05] bg-background/70 px-4 py-3 text-sm text-foreground/80 dark:border-white/[0.06]">
                    Any error message you saw
                  </div>
                </div>
              </div>
            </article>

            <article className="rounded-[1.75rem] border border-black/[0.05] bg-white/80 p-6 shadow-card-light backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface1/90 dark:shadow-card">
              <div className="space-y-3">
                <h2 className="text-xl font-bold tracking-tight text-foreground">
                  Helpful links
                </h2>
                <div className="flex flex-col gap-2 text-sm font-semibold">
                  <Link
                    href={routes.public.forgotPassword}
                    className="rounded-2xl border border-border/70 px-4 py-3 text-foreground transition-colors hover:bg-background/80"
                  >
                    Reset your password
                  </Link>
                  <Link
                    href={routes.public.verifyEmail}
                    className="rounded-2xl border border-border/70 px-4 py-3 text-foreground transition-colors hover:bg-background/80"
                  >
                    Verify your email
                  </Link>
                  <Link
                    href={routes.public.privacy}
                    className="rounded-2xl border border-border/70 px-4 py-3 text-foreground transition-colors hover:bg-background/80"
                  >
                    Privacy policy
                  </Link>
                  <Link
                    href={routes.public.terms}
                    className="rounded-2xl border border-border/70 px-4 py-3 text-foreground transition-colors hover:bg-background/80"
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
