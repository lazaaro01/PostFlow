import { prisma } from "../database/prisma/client";
import { PostStatusType } from "../shared/constants/post-status";

export class PostRepository {
  async create(data: {
    userId: string;
    channelId: string;
    title: string;
    caption: string;
    imageUrl: string;
    scheduledAt: Date;
  }) {
    return prisma.post.create({ data });
  }

  async findById(id: string) {
    return prisma.post.findUnique({ where: { id }, include: { channel: true } });
  }

  async findByIdAndUser(id: string, userId: string) {
    return prisma.post.findFirst({ where: { id, userId }, include: { channel: true } });
  }

  async findByUser(
    userId: string,
    options: { page: number; limit: number; status?: string }
  ) {
    const where: any = { userId };
    if (options.status) {
      where.status = options.status;
    }

    const [data, total] = await Promise.all([
      prisma.post.findMany({
        where,
        skip: (options.page - 1) * options.limit,
        take: options.limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.post.count({ where }),
    ]);

    return {
      data,
      total,
      page: options.page,
      limit: options.limit,
      totalPages: Math.ceil(total / options.limit),
    };
  }

  async updateStatus(id: string, status: PostStatusType) {
    return prisma.post.update({ where: { id }, data: { status } });
  }

  async updateScheduledAt(id: string, scheduledAt: Date) {
    return prisma.post.update({ where: { id }, data: { scheduledAt } });
  }

  async setPublished(id: string) {
    return prisma.post.update({
      where: { id },
      data: { status: "PUBLISHED", publishedAt: new Date() },
    });
  }
}
