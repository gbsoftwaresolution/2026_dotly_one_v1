const MAX_HEALTH_SCORE = 100;
const MIN_HEALTH_SCORE = 0;
const BASE_HEALTH_SCORE = 35;

export type RelationshipHealthBand = "cold" | "steady" | "warm" | "strong";

type RelationshipHealthInput = {
  lastInteractionAt: Date | null;
  interactionCount: number;
  relationshipAgeDays: number;
  hasPendingFollowUp: boolean;
  hasPassiveInactivityFollowUp: boolean;
  isOverdue: boolean;
  isUpcomingSoon: boolean;
};

export type RelationshipHealthSnapshot = {
  score: number;
  band: RelationshipHealthBand;
  label: string;
  summary: string;
  nextAction: string;
};

export function calculateRelationshipHealth(
  relationship: RelationshipHealthInput,
  now: Date = new Date(),
): RelationshipHealthSnapshot {
  const daysSinceLastInteraction = relationship.lastInteractionAt
    ? getAgeInDays(relationship.lastInteractionAt, now)
    : null;

  const score = clampHealthScore(
    BASE_HEALTH_SCORE +
      calculateRecencyContribution(
        daysSinceLastInteraction,
        relationship.relationshipAgeDays,
      ) +
      calculateEngagementContribution(relationship.interactionCount) +
      calculateStabilityContribution(
        relationship.relationshipAgeDays,
        relationship.interactionCount,
      ) +
      calculateFollowUpContribution(relationship),
  );
  const band = getRelationshipHealthBand(score);

  return {
    score,
    band,
    label: getRelationshipHealthLabel(band),
    summary: getRelationshipHealthSummary(
      relationship,
      daysSinceLastInteraction,
      band,
    ),
    nextAction: getRelationshipHealthNextAction(relationship, band),
  };
}

function calculateRecencyContribution(
  daysSinceLastInteraction: number | null,
  relationshipAgeDays: number,
) {
  if (daysSinceLastInteraction === null) {
    return relationshipAgeDays <= 14 ? 12 : 0;
  }

  if (daysSinceLastInteraction <= 3) {
    return 35;
  }

  if (daysSinceLastInteraction <= 7) {
    return 28;
  }

  if (daysSinceLastInteraction <= 14) {
    return 20;
  }

  if (daysSinceLastInteraction <= 30) {
    return 12;
  }

  if (daysSinceLastInteraction <= 60) {
    return 4;
  }

  return 0;
}

function calculateEngagementContribution(interactionCount: number) {
  if (interactionCount >= 6) {
    return 25;
  }

  if (interactionCount >= 3) {
    return 18;
  }

  if (interactionCount >= 1) {
    return 10;
  }

  return 0;
}

function calculateStabilityContribution(
  relationshipAgeDays: number,
  interactionCount: number,
) {
  if (relationshipAgeDays >= 30 && interactionCount >= 3) {
    return 8;
  }

  if (relationshipAgeDays >= 7 && interactionCount >= 1) {
    return 4;
  }

  return 0;
}

function calculateFollowUpContribution(
  relationship: Pick<
    RelationshipHealthInput,
    | "hasPendingFollowUp"
    | "hasPassiveInactivityFollowUp"
    | "isOverdue"
    | "isUpcomingSoon"
  >,
) {
  if (relationship.isOverdue) {
    return -30;
  }

  if (relationship.hasPassiveInactivityFollowUp) {
    return -22;
  }

  if (relationship.isUpcomingSoon) {
    return -12;
  }

  if (relationship.hasPendingFollowUp) {
    return 4;
  }

  return 0;
}

function getRelationshipHealthBand(score: number): RelationshipHealthBand {
  if (score >= 80) {
    return "strong";
  }

  if (score >= 60) {
    return "warm";
  }

  if (score >= 40) {
    return "steady";
  }

  return "cold";
}

function getRelationshipHealthLabel(band: RelationshipHealthBand) {
  switch (band) {
    case "strong":
      return "Strong";
    case "warm":
      return "Warm";
    case "steady":
      return "Steady";
    case "cold":
    default:
      return "Cold";
  }
}

function getRelationshipHealthSummary(
  relationship: RelationshipHealthInput,
  daysSinceLastInteraction: number | null,
  band: RelationshipHealthBand,
) {
  if (relationship.isOverdue) {
    return "A follow-up is overdue and this connection needs attention.";
  }

  if (relationship.hasPassiveInactivityFollowUp) {
    return "Momentum is fading because you have not interacted in a while.";
  }

  if (relationship.isUpcomingSoon) {
    return "A follow-up is due soon to keep the relationship active.";
  }

  if (
    daysSinceLastInteraction !== null &&
    daysSinceLastInteraction <= 7 &&
    relationship.interactionCount >= 3
  ) {
    return "Recent back-and-forth keeps this relationship strong.";
  }

  if (daysSinceLastInteraction !== null && daysSinceLastInteraction <= 14) {
    return "Recent activity is keeping this relationship warm.";
  }

  if (
    relationship.lastInteractionAt === null &&
    relationship.relationshipAgeDays <= 14
  ) {
    return "This is a new connection with room to build momentum.";
  }

  if (band === "steady") {
    return "This relationship is steady, but it could use a fresh touchpoint.";
  }

  return "This relationship could use a timely check-in.";
}

function getRelationshipHealthNextAction(
  relationship: RelationshipHealthInput,
  band: RelationshipHealthBand,
) {
  if (relationship.isOverdue || relationship.hasPassiveInactivityFollowUp) {
    return "Reach out now";
  }

  if (relationship.isUpcomingSoon) {
    return "Follow up within a day";
  }

  if (
    relationship.lastInteractionAt === null &&
    relationship.relationshipAgeDays <= 14
  ) {
    return "Send a first follow-up";
  }

  switch (band) {
    case "strong":
      return "Keep the momentum going";
    case "warm":
      return "Check in this week";
    case "steady":
      return "Share a useful update soon";
    case "cold":
    default:
      return "Reconnect with context";
  }
}

function clampHealthScore(score: number) {
  return Math.min(MAX_HEALTH_SCORE, Math.max(MIN_HEALTH_SCORE, score));
}

function getAgeInDays(value: Date, now: Date) {
  return Math.max(0, now.getTime() - value.getTime()) / (24 * 60 * 60 * 1000);
}
