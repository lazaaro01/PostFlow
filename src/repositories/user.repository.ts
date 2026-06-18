import { prisma } from "../database/prisma/client";

export class UserRepository {
  async create(data: { name: string; email: string; passwordHash: string }) {
    return prisma.user.create({ data });
  }

  async findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  }

  async findById(id: string) {
    return prisma.user.findUnique({ where: { id } });
  }
}
