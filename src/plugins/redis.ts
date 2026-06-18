import { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import Redis from "ioredis";
import { env } from "../config/env";

declare module "fastify" {
  interface FastifyInstance {
    redis: Redis;
  }
}

async function redisPlugin(app: FastifyInstance) {
  const redis = new Redis(env.REDIS_URL);

  app.decorate("redis", redis);

  app.addHook("onClose", async () => {
    await redis.quit();
  });
}

export default fp(redisPlugin, { name: "redis" });
