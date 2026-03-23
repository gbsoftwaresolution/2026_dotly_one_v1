import { useSyncExternalStore } from "react";

import { contactsApi } from "@/lib/api/contacts-api";
import { ApiError } from "@/lib/api/client";
import { followUpsApi } from "@/lib/api/follow-ups-api";
import { personaApi } from "@/lib/api/persona-api";
import { routes } from "@/lib/constants/routes";
import { getShareFastSnapshot, prefetchMyFastShare } from "@/lib/share-fast-store";
import type { Contact } from "@/types/contact";
import type { FollowUp, FollowUpStatus } from "@/types/follow-up";
import type { PersonaSummary } from "@/types/persona";

type ResourceStatus = "idle" | "loading" | "ready" | "error";

type ResourceState<T> = {
  status: ResourceStatus;
  data: T;
  error: string | null;
  refreshedAt: number | null;
};

type PersistedAppDataSnapshot = {
  personas: Pick<ResourceState<PersonaSummary[]>, "data" | "refreshedAt">;
  contacts: Pick<ResourceState<Contact[]>, "data" | "refreshedAt">;
  followUps: Record<FollowUpStatus, Pick<ResourceState<FollowUp[]>, "data" | "refreshedAt">>;
};

export type AppDataSnapshot = {
  personas: ResourceState<PersonaSummary[]>;
  contacts: ResourceState<Contact[]>;
  followUps: Record<FollowUpStatus, ResourceState<FollowUp[]>>;
  currentPersona: PersonaSummary | null;
};

const STORAGE_KEY = "dotly.app-data";

const APP_DATA_WARM_ROUTES = [
  routes.app.home,
  routes.app.personas,
  routes.app.requests,
  routes.app.qr,
  routes.app.contacts,
  routes.app.followUps,
  routes.app.events,
  routes.app.notifications,
  routes.app.analytics,
  routes.app.settings,
] as const;

const EMPTY_PERSONAS: PersonaSummary[] = [];
const EMPTY_CONTACTS: Contact[] = [];
const EMPTY_FOLLOW_UPS: FollowUp[] = [];

function createResourceState<T>(data: T): ResourceState<T> {
  return {
    status: "idle",
    data,
    error: null,
    refreshedAt: null,
  };
}

function createFollowUpState(): Record<FollowUpStatus, ResourceState<FollowUp[]>> {
  return {
    pending: createResourceState(EMPTY_FOLLOW_UPS),
    completed: createResourceState(EMPTY_FOLLOW_UPS),
    cancelled: createResourceState(EMPTY_FOLLOW_UPS),
  };
}

let snapshot = {
  personas: createResourceState(EMPTY_PERSONAS),
  contacts: createResourceState(EMPTY_CONTACTS),
  followUps: createFollowUpState(),
};

let renderedSnapshot: AppDataSnapshot = {
  personas: snapshot.personas,
  contacts: snapshot.contacts,
  followUps: snapshot.followUps,
  currentPersona: null,
};

let hydrated = false;
let pendingCorePrefetch: Promise<void> | null = null;
let pendingPersonasLoad: Promise<PersonaSummary[]> | null = null;
let pendingContactsLoad: Promise<Contact[]> | null = null;
const pendingFollowUpLoads: Partial<Record<FollowUpStatus, Promise<FollowUp[]>>> = {};

const listeners = new Set<() => void>();

function canUseStorage() {
  return typeof window !== "undefined";
}

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

function deriveCurrentPersona(personas: PersonaSummary[]) {
  const selectedPersonaId = getShareFastSnapshot().selectedPersonaId;

  if (selectedPersonaId) {
    const selectedPersona = personas.find((persona) => persona.id === selectedPersonaId);

    if (selectedPersona) {
      return selectedPersona;
    }
  }

  return personas[0] ?? null;
}

function toReadyState<T>(current: ResourceState<T>, data: T): ResourceState<T> {
  return {
    status: "ready",
    data,
    error: null,
    refreshedAt: Date.now(),
  };
}

function toLoadingState<T>(current: ResourceState<T>): ResourceState<T> {
  return {
    ...current,
    status: "loading",
    error: null,
  };
}

function cloneFollowUpResources(source: Record<FollowUpStatus, ResourceState<FollowUp[]>>) {
  return {
    pending: { ...source.pending, data: [...source.pending.data] },
    completed: { ...source.completed, data: [...source.completed.data] },
    cancelled: { ...source.cancelled, data: [...source.cancelled.data] },
  };
}

