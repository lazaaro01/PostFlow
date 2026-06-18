import { PostStatusType } from "../constants/post-status";

export interface CreateUserInput {
  name: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface CreateTelegramChannelInput {
  botToken: string;
  chatId: string;
}

export interface CreatePostInput {
  title: string;
  caption: string;
  imageUrl: string;
  scheduledAt: string;
}

export interface UpdatePostInput {
  title?: string;
  caption?: string;
  imageUrl?: string;
  scheduledAt?: string;
}

export interface PostResponse {
  id: string;
  userId: string;
  channelId: string;
  title: string;
  caption: string;
  imageUrl: string;
  status: PostStatusType;
  scheduledAt: Date;
  publishedAt: Date | null;
  createdAt: Date;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
