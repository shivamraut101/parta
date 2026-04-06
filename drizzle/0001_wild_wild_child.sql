CREATE TYPE "public"."shop_member_role" AS ENUM('OWNER', 'MANAGER', 'VIEWER');--> statement-breakpoint
CREATE TYPE "public"."supplier_transaction_type" AS ENUM('PURCHASE', 'PAYMENT', 'RETURN');--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"actor_user_id" uuid NOT NULL,
	"event_date" date NOT NULL,
	"event_type" varchar(120) NOT NULL,
	"entity_type" varchar(120) NOT NULL,
	"entity_id" text,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "corrections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"entity_type" varchar(80) NOT NULL,
	"entity_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"corrected_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_closures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"closure_date" date NOT NULL,
	"is_locked" boolean DEFAULT true NOT NULL,
	"closed_by" uuid,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "monthly_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"month_year" varchar(7) NOT NULL,
	"total_interest_paid" numeric(18, 2) DEFAULT '0' NOT NULL,
	"total_net_profit" numeric(18, 2) DEFAULT '0' NOT NULL,
	"turnover_velocity" numeric(18, 6) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shop_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "shop_member_role" DEFAULT 'VIEWER' NOT NULL,
	"invited_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supplier_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"supplier_id" uuid NOT NULL,
	"type" "supplier_transaction_type" NOT NULL,
	"amount" numeric(18, 2) DEFAULT '0' NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"name" varchar(160) NOT NULL,
	"contact_number" varchar(20),
	"category" varchar(80) NOT NULL,
	"current_balance" numeric(18, 2) DEFAULT '0' NOT NULL,
	"last_payment_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "daily_summaries" ADD COLUMN "is_voided" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_summaries" ADD COLUMN "void_reason" text;--> statement-breakpoint
ALTER TABLE "shops" ADD COLUMN "logo_url" text;--> statement-breakpoint
ALTER TABLE "shops" ADD COLUMN "primary_color" varchar(20);--> statement-breakpoint
ALTER TABLE "shops" ADD COLUMN "brand_name" varchar(160);--> statement-breakpoint
ALTER TABLE "shops" ADD COLUMN "currency_symbol" varchar(8) DEFAULT '₹' NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "corrections" ADD CONSTRAINT "corrections_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_closures" ADD CONSTRAINT "daily_closures_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monthly_snapshots" ADD CONSTRAINT "monthly_snapshots_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_members" ADD CONSTRAINT "shop_members_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_transactions" ADD CONSTRAINT "supplier_transactions_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_transactions" ADD CONSTRAINT "supplier_transactions_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_events_shop_date_idx" ON "audit_events" USING btree ("shop_id","event_date");--> statement-breakpoint
CREATE INDEX "audit_events_shop_created_idx" ON "audit_events" USING btree ("shop_id","created_at");--> statement-breakpoint
CREATE INDEX "corrections_shop_entity_idx" ON "corrections" USING btree ("shop_id","entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "corrections_shop_created_idx" ON "corrections" USING btree ("shop_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "daily_closures_shop_date_unique" ON "daily_closures" USING btree ("shop_id","closure_date");--> statement-breakpoint
CREATE INDEX "daily_closures_shop_date_idx" ON "daily_closures" USING btree ("shop_id","closure_date");--> statement-breakpoint
CREATE UNIQUE INDEX "monthly_snapshots_shop_month_unique" ON "monthly_snapshots" USING btree ("shop_id","month_year");--> statement-breakpoint
CREATE INDEX "monthly_snapshots_shop_month_idx" ON "monthly_snapshots" USING btree ("shop_id","month_year");--> statement-breakpoint
CREATE UNIQUE INDEX "shop_members_shop_user_unique" ON "shop_members" USING btree ("shop_id","user_id");--> statement-breakpoint
CREATE INDEX "shop_members_shop_user_idx" ON "shop_members" USING btree ("shop_id","user_id");--> statement-breakpoint
CREATE INDEX "supplier_transactions_supplier_created_idx" ON "supplier_transactions" USING btree ("supplier_id","created_at");--> statement-breakpoint
CREATE INDEX "supplier_transactions_shop_created_idx" ON "supplier_transactions" USING btree ("shop_id","created_at");--> statement-breakpoint
CREATE INDEX "suppliers_shop_name_idx" ON "suppliers" USING btree ("shop_id","name");