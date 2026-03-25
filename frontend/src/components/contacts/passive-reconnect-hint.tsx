"use client";

import { useEffect, useMemo } from "react";

import { refreshFollowUps, useAppDataSnapshot } from "@/lib/app-data-store";
import {
  getPassiveReminderBadgeLabel,
  getPassiveReminderBody,
  getPassiveReminderDetailTitle,
  getPassiveReminderScheduleLabel,
  isPassiveInactivityFollowUp,
} from "@/lib/follow-ups/passive-reminder";

interface PassiveReconnectHintProps {
  relationshipId: string;
}

export function PassiveReconnectHint({
  relationshipId,
}: PassiveReconnectHintProps) {
  const { followUps } = useAppDataSnapshot();

  useEffect(() => {
    if (followUps.pending.status !== "idle") {
      return;
    }

    void refreshFollowUps("pending", { processDue: false }).catch(
      () => undefined,
    );
  }, [followUps.pending.status]);

  const passiveReminder = useMemo(
    () =>
      followUps.pending.data.find(
        (followUp) =>
          followUp.relationshipId === relationshipId &&
          isPassiveInactivityFollowUp(followUp),
      ) ?? null,
    [followUps.pending.data, relationshipId],
  );

  if (!passiveReminder) {
    return null;
  }

  return (
    <div className="rounded-2xl bg-foreground/[0.04] px-4 py-4 shadow-inner ring-1 ring-inset ring-black/5 dark:bg-white/[0.05] dark:ring-white/10">
      <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-muted">
        {getPassiveReminderBadgeLabel()}
      </p>
      <h3 className="mt-1 font-sans text-sm font-semibold text-foreground">
        {getPassiveReminderDetailTitle()}
      </h3>
      <p className="mt-1 font-sans text-sm leading-6 text-foreground/80">
        {getPassiveReminderBody()}
      </p>
      <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-muted">
        {getPassiveReminderScheduleLabel()}
      </p>
    </div>
  );
}
