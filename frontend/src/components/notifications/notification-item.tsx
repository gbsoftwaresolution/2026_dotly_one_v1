import { cn } from "@/lib/utils/cn";
import type { Notification } from "@/types/notification";

interface NotificationItemProps {
  notification: Notification;
  onMarkRead: (id: string) => void;
  isMarkingRead: boolean;
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function NotificationItem({
  notification,
  onMarkRead,
  isMarkingRead,
}: NotificationItemProps) {
  const { id, title, body, isRead, createdAt } = notification;

  return (
    <button
      type="button"
      onClick={() => {
        if (!isRead && !isMarkingRead) onMarkRead(id);
      }}
      disabled={isRead || isMarkingRead}
      className={cn(
        "w-full rounded-3xl p-6 text-left transition-all duration-500 ease-[0.16,1,0.3,1] motion-safe:animate-[fade-in_420ms_ease-out]",
        isRead
          ? "bg-foreground/[0.02] opacity-60 ring-1 ring-black/5 dark:bg-white/[0.03] dark:ring-white/[0.06]"
          : "bg-white shadow-[0_4px_20px_rgb(0,0,0,0.06)] ring-1 ring-black/5 hover:scale-[0.995] hover:bg-foreground/[0.02] dark:bg-zinc-950 dark:ring-white/[0.06] dark:hover:bg-white/[0.04]",
        isMarkingRead && "opacity-60",
      )}
    >
      <div className="flex items-start gap-3">
        {/* Unread dot */}
        <div className="mt-1.5 shrink-0">
          <div
            className={cn(
              "h-2 w-2 rounded-full transition-colors",
              isRead
                ? "bg-slate-200 dark:bg-zinc-800"
                : "animate-pulse bg-foreground shadow-[0_0_8px_rgba(17,17,17,0.28)] dark:bg-white dark:shadow-[0_0_8px_rgba(255,255,255,0.22)]",
            )}
          />
        </div>

        <div className="min-w-0 flex-1 space-y-1">
          <p
            className={cn(
              "font-mono text-sm font-semibold",
              isRead
                ? "text-muted dark:text-zinc-500"
                : "text-foreground dark:text-white",
            )}
          >
            {title}
          </p>
          <p className="font-mono text-sm text-muted dark:text-zinc-400">
            {body}
          </p>
          <p className="font-mono text-[10px] text-slate-400 dark:text-zinc-600">
            {formatRelativeTime(createdAt)}
          </p>
        </div>
      </div>
    </button>
  );
}
