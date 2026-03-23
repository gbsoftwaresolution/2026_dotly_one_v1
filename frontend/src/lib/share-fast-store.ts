import { useSyncExternalStore } from "react";

import { personaApi } from "@/lib/api/persona-api";
import type {
  MyFastSharePayload,
  PersonaFastSharePayload,
} from "@/types/persona";

type ShareFastStatus = "idle" | "loading" | "ready" | "error";

type ShareFastSnapshot = {
  status: ShareFastStatus;
  selectedPersonaId: string | null;
  sharePayload: PersonaFastSharePayload | null;
  personaPayloads: Record<string, PersonaFastSharePayload>;
};

type PersistedShareFastSnapshot = Pick<
  ShareFastSnapshot,
  "selectedPersonaId" | "sharePayload" | "personaPayloads"
>;

const STORAGE_KEY = "dotly.share-fast";

let snapshot: ShareFastSnapshot = {
  status: "idle",
  selectedPersonaId: null,
  sharePayload: null,
  personaPayloads: {},
};

let hydrated = false;
let pendingPrefetch: Promise<MyFastSharePayload | null> | null = null;

const listeners = new Set<() => void>();

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

function canUseStorage() {
  return typeof window !== "undefined";
}

function toNormalizedSharePayload(
  value: MyFastSharePayload,
): PersonaFastSharePayload | null {
  if (value.persona === null || value.share === null) {
    return null;
  }

  return {
    personaId: value.persona.id,
    username: value.persona.username,
    fullName: value.persona.fullName,
    profilePhotoUrl: value.persona.profilePhotoUrl,
    shareUrl: value.share.shareUrl,
    qrValue: value.share.qrValue,
    primaryAction: value.share.primaryAction,
    effectiveActions: value.share.effectiveActions,
    preferredShareType: value.share.preferredShareType,
    hasQuickConnect: value.share.preferredShareType === "instant_connect",
    quickConnectUrl:
      value.share.preferredShareType === "instant_connect"
        ? value.share.shareUrl
        : null,
  };
}

function toStoredSnapshot(
  value: MyFastSharePayload,
  existingPersonaPayloads: Record<string, PersonaFastSharePayload>,
): ShareFastSnapshot {
  const personaPayloads = { ...existingPersonaPayloads };
  const normalizedSharePayload = toNormalizedSharePayload(value);

  if (normalizedSharePayload) {
    personaPayloads[normalizedSharePayload.personaId] = normalizedSharePayload;
  }

  return {
    status: "ready",
    selectedPersonaId: normalizedSharePayload?.personaId ?? null,
    sharePayload: normalizedSharePayload,
    personaPayloads,
  };
}

function toMyFastSharePayload(value: ShareFastSnapshot): MyFastSharePayload {
  if (value.sharePayload === null) {
    return {
      persona: null,
      share: null,
    };
  }

  return {
    persona: {
      id: value.sharePayload.personaId,
      username: value.sharePayload.username,
      fullName: value.sharePayload.fullName,
      profilePhotoUrl: value.sharePayload.profilePhotoUrl,
    },
    share: {
      shareUrl: value.sharePayload.shareUrl,
      qrValue: value.sharePayload.qrValue,
      primaryAction: value.sharePayload.primaryAction,
      effectiveActions: value.sharePayload.effectiveActions,
      preferredShareType: value.sharePayload.preferredShareType,
    },
  };
}

function persistSnapshot() {
  if (!canUseStorage()) {
    return;
  }

  const value: PersistedShareFastSnapshot = {
    selectedPersonaId: snapshot.selectedPersonaId,
    sharePayload: snapshot.sharePayload,
    personaPayloads: snapshot.personaPayloads,
  };

  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

function setSnapshot(nextSnapshot: ShareFastSnapshot) {
  snapshot = nextSnapshot;
  persistSnapshot();
  emitChange();
}

export function hydrateShareFastStore() {
  if (hydrated || !canUseStorage()) {
    return;
  }

  hydrated = true;

  const storedValue = window.sessionStorage.getItem(STORAGE_KEY);

  if (!storedValue) {
    return;
  }

  try {
    const parsedValue = JSON.parse(
      storedValue,
    ) as PersistedShareFastSnapshot | null;

    if (!parsedValue || typeof parsedValue !== "object") {
      return;
    }

    snapshot = {
      status: "ready",
      selectedPersonaId:
        typeof parsedValue.selectedPersonaId === "string"
          ? parsedValue.selectedPersonaId
          : null,
      sharePayload: parsedValue.sharePayload ?? null,
      personaPayloads: parsedValue.personaPayloads ?? {},
    };
  } catch {
    window.sessionStorage.removeItem(STORAGE_KEY);
  }
}

export function clearShareFastStore() {
  snapshot = {
    status: "idle",
    selectedPersonaId: null,
    sharePayload: null,
    personaPayloads: {},
  };
  pendingPrefetch = null;

  if (canUseStorage()) {
    hydrated = true;
    window.sessionStorage.removeItem(STORAGE_KEY);
  }

  emitChange();
}

export function seedMyFastShare(value: MyFastSharePayload) {
  hydrateShareFastStore();
  setSnapshot(toStoredSnapshot(value, snapshot.personaPayloads));
}

export function upsertPersonaFastShare(
  value: PersonaFastSharePayload,
  options?: { selected?: boolean },
) {
  hydrateShareFastStore();

  const selectedPersonaId = options?.selected
    ? value.personaId
    : snapshot.selectedPersonaId;

  setSnapshot({
    status: "ready",
    selectedPersonaId,
    sharePayload:
      selectedPersonaId === value.personaId ? value : snapshot.sharePayload,
    personaPayloads: {
      ...snapshot.personaPayloads,
      [value.personaId]: value,
    },
  });
}

export function getPersonaFastShare(personaId: string) {
  hydrateShareFastStore();

  if (snapshot.personaPayloads[personaId]) {
    return snapshot.personaPayloads[personaId];
  }

  if (snapshot.sharePayload?.personaId === personaId) {
    return snapshot.sharePayload;
  }

  return null;
}

export function getShareFastSnapshot() {
  hydrateShareFastStore();
  return snapshot;
}

export async function prefetchMyFastShare(options?: { force?: boolean }) {
  hydrateShareFastStore();

  if (!options?.force && snapshot.status === "ready") {
    return toMyFastSharePayload(snapshot);
  }

  if (!options?.force && pendingPrefetch) {
    return pendingPrefetch;
  }

  snapshot = {
    ...snapshot,
    status: "loading",
  };
  emitChange();

  pendingPrefetch = personaApi
    .getMyFastShare()
    .then((value) => {
      seedMyFastShare(value);
      return value;
    })
    .catch((error) => {
      snapshot = {
        ...snapshot,
        status: snapshot.sharePayload ? "ready" : "error",
      };
      emitChange();
      throw error;
    })
    .finally(() => {
      pendingPrefetch = null;
    });

  return pendingPrefetch;
}

function subscribe(listener: () => void) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function useShareFastSnapshot() {
  return useSyncExternalStore(subscribe, getShareFastSnapshot, getShareFastSnapshot);
}