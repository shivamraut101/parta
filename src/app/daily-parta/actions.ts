"use server";

import Decimal from "decimal.js";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { LOCAL_DAILY_LOAN_PAYMENT_DESC } from "@/app/daily-parta/constants";
import { db } from "@/db";
import { corrections, dailySummaries, expenses, shops } from "@/db/schema";
import { logAuditEvent } from "@/lib/audit/logAuditEvent";
import {
  recordCurrentAccountMovement,
  upsertCurrentAccountMovementBySource,
} from "@/lib/finance/currentAccountLedger";
import { assertBusinessDayUnlocked } from "@/lib/lock/assertBusinessDayUnlocked";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { normalizeBusinessDateInput } from "@/lib/time/businessDate";

const expenseCategorySchema = z.enum([
  "STAFF_ADVANCE",
  "TEA_SNACKS",
  "UTILITIES",
  "REPAIRS",
  "MISC",
]);

const dailyEntrySchema = z.object({
  date: z.string().min(1),
  totalSalesCash: z.coerce.number().min(0),
  totalSalesUpi: z.coerce.number().min(0),
  marginApplied: z.coerce.number().min(10).max(100),
  includeLocalDailyLoanPayment: z.coerce.boolean().default(false),
  localDailyLoanPayment: z.coerce.number().min(0).default(0),
});

const expenseSchema = z.object({
  date: z.string().min(1),
  amount: z.coerce.number().min(0),
  category: expenseCategorySchema,
  description: z.string().trim().optional(),
});

async function assertTenantShopOwnership(shopId: string, userId: string) {
  const [shop] = await db
    .select({ id: shops.id })
    .from(shops)
    .where(and(eq(shops.id, shopId), eq(shops.ownerId, userId)))
    .limit(1);

  if (!shop) {
    throw new Error("Tenant ownership verification failed.");
  }
}

