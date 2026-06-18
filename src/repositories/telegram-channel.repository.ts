import { prisma } from "../database/prisma/client";

export class TelegramChannelRepository {
  async create(data: { userId: string; botToken: string; chatId: string }) {
    return prisma.telegramChannel.create({ data });
  }

  async findByUser(userId: string) {
    return prisma.telegramChannel.findMany({ where: { userId } });
  }

  async findById(id: string) {
    return prisma.telegramChannel.findUnique({ where: { id } });
  }

  async findByIdAndUser(id: string, userId: string) {
    return prisma.telegramChannel.findFirst({ where: { id, userId } });
  }

  async delete(id: string) {
    return prisma.telegramChannel.delete({ where: { id } });
  }
}
