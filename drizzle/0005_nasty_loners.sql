CREATE TABLE "candidate_resume_content" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "candidate_resume_content_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"candidateID" integer NOT NULL,
	"analysisID" integer NOT NULL,
	"personalInfo" json,
	"summary" json,
	"experience" json,
	"education" json,
	"skills" json,
	"additionalSections" json,
	"currentScores" json,
	"version" integer DEFAULT 1 NOT NULL,
	"lastEditType" varchar(20) DEFAULT 'initial',
	"lastEditedSection" varchar(50),
	"activeRewriteID" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "candidate_resume_rewrites" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "candidate_resume_rewrites_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"candidateID" integer NOT NULL,
	"analysisID" integer NOT NULL,
	"resumeContentID" integer,
	"jobID" varchar(255),
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"versionNumber" integer DEFAULT 1 NOT NULL,
	"versionLabel" varchar(100),
	"optimizationSettings" json,
	"rewrittenContent" json,
	"improvements" json,
	"isActive" boolean DEFAULT false NOT NULL,
	"appliedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"completedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "candidate_resume_themes" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "candidate_resume_themes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"candidateID" integer NOT NULL,
	"resumeContentID" integer NOT NULL,
	"themeID" integer,
	"customOverrides" json,
	"sectionVisibility" json,
	"sectionOrder" json,
	"isDraft" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"publishedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "resume_content" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "resume_content_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"userID" integer NOT NULL,
	"analysisID" integer NOT NULL,
	"personalInfo" json,
	"summary" json,
	"experience" json,
	"education" json,
	"skills" json,
	"additionalSections" json,
	"currentScores" json,
	"version" integer DEFAULT 1 NOT NULL,
	"lastEditType" varchar(20) DEFAULT 'initial',
	"lastEditedSection" varchar(50),
	"activeRewriteID" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resume_rewrites" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "resume_rewrites_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"userID" integer NOT NULL,
	"analysisID" integer NOT NULL,
	"resumeContentID" integer,
	"jobID" varchar(255),
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"versionNumber" integer DEFAULT 1 NOT NULL,
	"versionLabel" varchar(100),
	"optimizationSettings" json,
	"rewrittenContent" json,
	"improvements" json,
	"isActive" boolean DEFAULT false NOT NULL,
	"appliedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"completedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "resume_themes" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "resume_themes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"description" text,
	"category" varchar(50) NOT NULL,
	"config" json NOT NULL,
	"thumbnailURL" varchar(512),
	"previewURL" varchar(512),
	"isSystemTheme" boolean DEFAULT true NOT NULL,
	"isATSOptimized" boolean DEFAULT false NOT NULL,
	"isPublic" boolean DEFAULT true NOT NULL,
	"usageCount" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "resume_themes_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "user_resume_themes" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "user_resume_themes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"userID" integer NOT NULL,
	"resumeContentID" integer NOT NULL,
	"themeID" integer,
	"customOverrides" json,
	"sectionVisibility" json,
	"sectionOrder" json,
	"isDraft" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"publishedAt" timestamp
);
--> statement-breakpoint
ALTER TABLE "candidate_resume_content" ADD CONSTRAINT "candidate_resume_content_candidateID_candidates_id_fk" FOREIGN KEY ("candidateID") REFERENCES "public"."candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_resume_content" ADD CONSTRAINT "candidate_resume_content_analysisID_candidate_analyses_id_fk" FOREIGN KEY ("analysisID") REFERENCES "public"."candidate_analyses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_resume_rewrites" ADD CONSTRAINT "candidate_resume_rewrites_candidateID_candidates_id_fk" FOREIGN KEY ("candidateID") REFERENCES "public"."candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_resume_rewrites" ADD CONSTRAINT "candidate_resume_rewrites_analysisID_candidate_analyses_id_fk" FOREIGN KEY ("analysisID") REFERENCES "public"."candidate_analyses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_resume_rewrites" ADD CONSTRAINT "candidate_resume_rewrites_resumeContentID_candidate_resume_content_id_fk" FOREIGN KEY ("resumeContentID") REFERENCES "public"."candidate_resume_content"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_resume_themes" ADD CONSTRAINT "candidate_resume_themes_candidateID_candidates_id_fk" FOREIGN KEY ("candidateID") REFERENCES "public"."candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_resume_themes" ADD CONSTRAINT "candidate_resume_themes_resumeContentID_candidate_resume_content_id_fk" FOREIGN KEY ("resumeContentID") REFERENCES "public"."candidate_resume_content"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_resume_themes" ADD CONSTRAINT "candidate_resume_themes_themeID_resume_themes_id_fk" FOREIGN KEY ("themeID") REFERENCES "public"."resume_themes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resume_content" ADD CONSTRAINT "resume_content_userID_users_id_fk" FOREIGN KEY ("userID") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resume_content" ADD CONSTRAINT "resume_content_analysisID_analyses_id_fk" FOREIGN KEY ("analysisID") REFERENCES "public"."analyses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resume_rewrites" ADD CONSTRAINT "resume_rewrites_userID_users_id_fk" FOREIGN KEY ("userID") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resume_rewrites" ADD CONSTRAINT "resume_rewrites_analysisID_analyses_id_fk" FOREIGN KEY ("analysisID") REFERENCES "public"."analyses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resume_rewrites" ADD CONSTRAINT "resume_rewrites_resumeContentID_resume_content_id_fk" FOREIGN KEY ("resumeContentID") REFERENCES "public"."resume_content"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_resume_themes" ADD CONSTRAINT "user_resume_themes_userID_users_id_fk" FOREIGN KEY ("userID") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_resume_themes" ADD CONSTRAINT "user_resume_themes_resumeContentID_resume_content_id_fk" FOREIGN KEY ("resumeContentID") REFERENCES "public"."resume_content"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_resume_themes" ADD CONSTRAINT "user_resume_themes_themeID_resume_themes_id_fk" FOREIGN KEY ("themeID") REFERENCES "public"."resume_themes"("id") ON DELETE set null ON UPDATE no action;