"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { SecondaryButton } from "@/components/shared/secondary-button";
import { authApi } from "@/lib/api";
import { clearShareFastStore } from "@/lib/share-fast-store";

export function LogoutButton() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleLogout() {
    setIsSubmitting(true);

    try {
      await authApi.logout();
    } finally {
      clearShareFastStore();
      router.replace("/login");
      router.refresh();
      setIsSubmitting(false);
    }
  }

  return (
    <SecondaryButton
      type="button"
      onClick={handleLogout}
      disabled={isSubmitting}
      className="min-w-20 px-4 text-xs sm:text-sm"
    >
      {isSubmitting ? "Logging out..." : "Log out"}
    </SecondaryButton>
  );
}
