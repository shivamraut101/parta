CREATE TYPE "public"."debt_account_kind" AS ENUM('BANK_CC', 'BANK_TERM_LOAN', 'BANK_OD', 'BANK_BILL_DISCOUNT', 'LOCAL_DAILY', 'LOCAL_MONTHLY', 'LOCAL_BULLET', 'LOCAL_FLEXI');--> statement-breakpoint
CREATE TYPE "public"."debt_installment_frequency" AS ENUM('DAILY', 'WEEKLY', 'MONTHLY', 'BULLET');--> statement-breakpoint
CREATE TYPE "public"."debt_rate_input_type" AS ENUM('ANNUAL_PERCENT', 'MONTHLY_PERCENT', 'DAILY_FIXED', 'EMI_DAILY', 'EMI_MONTHLY');--> statement-breakpoint
CREATE TABLE "debt_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"name" varchar(160) NOT NULL,
	"lender_name" varchar(160),
	"kind" "debt_account_kind" NOT NULL,
	"rate_input_type" "debt_rate_input_type" DEFAULT 'ANNUAL_PERCENT' NOT NULL,
	"principal_amount" numeric(18, 2) DEFAULT '0' NOT NULL,
	"outstanding_amount" numeric(18, 2) DEFAULT '0' NOT NULL,
	"annual_rate_pa" numeric(10, 6) DEFAULT '0' NOT NULL,
	"monthly_rate" numeric(10, 6) DEFAULT '0' NOT NULL,
	"daily_fixed_interest" numeric(18, 2) DEFAULT '0' NOT NULL,
	"installment_amount" numeric(18, 2) DEFAULT '0' NOT NULL,
	"installment_frequency" "debt_installment_frequency" DEFAULT 'MONTHLY' NOT NULL,
	"remaining_installments" integer DEFAULT 0 NOT NULL,
	"start_date" date,
	"maturity_date" date,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "debt_payments" ADD COLUMN "debt_account_id" uuid;--> statement-breakpoint
ALTER TABLE "debt_accounts" ADD CONSTRAINT "debt_accounts_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "debt_accounts_shop_active_idx" ON "debt_accounts" USING btree ("shop_id","is_active");--> statement-breakpoint
CREATE INDEX "debt_accounts_shop_kind_idx" ON "debt_accounts" USING btree ("shop_id","kind");--> statement-breakpoint
ALTER TABLE "debt_payments" ADD CONSTRAINT "debt_payments_debt_account_id_debt_accounts_id_fk" FOREIGN KEY ("debt_account_id") REFERENCES "public"."debt_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "debt_payments_shop_account_idx" ON "debt_payments" USING btree ("shop_id","debt_account_id");