export async function saveDailyEntry(formData: FormData) {
  const context = await getTenantContext();
  if (!context) {
    throw new Error("Unauthorized tenant context.");
  }

  const parsed = dailyEntrySchema.safeParse({
    date: normalizeBusinessDateInput(formData.get("date")),
    totalSalesCash: formData.get("totalSalesCash"),
    totalSalesUpi: formData.get("totalSalesUpi"),
    marginApplied: formData.get("marginApplied"),
    includeLocalDailyLoanPayment: formData.get("includeLocalDailyLoanPayment") || "false",
    localDailyLoanPayment: formData.get("localDailyLoanPayment") || "0",
  });

  if (!parsed.success) {
    throw new Error("Invalid daily summary payload.");
  }

  await assertTenantShopOwnership(context.shopId, context.userId);

  const payload = parsed.data;
  await assertBusinessDayUnlocked(context.shopId, payload.date);

  const [existingSummary] = await db
    .select({
      id: dailySummaries.id,
    })
    .from(dailySummaries)
    .where(
      and(
        eq(dailySummaries.shopId, context.shopId),
        eq(dailySummaries.summaryDate, payload.date),
      ),
    )
    .limit(1);

  const [existingLocalDailyLoanMarker] = await db
    .select({
      amount: expenses.amount,
    })
    .from(expenses)
    .where(
      and(
        eq(expenses.shopId, context.shopId),
        eq(expenses.expenseDate, payload.date),
        eq(expenses.category, "MISC"),
        eq(expenses.description, LOCAL_DAILY_LOAN_PAYMENT_DESC),
      ),
    )
    .limit(1);

  const totalSales = new Decimal(payload.totalSalesCash).add(payload.totalSalesUpi);
  const estimatedGrossProfit = totalSales.mul(new Decimal(payload.marginApplied).div(100));
  const localDailyLoanPayment = payload.includeLocalDailyLoanPayment
    ? new Decimal(payload.localDailyLoanPayment)
    : new Decimal(0);

  await db.transaction(async (tx) => {
    const [upsertedSummary] = await tx
      .insert(dailySummaries)
      .values({
        shopId: context.shopId,
        summaryDate: payload.date,
        totalSalesCash: payload.totalSalesCash.toString(),
        totalSalesUpi: payload.totalSalesUpi.toString(),
        marginApplied: payload.marginApplied.toString(),
        estimatedGrossProfit: estimatedGrossProfit.toFixed(2),
      })
      .onConflictDoUpdate({
        target: [dailySummaries.shopId, dailySummaries.summaryDate],
        set: {
          totalSalesCash: payload.totalSalesCash.toString(),
          totalSalesUpi: payload.totalSalesUpi.toString(),
          marginApplied: payload.marginApplied.toString(),
          estimatedGrossProfit: estimatedGrossProfit.toFixed(2),
          updatedAt: new Date(),
        },
      })
      .returning({ id: dailySummaries.id });

    const summaryId = upsertedSummary?.id || existingSummary?.id;
    if (summaryId) {
      await upsertCurrentAccountMovementBySource(tx, {
        shopId: context.shopId,
        sourceType: "SALES",
        sourceId: summaryId,
        movementDate: payload.date,
        movementType: "SALES_INFLOW",
        amount: totalSales.toFixed(2),
        direction: 1,
        description: "Daily sales inflow (Cash + UPI)",
      });
    }

    // Keep a single editable daily loan payment marker row so re-saving updates the value.
    await tx
      .delete(expenses)
      .where(
        and(
          eq(expenses.shopId, context.shopId),
          eq(expenses.expenseDate, payload.date),
          eq(expenses.category, "MISC"),
          eq(expenses.description, LOCAL_DAILY_LOAN_PAYMENT_DESC),
        ),
      );

    if (localDailyLoanPayment.gt(0)) {
      await tx.insert(expenses).values({
        shopId: context.shopId,
        expenseDate: payload.date,
        amount: localDailyLoanPayment.toFixed(2),
        category: "MISC",
        description: LOCAL_DAILY_LOAN_PAYMENT_DESC,
      });
    }

    const previousLocalDailyLoanAmount = new Decimal(existingLocalDailyLoanMarker?.amount || "0");
    const localDailyLoanDelta = localDailyLoanPayment.minus(previousLocalDailyLoanAmount);

    if (localDailyLoanDelta.gt(0)) {
      await recordCurrentAccountMovement(tx, {
        shopId: context.shopId,
        movementDate: payload.date,
        movementType: "EXPENSE_OUTFLOW",
        amount: localDailyLoanDelta.toFixed(2),
        direction: -1,
        sourceType: "MANUAL_ADJUSTMENT",
        description: "Daily local loan payment (delta increase)",
        notes: LOCAL_DAILY_LOAN_PAYMENT_DESC,
      });
    } else if (localDailyLoanDelta.lt(0)) {
      await recordCurrentAccountMovement(tx, {
        shopId: context.shopId,
        movementDate: payload.date,
        movementType: "ADJUSTMENT",
        amount: localDailyLoanDelta.abs().toFixed(2),
        direction: 1,
        sourceType: "MANUAL_ADJUSTMENT",
        description: "Daily local loan payment correction (delta decrease)",
        notes: LOCAL_DAILY_LOAN_PAYMENT_DESC,
      });
    }
  });

  await logAuditEvent({
    shopId: context.shopId,
    actorUserId: context.userId,
    eventDate: payload.date,
    eventType: "DAILY_SUMMARY_UPSERT",
    entityType: "DAILY_SUMMARY",
    entityId: payload.date,
    payload: {
      totalSalesCash: payload.totalSalesCash,
      totalSalesUpi: payload.totalSalesUpi,
      marginApplied: payload.marginApplied,
      estimatedGrossProfit: estimatedGrossProfit.toFixed(2),
      localDailyLoanPayment: localDailyLoanPayment.toString(),
    },
  });

  revalidatePath("/daily-parta");
}

