import { FastifyInstance } from "fastify";
import { UserRepository } from "../../repositories/user.repository";
import { NotFoundError } from "../../shared/errors/app-error";

const userRepo = new UserRepository();

export async function userRoutes(app: FastifyInstance) {
  app.get("/users/me", { preHandler: [app.authenticate] }, async (request) => {
    const user = await userRepo.findById(request.userId);
    if (!user) {
      throw new NotFoundError("User");
    }
    return { id: user.id, name: user.name, email: user.email };
  });
}
