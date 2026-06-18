export const JobStatus = {
  PENDING: "PENDING",
  ACTIVE: "ACTIVE",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
  DELAYED: "DELAYED",
  CANCELLED: "CANCELLED",
} as const;

export type JobStatusType = (typeof JobStatus)[keyof typeof JobStatus];
