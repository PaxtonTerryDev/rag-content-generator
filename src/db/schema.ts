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
  },
  (table) => ({
    providerStatusIdx: index("provider_status_idx").on(
      table.provider,
      table.status
    ),
    startedAtIdx: index("started_at_idx").on(table.startedAt),
  })
);

// export const providerConfigs = pgTable('provider_configs', {
//   id: serial('id').primaryKey(),
//   provider: providerEnum('provider').notNull().unique(),
//   enabled: boolean('enabled').default(true),
//   rateLimitPerMinute: integer('rate_limit_per_minute').default(60),
//   lastCollectedAt: timestamp('last_collected_at', { withTimezone: true }),
//   config: jsonb('config').default({}),
//   createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
//   updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
// });

// Type exports for use in your application
export type Content = typeof content.$inferSelect;
export type NewContent = typeof content.$inferInsert;
export type CollectionJob = typeof collectionJobs.$inferSelect;
export type NewCollectionJob = typeof collectionJobs.$inferInsert;
// export type ProviderConfig = typeof providerConfigs.$inferSelect;
// export type NewProviderConfig = typeof providerConfigs.$inferInsert;

// Provider type for type safety
export type Provider = "stackoverflow" | "devto" | "hackernews" | "reddit";
export type ContentType =
  | "question"
  | "answer"
  | "comment"
  | "post"
  | "story"
  | "discussion";
export type JobStatus = "pending" | "processing" | "completed" | "failed";
