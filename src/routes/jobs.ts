// src/routes/jobs.ts (enhanced version - FIXED)
import { Router } from "express";
import { jobQueue, jobScheduler } from "@/services";
import { JobMonitor } from "@/services/jobs/job-monitoring";
import { db } from "@/db/connection";
import { collectionJobs } from "@/db/schema";
import { and, eq, inArray, desc, asc, count } from "drizzle-orm";

const router: Router = Router();
const jobMonitor = new JobMonitor();

// Enhanced job listing with filters
router.get("/", async (req, res) => {
  try {
    const {
      status,
      jobType,
      page = 1,
      limit = 20,
      sortBy = "startedAt",
      sortOrder = "desc",
    } = req.query;

    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
    const limitNum = parseInt(limit as string);

    // Build base queries
    const baseJobsQuery = db.select().from(collectionJobs);
    const baseCountQuery = db.select({ count: count() }).from(collectionJobs);

    // Define valid sort columns
    const sortableColumns = {
      id: collectionJobs.id,
      provider: collectionJobs.provider,
      status: collectionJobs.status,
      startedAt: collectionJobs.startedAt,
      completedAt: collectionJobs.completedAt,
      itemsCollected: collectionJobs.itemsCollected,
      itemsProcessed: collectionJobs.itemsProcessed,
      priority: collectionJobs.priority,
      maxAttempts: collectionJobs.maxAttempts,
      currentAttempts: collectionJobs.currentAttempts,
      scheduledAt: collectionJobs.scheduledAt,
      jobType: collectionJobs.jobType,
    };

    // Get sort column or default to startedAt
    const sortColumn =
      sortableColumns[sortBy as keyof typeof sortableColumns] ||
      collectionJobs.startedAt;
    const orderBy = sortOrder === "desc" ? desc(sortColumn) : asc(sortColumn);

    // Execute queries based on filter combinations
    let jobs;
    let totalResult;

    if (status && jobType) {
      // Both filters
      const whereClause = and(
        eq(collectionJobs.status, status as any),
        eq(collectionJobs.jobType, jobType as string)
      );
      jobs = await baseJobsQuery
        .where(whereClause)
        .orderBy(orderBy)
        .limit(limitNum)
        .offset(offset);
      [totalResult] = await baseCountQuery.where(whereClause);
    } else if (status) {
      // Status filter only
      const whereClause = eq(collectionJobs.status, status as any);
      jobs = await baseJobsQuery
        .where(whereClause)
        .orderBy(orderBy)
        .limit(limitNum)
        .offset(offset);
      [totalResult] = await baseCountQuery.where(whereClause);
    } else if (jobType) {
      // Job type filter only
      const whereClause = eq(collectionJobs.jobType, jobType as string);
      jobs = await baseJobsQuery
        .where(whereClause)
        .orderBy(orderBy)
        .limit(limitNum)
        .offset(offset);
      [totalResult] = await baseCountQuery.where(whereClause);
    } else {
      // No filters
      jobs = await baseJobsQuery
        .orderBy(orderBy)
        .limit(limitNum)
        .offset(offset);
      [totalResult] = await baseCountQuery;
    }

    res.json({
      jobs,
      pagination: {
        page: parseInt(page as string),
        limit: limitNum,
        total: totalResult.count,
        pages: Math.ceil(totalResult.count / limitNum),
      },
    });
  } catch (error) {
    console.error("Error fetching jobs:", error);
    res.status(500).json({ error: "Failed to fetch jobs" });
  }
});

// Add job to queue
router.post("/queue", async (req, res) => {
  try {
    const { type, payload, options } = req.body;

    const jobId = await jobQueue.addJob(type, payload, options);

    res.json({
      success: true,
      jobId,
      message: "Job added to queue",
    });
  } catch (error) {
    console.error("Error adding job to queue:", error);
    res.status(500).json({ error: "Failed to add job to queue" });
  }
});

// Cancel job
router.delete("/:id", async (req, res) => {
  try {
    const jobId = parseInt(req.params.id);
    const cancelled = await jobQueue.cancelJob(jobId);

    if (cancelled) {
      res.json({ success: true, message: "Job cancelled" });
    } else {
      res.status(404).json({ error: "Job not found or cannot be cancelled" });
    }
  } catch (error) {
    console.error("Error cancelling job:", error);
    res.status(500).json({ error: "Failed to cancel job" });
  }
});

