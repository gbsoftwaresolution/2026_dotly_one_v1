"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";

import type { Identity } from "@/types/identity";
import { enabledIdentityTypes, IdentityType } from "@/types/identity";
import { listMyIdentities } from "@/lib/api/identities";

const STORAGE_KEY = "dotly.active-identity-id";

export interface IdentityContextValue {
  activeIdentity: Identity | null;
  availableIdentities: Identity[];
  isLoading: boolean;
  switchIdentity: (id: string) => void;
  refreshIdentities: () => Promise<void>;
}

const mockIdentities: Identity[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    personId: "person-1",
    identityType: IdentityType.Personal,
    displayName: "Grandpa Joe",
    handle: "grandpa-joe",
    verificationLevel: "basic_verified",
    status: "active",
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    personId: "person-1",
    identityType: IdentityType.Business,
    displayName: "Joe's Home Repairs",
    handle: "joes-home-repairs",
    verificationLevel: "strong_verified",
    status: "active",
  },
];

const IdentityContext = createContext<IdentityContextValue | null>(null);

function isEnabledIdentity(identity: Identity): boolean {
  return enabledIdentityTypes.some((type) => type === identity.identityType);
}

function readStoredIdentityId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(STORAGE_KEY);
}

function chooseActiveIdentity(
  identities: Identity[],
  preferredId?: string | null,
): Identity | null {
  if (identities.length === 0) {
    return null;
  }

  if (preferredId) {
    const matched = identities.find((identity) => identity.id === preferredId);

    if (matched) {
      return matched;
    }
  }

  return identities[0] ?? null;
}

interface IdentityProviderProps extends PropsWithChildren {
  initialIdentities?: Identity[];
}

export function IdentityProvider({
  children,
  initialIdentities,
}: IdentityProviderProps) {
  const [availableIdentities, setAvailableIdentities] = useState<Identity[]>(
    initialIdentities ?? [],
  );
  const [activeIdentity, setActiveIdentity] = useState<Identity | null>(null);
  const [isLoading, setIsLoading] = useState(initialIdentities === undefined);

  const refreshIdentities = useCallback(async () => {
    setIsLoading(true);

    try {
      const identities =
        initialIdentities ?? (await listMyIdentities().catch(() => []));
      const safeIdentities = (
        identities.length > 0 ? identities : mockIdentities
      ).filter(isEnabledIdentity);
      const preferredId = readStoredIdentityId();
      const nextActiveIdentity = chooseActiveIdentity(
        safeIdentities,
        preferredId,
      );

      setAvailableIdentities(safeIdentities);
      setActiveIdentity(nextActiveIdentity);

      if (nextActiveIdentity && typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, nextActiveIdentity.id);
      }
    } finally {
      setIsLoading(false);
    }
  }, [initialIdentities]);

  useEffect(() => {
    void refreshIdentities();
  }, [refreshIdentities]);

  const switchIdentity = useCallback(
    (id: string) => {
      setActiveIdentity((currentIdentity) => {
        const nextIdentity = availableIdentities.find(
          (identity) => identity.id === id,
        );

        if (!nextIdentity) {
          return currentIdentity;
        }

        if (typeof window !== "undefined") {
          window.localStorage.setItem(STORAGE_KEY, nextIdentity.id);
        }

        return nextIdentity;
      });
    },
    [availableIdentities],
  );

  const value = useMemo<IdentityContextValue>(
    () => ({
      activeIdentity,
      availableIdentities,
      isLoading,
      switchIdentity,
      refreshIdentities,
    }),
    [
      activeIdentity,
      availableIdentities,
      isLoading,
      switchIdentity,
      refreshIdentities,
    ],
  );

  return (
    <IdentityContext.Provider value={value}>
      {children}
    </IdentityContext.Provider>
  );
}

export function useIdentityContext(): IdentityContextValue {
  const context = useContext(IdentityContext);

  if (!context) {
    throw new Error(
      "useIdentityContext must be used within an IdentityProvider",
    );
  }

  return context;
}
