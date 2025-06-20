// src/services/jobs/job-queue.ts (improved version)
import { EventEmitter } from "events";
import { db } from "@/db/connection";
import { collectionJobs } from "@/db/schema";
import { eq, and, or, sql, inArray } from "drizzle-orm";

export interface JobDefinition {
  id: string;
  type: string;
  payload: any;
  priority?: number;
  attempts?: number;
  maxAttempts?: number;
  delay?: number;
  cron?: string;
  retryDelay?: number;
}

export interface JobHandler {
  (job: JobDefinition): Promise<void>;
}

export interface JobOptions {
  priority?: number;
  delay?: number;
  maxAttempts?: number;
  retryDelay?: number;
  cron?: string;
}

export class JobQueue extends EventEmitter {
  private handlers = new Map<string, JobHandler>();
  private isProcessing = false;
  private workers = new Map<string, Promise<void>>();
  private maxConcurrentJobs = 3;
  private processingInterval: NodeJS.Timeout | null = null;
  private errorBackoffMs = 5000; // 5 second backoff on critical errors

  constructor() {
    super();
  }

  // Register job handlers
  registerHandler(jobType: string, handler: JobHandler): void {
    this.handlers.set(jobType, handler);
    console.log(`Registered job handler for: ${jobType}`);
  }

  // Add job to queue
  async addJob(
    type: string,
    payload: any,
    options: JobOptions = {}
  ): Promise<number> {
    try {
      const scheduledAt = options.delay
        ? new Date(Date.now() + options.delay)
        : null;

      const [job] = await db
        .insert(collectionJobs)
        .values({
          provider: type as any, // Using provider field for job type compatibility
          status: "pending",
          priority: options.priority || 0,
          maxAttempts: options.maxAttempts || 3,
          currentAttempts: 0,
          retryDelay: options.retryDelay || 5000,
          scheduledAt: scheduledAt,
          jobType: type,
          configuration: {
            type,
            payload,
            ...options,
          },
        })
        .returning();

      this.emit("jobAdded", job);
      console.log(`Job ${job.id} (${type}) added to queue`);

      // Start processing if not already running
      if (!this.isProcessing) {
        this.startProcessing();
      }

      return job.id;
    } catch (error) {
      console.error("Failed to add job to queue:", error);
      throw error;
    }
  }

  // Start job processing with better error handling
  async startProcessing(): Promise<void> {
    if (this.isProcessing) {
      console.log("Job processing already started");
      return;
    }

    this.isProcessing = true;
    console.log("Job queue processing started");

    // Use setInterval instead of while loop for better error handling
    this.processingInterval = setInterval(async () => {
      if (!this.isProcessing) {
        if (this.processingInterval) {
          clearInterval(this.processingInterval);
          this.processingInterval = null;
        }
        return;
      }

      try {
        // Check if we can start more workers
        if (this.workers.size < this.maxConcurrentJobs) {
          const job = await this.getNextJob();

          if (job) {
            const workerId = `worker-${job.id}`;
            const workerPromise = this.processJob(job)
              .catch((error) => {
                console.error(`Worker ${workerId} failed:`, error);
              })
              .finally(() => {
                this.workers.delete(workerId);
              });

            this.workers.set(workerId, workerPromise);
          }
        }
      } catch (error) {
        console.error("Error in job processing loop:", error);

        // On database connection errors, back off longer
        if (this.isDatabaseError(error)) {
          console.log(
            `Database error detected, backing off for ${this.errorBackoffMs}ms`
          );
          await this.delay(this.errorBackoffMs);
        }
      }
    }, 1000); // Check every second
  }

  // Stop job processing gracefully
  async stopProcessing(): Promise<void> {
    console.log("Stopping job queue processing...");
    this.isProcessing = false;

    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }

    // Wait for all active workers to complete
    if (this.workers.size > 0) {
      console.log(
        `Waiting for ${this.workers.size} active workers to complete...`
      );
      await Promise.allSettled(this.workers.values());
    }