export async function addExpense(formData: FormData) {
  const context = await getTenantContext();
  if (!context) {
    throw new Error("Unauthorized tenant context.");
  }

  const parsed = expenseSchema.safeParse({
    date: normalizeBusinessDateInput(formData.get("date")),
    amount: formData.get("amount"),
    category: formData.get("category"),
    description: formData.get("description") ?? undefined,
  });

  if (!parsed.success) {
    throw new Error("Invalid expense payload.");
  }

  await assertTenantShopOwnership(context.shopId, context.userId);

  const payload = parsed.data;
  await assertBusinessDayUnlocked(context.shopId, payload.date);

  let insertedExpenseId: string | undefined;

  await db.transaction(async (tx) => {
    const [insertedExpense] = await tx.insert(expenses).values({
      shopId: context.shopId,
      expenseDate: payload.date,
      amount: payload.amount.toString(),
      category: payload.category,
      description: payload.description || null,
    }).returning({ id: expenses.id });

    insertedExpenseId = insertedExpense?.id;

    if (insertedExpenseId) {
      await upsertCurrentAccountMovementBySource(tx, {
        shopId: context.shopId,
        sourceType: "EXPENSE",
        sourceId: insertedExpenseId,
        movementDate: payload.date,
        movementType: "EXPENSE_OUTFLOW",
        amount: payload.amount.toString(),
        direction: -1,
        description: `Expense outflow (${payload.category})`,
        notes: payload.description || undefined,
      });
    }
  });

  await logAuditEvent({
    shopId: context.shopId,
    actorUserId: context.userId,
    eventDate: payload.date,
    eventType: "EXPENSE_ADDED",
    entityType: "EXPENSE",
    entityId: insertedExpenseId,
    payload: {
      amount: payload.amount,
      category: payload.category,
      description: payload.description || null,
    },
  });

  revalidatePath("/daily-parta");
}

const voidSchema = z.object({
  summaryId: z.string().uuid(),
  reason: z.string().trim().min(3).max(500),
});

export async function voidDailyEntry(formData: FormData) {
  const context = await getTenantContext();
  if (!context) {
    throw new Error("Unauthorized tenant context.");
  }

  const parsed = voidSchema.safeParse({
    summaryId: formData.get("summaryId"),
    reason: formData.get("reason"),
  });

  if (!parsed.success) {
    throw new Error("Invalid void payload. Reason is required (min 3 characters).");
  }

  const { summaryId, reason } = parsed.data;

  const [summary] = await db
    .select({
      id: dailySummaries.id,
      summaryDate: dailySummaries.summaryDate,
      isVoided: dailySummaries.isVoided,
      totalSalesCash: dailySummaries.totalSalesCash,
      totalSalesUpi: dailySummaries.totalSalesUpi,
      marginApplied: dailySummaries.marginApplied,
      estimatedGrossProfit: dailySummaries.estimatedGrossProfit,
    })
    .from(dailySummaries)
    .where(and(eq(dailySummaries.id, summaryId), eq(dailySummaries.shopId, context.shopId)))
    .limit(1);

  if (!summary) {
    throw new Error("Daily summary not found.");
  }

  if (summary.isVoided) {
    throw new Error("This entry is already voided.");
  }

  await assertBusinessDayUnlocked(context.shopId, summary.summaryDate);

  const voidedAt = new Date();

  let correctionId: string | undefined;

  await db.transaction(async (tx) => {
    await tx
      .update(dailySummaries)
      .set({ isVoided: true, voidReason: reason, updatedAt: voidedAt })
      .where(eq(dailySummaries.id, summaryId));

    const [correction] = await tx.insert(corrections).values({
      shopId: context.shopId,
      entityType: "DAILY_SUMMARY",
      entityId: summaryId,
      reason,
      correctedBy: context.userId,
    }).returning({ id: corrections.id });

    correctionId = correction?.id;

    await upsertCurrentAccountMovementBySource(tx, {
      shopId: context.shopId,
      sourceType: "SALES",
      sourceId: summaryId,
      movementDate: summary.summaryDate,
      movementType: "SALES_INFLOW",
      amount: "0",
      direction: 1,
      description: "Daily sales inflow removed due to void",
      notes: reason,
    });
  });

  await logAuditEvent({
    shopId: context.shopId,
    actorUserId: context.userId,
    eventDate: summary.summaryDate,
    eventType: "DAILY_SUMMARY_VOIDED",
    entityType: "DAILY_SUMMARY",
    entityId: summaryId,
    payload: {
      reason,
      correctionId,
      voidedAt: voidedAt.toISOString(),
      preVoid: {
        totalSalesCash: summary.totalSalesCash,
        totalSalesUpi: summary.totalSalesUpi,
        marginApplied: summary.marginApplied,
        estimatedGrossProfit: summary.estimatedGrossProfit,
      },
    },
  });

  revalidatePath("/daily-parta");
}