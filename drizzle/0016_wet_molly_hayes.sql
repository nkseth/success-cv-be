DROP INDEX "jobs_skills_idx";--> statement-breakpoint
ALTER TABLE "jobs" ALTER COLUMN "description" DROP NOT NULL;--> statement-breakpoint
CREATE INDEX "jobs_skills_idx" ON "jobs" USING gin ("skills_required");