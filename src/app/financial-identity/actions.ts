"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";

import { db } from "@/db";
import { currentAccountAccounts, financialConfigs, shops } from "@/db/schema";
import { logAuditEvent } from "@/lib/audit/logAuditEvent";
import { recomputeCurrentAccountBalances } from "@/lib/finance/currentAccountLedger";
import { normalizeAnnualRate, normalizeMonthlyRate } from "@/lib/finance/normalizeRate";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { normalizeBusinessDateInput } from "@/lib/time/businessDate";

const optionalNumber = (defaultValue: number) =>
  z.preprocess(
    (value) => {
      if (value === null || value === undefined) return defaultValue;
      if (typeof value === "string" && value.trim() === "") return defaultValue;
      return value;
    },
    z.coerce.number(),
  );

const debtProfileSchema = z.object({
  ccLimit: optionalNumber(0).pipe(z.number().min(0)),
  bankInterestRatePa: optionalNumber(0).pipe(z.number().min(0)),
  dailyLocalDrain: optionalNumber(0).pipe(z.number().min(0)),
  localLoanAprMonthly: optionalNumber(0).pipe(z.number().min(0).max(100)),
  baseMarginDefault: optionalNumber(20).pipe(z.number().min(0)),
  enableCurrentAccount: z.boolean().default(false),
  currentAccountName: z.string().trim().max(160).optional(),
  currentAccountNumber: z.string().trim().max(50).optional(),
  currentBankName: z.string().trim().max(160).optional(),
  currentIfscCode: z.string().trim().max(20).optional(),
  currentAccountOpeningBalance: optionalNumber(0).pipe(z.number().min(0)),
  currentAccountStartDate: z.string().optional(),
  currentAccountNotes: z.string().trim().max(500).optional(),
});

export async function updateDebtProfile(formData: FormData) {
  const context = await getTenantContext();

  if (!context) {
    throw new Error("Unauthorized tenant context.");
  }

  const parsed = debtProfileSchema.safeParse({
    ccLimit: 0,
    bankInterestRatePa: 0,
    dailyLocalDrain: 0,
    localLoanAprMonthly: 0,
    baseMarginDefault: formData.get("baseMarginDefault"),
    enableCurrentAccount:
      (formData.get("enableCurrentAccount")?.toString() || "").toLowerCase() === "on"
      || (formData.get("enableCurrentAccount")?.toString() || "").toLowerCase() === "true",
    currentAccountName: (formData.get("currentAccountName")?.toString() || "").trim() || undefined,
    currentAccountNumber: (formData.get("currentAccountNumber")?.toString() || "").trim() || undefined,
    currentBankName: (formData.get("currentBankName")?.toString() || "").trim() || undefined,
    currentIfscCode: (formData.get("currentIfscCode")?.toString() || "").trim() || undefined,
    currentAccountOpeningBalance: formData.get("currentAccountOpeningBalance") || "0",
    currentAccountStartDate: normalizeBusinessDateInput(formData.get("currentAccountStartDate")) || undefined,
    currentAccountNotes: (formData.get("currentAccountNotes")?.toString() || "").trim() || undefined,
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

  await db.transaction(async (tx) => {
    await tx
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

    if (payload.enableCurrentAccount) {
      const safeAccountName = payload.currentAccountName?.trim() || "Current Account";

      await tx
        .insert(currentAccountAccounts)
        .values({
          shopId: context.shopId,
          accountName: safeAccountName,
          accountNumber: payload.currentAccountNumber || null,
          bankName: payload.currentBankName || null,
          ifscCode: payload.currentIfscCode || null,
          openingBalance: payload.currentAccountOpeningBalance.toFixed(2),
          startDate: payload.currentAccountStartDate || null,
          notes: payload.currentAccountNotes || null,
          currentBalance: payload.currentAccountOpeningBalance.toFixed(2),
        })
        .onConflictDoUpdate({
          target: currentAccountAccounts.shopId,
          set: {
            accountName: safeAccountName,
            accountNumber: payload.currentAccountNumber || null,
            bankName: payload.currentBankName || null,
            ifscCode: payload.currentIfscCode || null,
            openingBalance: payload.currentAccountOpeningBalance.toFixed(2),
            startDate: payload.currentAccountStartDate || null,
            notes: payload.currentAccountNotes || null,
            updatedAt: new Date(),
          },
        });

      await recomputeCurrentAccountBalances(tx, context.shopId, safeAccountName);
    }
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
      enableCurrentAccount: payload.enableCurrentAccount,
      currentAccountName: payload.currentAccountName || null,
      currentAccountOpeningBalance: payload.enableCurrentAccount ? payload.currentAccountOpeningBalance : null,
    },
  });

  redirect("/financial-identity?saved=1");
}
