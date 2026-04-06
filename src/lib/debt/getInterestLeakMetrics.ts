import Decimal from "decimal.js";
import { and, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { debtPayments, financialConfigs } from "@/db/schema";
import { normalizeAnnualRate, normalizeMonthlyRate } from "@/lib/finance/normalizeRate";

export type InterestLeakMetrics = {
  ccOutstanding: Decimal;
  localOutstanding: Decimal;
  ccPerDay: Decimal;
  localPerDay: Decimal;
  totalPerDay: Decimal;
  totalPerHour: Decimal;
};

export async function getInterestLeakMetrics(shopId: string): Promise<InterestLeakMetrics> {
  const [config] = await db
    .select({
      ccLimit: financialConfigs.ccLimit,
      bankInterestRatePa: financialConfigs.bankInterestRatePa,
      dailyLocalDrain: financialConfigs.dailyLocalDrain,
      localLoanAprMonthly: financialConfigs.localLoanAprMonthly,
    })
    .from(financialConfigs)
    .where(eq(financialConfigs.shopId, shopId))
    .limit(1);

  if (!config) {
    throw new Error("Missing financial config for interest leak metrics.");
  }

  const [bankPaidAgg] = await db
    .select({
      total: sql<string>`coalesce(sum(${debtPayments.amount}), '0')`,
    })
    .from(debtPayments)
    .where(
      and(eq(debtPayments.shopId, shopId), eq(debtPayments.targetType, "BANK_CC")),
    );

  const [localPaidAgg] = await db
    .select({
      total: sql<string>`coalesce(sum(${debtPayments.amount}), '0')`,
    })
    .from(debtPayments)
    .where(
      and(eq(debtPayments.shopId, shopId), eq(debtPayments.targetType, "LOCAL_LOAN")),
    );

  const ccLimit = new Decimal(config.ccLimit);
  const ccOutstanding = Decimal.max(ccLimit.minus(bankPaidAgg?.total ?? "0"), 0);
  const bankAnnualRate = normalizeAnnualRate(config.bankInterestRatePa);
  const localAnnualRate = normalizeMonthlyRate(config.localLoanAprMonthly).mul(12);
  const configuredLocalDrain = new Decimal(config.dailyLocalDrain);
  const paidToLocal = new Decimal(localPaidAgg?.total ?? "0");

  const inferredLocalOutstanding = localAnnualRate.gt(0)
    ? configuredLocalDrain.mul(365).div(localAnnualRate)
    : new Decimal(0);

  const localOutstanding = Decimal.max(inferredLocalOutstanding.minus(paidToLocal), 0);

  const ccPerDay = ccOutstanding.mul(bankAnnualRate).div(365);
  const localPerDay = localOutstanding.mul(localAnnualRate).div(365);

  const totalPerDay = ccPerDay.add(localPerDay);
  const totalPerHour = totalPerDay.div(24);

  return {
    ccOutstanding,
    localOutstanding,
    ccPerDay,
    localPerDay,
    totalPerDay,
    totalPerHour,
  };
}
