"use client";

import { useState } from "react";

import { requestApi } from "@/lib/api/request-api";
import type { EventParticipant } from "@/types/event";

import { ParticipantCard } from "./participant-card";

interface ParticipantsListProps {
  participants: EventParticipant[];
  eventId: string;
  /** The personaId the current user is attending as — set as fromPersonaId */
  myPersonaId: string;
}

export function ParticipantsList({
  participants,
  eventId,
  myPersonaId,
}: ParticipantsListProps) {
  const [requestingIds, setRequestingIds] = useState<Set<string>>(new Set());
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handleRequestAccess(participant: EventParticipant) {
    if (sentIds.has(participant.personaId)) return;

    setRequestingIds((prev) => new Set(prev).add(participant.personaId));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[participant.personaId];
      return next;
    });

    try {
      await requestApi.send({
        toPersonaId: participant.personaId,
        fromPersonaId: myPersonaId,
        sourceType: "event",
        sourceId: eventId,
      });
      setSentIds((prev) => new Set(prev).add(participant.personaId));
    } catch (err: unknown) {
      setErrors((prev) => ({
        ...prev,
        [participant.personaId]:
          err instanceof Error ? err.message : "Request failed.",
      }));
    } finally {
      setRequestingIds((prev) => {
        const next = new Set(prev);
        next.delete(participant.personaId);
        return next;
      });
    }
  }

  return (
    <div className="space-y-2">
      {participants.map((p) => (
        <div key={p.personaId}>
          {sentIds.has(p.personaId) ? (
            <div className="rounded-3xl border border-green-100 bg-green-50 px-5 py-4 dark:border-green-900 dark:bg-green-950/30">
              <p className="font-mono text-xs font-medium text-green-700 dark:text-green-400">
                Request sent to {p.fullName}
              </p>
            </div>
          ) : (
            <>
              <ParticipantCard
                participant={p}
                onRequestAccess={handleRequestAccess}
                isRequesting={requestingIds.has(p.personaId)}
              />
              {errors[p.personaId] ? (
                <p className="mt-1 px-2 font-mono text-xs text-rose-600 dark:text-rose-400">
                  {errors[p.personaId]}
                </p>
              ) : null}
            </>
          )}
        </div>
      ))}
    </div>
  );
}
