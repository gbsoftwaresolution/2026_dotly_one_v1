import Link from "next/link";

import { Card } from "@/components/shared/card";
import { routes } from "@/lib/constants/routes";
import type { Contact } from "@/types/contact";

function formatSourceType(sourceType: Contact["sourceType"]): string {
  return sourceType === "qr" ? "QR" : "Profile";
}

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

interface ContactCardProps {
  contact: Contact;
}

export function ContactCard({ contact }: ContactCardProps) {
  const { targetPersona, sourceType, createdAt, relationshipId } = contact;

  return (
    <Link
      href={routes.app.contactDetail(relationshipId)}
      className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-brandRose dark:focus-visible:ring-brandCyan rounded-3xl"
    >
      <Card className="space-y-4 transition-all hover:bg-slate-50 active:scale-[0.99] dark:hover:bg-zinc-900">
        <div className="flex items-start gap-4">
          {targetPersona.profilePhotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={targetPersona.profilePhotoUrl}
              alt={targetPersona.fullName}
              className="h-14 w-14 rounded-2xl object-cover"
            />
          ) : (
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-base font-semibold text-white dark:bg-white dark:text-zinc-950">
              {targetPersona.fullName.charAt(0).toUpperCase()}
            </div>
          )}

          <div className="min-w-0 flex-1 space-y-1 pt-1">
            <h2 className="truncate font-sans text-base font-semibold text-foreground">
              {targetPersona.fullName}
            </h2>
            <p className="truncate font-sans text-sm text-muted">
              {targetPersona.jobTitle} at {targetPersona.companyName}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6 border-t border-border pt-4 font-mono text-[10px] uppercase tracking-widest text-muted">
          <span>Source: {formatSourceType(sourceType)}</span>
          <span>Date: {formatTimestamp(createdAt)}</span>
        </div>
      </Card>
    </Link>
  );
}
