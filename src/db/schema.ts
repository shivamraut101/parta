import {
  boolean,
  date,
  index,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

export const shops = pgTable("shops", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  ownerId: uuid("owner_id").notNull(),
  logoUrl: text("logo_url"),
  primaryColor: varchar("primary_color", { length: 20 }),
  brandName: varchar("brand_name", { length: 160 }),
  currencySymbol: varchar("currency_symbol", { length: 8 }).default("₹").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const financialConfigs = pgTable("financial_configs", {
  shopId: uuid("shop_id")
    .primaryKey()
    .references(() => shops.id, { onDelete: "cascade" }),
  ccLimit: numeric("cc_limit", { precision: 18, scale: 2 })
    .default("0")
    .notNull(),
  bankInterestRatePa: numeric("bank_interest_rate_pa", { precision: 10, scale: 6 })
    .default("0")
    .notNull(),
  dailyLocalDrain: numeric("daily_local_drain", { precision: 18, scale: 2 })
    .default("0")
    .notNull(),
  localLoanAprMonthly: numeric("local_loan_apr_monthly", {
    precision: 10,
    scale: 6,
  })
    .default("0")
    .notNull(),
  baseMarginDefault: numeric("base_margin_default", { precision: 10, scale: 6 })
    .default("20")
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const expenseCategoryEnum = pgEnum("expense_category", [
  "STAFF_ADVANCE",
  "TEA_SNACKS",
  "UTILITIES",
  "REPAIRS",
  "MISC",
]);

export const dailySummaries = pgTable(
  "daily_summaries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    summaryDate: date("date").notNull(),
    totalSalesCash: numeric("total_sales_cash", { precision: 18, scale: 2 })
      .default("0")
      .notNull(),
    totalSalesUpi: numeric("total_sales_upi", { precision: 18, scale: 2 })
      .default("0")
      .notNull(),
    marginApplied: numeric("margin_applied", { precision: 10, scale: 6 })
      .default("20")
      .notNull(),
    estimatedGrossProfit: numeric("estimated_gross_profit", {
      precision: 18,
      scale: 2,
    })
      .default("0")
      .notNull(),
    isVoided: boolean("is_voided").default(false).notNull(),
    voidReason: text("void_reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    shopDateUnique: uniqueIndex("daily_summaries_shop_id_date_unique").on(
      table.shopId,
      table.summaryDate,
    ),
    shopDateIdx: index("daily_summaries_shop_date_idx").on(
      table.shopId,
      table.summaryDate,
    ),
  }),
);

export const expenses = pgTable(
  "expenses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    amount: numeric("amount", { precision: 18, scale: 2 })
      .default("0")
      .notNull(),
    category: expenseCategoryEnum("category").notNull(),
    description: text("description"),
    expenseDate: date("expense_date").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    shopDateIdx: index("expenses_shop_date_idx").on(table.shopId, table.expenseDate),
  }),
);

export const debtTargetTypeEnum = pgEnum("debt_target_type", [
  "BANK_CC",
  "LOCAL_LOAN",
]);

export const debtPaymentSourceEnum = pgEnum("debt_payment_source", [
  "CASH",
  "UPI",
]);

export const debtPayments = pgTable(
  "debt_payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    amount: numeric("amount", { precision: 18, scale: 2 })
      .default("0")
      .notNull(),
    paymentDate: date("date").notNull(),
    targetType: debtTargetTypeEnum("target_type").notNull(),
    source: debtPaymentSourceEnum("source").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    shopDateIdx: index("debt_payments_shop_date_idx").on(table.shopId, table.paymentDate),
  }),
);

export const dailyInterestLogs = pgTable(
  "daily_interest_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    logDate: date("date").notNull(),
    ccInterestAccrued: numeric("cc_interest_accrued", { precision: 18, scale: 6 })
      .default("0")
      .notNull(),
    localInterestAccrued: numeric("local_interest_accrued", {
      precision: 18,
      scale: 6,
    })
      .default("0")
      .notNull(),
    totalInterestDrain: numeric("total_interest_drain", { precision: 18, scale: 6 })
      .default("0")
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    shopDateUnique: uniqueIndex("daily_interest_logs_shop_id_date_unique").on(
      table.shopId,
      table.logDate,
    ),
    shopDateIdx: index("daily_interest_logs_shop_date_idx").on(table.shopId, table.logDate),
  }),
);

export const supplierTransactionTypeEnum = pgEnum("supplier_transaction_type", [
  "PURCHASE",
  "PAYMENT",
  "RETURN",
]);