function buildSnapshot(): AppDataSnapshot {
  return {
    personas: snapshot.personas,
    contacts: snapshot.contacts,
    followUps: snapshot.followUps,
    currentPersona: deriveCurrentPersona(snapshot.personas.data),
  };
}

function syncRenderedSnapshot() {
  renderedSnapshot = buildSnapshot();
}

function persistSnapshot() {
  if (!canUseStorage()) {
    return;
  }

  const value: PersistedAppDataSnapshot = {
    personas: {
      data: snapshot.personas.data,
      refreshedAt: snapshot.personas.refreshedAt,
    },
    contacts: {
      data: snapshot.contacts.data,
      refreshedAt: snapshot.contacts.refreshedAt,
    },
    followUps: {
      pending: {
        data: snapshot.followUps.pending.data,
        refreshedAt: snapshot.followUps.pending.refreshedAt,
      },
      completed: {
        data: snapshot.followUps.completed.data,
        refreshedAt: snapshot.followUps.completed.refreshedAt,
      },
      cancelled: {
        data: snapshot.followUps.cancelled.data,
        refreshedAt: snapshot.followUps.cancelled.refreshedAt,
      },
    },
  };

  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

function setSnapshot(nextSnapshot: typeof snapshot) {
  snapshot = nextSnapshot;
  syncRenderedSnapshot();
  persistSnapshot();
  emitChange();
}

function setFollowUpState(status: FollowUpStatus, nextState: ResourceState<FollowUp[]>) {
  setSnapshot({
    ...snapshot,
    followUps: {
      ...snapshot.followUps,
      [status]: nextState,
    },
  });
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    return error.message;
  }

  return fallback;
}

function sortFollowUps(items: FollowUp[]) {
  return [...items].sort((left, right) => {
    const leftPending = left.status === "pending";
    const rightPending = right.status === "pending";

    if (leftPending && !rightPending) {
      return -1;
    }

    if (!leftPending && rightPending) {
      return 1;
    }

    if (leftPending && rightPending) {
      return new Date(left.remindAt).getTime() - new Date(right.remindAt).getTime();
    }

    return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
  });
}

function upsertFollowUpItem(items: FollowUp[], followUp: FollowUp) {
  const remaining = items.filter((item) => item.id !== followUp.id);
  return sortFollowUps([...remaining, followUp]);
}

export function hydrateAppDataStore() {
  if (hydrated || !canUseStorage()) {
    return;
  }

  hydrated = true;

  const storedValue = window.sessionStorage.getItem(STORAGE_KEY);

  if (!storedValue) {
    return;
  }

  try {
    const parsedValue = JSON.parse(storedValue) as PersistedAppDataSnapshot | null;

    if (!parsedValue || typeof parsedValue !== "object") {
      return;
    }

    snapshot = {
      personas: {
        status: "ready",
        data: Array.isArray(parsedValue.personas?.data) ? parsedValue.personas.data : EMPTY_PERSONAS,
        error: null,
        refreshedAt: parsedValue.personas?.refreshedAt ?? null,
      },
      contacts: {
        status: "ready",
        data: Array.isArray(parsedValue.contacts?.data) ? parsedValue.contacts.data : EMPTY_CONTACTS,
        error: null,
        refreshedAt: parsedValue.contacts?.refreshedAt ?? null,
      },
      followUps: {
        pending: {
          status: "ready",
          data: Array.isArray(parsedValue.followUps?.pending?.data)
            ? sortFollowUps(parsedValue.followUps.pending.data)
            : EMPTY_FOLLOW_UPS,
          error: null,
          refreshedAt: parsedValue.followUps?.pending?.refreshedAt ?? null,
        },
        completed: {
          status: "ready",
          data: Array.isArray(parsedValue.followUps?.completed?.data)
            ? sortFollowUps(parsedValue.followUps.completed.data)
            : EMPTY_FOLLOW_UPS,
          error: null,
          refreshedAt: parsedValue.followUps?.completed?.refreshedAt ?? null,
        },
        cancelled: {
          status: "ready",
          data: Array.isArray(parsedValue.followUps?.cancelled?.data)
            ? sortFollowUps(parsedValue.followUps.cancelled.data)
            : EMPTY_FOLLOW_UPS,
          error: null,
          refreshedAt: parsedValue.followUps?.cancelled?.refreshedAt ?? null,
        },
      },
    };
    syncRenderedSnapshot();
  } catch {
    window.sessionStorage.removeItem(STORAGE_KEY);
  }
}

