// src/services/job-monitoring.ts
import { db } from "@/db/connection";
import { collectionJobs, jobExecutionLog } from "@/db/schema";
import { EventEmitter } from "events";
import { eq, and, desc, count, sql } from "drizzle-orm";

export class JobMonitor extends EventEmitter {
  private metricsInterval: NodeJS.Timeout | null = null;

  startMonitoring(intervalMs = 30000): void {
    this.metricsInterval = setInterval(async () => {
      try {
        const metrics = await this.collectMetrics();
        this.emit("metrics", metrics);

        // Check for stuck jobs
        const stuckJobs = await this.findStuckJobs();
        if (stuckJobs.length > 0) {
          this.emit("stuckJobs", stuckJobs);
        }
      } catch (error) {
        console.error("Error collecting job metrics:", error);
      }
    }, intervalMs);
  }

  stopMonitoring(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }
  }

  async collectMetrics() {
    // Job status distribution
    const statusCounts = await db
      .select({
        status: collectionJobs.status,
        count: count(),
      })
      .from(collectionJobs)
      .groupBy(collectionJobs.status);

    // Average processing time for completed jobs
    const avgProcessingTime = await db
      .select({
        avgMs: sql<number>`
          AVG(EXTRACT(EPOCH FROM (completed_at - started_at)) * 1000)::int
        `,
      })
      .from(collectionJobs)
      .where(eq(collectionJobs.status, "completed"));

    // Job failure rate (last 24 hours)
    const failureRateResult = await db
      .select({
        total: count(),
        failed: sql<number>`COUNT(*) FILTER (WHERE status = 'failed')`,
      })
      .from(collectionJobs)
      .where(sql`started_at > NOW() - INTERVAL '24 hours'`);

    return {
      statusCounts,
      avgProcessingTimeMs: avgProcessingTime[0]?.avgMs || 0,
      failureRate: failureRateResult[0] || { total: 0, failed: 0 },
      timestamp: new Date().toISOString(),
    };
  }

  private async findStuckJobs() {
    // Jobs processing for more than 30 minutes
    return db
      .select()
      .from(collectionJobs)
      .where(
        and(
          eq(collectionJobs.status, "processing"),
          sql`started_at < NOW() - INTERVAL '30 minutes'`
        )
      );
  }

  async logJobEvent(
    jobId: number,
    level: "info" | "warn" | "error" | "debug",
    message: string,
    metadata: any = {}
  ): Promise<void> {
    await db.insert(jobExecutionLog).values({
      jobId,
      level,
      message,
      metadata,
    });
  }

  async getJobLogs(jobId: number, limit = 100) {
    return db
      .select()
      .from(jobExecutionLog)
      .where(eq(jobExecutionLog.jobId, jobId))
      .orderBy(desc(jobExecutionLog.createdAt))
      .limit(limit);
  }

  // Get metrics for a specific time period
  async getMetricsForPeriod(hours: number = 24) {
    const timeThreshold = sql`NOW() - INTERVAL '${hours} hours'`;

    const periodMetrics = await db
      .select({
        status: collectionJobs.status,
        count: count(),
        avgDurationMs: sql<number>`
          AVG(
            CASE 
              WHEN completed_at IS NOT NULL 
              THEN EXTRACT(EPOCH FROM (completed_at - started_at)) * 1000 
              ELSE NULL 
            END
          )::int
        `,
      })
      .from(collectionJobs)
      .where(sql`started_at > ${timeThreshold}`)
      .groupBy(collectionJobs.status);

    return {
      period: `${hours} hours`,
      metrics: periodMetrics,
      timestamp: new Date().toISOString(),
    };
  }

  // Get job throughput statistics
  async getThroughputStats() {
    const hourlyThroughput = await db.execute(sql`
      SELECT 
        DATE_TRUNC('hour', started_at) as hour,
        COUNT(*) as jobs_started,
        COUNT(*) FILTER (WHERE status = 'completed') as jobs_completed,
        COUNT(*) FILTER (WHERE status = 'failed') as jobs_failed
      FROM collection_jobs 
      WHERE started_at > NOW() - INTERVAL '24 hours'
      GROUP BY DATE_TRUNC('hour', started_at)
      ORDER BY hour DESC
      LIMIT 24
    `);

    return {
      hourlyThroughput: hourlyThroughput.map((row) => ({
        hour: row.hour,
        started: parseInt(row.jobs_started as string),
        completed: parseInt(row.jobs_completed as string),
        failed: parseInt(row.jobs_failed as string),
      })),
      timestamp: new Date().toISOString(),
    };
  }

  // Health check for the job system
  async getHealthStatus() {
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

    // Check for recent activity
    const [recentActivity] = await db
      .select({ count: count() })
      .from(collectionJobs)
      .where(sql`started_at > ${fiveMinutesAgo.toISOString()}`);

    // Check for stuck jobs
    const stuckJobs = await this.findStuckJobs();

    // Check failure rate
    const [failureRate] = await db
      .select({
        total: count(),
        failed: sql<number>`COUNT(*) FILTER (WHERE status = 'failed')`,
      })
      .from(collectionJobs)
      .where(sql`started_at > NOW() - INTERVAL '1 hour'`);

    const failurePercentage =
      failureRate.total > 0
        ? (failureRate.failed / failureRate.total) * 100
        : 0;

    const isHealthy = stuckJobs.length === 0 && failurePercentage < 50;

    return {
      healthy: isHealthy,
      recentActivity: recentActivity.count,
      stuckJobs: stuckJobs.length,
      failureRate: {
        percentage: Math.round(failurePercentage * 100) / 100,
        total: failureRate.total,
        failed: failureRate.failed,
      },
      timestamp: now.toISOString(),
    };
  }
}
