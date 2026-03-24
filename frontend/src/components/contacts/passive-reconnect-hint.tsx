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
    <div className="rounded-2xl border border-cyan-200/80 bg-cyan-50/70 px-4 py-4 dark:border-brandCyan/20 dark:bg-brandCyan/[0.08]">
      <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-cyan-700 dark:text-brandCyan">
        {getPassiveReminderBadgeLabel()}
      </p>
      <h3 className="mt-1 font-sans text-sm font-semibold text-cyan-950 dark:text-foreground">
        {getPassiveReminderDetailTitle()}
      </h3>
      <p className="mt-1 font-sans text-sm leading-6 text-cyan-900/90 dark:text-white/78">
        {getPassiveReminderBody()}
      </p>
      <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-cyan-700/80 dark:text-brandCyan/80">
        {getPassiveReminderScheduleLabel()}
      </p>
    </div>
  );
}