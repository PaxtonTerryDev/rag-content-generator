// src/services/index.ts
import { JobQueue } from "@/services/jobs/job-queue";
import { JobScheduler } from "@/services/jobs/job-scheduler";
import {
  stackOverflowHandler,
  scheduleHandler,
} from "@/services/jobs/job-handlers";

// Initialize job queue
export const jobQueue = new JobQueue();

// Register job handlers
jobQueue.registerHandler("stackoverflow-collection", stackOverflowHandler);
jobQueue.registerHandler("scheduled-job", scheduleHandler);

// Initialize job scheduler
export const jobScheduler = new JobScheduler(jobQueue);

// Setup default scheduled jobs
export const initializeDefaultJobs = () => {
  // Example: Daily Stack Overflow collection at 2 AM
  jobScheduler.scheduleJob(
    "daily-stackoverflow",
    "0 2 * * *", // 2 AM every day
    "stackoverflow-collection",
    {
      pages: 5,
      tags: ["javascript", "typescript", "python"],
      sort: "creation",
      includeAnswers: true,
    }
  );

  // Example: Weekly cleanup job
  jobScheduler.scheduleJob(
    "weekly-cleanup",
    "0 3 * * 0", // 3 AM every Sunday
    "cleanup-job",
    { retentionDays: 90 }
  );
};
