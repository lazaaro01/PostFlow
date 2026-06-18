import { Queue } from "bullmq";
import { env } from "../config/env";
import { QUEUES } from "../shared/constants/queues";

function parseRedisUrl(url: string) {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: Number(u.port) || 6379,
    password: u.password || undefined,
    db: u.pathname ? Number(u.pathname.replace("/", "")) || 0 : 0,
  };
}

const connection = parseRedisUrl(env.REDIS_URL);

const defaultJobOptions = {
  attempts: 5,
  backoff: {
    type: "exponential" as const,
    delay: 5000,
  },
  removeOnComplete: 100,
  removeOnFail: 50,
};

export const publishPostQueue = new Queue(QUEUES.PUBLISH_POST, {
  connection,
  defaultJobOptions,
});

export const retryPostQueue = new Queue(QUEUES.RETRY_POST, {
  connection,
  defaultJobOptions: {
    ...defaultJobOptions,
    attempts: 10,
  },
});

export const deadLetterQueue = new Queue(QUEUES.DEAD_LETTER, {
  connection,
  defaultJobOptions: {
    ...defaultJobOptions,
    attempts: 1,
  },
});
