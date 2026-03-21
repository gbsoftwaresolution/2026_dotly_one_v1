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
    <div className="flex flex-col gap-2">
      {participants.map((p) => (
        <div key={p.personaId}>
          {sentIds.has(p.personaId) ? (
            <div className="rounded-3xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-4">
              <p className="font-mono text-xs font-medium text-emerald-600 dark:text-emerald-400">
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
                <div className="mt-1 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-3 py-2">
                  <p className="font-mono text-xs text-rose-500 dark:text-rose-400">
                    {errors[p.personaId]}
                  </p>
                </div>
              ) : null}
            </>
          )}
        </div>
      ))}
    </div>
  );
}
