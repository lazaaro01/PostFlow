import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import path from "path";
import { env } from "../config/env";
import redisPlugin from "../plugins/redis";
import jwtPlugin from "../plugins/jwt";
import { authRoutes } from "../modules/auth/auth.routes";
import { userRoutes } from "../modules/users/users.routes";
import { telegramRoutes } from "../modules/telegram/telegram.routes";
import { postRoutes } from "../modules/posts/posts.routes";
import { metricsRoutes } from "../modules/metrics/metrics.routes";

export async function buildApp() {
  const app = Fastify({
    logger: env.NODE_ENV !== "test",
  });

  await app.register(cors, { origin: true });
  await app.register(rateLimit, { max: 100, timeWindow: "1 minute" });
  await app.register(multipart);
  await app.register(fastifyStatic, {
    root: path.join(process.cwd(), "public"),
    prefix: "/public/",
  });
  await app.register(redisPlugin);
  await app.register(jwtPlugin);

  await app.register(authRoutes);
  await app.register(userRoutes);
  await app.register(telegramRoutes);
  await app.register(postRoutes);
  await app.register(metricsRoutes);

  app.setErrorHandler((error, request, reply) => {
    if (error.statusCode) {
      return reply.status(error.statusCode).send({
        error: error.code || "BAD_REQUEST",
        message: error.message,
      });
    }

    if (error.validation) {
      return reply.status(422).send({
        error: "VALIDATION_ERROR",
        message: "Invalid request payload",
        details: error.validation,
      });
    }

    app.log.error(error);
    return reply.status(500).send({
      error: "INTERNAL_ERROR",
      message: "Internal server error",
    });
  });

  return app;
}