export function clearAppDataStore() {
  snapshot = {
    personas: createResourceState(EMPTY_PERSONAS),
    contacts: createResourceState(EMPTY_CONTACTS),
    followUps: createFollowUpState(),
  };
  syncRenderedSnapshot();
  pendingCorePrefetch = null;
  pendingPersonasLoad = null;
  pendingContactsLoad = null;
  delete pendingFollowUpLoads.pending;
  delete pendingFollowUpLoads.completed;
  delete pendingFollowUpLoads.cancelled;

  if (canUseStorage()) {
    hydrated = true;
    window.sessionStorage.removeItem(STORAGE_KEY);
  }

  emitChange();
}

export function getAppDataSnapshot() {
  hydrateAppDataStore();
  return renderedSnapshot;
}

export async function refreshPersonas(options?: { force?: boolean }) {
  hydrateAppDataStore();

  if (!options?.force && snapshot.personas.status === "ready") {
    return snapshot.personas.data;
  }

  if (!options?.force && pendingPersonasLoad) {
    return pendingPersonasLoad;
  }

  setSnapshot({
    ...snapshot,
    personas: toLoadingState(snapshot.personas),
  });

  pendingPersonasLoad = personaApi
    .list()
    .then((personas) => {
      setSnapshot({
        ...snapshot,
        personas: toReadyState(snapshot.personas, personas),
      });
      return personas;
    })
    .catch((error) => {
      setSnapshot({
        ...snapshot,
        personas: {
          ...snapshot.personas,
          status: snapshot.personas.data.length > 0 ? "ready" : "error",
          error: getErrorMessage(error, "We could not refresh personas right now."),
        },
      });
      throw error;
    })
    .finally(() => {
      pendingPersonasLoad = null;
    });

  return pendingPersonasLoad;
}

export async function refreshContacts(options?: { force?: boolean }) {
  hydrateAppDataStore();

  if (!options?.force && snapshot.contacts.status === "ready") {
    return snapshot.contacts.data;
  }

  if (!options?.force && pendingContactsLoad) {
    return pendingContactsLoad;
  }

  setSnapshot({
    ...snapshot,
    contacts: toLoadingState(snapshot.contacts),
  });

  pendingContactsLoad = contactsApi
    .list()
    .then((contacts) => {
      setSnapshot({
        ...snapshot,
        contacts: toReadyState(snapshot.contacts, contacts),
      });
      return contacts;
    })
    .catch((error) => {
      setSnapshot({
        ...snapshot,
        contacts: {
          ...snapshot.contacts,
          status: snapshot.contacts.data.length > 0 ? "ready" : "error",
          error: getErrorMessage(error, "We could not refresh contacts right now."),
        },
      });
      throw error;
    })
    .finally(() => {
      pendingContactsLoad = null;
    });

  return pendingContactsLoad;
}

export async function refreshFollowUps(
  status: FollowUpStatus,
  options?: { force?: boolean; processDue?: boolean },
) {
  hydrateAppDataStore();

  if (!options?.force && snapshot.followUps[status].status === "ready") {
    return snapshot.followUps[status].data;
  }

  if (!options?.force && pendingFollowUpLoads[status]) {
    return pendingFollowUpLoads[status]!;
  }

  setFollowUpState(status, toLoadingState(snapshot.followUps[status]));

  pendingFollowUpLoads[status] = Promise.resolve()
    .then(async () => {
      if (status === "pending" && options?.processDue !== false) {
        await followUpsApi.processDue().catch(() => undefined);
      }

      return followUpsApi.list({ status });
    })
    .then((followUps) => {
      setFollowUpState(status, toReadyState(snapshot.followUps[status], sortFollowUps(followUps)));
      return followUps;
    })
    .catch((error) => {
      setFollowUpState(status, {
        ...snapshot.followUps[status],
        status: snapshot.followUps[status].data.length > 0 ? "ready" : "error",
        error: getErrorMessage(error, "We could not refresh follow-ups right now."),
      });
      throw error;
    })
    .finally(() => {
      delete pendingFollowUpLoads[status];
    });

  return pendingFollowUpLoads[status]!;
}

