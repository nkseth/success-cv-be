CREATE TABLE "credit_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"walletID" integer NOT NULL,
	"initiatedByUserID" integer,
	"initiatedByCandidateID" integer,
	"type" varchar(50) NOT NULL,
	"amount" integer NOT NULL,
	"balanceAfter" integer NOT NULL,
	"referenceType" varchar(50),
	"referenceID" varchar(100),
	"status" varchar(20) DEFAULT 'completed' NOT NULL,
	"description" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"completedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "credit_wallets" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "credit_wallets_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"userID" integer,
	"organisationID" integer,
	"balance" integer DEFAULT 0 NOT NULL,
	"pendingBalance" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userID" integer,
	"organisationID" integer,
	"orderType" varchar(50) NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'INR' NOT NULL,
	"planID" integer,
	"creditsAmount" integer,
	"razorpayOrderId" varchar(100),
	"razorpayPaymentId" varchar(100),
	"razorpaySignature" varchar(255),
	"status" varchar(50) DEFAULT 'created' NOT NULL,
	"paidAt" timestamp,
	"failureReason" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "razorpay_webhooks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"eventType" varchar(100) NOT NULL,
	"eventId" varchar(100) NOT NULL,
	"payload" jsonb NOT NULL,
	"status" varchar(20) DEFAULT 'received' NOT NULL,
	"processedAt" timestamp,
	"errorMessage" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "razorpay_webhooks_eventId_unique" UNIQUE("eventId")
);
--> statement-breakpoint
CREATE TABLE "subscription_plans" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "subscription_plans_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(100) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"type" varchar(50) NOT NULL,
	"priceMonthly" numeric(10, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'INR' NOT NULL,
	"creditsPerMonth" integer NOT NULL,
	"maxTeamMembers" integer,
	"maxCandidates" integer,
	"features" jsonb,
	"razorpayPlanId" varchar(100),
	"isActive" boolean DEFAULT true NOT NULL,
	"sortOrder" integer DEFAULT 0,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "subscription_plans_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "user_subscriptions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "user_subscriptions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"userID" integer,
	"organisationID" integer,
	"planID" integer NOT NULL,
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"currentPeriodStart" timestamp NOT NULL,
	"currentPeriodEnd" timestamp NOT NULL,
	"razorpaySubscriptionId" varchar(100),
	"razorpayCustomerId" varchar(100),
	"cancelAtPeriodEnd" boolean DEFAULT false,
	"cancelledAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_walletID_credit_wallets_id_fk" FOREIGN KEY ("walletID") REFERENCES "public"."credit_wallets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_initiatedByUserID_users_id_fk" FOREIGN KEY ("initiatedByUserID") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_initiatedByCandidateID_candidates_id_fk" FOREIGN KEY ("initiatedByCandidateID") REFERENCES "public"."candidates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_wallets" ADD CONSTRAINT "credit_wallets_userID_users_id_fk" FOREIGN KEY ("userID") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_wallets" ADD CONSTRAINT "credit_wallets_organisationID_organisations_id_fk" FOREIGN KEY ("organisationID") REFERENCES "public"."organisations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_userID_users_id_fk" FOREIGN KEY ("userID") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_organisationID_organisations_id_fk" FOREIGN KEY ("organisationID") REFERENCES "public"."organisations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_planID_subscription_plans_id_fk" FOREIGN KEY ("planID") REFERENCES "public"."subscription_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_userID_users_id_fk" FOREIGN KEY ("userID") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_organisationID_organisations_id_fk" FOREIGN KEY ("organisationID") REFERENCES "public"."organisations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_planID_subscription_plans_id_fk" FOREIGN KEY ("planID") REFERENCES "public"."subscription_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "credit_transactions_wallet_idx" ON "credit_transactions" USING btree ("walletID");--> statement-breakpoint
CREATE INDEX "credit_transactions_type_idx" ON "credit_transactions" USING btree ("type");--> statement-breakpoint
CREATE INDEX "credit_transactions_status_idx" ON "credit_transactions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "credit_transactions_created_idx" ON "credit_transactions" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "credit_transactions_user_idx" ON "credit_transactions" USING btree ("initiatedByUserID");--> statement-breakpoint
CREATE INDEX "credit_transactions_candidate_idx" ON "credit_transactions" USING btree ("initiatedByCandidateID");--> statement-breakpoint
CREATE UNIQUE INDEX "credit_wallets_user_idx" ON "credit_wallets" USING btree ("userID");--> statement-breakpoint
CREATE UNIQUE INDEX "credit_wallets_org_idx" ON "credit_wallets" USING btree ("organisationID");--> statement-breakpoint
CREATE INDEX "credit_wallets_balance_idx" ON "credit_wallets" USING btree ("balance");--> statement-breakpoint
CREATE INDEX "payment_orders_user_idx" ON "payment_orders" USING btree ("userID");--> statement-breakpoint
CREATE INDEX "payment_orders_org_idx" ON "payment_orders" USING btree ("organisationID");--> statement-breakpoint
CREATE INDEX "payment_orders_status_idx" ON "payment_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "payment_orders_razorpay_order_idx" ON "payment_orders" USING btree ("razorpayOrderId");--> statement-breakpoint
CREATE INDEX "payment_orders_created_idx" ON "payment_orders" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "razorpay_webhooks_event_type_idx" ON "razorpay_webhooks" USING btree ("eventType");--> statement-breakpoint
CREATE INDEX "razorpay_webhooks_status_idx" ON "razorpay_webhooks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "razorpay_webhooks_created_idx" ON "razorpay_webhooks" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "subscription_plans_type_idx" ON "subscription_plans" USING btree ("type");--> statement-breakpoint
CREATE INDEX "subscription_plans_active_idx" ON "subscription_plans" USING btree ("isActive");--> statement-breakpoint
CREATE INDEX "subscription_plans_sort_idx" ON "subscription_plans" USING btree ("sortOrder");--> statement-breakpoint
CREATE INDEX "user_subscriptions_user_idx" ON "user_subscriptions" USING btree ("userID");--> statement-breakpoint
CREATE INDEX "user_subscriptions_org_idx" ON "user_subscriptions" USING btree ("organisationID");--> statement-breakpoint
CREATE INDEX "user_subscriptions_status_idx" ON "user_subscriptions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "user_subscriptions_period_end_idx" ON "user_subscriptions" USING btree ("currentPeriodEnd");