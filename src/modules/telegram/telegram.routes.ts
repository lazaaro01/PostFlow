import { FastifyInstance } from "fastify";
import { z } from "zod";
import { TelegramChannelRepository } from "../../repositories/telegram-channel.repository";
import { TelegramService } from "../../services/telegram.service";
import { NotFoundError } from "../../shared/errors/app-error";

const channelRepo = new TelegramChannelRepository();
const telegramService = new TelegramService();

const createChannelSchema = z.object({
  botToken: z.string().min(1),
  chatId: z.string().min(1),
});

export async function telegramRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  app.post("/telegram/channels", async (request, reply) => {
    const body = createChannelSchema.parse(request.body);
    const channel = await channelRepo.create({
      userId: request.userId,
      botToken: body.botToken,
      chatId: body.chatId,
    });
    return reply.status(201).send(channel);
  });

  app.get("/telegram/channels", async (request) => {
    return channelRepo.findByUser(request.userId);
  });

  app.delete("/telegram/channels/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const channel = await channelRepo.findByIdAndUser(id, request.userId);
    if (!channel) {
      throw new NotFoundError("Channel");
    }
    await channelRepo.delete(id);
    return reply.status(204).send();
  });

  app.post("/telegram/channels/:id/test", async (request) => {
    const { id } = request.params as { id: string };
    const channel = await channelRepo.findByIdAndUser(id, request.userId);
    if (!channel) {
      throw new NotFoundError("Channel");
    }

    await telegramService.testConnection(channel.botToken, channel.chatId);
    return { message: "Connection successful" };
  });
}
