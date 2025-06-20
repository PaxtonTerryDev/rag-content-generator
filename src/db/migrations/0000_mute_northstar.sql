DO $$ BEGIN
 CREATE TYPE "public"."content_type" AS ENUM('question', 'answer', 'comment', 'post', 'story', 'discussion');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."provider" AS ENUM('stackoverflow', 'devto', 'hackernews', 'reddit');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."status" AS ENUM('pending', 'processing', 'completed', 'failed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "collection_jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider" "provider" NOT NULL,
	"status" "status" DEFAULT 'pending',
	"started_at" timestamp with time zone DEFAULT now(),
	"completed_at" timestamp with time zone,
	"items_collected" integer DEFAULT 0,
	"items_processed" integer DEFAULT 0,
	"error_message" text,
	"configuration" jsonb DEFAULT '{}'::jsonb,
	"last_processed_id" varchar(255)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "content" (
	"id" serial PRIMARY KEY NOT NULL,
	"external_id" varchar(255) NOT NULL,
	"provider" "provider" NOT NULL,
	"content_type" "content_type" NOT NULL,
	"title" text,
	"body" text NOT NULL,
	"author" varchar(255),
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now(),
	"source_url" text,
	"tags" text[],
	"score" integer DEFAULT 0,
	"view_count" integer DEFAULT 0,
	"comment_count" integer DEFAULT 0,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "provider_status_idx" ON "collection_jobs" ("provider","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "started_at_idx" ON "collection_jobs" ("started_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "provider_external_id_idx" ON "content" ("provider","external_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "provider_idx" ON "content" ("provider");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "content_type_idx" ON "content" ("content_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "created_at_idx" ON "content" ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "author_idx" ON "content" ("author");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "score_idx" ON "content" ("score");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "provider_created_at_idx" ON "content" ("provider","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "provider_score_idx" ON "content" ("provider","score");