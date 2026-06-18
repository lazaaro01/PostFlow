import { FastifyInstance } from "fastify";
import client from "prom-client";

const register = new client.Registry();

client.collectDefaultMetrics({ register });

export const postsCreatedTotal = new client.Counter({
  name: "posts_created_total",
  help: "Total number of posts created",
  registers: [register],
});

export const postsPublishedTotal = new client.Counter({
  name: "posts_published_total",
  help: "Total number of posts published",
  registers: [register],
});

export const postsFailedTotal = new client.Counter({
  name: "posts_failed_total",
  help: "Total number of posts that failed",
  registers: [register],
});

export const jobsProcessedTotal = new client.Counter({
  name: "jobs_processed_total",
  help: "Total number of jobs processed",
  registers: [register],
});

export const publishDurationSeconds = new client.Histogram({
  name: "publish_duration_seconds",
  help: "Duration of publish operations in seconds",
  buckets: [0.1, 0.5, 1, 2, 5, 10],
  registers: [register],
});

export const bullmqWaitingJobs = new client.Gauge({
  name: "bullmq_waiting_jobs",
  help: "Number of waiting jobs in BullMQ",
  registers: [register],
});

export const bullmqActiveJobs = new client.Gauge({
  name: "bullmq_active_jobs",
  help: "Number of active jobs in BullMQ",
  registers: [register],
});

export const bullmqFailedJobs = new client.Gauge({
  name: "bullmq_failed_jobs",
  help: "Number of failed jobs in BullMQ",
  registers: [register],
});

export async function metricsRoutes(app: FastifyInstance) {
  app.get("/metrics", async (_request, reply) => {
    const metrics = await register.metrics();
    return reply.type(register.contentType).send(metrics);
  });
}
