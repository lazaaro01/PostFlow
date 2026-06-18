import { prisma } from "../database/prisma/client";

export class JobRepository {
  async create(data: { postId: string; queueName: string }) {
    return prisma.job.create({ data });
  }

  async findByPostId(postId: string) {
    return prisma.job.findFirst({ where: { postId } });
  }

  async updateStatus(id: string, status: string, attempts?: number) {
    const data: any = { status };
    if (attempts !== undefined) {
      data.attempts = attempts;
    }
    return prisma.job.update({ where: { id }, data });
  }

  async incrementAttempts(id: string) {
    return prisma.job.update({
      where: { id },
      data: { attempts: { increment: 1 } },
    });
  }
}
