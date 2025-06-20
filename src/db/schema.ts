import { eq, inArray } from "drizzle-orm";
import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  integer,
  jsonb,
  uniqueIndex,
  index,
  pgEnum,
  boolean,
  foreignKey,
} from "drizzle-orm/pg-core";

export const providerEnum = pgEnum("provider", [
  "stackoverflow",
  "devto",
  "hackernews",
  "reddit",
]);

export const contentTypeEnum = pgEnum("content_type", [
  "question",
  "answer",
  "comment",
  "post",
  "story",
  "discussion",
]);

export const statusEnum = pgEnum("status", [
  "pending",
  "processing",
  "completed",
  "failed",
  "cancelled",
  "retrying",
  "scheduled",
]);

export const content = pgTable(
  "content",
  {
    id: serial("id").primaryKey(),
    externalId: varchar("external_id", { length: 255 }).notNull(),
    provider: providerEnum("provider").notNull(),
    contentType: contentTypeEnum("content_type").notNull(),
    title: text("title"),
    body: text("body").notNull(),
    author: varchar("author", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
    sourceUrl: text("source_url"),
    tags: text("tags").array(),
    score: integer("score").default(0),
    viewCount: integer("view_count").default(0),
    commentCount: integer("comment_count").default(0),
    metadata: jsonb("metadata").default({}),
    processedAt: timestamp("processed_at", { withTimezone: true }),
  },
  (table) => ({
    providerExternalIdIdx: uniqueIndex("provider_external_id_idx").on(
      table.provider,
      table.externalId
    ),
    providerIdx: index("provider_idx").on(table.provider),
    contentTypeIdx: index("content_type_idx").on(table.contentType),
    createdAtIdx: index("created_at_idx").on(table.createdAt),
    authorIdx: index("author_idx").on(table.author),
    scoreIdx: index("score_idx").on(table.score),
    providerCreatedAtIdx: index("provider_created_at_idx").on(
      table.provider,
      table.createdAt
    ),
    providerScoreIdx: index("provider_score_idx").on(
      table.provider,
      table.score
    ),
  })
);

export const collectionJobs = pgTable(
  "collection_jobs",
  {
    id: serial("id").primaryKey(),
    provider: providerEnum("provider").notNull(),
    status: statusEnum("status").default("pending"),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    itemsCollected: integer("items_collected").default(0),
    itemsProcessed: integer("items_processed").default(0),
    errorMessage: text("error_message"),
    configuration: jsonb("configuration").default({}),
    lastProcessedId: varchar("last_processed_id", { length: 255 }),

    // New job system fields
    priority: integer("priority").default(0),
    maxAttempts: integer("max_attempts").default(3),
    currentAttempts: integer("current_attempts").default(0),
    retryDelay: integer("retry_delay").default(5000),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    workerId: varchar("worker_id", { length: 255 }),
    parentJobId: integer("parent_job_id"),
    jobType: varchar("job_type", { length: 100 }),
  },
  (table) => ({
    providerStatusIdx: index("provider_status_idx").on(
      table.provider,
      table.status
    ),
    startedAtIdx: index("started_at_idx").on(table.startedAt),
    jobQueuePendingIdx: index("job_queue_pending_idx")
      .on(table.status, table.priority, table.startedAt)
      .where(inArray(table.status, ["pending", "scheduled"])),
    workerIdx: index("job_worker_idx").on(table.workerId),
    jobTypeIdx: index("job_type_idx").on(table.jobType),
    scheduledAtIdx: index("job_scheduled_at_idx").on(table.scheduledAt),
    parentJobRef: foreignKey({
      columns: [table.parentJobId],
      foreignColumns: [table.id],
    }),
  })
);

export const jobExecutionLog = pgTable(
  "job_execution_log",
  {
    id: serial("id").primaryKey(),
    jobId: integer("job_id")
      .notNull()
      .references(() => collectionJobs.id, { onDelete: "cascade" }),
    level: varchar("level", { length: 20 }).notNull().default("info"),
    message: text("message").notNull(),
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    jobIdIdx: index("log_job_id_idx").on(table.jobId),
    levelIdx: index("log_level_idx").on(table.level),
    createdAtIdx: index("log_created_at_idx").on(table.createdAt),
  })
);

export const jobSchedules = pgTable(
  "job_schedules",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 255 }).notNull().unique(),
    jobType: varchar("job_type", { length: 100 }).notNull(),
    cronExpression: varchar("cron_expression", { length: 100 }).notNull(),
    payload: jsonb("payload").default({}),
    isActive: boolean("is_active").default(true),
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    nextRunAt: timestamp("next_run_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    activeNextRunIdx: index("schedule_active_next_run_idx")
      .on(table.isActive, table.nextRunAt)
      .where(eq(table.isActive, true)),
  })
);

// Type exports for use in your application
export type Content = typeof content.$inferSelect;
export type NewContent = typeof content.$inferInsert;
export type CollectionJob = typeof collectionJobs.$inferSelect;
export type NewCollectionJob = typeof collectionJobs.$inferInsert;

export type Provider = "stackoverflow" | "devto" | "hackernews" | "reddit";
export type ContentType =
  | "question"
  | "answer"
  | "comment"
  | "post"
  | "story"
  | "discussion";

export type JobSchedule = typeof jobSchedules.$inferSelect;
export type NewJobSchedule = typeof jobSchedules.$inferInsert;
export type JobExecutionLog = typeof jobExecutionLog.$inferSelect;
export type NewJobExecutionLog = typeof jobExecutionLog.$inferInsert;
