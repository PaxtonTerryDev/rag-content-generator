import { JobDefinition, JobHandler } from "@/services/jobs/job-queue";
import { StackOverflowCollector } from "@/collectors/stack-overflow-collector";

export const stackOverflowHandler: JobHandler = async (job: JobDefinition) => {
  const collector = new StackOverflowCollector();
  await collector.startCollection(job.payload);
};

export const scheduleHandler: JobHandler = async (job: JobDefinition) => {
  // Handle scheduled jobs (e.g., daily collections)
  const { jobType, payload } = job.payload;

  // This could dispatch to other job types
  // For example, schedule daily Stack Overflow collection
  console.log(`Executing scheduled job: ${jobType}`);
};
