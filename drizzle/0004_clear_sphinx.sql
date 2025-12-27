CREATE TABLE "resume_section_content" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "resume_section_content_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"customizationID" integer NOT NULL,
	"sectionName" varchar(100) NOT NULL,
	"content" json NOT NULL,
	"isVisible" boolean DEFAULT true NOT NULL,
	"displayOrder" integer DEFAULT 0 NOT NULL,
	"editedAt" timestamp DEFAULT now() NOT NULL,
	"editedBy" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resume_templates" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "resume_templates_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"description" text,
	"category" varchar(50) NOT NULL,
	"createdBy" integer,
	"isSystemTemplate" boolean DEFAULT false NOT NULL,
	"isPublic" boolean DEFAULT false NOT NULL,
	"config" json NOT NULL,
	"thumbnailURL" varchar(512),
	"previewURL" varchar(512),
	"tags" json,
	"isATSOptimized" boolean DEFAULT false NOT NULL,
	"compatibilityScore" integer DEFAULT 0,
	"version" varchar(20) DEFAULT '1.0.0' NOT NULL,
	"usageCount" integer DEFAULT 0 NOT NULL,
	"rating" integer DEFAULT 0,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"deletedAt" timestamp,
	CONSTRAINT "resume_templates_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "template_feedback" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "template_feedback_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"templateID" integer NOT NULL,
	"userID" integer NOT NULL,
	"rating" integer NOT NULL,
	"comment" text,
	"categoryRatings" json,
	"isHelpful" boolean DEFAULT false NOT NULL,
	"helpfulCount" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "template_versions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "template_versions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"templateID" integer NOT NULL,
	"versionNumber" varchar(20) NOT NULL,
	"changelog" text,
	"configSnapshot" json NOT NULL,
	"createdBy" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_resume_customizations" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "user_resume_customizations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"userID" integer NOT NULL,
	"analysisID" integer,
	"documentID" integer,
	"templateID" integer,
	"name" varchar(255),
	"description" text,
	"customConfig" json,
	"dataSource" json,
	"isLocked" boolean DEFAULT false NOT NULL,
	"isDraft" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"publishedAt" timestamp,
	"deletedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "user_template_preferences" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "user_template_preferences_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"userID" integer NOT NULL,
	"preferences" json,
	"lastUsedTemplateID" integer,
	"lastUsedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "resume_section_content" ADD CONSTRAINT "resume_section_content_customizationID_user_resume_customizations_id_fk" FOREIGN KEY ("customizationID") REFERENCES "public"."user_resume_customizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resume_section_content" ADD CONSTRAINT "resume_section_content_editedBy_users_id_fk" FOREIGN KEY ("editedBy") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resume_templates" ADD CONSTRAINT "resume_templates_createdBy_users_id_fk" FOREIGN KEY ("createdBy") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_feedback" ADD CONSTRAINT "template_feedback_templateID_resume_templates_id_fk" FOREIGN KEY ("templateID") REFERENCES "public"."resume_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_feedback" ADD CONSTRAINT "template_feedback_userID_users_id_fk" FOREIGN KEY ("userID") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_versions" ADD CONSTRAINT "template_versions_templateID_resume_templates_id_fk" FOREIGN KEY ("templateID") REFERENCES "public"."resume_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_versions" ADD CONSTRAINT "template_versions_createdBy_users_id_fk" FOREIGN KEY ("createdBy") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_resume_customizations" ADD CONSTRAINT "user_resume_customizations_userID_users_id_fk" FOREIGN KEY ("userID") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_resume_customizations" ADD CONSTRAINT "user_resume_customizations_templateID_resume_templates_id_fk" FOREIGN KEY ("templateID") REFERENCES "public"."resume_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_template_preferences" ADD CONSTRAINT "user_template_preferences_userID_users_id_fk" FOREIGN KEY ("userID") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_template_preferences" ADD CONSTRAINT "user_template_preferences_lastUsedTemplateID_resume_templates_id_fk" FOREIGN KEY ("lastUsedTemplateID") REFERENCES "public"."resume_templates"("id") ON DELETE set null ON UPDATE no action;