import { FastifyInstance } from "fastify";
import { z } from "zod";
import bcrypt from "bcrypt";
import { UserRepository } from "../../repositories/user.repository";
import { ConflictError, UnauthorizedError } from "../../shared/errors/app-error";

const userRepo = new UserRepository();

const registerSchema = z.object({
  name: z.string().min(2).max(255),
  email: z.string().email(),
  password: z.string().min(6).max(128),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export async function authRoutes(app: FastifyInstance) {
  app.post("/auth/register", async (request, reply) => {
    const body = registerSchema.parse(request.body);

    const existing = await userRepo.findByEmail(body.email);
    if (existing) {
      throw new ConflictError("Email already registered");
    }

    const passwordHash = await bcrypt.hash(body.password, 12);
    const user = await userRepo.create({
      name: body.name,
      email: body.email,
      passwordHash,
    });

    const token = app.signJwt({ sub: user.id });

    return reply.status(201).send({
      user: { id: user.id, name: user.name, email: user.email },
      token,
    });
  });

  app.post("/auth/login", async (request, reply) => {
    const body = loginSchema.parse(request.body);

    const user = await userRepo.findByEmail(body.email);
    if (!user) {
      throw new UnauthorizedError("Invalid email or password");
    }

    const valid = await bcrypt.compare(body.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedError("Invalid email or password");
    }

    const token = app.signJwt({ sub: user.id });

    return {
      user: { id: user.id, name: user.name, email: user.email },
      token,
    };
  });
}
