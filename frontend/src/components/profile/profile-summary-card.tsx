export function ProfileSummaryCard() {
  return (
    <div className="rounded-3xl bg-foreground/[0.03] p-5 shadow-inner ring-1 ring-inset ring-black/5 dark:bg-white/[0.045] dark:ring-white/5">
      <div className="space-y-2">
        <h2 className="text-base font-semibold text-foreground">
          Persona detail coming next
        </h2>
        <p className="text-sm text-muted">
          Phase 1 focuses on account access, persona creation, persona listing,
          and public profile viewing. Detailed persona editing is not yet part
          of this screen.
        </p>
      </div>
    </div>
  );
}
