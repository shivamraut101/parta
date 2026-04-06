import { asc, eq } from "drizzle-orm";
import { cache } from "react";

import { db } from "@/db";
import { financialConfigs, shops } from "@/db/schema";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type TenantContext = {
  userId: string;
  shopId: string;
  shopName: string;
  brand: {
    logoUrl: string | null;
    primaryColor: string;
    brandName: string;
    currencySymbol: string;
  };
  financialConfig: {
    ccLimit: string;
    bankInterestRatePa: string;
    dailyLocalDrain: string;
    localLoanAprMonthly: string;
    baseMarginDefault: string;
  };
};

export const getTenantContext = cache(async function getTenantContextImpl(): Promise<TenantContext | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  const rows = await db
    .select({
      shopId: shops.id,
      shopName: shops.name,
      logoUrl: shops.logoUrl,
      primaryColor: shops.primaryColor,
      brandName: shops.brandName,
      currencySymbol: shops.currencySymbol,
      ccLimit: financialConfigs.ccLimit,
      bankInterestRatePa: financialConfigs.bankInterestRatePa,
      dailyLocalDrain: financialConfigs.dailyLocalDrain,
      localLoanAprMonthly: financialConfigs.localLoanAprMonthly,
      baseMarginDefault: financialConfigs.baseMarginDefault,
    })
    .from(shops)
    .leftJoin(financialConfigs, eq(financialConfigs.shopId, shops.id))
    .where(eq(shops.ownerId, user.id))
    .orderBy(asc(shops.createdAt))
    .limit(1);

  const row = rows[0];

  if (!row) {
    return null;
  }

  return {
    userId: user.id,
    shopId: row.shopId,
    shopName: row.shopName,
    brand: {
      logoUrl: row.logoUrl,
      primaryColor: row.primaryColor ?? "#0f766e",
      brandName: row.brandName ?? row.shopName,
      currencySymbol: row.currencySymbol ?? "₹",
    },
    financialConfig: {
      ccLimit: row.ccLimit ?? "0",
      bankInterestRatePa: row.bankInterestRatePa ?? "0",
      dailyLocalDrain: row.dailyLocalDrain ?? "0",
      localLoanAprMonthly: row.localLoanAprMonthly ?? "0",
      baseMarginDefault: row.baseMarginDefault ?? "20",
    },
  };
});
