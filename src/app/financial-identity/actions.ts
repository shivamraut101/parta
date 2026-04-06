"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";

import { db } from "@/db";
import { financialConfigs, shops } from "@/db/schema";
import { logAuditEvent } from "@/lib/audit/logAuditEvent";
import { normalizeAnnualRate, normalizeMonthlyRate } from "@/lib/finance/normalizeRate";
import { getTenantContext } from "@/lib/tenant/getTenantContext";

const debtProfileSchema = z.object({
  ccLimit: z.coerce.number().min(0),
  bankInterestRatePa: z.coerce.number().min(0),
  dailyLocalDrain: z.coerce.number().min(0),
  localLoanAprMonthly: z.coerce.number().min(0).max(100),
  baseMarginDefault: z.coerce.number().min(0),
});

export async function updateDebtProfile(formData: FormData) {
  const context = await getTenantContext();

  if (!context) {
    throw new Error("Unauthorized tenant context.");
  }

  const parsed = debtProfileSchema.safeParse({
    ccLimit: formData.get("ccLimit"),
    bankInterestRatePa: formData.get("bankInterestRatePa"),
    dailyLocalDrain: formData.get("dailyLocalDrain"),
    localLoanAprMonthly: formData.get("localLoanAprMonthly"),
    baseMarginDefault: formData.get("baseMarginDefault"),
  });

  if (!parsed.success) {
    throw new Error("Invalid financial profile payload.");
  }

  const payload = parsed.data;
  const normalizedBankAnnualRate = normalizeAnnualRate(payload.bankInterestRatePa).toString();
  const normalizedLocalMonthlyRate = normalizeMonthlyRate(payload.localLoanAprMonthly).toString();

  const matchingShop = await db
    .select({ id: shops.id })
    .from(shops)
    .where(and(eq(shops.id, context.shopId), eq(shops.ownerId, context.userId)))
    .limit(1);

  if (!matchingShop[0]) {
    throw new Error("Tenant ownership verification failed.");
  }

  await db
    .insert(financialConfigs)
    .values({
      shopId: context.shopId,
      ccLimit: payload.ccLimit.toString(),
      bankInterestRatePa: normalizedBankAnnualRate,
      dailyLocalDrain: payload.dailyLocalDrain.toString(),
      localLoanAprMonthly: normalizedLocalMonthlyRate,
      baseMarginDefault: payload.baseMarginDefault.toString(),
    })
    .onConflictDoUpdate({
      target: financialConfigs.shopId,
      set: {
        ccLimit: payload.ccLimit.toString(),
        bankInterestRatePa: normalizedBankAnnualRate,
        dailyLocalDrain: payload.dailyLocalDrain.toString(),
        localLoanAprMonthly: normalizedLocalMonthlyRate,
        baseMarginDefault: payload.baseMarginDefault.toString(),
        updatedAt: new Date(),
      },
    });

  await logAuditEvent({
    shopId: context.shopId,
    actorUserId: context.userId,
    eventType: "FINANCIAL_PROFILE_UPDATED",
    entityType: "FINANCIAL_CONFIG",
    entityId: context.shopId,
    payload: {
      ccLimit: payload.ccLimit,
      bankInterestRatePa: normalizedBankAnnualRate,
      dailyLocalDrain: payload.dailyLocalDrain,
      localLoanAprMonthly: normalizedLocalMonthlyRate,
      baseMarginDefault: payload.baseMarginDefault,
    },
  });

  redirect("/financial-identity?saved=1");
}
