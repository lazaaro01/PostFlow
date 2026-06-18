import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { UnauthorizedError } from "../shared/errors/app-error";

declare module "fastify" {
  interface FastifyInstance {
    signJwt(payload: object): string;
    verifyJwt(token: string): object;
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    userId: string;
  }
}

async function jwtPlugin(app: FastifyInstance) {
  app.decorate("signJwt", (payload: object): string => {
    return jwt.sign(payload, env.JWT_SECRET, { expiresIn: "7d" });
  });

  app.decorate("verifyJwt", (token: string): object => {
    return jwt.verify(token, env.JWT_SECRET) as object;
  });

  app.decorate("authenticate", async (request: FastifyRequest, _reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      throw new UnauthorizedError("Missing authorization header");
    }
    const token = authHeader.replace("Bearer ", "");
    try {
      const payload = app.verifyJwt(token) as { sub: string };
      request.userId = payload.sub;
    } catch {
      throw new UnauthorizedError("Invalid or expired token");
    }
  });
}

export default fp(jwtPlugin, { name: "jwt" });
