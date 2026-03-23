"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import {
  APP_DATA_WARM_ROUTES,
  hydrateAppDataStore,
  prefetchAppCoreData,
} from "@/lib/app-data-store";
import { hydrateShareFastStore } from "@/lib/share-fast-store";

export function AppPrefetchBootstrap() {
  const router = useRouter();

  useEffect(() => {
    hydrateShareFastStore();
    hydrateAppDataStore();

    for (const route of APP_DATA_WARM_ROUTES) {
      router.prefetch(route);
    }

    void prefetchAppCoreData().catch(() => undefined);
  }, [router]);

  return null;
}