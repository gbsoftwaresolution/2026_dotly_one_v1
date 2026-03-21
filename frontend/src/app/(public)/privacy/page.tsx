import { LegalPageShell } from "@/components/layout/legal-page-shell";

const sections = [
  {
    title: "What Dotly stores",
    body: (
      <>
        <p>
          Dotly stores the information needed to operate your account and your
          networking flows, including your email address, personas, profile
          configuration, relationship activity, and app-generated events such as
          requests, approvals, notifications, and analytics summaries.
        </p>
        <p>
          We avoid collecting more than is necessary for the product to work.
          Private fields and permissioned content are intended to remain scoped
          to the audiences you authorize.
        </p>
      </>
    ),
  },
  {
    title: "How information is used",
    body: (
      <>
        <p>
          We use your data to authenticate you, render your personas, enforce
          permission-based access, support QR sharing, deliver notifications,
          prevent abuse, and improve reliability and safety across the platform.
        </p>
        <p>
          Operational logs and service metrics may also be used to diagnose
          errors, investigate incidents, and maintain system health.
        </p>
      </>
    ),
  },
  {
    title: "Sharing and disclosure",
    body: (
      <>
        <p>
          Dotly does not treat your profile data as an advertising asset. We do
          not expose permissioned networking information broadly by default.
          Information is shared with other users according to the persona and
          access controls you configure.
        </p>
        <p>
          We may disclose limited information when required for legal
          compliance, security investigations, or to protect users and the
          service from fraud, abuse, or harmful activity.
        </p>
      </>
    ),
  },
  {
    title: "Your control",
    body: (
      <>
        <p>
          You control the personas you create, the contexts you share, and the
          visibility rules attached to them. Reviewing your persona settings and
          connection approvals regularly is the best way to keep sharing aligned
          with your intent.
        </p>
        <p>
          If Dotly adds more formal export, deletion, or retention controls,
          this page should be updated to reflect those workflows clearly.
        </p>
      </>
    ),
  },
] as const;

export default function PrivacyPage() {
  return (
    <LegalPageShell
      eyebrow="Dotly privacy"
      title="Privacy commitments for identity you can control"
      intro="This page summarizes how Dotly handles account information, persona data, permission-based sharing, and operational data needed to keep the platform safe and reliable."
      lastUpdated="March 21, 2026"
      sections={sections}
    />
  );
}