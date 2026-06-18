export const QUEUES = {
  PUBLISH_POST: "publish-post",
  RETRY_POST: "retry-post",
  DEAD_LETTER: "dead-letter",
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];
