const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

type RelationshipPriorityInput = {
  lastInteractionAt: Date | null;
  connectedAt: Date | null;
  hasPendingFollowUp: boolean;
  isOverdue: boolean;
  isUpcomingSoon: boolean;
};

export function calculateRelationshipPriority(
  relationship: RelationshipPriorityInput,
  now: Date = new Date(),
) {
  return (
    calculateRecencyScore(relationship.lastInteractionAt, now) +
    calculateFollowUpUrgencyScore(relationship) +
    calculateConnectionRecencyScore(relationship.connectedAt, now)
  );
}

function calculateRecencyScore(lastInteractionAt: Date | null, now: Date) {
  if (!lastInteractionAt) {
    return 10;
  }

  const ageInDays = getAgeInDays(lastInteractionAt, now);

  if (ageInDays <= 1) {
    return 50;
  }

  if (ageInDays <= 3) {
    return 40;
  }

  if (ageInDays <= 7) {
    return 30;
  }

  if (ageInDays <= 14) {
    return 20;
  }

  return 10;
}

function calculateFollowUpUrgencyScore(
  relationship: Pick<
    RelationshipPriorityInput,
    "hasPendingFollowUp" | "isOverdue" | "isUpcomingSoon"
  >,
) {
  if (relationship.isOverdue) {
    return 50;
  }

  if (relationship.isUpcomingSoon) {
    return 30;
  }

  if (relationship.hasPendingFollowUp) {
    return 20;
  }

  return 0;
}

function calculateConnectionRecencyScore(connectedAt: Date | null, now: Date) {
  if (!connectedAt) {
    return 5;
  }

  const ageInDays = getAgeInDays(connectedAt, now);

  if (ageInDays <= 1) {
    return 20;
  }

  if (ageInDays <= 7) {
    return 15;
  }

  return 5;
}

function getAgeInDays(value: Date, now: Date) {
  const ageInMilliseconds = Math.max(0, now.getTime() - value.getTime());

  return ageInMilliseconds / MILLISECONDS_PER_DAY;
}