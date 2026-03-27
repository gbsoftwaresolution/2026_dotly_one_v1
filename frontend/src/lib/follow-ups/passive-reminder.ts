import type { FollowUp, FollowUpType } from "@/types/follow-up";

const PASSIVE_INACTIVITY_DAYS = 14;

type PassiveReminderLike = {
  isSystemGenerated?: boolean;
  type?: FollowUpType;
};

export function isPassiveInactivityFollowUp(
  followUp: PassiveReminderLike | null | undefined,
) {
  return Boolean(followUp?.isSystemGenerated && followUp.type === "inactivity");
}

export function getPassiveReminderBadgeLabel() {
  return "Stay close";
}

export function getPassiveReminderHeadline() {
  return "Reopen the conversation";
}

export function getPassiveReminderScheduleLabel() {
  return `Reconnect after ${PASSIVE_INACTIVITY_DAYS / 7} weeks`;
}

export function getPassiveReminderBody() {
  return "It has been a little while since your last exchange.";
}

export function getPassiveReminderDetailTitle() {
  return "Consider a thoughtful reconnect";
}

export function getPassiveReminderRelationshipIds(followUps: FollowUp[]) {
  return new Set(
    followUps
      .filter((followUp) => isPassiveInactivityFollowUp(followUp))
      .map((followUp) => followUp.relationshipId),
  );
}
