const UNREAD_COUNT_EVENT = "dotly:notifications-unread-count";

interface UnreadCountDetail {
  unreadCount: number;
}

export function publishUnreadCount(unreadCount: number) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<UnreadCountDetail>(UNREAD_COUNT_EVENT, {
      detail: { unreadCount },
    }),
  );
}

export function subscribeToUnreadCount(
  listener: (unreadCount: number) => void,
) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handleUnreadCount = (event: Event) => {
    const unreadCount = (event as CustomEvent<UnreadCountDetail>).detail
      ?.unreadCount;

    if (typeof unreadCount === "number") {
      listener(unreadCount);
    }
  };

  window.addEventListener(UNREAD_COUNT_EVENT, handleUnreadCount);

  return () => {
    window.removeEventListener(UNREAD_COUNT_EVENT, handleUnreadCount);
  };
}
