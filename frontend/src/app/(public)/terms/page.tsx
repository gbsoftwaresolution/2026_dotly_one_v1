import Link from "next/link";

import { LegalPageShell } from "@/components/layout/legal-page-shell";
import { routes } from "@/lib/constants/routes";

const sections = [
  {
    title: "Using Dotly responsibly",
    body: (
      <>
        <p>
          Dotly is built for permission-based networking. You agree to use the
          platform to create accurate personas, share information you have the
          right to share, and respect the access boundaries other people set.
        </p>
        <p>
          You must not impersonate other people, use Dotly for harassment,
          scraping, spam, or abusive contact campaigns, or attempt to bypass
          persona permissions, approvals, or blocks.
        </p>
      </>
    ),
  },
  {
    title: "Accounts, security, and access",
    body: (
      <>
        <p>
          You are responsible for maintaining the security of your account,
          including your password and any device sessions used to access Dotly.
        </p>
        <p>
          If we detect behavior that threatens user safety, service integrity,
          or legal compliance, we may limit access, suspend features, or remove
          accounts while we investigate.
        </p>
      </>
    ),
  },
  {
    title: "Personas, QR sharing, and permissions",
    body: (
      <>
        <p>
          Dotly lets you create personas, publish profile links, and share QR
          entry points. Those features are designed to control who sees what,
          not to guarantee that recipients will keep shared information private
          after they receive it.
        </p>
        <p>
          You should only grant access that matches your intent, review persona
          settings carefully, and revoke or adjust access when relationships or
          contexts change.
        </p>
      </>
    ),
  },
  {
    title: "Service availability and changes",
    body: (
      <>
        <p>
          We can update, improve, or retire features over time. We also may
          change these terms as the product evolves, especially around trust,
          abuse prevention, and identity controls.
        </p>
        <p>
          Continued use of Dotly after material updates means you accept the
          revised terms. If you do not agree with future changes, you should
          stop using the service.
        </p>
        <p>
          If you have questions about these terms or need account help, reach
          out through{" "}
          <Link
            href={routes.public.support}
            className="font-semibold text-foreground underline underline-offset-4"
          >
            Dotly support
          </Link>
          .
        </p>
      </>
    ),
  },
] as const;

export default function TermsPage() {
  return (
    <LegalPageShell
      eyebrow="Dotly terms"
      title="Terms for secure, permission-based networking"
      intro="These terms explain the basic rules for using Dotly responsibly, protecting your account, and respecting the identity and permission controls that make the platform useful."
      lastUpdated="March 21, 2026"
      sections={sections}
    />
  );
}
