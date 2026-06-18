import { FastifyInstance } from "fastify";
import { z } from "zod";
import { PostRepository } from "../../repositories/post.repository";
import { JobRepository } from "../../repositories/job.repository";
import { TelegramChannelRepository } from "../../repositories/telegram-channel.repository";
import { publishPostQueue } from "../../queues";
import { NotFoundError, ValidationError } from "../../shared/errors/app-error";
import { QUEUES } from "../../shared/constants/queues";
import { postsCreatedTotal } from "../../modules/metrics/metrics.routes";

const postRepo = new PostRepository();
const jobRepo = new JobRepository();
const channelRepo = new TelegramChannelRepository();

const createPostSchema = z.object({
  title: z.string().min(1).max(255),
  caption: z.string(),
  imageUrl: z.string().url(),
  scheduledAt: z.string().datetime(),
  channelId: z.string().uuid(),
});

const updatePostSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  caption: z.string().optional(),
  imageUrl: z.string().url().optional(),
  scheduledAt: z.string().datetime().optional(),
});

const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.string().optional(),
});

export async function postRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  app.post("/posts", async (request, reply) => {
    const body = createPostSchema.parse(request.body);

    const channel = await channelRepo.findByIdAndUser(body.channelId, request.userId);
    if (!channel) {
      throw new NotFoundError("Telegram channel not found or not yours");
    }

    const scheduledAt = new Date(body.scheduledAt);
    if (scheduledAt <= new Date()) {
      throw new ValidationError("scheduledAt must be in the future");
    }

    const post = await postRepo.create({
      userId: request.userId,
      channelId: body.channelId,
      title: body.title,
      caption: body.caption,
      imageUrl: body.imageUrl,
      scheduledAt,
    });

    const delay = scheduledAt.getTime() - Date.now();

    const bullJob = await publishPostQueue.add(
      `publish-post-${post.id}`,
      { postId: post.id },
      { delay }
    );

    await postRepo.updateStatus(post.id, "SCHEDULED");

    await jobRepo.create({
      postId: post.id,
      queueName: QUEUES.PUBLISH_POST,
    });

    postsCreatedTotal.inc();

    return reply.status(201).send({ post, bullJobId: bullJob.id });
  });

  app.get("/posts", async (request) => {
    const query = paginationSchema.parse(request.query);
    return postRepo.findByUser(request.userId, query);
  });

  app.get("/posts/:id", async (request) => {
    const { id } = request.params as { id: string };
    const post = await postRepo.findByIdAndUser(id, request.userId);
    if (!post) {
      throw new NotFoundError("Post");
    }
    return post;
  });

  app.patch("/posts/:id/cancel", async (request) => {
    const { id } = request.params as { id: string };
    const post = await postRepo.findByIdAndUser(id, request.userId);
    if (!post) {
      throw new NotFoundError("Post");
    }
    if (post.status !== "SCHEDULED") {
      throw new ValidationError("Only scheduled posts can be cancelled");
    }

    const job = await jobRepo.findByPostId(post.id);
    if (job) {
      const bullJob = await publishPostQueue.getJob(job.id);
      if (bullJob) {
        await bullJob.remove();
      }
      await jobRepo.updateStatus(job.id, "CANCELLED");
    }

    await postRepo.updateStatus(post.id, "CANCELLED");
    return { message: "Post cancelled" };
  });

  app.patch("/posts/:id/reschedule", async (request) => {
    const { id } = request.params as { id: string };
    const body = z.object({ scheduledAt: z.string().datetime() }).parse(request.body);

    const post = await postRepo.findByIdAndUser(id, request.userId);
    if (!post) {
      throw new NotFoundError("Post");
    }
    if (post.status !== "SCHEDULED") {
      throw new ValidationError("Only scheduled posts can be rescheduled");
    }

    const newScheduledAt = new Date(body.scheduledAt);
    if (newScheduledAt <= new Date()) {
      throw new ValidationError("scheduledAt must be in the future");
    }

    const job = await jobRepo.findByPostId(post.id);
    if (job) {
      const bullJob = await publishPostQueue.getJob(job.id);
      if (bullJob) {
        await bullJob.remove();
      }
    }

    const delay = newScheduledAt.getTime() - Date.now();
    const newBullJob = await publishPostQueue.add(
      `publish-post-${post.id}`,
      { postId: post.id },
      { delay }
    );

    await postRepo.updateScheduledAt(post.id, newScheduledAt);

    if (job) {
      await jobRepo.updateStatus(job.id, "CANCELLED");
    }
    await jobRepo.create({ postId: post.id, queueName: QUEUES.PUBLISH_POST });

    return { message: "Post rescheduled", bullJobId: newBullJob.id };
  });
}