// Schedule recurring job
router.post("/schedule", async (req, res) => {
  try {
    const { name, cron, jobType, payload } = req.body;

    jobScheduler.scheduleJob(name, cron, jobType, payload);

    res.json({
      success: true,
      message: `Job "${name}" scheduled with cron: ${cron}`,
    });
  } catch (error) {
    console.error("Error scheduling job:", error);
    res.status(500).json({ error: "Failed to schedule job" });
  }
});

// Get job queue statistics
router.get("/stats", async (req, res) => {
  try {
    const stats = await jobQueue.getStats();
    res.json(stats);
  } catch (error) {
    console.error("Error getting job stats:", error);
    res.status(500).json({ error: "Failed to get job statistics" });
  }
});

// Get job details with logs
router.get("/:id", async (req, res): Promise<any> => {
  try {
    const jobId = parseInt(req.params.id);

    const [job] = await db
      .select()
      .from(collectionJobs)
      .where(eq(collectionJobs.id, jobId))
      .limit(1);

    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    // Get job logs
    const logs = await jobMonitor.getJobLogs(jobId, 50);

    res.json({
      job,
      logs,
      metadata: {
        logsCount: logs.length,
        canRetry: ["failed", "cancelled"].includes(job.status),
        canCancel: ["pending", "processing", "scheduled"].includes(job.status),
      },
    });
  } catch (error) {
    console.error("Error fetching job details:", error);
    res.status(500).json({ error: "Failed to fetch job details" });
  }
});

// Retry failed job
router.post("/:id/retry", async (req, res): Promise<any> => {
  try {
    const jobId = parseInt(req.params.id);

    const [updated] = await db
      .update(collectionJobs)
      .set({
        status: "pending",
        currentAttempts: 0,
        errorMessage: null,
        startedAt: new Date(),
      })
      .where(
        and(eq(collectionJobs.id, jobId), eq(collectionJobs.status, "failed"))
      )
      .returning();

    if (!updated) {
      return res
        .status(404)
        .json({ error: "Job not found or cannot be retried" });
    }

    await jobMonitor.logJobEvent(jobId, "info", "Job manually retried by user");

    res.json({
      success: true,
      message: "Job queued for retry",
      job: updated,
    });
  } catch (error) {
    console.error("Error retrying job:", error);
    res.status(500).json({ error: "Failed to retry job" });
  }
});

// Bulk operations
router.post("/bulk/:action", async (req, res): Promise<any> => {
  try {
    const { action } = req.params;
    const { jobIds } = req.body;

    if (!Array.isArray(jobIds)) {
      return res.status(400).json({ error: "jobIds must be an array" });
    }

    let result;
    switch (action) {
      case "cancel":
        result = await db
          .update(collectionJobs)
          .set({
            status: "cancelled",
            completedAt: new Date(),
            errorMessage: "Bulk cancelled by user",
          })
          .where(
            and(
              inArray(collectionJobs.id, jobIds),
              inArray(collectionJobs.status, [
                "pending",
                "processing",
                "scheduled",
              ])
            )
          )
          .returning();
        break;

      case "retry":
        result = await db
          .update(collectionJobs)
          .set({
            status: "pending",
            currentAttempts: 0,
            errorMessage: null,
            startedAt: new Date(),
          })
          .where(
            and(
              inArray(collectionJobs.id, jobIds),
              eq(collectionJobs.status, "failed")
            )
          )
          .returning();
        break;

      default:
        return res.status(400).json({ error: "Invalid action" });
    }

    res.json({
      success: true,
      message: `Bulk ${action} completed`,
      affectedJobs: result.length,
    });
  } catch (error) {
    console.error(`Error performing bulk ${req.params.action}:`, error);
    res
      .status(500)
      .json({ error: `Failed to perform bulk ${req.params.action}` });
  }
});

// Get real-time metrics
router.get("/monitoring/metrics", async (req, res) => {
  try {
    const metrics = await jobMonitor.collectMetrics();
    res.json(metrics);
  } catch (error) {
    console.error("Error getting metrics:", error);
    res.status(500).json({ error: "Failed to get metrics" });
  }
});

export { router as jobsRouter };
