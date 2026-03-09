CREATE TABLE "career_roadmaps" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "career_roadmaps_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"userID" integer NOT NULL,
	"resumeContentID" integer NOT NULL,
	"questionnaire" json,
	"paths" json,
	"selectedPathIndex" integer,
	"jobID" varchar(255),
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"detailedPlan" json,
	"detailedStatus" varchar(50) DEFAULT 'none' NOT NULL,
	"detailedJobID" varchar(255),
	"errorMsg" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"completedAt" timestamp
);
--> statement-breakpoint
ALTER TABLE "career_roadmaps" ADD CONSTRAINT "career_roadmaps_userID_users_id_fk" FOREIGN KEY ("userID") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "career_roadmaps" ADD CONSTRAINT "career_roadmaps_resumeContentID_resume_content_id_fk" FOREIGN KEY ("resumeContentID") REFERENCES "public"."resume_content"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "career_roadmaps_user_id_idx" ON "career_roadmaps" USING btree ("userID");--> statement-breakpoint
CREATE INDEX "career_roadmaps_resume_content_id_idx" ON "career_roadmaps" USING btree ("resumeContentID");--> statement-breakpoint
CREATE INDEX "career_roadmaps_status_idx" ON "career_roadmaps" USING btree ("status");--> statement-breakpoint
CREATE INDEX "career_roadmaps_job_id_idx" ON "career_roadmaps" USING btree ("jobID");--> statement-breakpoint
CREATE INDEX "career_roadmaps_created_at_idx" ON "career_roadmaps" USING btree ("createdAt");