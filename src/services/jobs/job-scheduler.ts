import * as cron from "node-cron";
import { JobQueue } from "@/services/jobs/job-queue";

export class JobScheduler {
  private scheduledJobs = new Map<string, cron.ScheduledTask>();

  constructor(private jobQueue: JobQueue) {}

  // Schedule recurring job
  scheduleJob(
    name: string,
    cronExpression: string,
    jobType: string,
    payload: any
  ): void {
    if (this.scheduledJobs.has(name)) {
      this.scheduledJobs.get(name)?.destroy();
    }

    const task = cron.schedule(cronExpression, async () => {
      console.log(`Executing scheduled job: ${name}`);
      await this.jobQueue.addJob(jobType, payload);
    });

    this.scheduledJobs.set(name, task);

    console.log(`Scheduled job "${name}" with expression: ${cronExpression}`);
  }

  // Unschedule job
  unscheduleJob(name: string): boolean {
    const task = this.scheduledJobs.get(name);
    if (task) {
      task.destroy();
      this.scheduledJobs.delete(name);
      return true;
    }
    return false;
  }

  // List scheduled jobs
  getScheduledJobs(): string[] {
    return Array.from(this.scheduledJobs.keys());
  }

  // Get scheduled job details
  getScheduledJobDetails(): Array<{ name: string; running: boolean }> {
    return Array.from(this.scheduledJobs.entries()).map(([name, task]) => ({
      name,
      running: task.getStatus() === "scheduled",
    }));
  }

  // Start all scheduled jobs
  startAll(): void {
    this.scheduledJobs.forEach((task, name) => {
      if (task.getStatus() === "scheduled") {
        console.log(`Starting scheduled job: ${name}`);
      }
    });
  }

  // Stop all scheduled jobs
  stopAll(): void {
    this.scheduledJobs.forEach((task, name) => {
      task.stop();
      console.log(`Stopped scheduled job: ${name}`);
    });
  }
}
