"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { db } from "@/db";
import { financialConfigs, shops } from "@/db/schema";
import { logAuditEvent } from "@/lib/audit/logAuditEvent";
import { normalizeAnnualRate, normalizeMonthlyRate } from "@/lib/finance/normalizeRate";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const createShopSchema = z.object({
  shopName: z.string().trim().min(2).max(160),
  brandName: z.string().trim().max(160).optional(),
  primaryColor: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  currencySymbol: z.string().trim().min(1).max(8).optional(),
  ccLimit: z.string().trim().regex(/^\d+(\.\d{1,2})?$/),
  bankInterestRatePa: z.string().trim().regex(/^\d+(\.\d{1,6})?$/),
  dailyLocalDrain: z.string().trim().regex(/^\d+(\.\d{1,2})?$/),
  localLoanAprMonthly: z.string().trim().regex(/^\d+(\.\d{1,6})?$/),
  baseMarginDefault: z.string().trim().regex(/^\d+(\.\d{1,6})?$/),
});

export async function createInitialShop(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("You must be signed in before creating a shop.");
  }

  const parsed = createShopSchema.safeParse({
    shopName: formData.get("shopName"),
    brandName: formData.get("brandName") ?? undefined,
    primaryColor: formData.get("primaryColor") ?? undefined,
    currencySymbol: formData.get("currencySymbol") ?? undefined,
    ccLimit: formData.get("ccLimit"),
    bankInterestRatePa: formData.get("bankInterestRatePa"),
    dailyLocalDrain: formData.get("dailyLocalDrain"),
    localLoanAprMonthly: formData.get("localLoanAprMonthly"),
    baseMarginDefault: formData.get("baseMarginDefault"),
  });

  if (!parsed.success) {
    throw new Error("Invalid shop setup payload.");
  }

  const payload = parsed.data;
  const normalizedBankAnnualRate = normalizeAnnualRate(payload.bankInterestRatePa).toString();
  const normalizedLocalMonthlyRate = normalizeMonthlyRate(payload.localLoanAprMonthly).toString();

  const [createdShop] = await db
    .insert(shops)
    .values({
      name: payload.shopName,
      ownerId: user.id,
      brandName: payload.brandName || payload.shopName,
      primaryColor: payload.primaryColor || "#0f766e",
      currencySymbol: payload.currencySymbol || "₹",
    })
    .returning({ id: shops.id });

  await db.insert(financialConfigs).values({
    shopId: createdShop.id,
    ccLimit: payload.ccLimit,
    bankInterestRatePa: normalizedBankAnnualRate,
    dailyLocalDrain: payload.dailyLocalDrain,
    localLoanAprMonthly: normalizedLocalMonthlyRate,
    baseMarginDefault: payload.baseMarginDefault,
  });

  await logAuditEvent({
    shopId: createdShop.id,
    actorUserId: user.id,
    eventType: "SHOP_ONBOARDED",
    entityType: "SHOP",
    entityId: createdShop.id,
    payload: {
      shopName: payload.shopName,
      brandName: payload.brandName || payload.shopName,
      ccLimit: payload.ccLimit,
      bankInterestRatePa: normalizedBankAnnualRate,
      dailyLocalDrain: payload.dailyLocalDrain,
      localLoanAprMonthly: normalizedLocalMonthlyRate,
      baseMarginDefault: payload.baseMarginDefault,
    },
  });

  redirect("/");
}
