"use server";

import Decimal from "decimal.js";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { corrections, dailySummaries, expenses, shops } from "@/db/schema";
import { logAuditEvent } from "@/lib/audit/logAuditEvent";
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
  });

  if (!parsed.success) {
    throw new Error("Invalid daily summary payload.");
  }

  await assertTenantShopOwnership(context.shopId, context.userId);

  const payload = parsed.data;
  await assertBusinessDayUnlocked(context.shopId, payload.date);

  const totalSales = new Decimal(payload.totalSalesCash).add(payload.totalSalesUpi);
  const estimatedGrossProfit = totalSales.mul(new Decimal(payload.marginApplied).div(100));

  await db
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

  const [insertedExpense] = await db.insert(expenses).values({
    shopId: context.shopId,
    expenseDate: payload.date,
    amount: payload.amount.toString(),
    category: payload.category,
    description: payload.description || null,
  }).returning({ id: expenses.id });

  await logAuditEvent({
    shopId: context.shopId,
    actorUserId: context.userId,
    eventDate: payload.date,
    eventType: "EXPENSE_ADDED",
    entityType: "EXPENSE",
    entityId: insertedExpense?.id,
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
    .select({ id: dailySummaries.id, summaryDate: dailySummaries.summaryDate, isVoided: dailySummaries.isVoided })
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

  await db
    .update(dailySummaries)
    .set({ isVoided: true, voidReason: reason })
    .where(eq(dailySummaries.id, summaryId));

  await db.insert(corrections).values({
    shopId: context.shopId,
    entityType: "DAILY_SUMMARY",
    entityId: summaryId,
    reason,
    correctedBy: context.userId,
  });

  await logAuditEvent({
    shopId: context.shopId,
    actorUserId: context.userId,
    eventDate: summary.summaryDate,
    eventType: "DAILY_SUMMARY_VOIDED",
    entityType: "DAILY_SUMMARY",
    entityId: summaryId,
    payload: { reason },
  });

  revalidatePath("/daily-parta");
}