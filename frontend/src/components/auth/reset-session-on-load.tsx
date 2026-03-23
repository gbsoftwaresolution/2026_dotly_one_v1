"use client";

import { useEffect } from "react";

import { authApi } from "@/lib/api";
import { clearShareFastStore } from "@/lib/share-fast-store";

interface ResetSessionOnLoadProps {
  enabled: boolean;
}

export function ResetSessionOnLoad({ enabled }: ResetSessionOnLoadProps) {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    clearShareFastStore();
    void authApi.logout();
  }, [enabled]);

  return null;
}
