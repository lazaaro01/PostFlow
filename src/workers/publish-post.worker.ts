import "dotenv/config";
import { Worker } from "bullmq";
import { env } from "../config/env";
import { QUEUES } from "../shared/constants/queues";
import { PostRepository } from "../repositories/post.repository";
import { JobRepository } from "../repositories/job.repository";
import { TelegramService } from "../services/telegram.service";
import { retryPostQueue } from "../queues";
import {
  postsPublishedTotal,
  postsFailedTotal,
  jobsProcessedTotal,
  publishDurationSeconds,
} from "../modules/metrics/metrics.routes";

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

const postRepo = new PostRepository();
const jobRepo = new JobRepository();
const telegramService = new TelegramService();

const worker = new Worker(
  QUEUES.PUBLISH_POST,
  async (job) => {
    const { postId } = job.data as { postId: string };
    const endTimer = publishDurationSeconds.startTimer();

    try {
      const post = await postRepo.findById(postId);
      if (!post) {
        throw new Error(`Post ${postId} not found`);
      }

      if (post.status === "CANCELLED") {
        await job.discard();
        return { status: "cancelled" };
      }

      await postRepo.updateStatus(post.id, "PROCESSING");

      const dbJob = await jobRepo.findByPostId(post.id);
      if (dbJob) {
        await jobRepo.updateStatus(dbJob.id, "ACTIVE");
      }

      await telegramService.sendPhoto(
        post.channel.botToken,
        post.channel.chatId,
        post.imageUrl,
        post.caption
      );

      await postRepo.setPublished(post.id);
      postsPublishedTotal.inc();

      if (dbJob) {
        await jobRepo.updateStatus(dbJob.id, "COMPLETED");
      }

      jobsProcessedTotal.inc();

      return { status: "published", postId: post.id };
    } catch (error) {
      postsFailedTotal.inc();

      const dbJob = await jobRepo.findByPostId(postId);
      if (dbJob) {
        await jobRepo.incrementAttempts(dbJob.id);
        await jobRepo.updateStatus(dbJob.id, "FAILED", dbJob.attempts + 1);
      }

      await postRepo.updateStatus(postId, "FAILED");

      if (job.attemptsMade < (job.opts.attempts || 5) - 1) {
        await postRepo.updateStatus(postId, "RETRYING");
        await retryPostQueue.add(
          `retry-post-${postId}`,
          { postId },
          { delay: 5000 * Math.pow(2, job.attemptsMade) }
        );
      }

      throw error;
    } finally {
      endTimer();
    }
  },
  {
    connection,
    concurrency: 5,
  }
);

worker.on("completed", (job) => {
  console.log(`Job ${job.id} completed successfully`);
});

worker.on("failed", (job, error) => {
  console.error(`Job ${job?.id} failed:`, error.message);
});

console.log("Publish post worker started");

process.on("SIGTERM", async () => {
  await worker.close();
});
