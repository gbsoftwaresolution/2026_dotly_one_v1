"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { ConfirmModal } from "@/components/shared/confirm-modal";
import { blocksApi } from "@/lib/api";
import { isApiError } from "@/lib/api/client";

interface BlockUserButtonProps {
  personaId: string;
  displayName: string;
}

export function BlockUserButton({
  personaId,
  displayName,
}: BlockUserButtonProps) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [isBlocking, setIsBlocking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setError(null);
    setIsBlocking(true);

    try {
      await blocksApi.blockByPersona(personaId);
      setShowModal(false);
      router.replace("/app/contacts?message=node-removed");
      router.refresh();
    } catch (err) {
      setError(
        isApiError(err)
          ? err.message
          : "Unable to block this user right now. Please try again.",
      );
      setIsBlocking(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="inline-flex h-11 items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 px-5 text-sm font-medium text-rose-700 transition-all hover:bg-rose-100 active:scale-95 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-400 dark:hover:bg-rose-950/50 dark:focus:ring-offset-bgOnyx"
      >
        Block user
      </button>

      {error ? (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-400">
          {error}
        </p>
      ) : null}

      <ConfirmModal
        open={showModal}
        title={`Block ${displayName}?`}
        description="This person will be removed from your contacts and future requests will be denied."
        confirmLabel="Block user"
        cancelLabel="Cancel"
        destructive
        isConfirming={isBlocking}
        onConfirm={handleConfirm}
        onCancel={() => {
          if (!isBlocking) setShowModal(false);
        }}
      />
    </>
  );
}
