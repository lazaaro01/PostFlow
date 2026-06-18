import { Telegraf } from "telegraf";
import { AppError } from "../shared/errors/app-error";

export class TelegramService {
  async testConnection(botToken: string, chatId: string): Promise<boolean> {
    try {
      const bot = new Telegraf(botToken);
      const botInfo = await bot.telegram.getMe();

      const chat = await bot.telegram.getChat(chatId);
      if (!chat) {
        throw new AppError("Chat not found or bot cannot access it", 400, "CHAT_NOT_FOUND");
      }

      const member = await bot.telegram.getChatMember(chatId, botInfo.id);
      const canPost = member.status === "administrator" || member.status === "member" || member.status === "creator";
      if (!canPost) {
        throw new AppError("Bot does not have permission to post in this channel", 400, "NO_PERMISSION");
      }

      return true;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(
        `Telegram connection failed: ${(error as Error).message}`,
        400,
        "TELEGRAM_CONNECTION_FAILED"
      );
    }
  }

  async sendPhoto(botToken: string, chatId: string, imageUrl: string, caption?: string) {
    const bot = new Telegraf(botToken);
    await bot.telegram.sendPhoto(chatId, { url: imageUrl }, { caption });
  }
}
