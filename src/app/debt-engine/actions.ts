"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { debtPayments, shops } from "@/db/schema";
import { logAuditEvent } from "@/lib/audit/logAuditEvent";
import { assertBusinessDayUnlocked } from "@/lib/lock/assertBusinessDayUnlocked";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { normalizeBusinessDateInput } from "@/lib/time/businessDate";

const debtTargetTypeSchema = z.enum(["BANK_CC", "LOCAL_LOAN"]);
const debtPaymentSourceSchema = z.enum(["CASH", "UPI"]);

const debtPaymentSchema = z.object({
  amount: z.coerce.number().positive(),
  date: z.string().min(1),
  targetType: debtTargetTypeSchema,
  source: debtPaymentSourceSchema,
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

export async function recordDebtPayment(formData: FormData) {
  const context = await getTenantContext();

  if (!context) {
    throw new Error("Unauthorized tenant context.");
  }

  const parsed = debtPaymentSchema.safeParse({
    amount: formData.get("amount"),
    date: normalizeBusinessDateInput(formData.get("date")),
    targetType: formData.get("targetType"),
    source: formData.get("source"),
  });

  if (!parsed.success) {
    throw new Error("Invalid debt payment payload.");
  }

  await assertTenantShopOwnership(context.shopId, context.userId);

  const payload = parsed.data;
  await assertBusinessDayUnlocked(context.shopId, payload.date);

  const [insertedPayment] = await db.insert(debtPayments).values({
    shopId: context.shopId,
    amount: payload.amount.toString(),
    paymentDate: payload.date,
    targetType: payload.targetType,
    source: payload.source,
  }).returning({ id: debtPayments.id });

  await logAuditEvent({
    shopId: context.shopId,
    actorUserId: context.userId,
    eventDate: payload.date,
    eventType: "DEBT_PAYMENT_RECORDED",
    entityType: "DEBT_PAYMENT",
    entityId: insertedPayment?.id,
    payload: {
      amount: payload.amount,
      targetType: payload.targetType,
      source: payload.source,
    },
  });

  revalidatePath("/debt-engine");
}