    console.log("Job queue processing stopped");
  }

  // Get next job from queue with better filtering
  private async getNextJob(): Promise<any> {
    try {
      // Only get jobs that are ready to run (not scheduled for future)
      const [job] = await db
        .select()
        .from(collectionJobs)
        .where(
          and(
            eq(collectionJobs.status, "pending"),
            or(eq(collectionJobs.scheduledAt, null), sql`scheduled_at <= NOW()`)
          )
        )
        .orderBy(sql`priority DESC, started_at ASC NULLS FIRST`)
        .limit(1);

      return job;
    } catch (error) {
      console.error("Error getting next job:", error);
      throw error;
    }
  }

  // Process individual job with better error handling
  private async processJob(job: any): Promise<void> {
    const config = job.configuration || {};
    const jobType = job.jobType || config.type;
    const handler = this.handlers.get(jobType);

    if (!handler) {
      await this.markJobFailed(
        job.id,
        `No handler registered for job type: ${jobType}`
      );
      return;
    }

    // Mark job as processing
    try {
      await db
        .update(collectionJobs)
        .set({
          status: "processing",
          startedAt: new Date(),
          workerId: `worker-${job.id}`,
        })
        .where(eq(collectionJobs.id, job.id));
    } catch (error) {
      console.error(`Failed to mark job ${job.id} as processing:`, error);
      return;
    }

    try {
      console.log(`Processing job ${job.id} of type ${jobType}`);

      const jobDefinition: JobDefinition = {
        id: job.id.toString(),
        type: jobType,
        payload: config.payload || {},
        priority: job.priority || 0,
        attempts: (job.currentAttempts || 0) + 1,
        maxAttempts: job.maxAttempts || 3,
      };

      await handler(jobDefinition);

      // Mark job as completed
      await db
        .update(collectionJobs)
        .set({
          status: "completed",
          completedAt: new Date(),
        })
        .where(eq(collectionJobs.id, job.id));

      this.emit("jobCompleted", job);
      console.log(`Job ${job.id} completed successfully`);
    } catch (error) {
      console.error(`Job ${job.id} failed:`, error);

      const currentAttempts = (job.currentAttempts || 0) + 1;
      const maxAttempts = job.maxAttempts || 3;

      if (currentAttempts >= maxAttempts) {
        await this.markJobFailed(
          job.id,
          error instanceof Error ? error.message : String(error)
        );
      } else {
        // Retry with exponential backoff
        const baseDelay = job.retryDelay || 5000;
        const retryDelay = baseDelay * Math.pow(2, currentAttempts - 1);

        await db
          .update(collectionJobs)
          .set({
            status: "pending",
            currentAttempts: currentAttempts,
            scheduledAt: new Date(Date.now() + retryDelay),
            errorMessage:
              error instanceof Error ? error.message : String(error),
          })
          .where(eq(collectionJobs.id, job.id));

        console.log(
          `Job ${job.id} will retry in ${retryDelay}ms (attempt ${currentAttempts}/${maxAttempts})`
        );
      }
    }
  }

  private async markJobFailed(
    jobId: number,
    errorMessage: string
  ): Promise<void> {
    try {
      await db
        .update(collectionJobs)
        .set({
          status: "failed",
          completedAt: new Date(),
          errorMessage,
        })
        .where(eq(collectionJobs.id, jobId));

      this.emit("jobFailed", { id: jobId, error: errorMessage });
      console.log(`Job ${jobId} marked as failed: ${errorMessage}`);
    } catch (error) {
      console.error(`Failed to mark job ${jobId} as failed:`, error);
    }
  }

  // Cancel job
  async cancelJob(jobId: number): Promise<boolean> {
    try {
      const [updated] = await db
        .update(collectionJobs)
        .set({
          status: "cancelled",
          completedAt: new Date(),
          errorMessage: "Job cancelled by user",
        })
        .where(
          and(
            eq(collectionJobs.id, jobId),
            inArray(collectionJobs.status, [
              "pending",
              "processing",
              "scheduled",
            ])
          )
        )
        .returning();

      if (updated) {
        console.log(`Job ${jobId} cancelled`);
      }

      return !!updated;
    } catch (error) {
      console.error(`Failed to cancel job ${jobId}:`, error);
      return false;
    }
  }

  // Get job statistics
  async getStats(): Promise<any> {
    try {
      const stats = await db
        .select({
          status: collectionJobs.status,
          count: sql`COUNT(*)`,
        })
        .from(collectionJobs)
        .groupBy(collectionJobs.status);

      return {
        workers: this.workers.size,
        maxConcurrentJobs: this.maxConcurrentJobs,
        isProcessing: this.isProcessing,
        statusCounts: stats.reduce((acc, stat) => {
          acc[stat.status] = parseInt(stat.count as string);
          return acc;
        }, {} as Record<string, number>),
      };
    } catch (error) {
      console.error("Failed to get job stats:", error);
      return {
        workers: this.workers.size,
        maxConcurrentJobs: this.maxConcurrentJobs,
        isProcessing: this.isProcessing,
        statusCounts: {},
        error: "Failed to fetch database stats",
      };
    }
  }

  // Helper methods
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private isDatabaseError(error: any): boolean {
    // Check for common database errors
    return (
      error &&
      (error.code === "ECONNREFUSED" ||
        error.code === "42703" || // Column does not exist
        error.code === "42P01" || // Table does not exist
        error.message?.includes("connection") ||
        error.message?.includes("database"))
    );
  }

  // Cleanup method for graceful shutdown
  async cleanup(): Promise<void> {
    await this.stopProcessing();
  }
}
