import type { FollowUp, FollowUpType } from "@/types/follow-up";

const PASSIVE_INACTIVITY_DAYS = 14;

type PassiveReminderLike = {
  isSystemGenerated?: boolean;
  type?: FollowUpType;
};

export function isPassiveInactivityFollowUp(
  followUp: PassiveReminderLike | null | undefined,
) {
  return Boolean(
    followUp?.isSystemGenerated && followUp.type === "inactivity",
  );
}

export function getPassiveReminderBadgeLabel() {
  return "Stay in touch";
}

export function getPassiveReminderHeadline() {
  return "Reach out again";
}

export function getPassiveReminderScheduleLabel() {
  return `Reconnect after ${PASSIVE_INACTIVITY_DAYS / 7} weeks`;
}

export function getPassiveReminderBody() {
  return "You haven't interacted in a while.";
}

export function getPassiveReminderDetailTitle() {
  return "Consider reconnecting";
}

export function getPassiveReminderRelationshipIds(followUps: FollowUp[]) {
  return new Set(
    followUps
      .filter((followUp) => isPassiveInactivityFollowUp(followUp))
      .map((followUp) => followUp.relationshipId),
  );
}