export async function prefetchAppCoreData(options?: { force?: boolean }) {
  hydrateAppDataStore();

  if (!options?.force && pendingCorePrefetch) {
    return pendingCorePrefetch;
  }

  pendingCorePrefetch = Promise.allSettled([
    prefetchMyFastShare(options).catch(() => null),
    refreshPersonas(options).catch(() => EMPTY_PERSONAS),
    refreshContacts(options).catch(() => EMPTY_CONTACTS),
    refreshFollowUps("pending", { ...options, processDue: true }).catch(() => EMPTY_FOLLOW_UPS),
  ]).then(() => undefined);

  return pendingCorePrefetch.finally(() => {
    pendingCorePrefetch = null;
  });
}

export function optimisticallyInsertFollowUp(followUp: FollowUp) {
  hydrateAppDataStore();
  const previousFollowUps = cloneFollowUpResources(snapshot.followUps);
  const nextPending = snapshot.followUps.pending;

  setFollowUpState("pending", {
    ...nextPending,
    status: "ready",
    error: null,
    refreshedAt: Date.now(),
    data: upsertFollowUpItem(nextPending.data, followUp),
  });

  return () => {
    setSnapshot({
      ...snapshot,
      followUps: previousFollowUps,
    });
  };
}

export function optimisticallyTransitionFollowUp(
  id: string,
  nextStatus: Exclude<FollowUpStatus, "pending">,
) {
  hydrateAppDataStore();
  const previousFollowUps = cloneFollowUpResources(snapshot.followUps);
  let sourceFollowUp: FollowUp | null = null;

  for (const status of ["pending", "completed", "cancelled"] as const) {
    sourceFollowUp = snapshot.followUps[status].data.find((followUp) => followUp.id === id) ?? sourceFollowUp;
  }

  if (!sourceFollowUp) {
    return () => undefined;
  }

  const optimisticTimestamp = new Date().toISOString();
  const optimisticFollowUp: FollowUp = {
    ...sourceFollowUp,
    status: nextStatus,
    updatedAt: optimisticTimestamp,
    completedAt: nextStatus === "completed" ? optimisticTimestamp : null,
  };

  const nextFollowUps = cloneFollowUpResources(snapshot.followUps);
  nextFollowUps.pending = {
    ...nextFollowUps.pending,
    status: "ready",
    data: nextFollowUps.pending.data.filter((followUp) => followUp.id !== id),
    refreshedAt: Date.now(),
  };

  nextFollowUps.completed = {
    ...nextFollowUps.completed,
    status: nextStatus === "completed" || nextFollowUps.completed.status === "ready" ? "ready" : nextFollowUps.completed.status,
    data:
      nextStatus === "completed"
        ? upsertFollowUpItem(nextFollowUps.completed.data, optimisticFollowUp)
        : nextFollowUps.completed.data.filter((followUp) => followUp.id !== id),
    refreshedAt: Date.now(),
    error: null,
  };

  nextFollowUps.cancelled = {
    ...nextFollowUps.cancelled,
    status: nextStatus === "cancelled" || nextFollowUps.cancelled.status === "ready" ? "ready" : nextFollowUps.cancelled.status,
    data:
      nextStatus === "cancelled"
        ? upsertFollowUpItem(nextFollowUps.cancelled.data, optimisticFollowUp)
        : nextFollowUps.cancelled.data.filter((followUp) => followUp.id !== id),
    refreshedAt: Date.now(),
    error: null,
  };

  setSnapshot({
    ...snapshot,
    followUps: nextFollowUps,
  });

  return () => {
    setSnapshot({
      ...snapshot,
      followUps: previousFollowUps,
    });
  };
}

export function reconcileFollowUp(followUp: FollowUp, options?: { replaceId?: string }) {
  hydrateAppDataStore();

  const nextFollowUps = cloneFollowUpResources(snapshot.followUps);
  const idsToRemove = new Set([followUp.id, options?.replaceId].filter(Boolean));

  for (const status of ["pending", "completed", "cancelled"] as const) {
    nextFollowUps[status] = {
      ...nextFollowUps[status],
      data: nextFollowUps[status].data.filter((item) => !idsToRemove.has(item.id)),
      refreshedAt: Date.now(),
      error: null,
    };
  }

  nextFollowUps[followUp.status] = {
    ...nextFollowUps[followUp.status],
    status: "ready",
    data: upsertFollowUpItem(nextFollowUps[followUp.status].data, followUp),
  };

  setSnapshot({
    ...snapshot,
    followUps: nextFollowUps,
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function useAppDataSnapshot() {
  return useSyncExternalStore(subscribe, getAppDataSnapshot, getAppDataSnapshot);
}

export { APP_DATA_WARM_ROUTES };