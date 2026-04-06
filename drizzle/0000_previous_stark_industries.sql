CREATE TYPE "public"."debt_payment_source" AS ENUM('CASH', 'UPI');--> statement-breakpoint
CREATE TYPE "public"."debt_target_type" AS ENUM('BANK_CC', 'LOCAL_LOAN');--> statement-breakpoint
CREATE TYPE "public"."expense_category" AS ENUM('STAFF_ADVANCE', 'TEA_SNACKS', 'UTILITIES', 'REPAIRS', 'MISC');--> statement-breakpoint
CREATE TABLE "daily_interest_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"date" date NOT NULL,
	"cc_interest_accrued" numeric(18, 6) DEFAULT '0' NOT NULL,
	"local_interest_accrued" numeric(18, 6) DEFAULT '0' NOT NULL,
	"total_interest_drain" numeric(18, 6) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_summaries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"date" date NOT NULL,
	"total_sales_cash" numeric(18, 2) DEFAULT '0' NOT NULL,
	"total_sales_upi" numeric(18, 2) DEFAULT '0' NOT NULL,
	"margin_applied" numeric(10, 6) DEFAULT '20' NOT NULL,
	"estimated_gross_profit" numeric(18, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "debt_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"amount" numeric(18, 2) DEFAULT '0' NOT NULL,
	"date" date NOT NULL,
	"target_type" "debt_target_type" NOT NULL,
	"source" "debt_payment_source" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"amount" numeric(18, 2) DEFAULT '0' NOT NULL,
	"category" "expense_category" NOT NULL,
	"description" text,
	"expense_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "financial_configs" (
	"shop_id" uuid PRIMARY KEY NOT NULL,
	"cc_limit" numeric(18, 2) DEFAULT '0' NOT NULL,
	"bank_interest_rate_pa" numeric(10, 6) DEFAULT '0' NOT NULL,
	"daily_local_drain" numeric(18, 2) DEFAULT '0' NOT NULL,
	"local_loan_apr_monthly" numeric(10, 6) DEFAULT '0' NOT NULL,
	"base_margin_default" numeric(10, 6) DEFAULT '20' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shops" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(160) NOT NULL,
	"owner_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "daily_interest_logs" ADD CONSTRAINT "daily_interest_logs_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_summaries" ADD CONSTRAINT "daily_summaries_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debt_payments" ADD CONSTRAINT "debt_payments_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_configs" ADD CONSTRAINT "financial_configs_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "daily_interest_logs_shop_id_date_unique" ON "daily_interest_logs" USING btree ("shop_id","date");--> statement-breakpoint
CREATE INDEX "daily_interest_logs_shop_date_idx" ON "daily_interest_logs" USING btree ("shop_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "daily_summaries_shop_id_date_unique" ON "daily_summaries" USING btree ("shop_id","date");--> statement-breakpoint
CREATE INDEX "daily_summaries_shop_date_idx" ON "daily_summaries" USING btree ("shop_id","date");--> statement-breakpoint
CREATE INDEX "debt_payments_shop_date_idx" ON "debt_payments" USING btree ("shop_id","date");--> statement-breakpoint
CREATE INDEX "expenses_shop_date_idx" ON "expenses" USING btree ("shop_id","expense_date");