export const suppliers = pgTable(
  "suppliers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 160 }).notNull(),
    contactNumber: varchar("contact_number", { length: 20 }),
    category: varchar("category", { length: 80 }).notNull(),
    currentBalance: numeric("current_balance", { precision: 18, scale: 2 })
      .default("0")
      .notNull(),
    lastPaymentDate: date("last_payment_date"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    shopNameIdx: index("suppliers_shop_name_idx").on(table.shopId, table.name),
  }),
);

export const supplierTransactions = pgTable(
  "supplier_transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id, { onDelete: "cascade" }),
    type: supplierTransactionTypeEnum("type").notNull(),
    amount: numeric("amount", { precision: 18, scale: 2 })
      .default("0")
      .notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    supplierCreatedIdx: index("supplier_transactions_supplier_created_idx").on(
      table.supplierId,
      table.createdAt,
    ),
    shopCreatedIdx: index("supplier_transactions_shop_created_idx").on(
      table.shopId,
      table.createdAt,
    ),
  }),
);

export const monthlySnapshots = pgTable(
  "monthly_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    monthYear: varchar("month_year", { length: 7 }).notNull(),
    totalInterestPaid: numeric("total_interest_paid", { precision: 18, scale: 2 })
      .default("0")
      .notNull(),
    totalNetProfit: numeric("total_net_profit", { precision: 18, scale: 2 })
      .default("0")
      .notNull(),
    turnoverVelocity: numeric("turnover_velocity", { precision: 18, scale: 6 })
      .default("0")
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    shopMonthUnique: uniqueIndex("monthly_snapshots_shop_month_unique").on(
      table.shopId,
      table.monthYear,
    ),
    shopMonthIdx: index("monthly_snapshots_shop_month_idx").on(table.shopId, table.monthYear),
  }),
);

export const dailyClosures = pgTable(
  "daily_closures",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    closureDate: date("closure_date").notNull(),
    isLocked: boolean("is_locked").default(true).notNull(),
    closedBy: uuid("closed_by"),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    shopDateUnique: uniqueIndex("daily_closures_shop_date_unique").on(
      table.shopId,
      table.closureDate,
    ),
    shopDateIdx: index("daily_closures_shop_date_idx").on(table.shopId, table.closureDate),
  }),
);

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    actorUserId: uuid("actor_user_id").notNull(),
    eventDate: date("event_date").notNull(),
    eventType: varchar("event_type", { length: 120 }).notNull(),
    entityType: varchar("entity_type", { length: 120 }).notNull(),
    entityId: text("entity_id"),
    payload: jsonb("payload").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    shopDateIdx: index("audit_events_shop_date_idx").on(table.shopId, table.eventDate),
    shopCreatedIdx: index("audit_events_shop_created_idx").on(table.shopId, table.createdAt),
  }),
);

export const corrections = pgTable(
  "corrections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    entityType: varchar("entity_type", { length: 80 }).notNull(),
    entityId: uuid("entity_id").notNull(),
    reason: text("reason").notNull(),
    correctedBy: uuid("corrected_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    shopEntityIdx: index("corrections_shop_entity_idx").on(table.shopId, table.entityType, table.entityId),
    shopCreatedIdx: index("corrections_shop_created_idx").on(table.shopId, table.createdAt),
  }),
);

export const shopMemberRoleEnum = pgEnum("shop_member_role", [
  "OWNER",
  "MANAGER",
  "VIEWER",
]);

export const shopMembers = pgTable(
  "shop_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
    role: shopMemberRoleEnum("role").notNull().default("VIEWER"),
    invitedBy: uuid("invited_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    shopUserUnique: uniqueIndex("shop_members_shop_user_unique").on(table.shopId, table.userId),
    shopUserIdx: index("shop_members_shop_user_idx").on(table.shopId, table.userId),
  }),
);

export type Shop = typeof shops.$inferSelect;
export type FinancialConfig = typeof financialConfigs.$inferSelect;
export type DailySummary = typeof dailySummaries.$inferSelect;
export type Expense = typeof expenses.$inferSelect;
export type DebtPayment = typeof debtPayments.$inferSelect;
export type DailyInterestLog = typeof dailyInterestLogs.$inferSelect;
export type Supplier = typeof suppliers.$inferSelect;
export type SupplierTransaction = typeof supplierTransactions.$inferSelect;
export type MonthlySnapshot = typeof monthlySnapshots.$inferSelect;
export type Correction = typeof corrections.$inferSelect;
export type ShopMember = typeof shopMembers.$inferSelect;
export type DailyClosure = typeof dailyClosures.$inferSelect;
export type AuditEvent = typeof auditEvents.$inferSelect;
