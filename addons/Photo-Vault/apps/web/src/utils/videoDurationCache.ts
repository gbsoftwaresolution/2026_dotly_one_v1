const STORAGE_PREFIX = "boosterVault:videoDurationSeconds:";
const EVENT_NAME = "boosterVault:videoDurationUpdated";

export function getCachedVideoDurationSeconds(mediaId: string): number | null {
  try {
    const raw = globalThis.localStorage?.getItem(`${STORAGE_PREFIX}${mediaId}`);
    if (!raw) return null;
    const seconds = Number(raw);
    if (!Number.isFinite(seconds) || seconds <= 0) return null;
    return seconds;
  } catch {
    return null;
  }
}

export function setCachedVideoDurationSeconds(
  mediaId: string,
  seconds: number,
): void {
  try {
    if (!Number.isFinite(seconds) || seconds <= 0) return;
    globalThis.localStorage?.setItem(
      `${STORAGE_PREFIX}${mediaId}`,
      String(Math.round(seconds)),
    );
    globalThis.dispatchEvent(
      new CustomEvent(EVENT_NAME, { detail: { mediaId } }),
    );
  } catch {
    // ignore
  }
}

export function onVideoDurationUpdated(
  handler: (mediaId: string) => void,
): () => void {
  const listener = (e: Event) => {
    const ce = e as CustomEvent;
    const mediaId = ce?.detail?.mediaId;
    if (typeof mediaId === "string" && mediaId) handler(mediaId);
  };
  globalThis.addEventListener(EVENT_NAME, listener as EventListener);
  return () =>
    globalThis.removeEventListener(EVENT_NAME, listener as EventListener);
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "";
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0)
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export async function extractVideoDurationSecondsFromFile(
  file: File,
): Promise<number | null> {
  try {
    const url = URL.createObjectURL(file);
    try {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.muted = true;
      video.playsInline = true;

      const duration = await new Promise<number>((resolve, reject) => {
        const cleanup = () => {
          video.removeAttribute("src");
          video.load();
        };

        const onLoaded = () => {
          const d = video.duration;
          cleanup();
          resolve(d);
        };
        const onError = () => {
          cleanup();
          reject(new Error("Failed to read video metadata"));
        };

        video.addEventListener("loadedmetadata", onLoaded, { once: true });
        video.addEventListener("error", onError, { once: true });
        video.src = url;
      });

      if (!Number.isFinite(duration) || duration <= 0) return null;
      return duration;
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch {
    return null;
  }
}
