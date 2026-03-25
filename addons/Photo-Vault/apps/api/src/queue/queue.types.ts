export type QueueJobContext = {
  requestId?: string;
  userId?: string;
  entityId?: string;
};

export type QueueJobData<
  TPayload extends Record<string, any> = Record<string, any>,
> = {
  ctx?: QueueJobContext;
  payload: TPayload;
};
