export const QUEUE_NAMES = {
  exports: "exports",
  purge: "purge",
  thumbnails: "thumbnails",
  lifeDocsReminders: "lifeDocsReminders",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
