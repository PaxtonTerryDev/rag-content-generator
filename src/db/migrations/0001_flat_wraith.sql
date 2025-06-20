ALTER TYPE "status" ADD VALUE 'cancelled';--> statement-breakpoint
ALTER TYPE "status" ADD VALUE 'retrying';--> statement-breakpoint
ALTER TYPE "status" ADD VALUE 'scheduled';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "job_execution_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" integer NOT NULL,
	"level" varchar(20) DEFAULT 'info' NOT NULL,
	"message" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "job_schedules" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"job_type" varchar(100) NOT NULL,
	"cron_expression" varchar(100) NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb,
	"is_active" boolean DEFAULT true,
	"last_run_at" timestamp with time zone,
	"next_run_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "job_schedules_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "collection_jobs" ADD COLUMN "priority" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "collection_jobs" ADD COLUMN "max_attempts" integer DEFAULT 3;--> statement-breakpoint
ALTER TABLE "collection_jobs" ADD COLUMN "current_attempts" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "collection_jobs" ADD COLUMN "retry_delay" integer DEFAULT 5000;--> statement-breakpoint
ALTER TABLE "collection_jobs" ADD COLUMN "scheduled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "collection_jobs" ADD COLUMN "worker_id" varchar(255);--> statement-breakpoint
ALTER TABLE "collection_jobs" ADD COLUMN "parent_job_id" integer;--> statement-breakpoint
ALTER TABLE "collection_jobs" ADD COLUMN "job_type" varchar(100);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "job_execution_log" ADD CONSTRAINT "job_execution_log_job_id_collection_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."collection_jobs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "log_job_id_idx" ON "job_execution_log" ("job_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "log_level_idx" ON "job_execution_log" ("level");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "log_created_at_idx" ON "job_execution_log" ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "schedule_active_next_run_idx" ON "job_schedules" ("is_active","next_run_at");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "collection_jobs" ADD CONSTRAINT "collection_jobs_parent_job_id_collection_jobs_id_fk" FOREIGN KEY ("parent_job_id") REFERENCES "public"."collection_jobs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_queue_pending_idx" ON "collection_jobs" ("status","priority","started_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_worker_idx" ON "collection_jobs" ("worker_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_type_idx" ON "collection_jobs" ("job_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_scheduled_at_idx" ON "collection_jobs" ("scheduled_at");