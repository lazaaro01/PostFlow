export const PostStatus = {
  DRAFT: "DRAFT",
  SCHEDULED: "SCHEDULED",
  PROCESSING: "PROCESSING",
  PUBLISHED: "PUBLISHED",
  FAILED: "FAILED",
  RETRYING: "RETRYING",
  CANCELLED: "CANCELLED",
} as const;

export type PostStatusType = (typeof PostStatus)[keyof typeof PostStatus];
