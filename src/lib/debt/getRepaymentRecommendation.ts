import Decimal from "decimal.js";
import { and, desc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { dailySummaries, debtPayments, financialConfigs } from "@/db/schema";
import { normalizeAnnualRate, normalizeMonthlyRate } from "@/lib/finance/normalizeRate";

export type DebtTarget = "BANK_CC" | "LOCAL_LOAN";

export type RepaymentRecommendation = {
  priorityTarget: DebtTarget;
  bankAnnualRate: Decimal;
  localAnnualRate: Decimal;
  annualRate: Decimal;
  idleCash: Decimal;
  recommendedPayment: Decimal;
  savingsPerDay: Decimal;
  savingsPerMonth: Decimal;
};

function annualizeLocalRate(monthlyRate: Decimal): Decimal {
  return monthlyRate.mul(12);
}

export async function getRepaymentRecommendation(
  shopId: string,
): Promise<RepaymentRecommendation> {
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
    throw new Error("Missing financial config for repayment recommendation.");
  }

  const [latestSummary] = await db
    .select({
      totalSalesCash: dailySummaries.totalSalesCash,
      totalSalesUpi: dailySummaries.totalSalesUpi,
    })
    .from(dailySummaries)
    .where(eq(dailySummaries.shopId, shopId))
    .orderBy(desc(dailySummaries.summaryDate))
    .limit(1);

  const [bankPaidAgg] = await db
    .select({
      total: sql<string>`coalesce(sum(${debtPayments.amount}), '0')`,
    })
    .from(debtPayments)
    .where(
      and(
        eq(debtPayments.shopId, shopId),
        eq(debtPayments.targetType, "BANK_CC"),
      ),
    );

  const [localPaidAgg] = await db
    .select({
      total: sql<string>`coalesce(sum(${debtPayments.amount}), '0')`,
    })
    .from(debtPayments)
    .where(
      and(
        eq(debtPayments.shopId, shopId),
        eq(debtPayments.targetType, "LOCAL_LOAN"),
      ),
    );

  const bankRate = normalizeAnnualRate(config.bankInterestRatePa);
  const localRate = annualizeLocalRate(normalizeMonthlyRate(config.localLoanAprMonthly));

  const priorityTarget: DebtTarget = localRate.gt(bankRate) ? "LOCAL_LOAN" : "BANK_CC";
  const annualRate = priorityTarget === "LOCAL_LOAN" ? localRate : bankRate;

  const idleCash = new Decimal(latestSummary?.totalSalesCash ?? "0").add(
    new Decimal(latestSummary?.totalSalesUpi ?? "0"),
  );

  const ccLimit = new Decimal(config.ccLimit);
  const bankOutstanding = Decimal.max(ccLimit.minus(bankPaidAgg?.total ?? "0"), 0);
  const configuredLocalDrain = new Decimal(config.dailyLocalDrain);
  const paidToLocal = new Decimal(localPaidAgg?.total ?? "0");
  const inferredLocalOutstanding = localRate.gt(0)
    ? configuredLocalDrain.mul(365).div(localRate)
    : new Decimal(0);
  const localOutstanding = Decimal.max(inferredLocalOutstanding.minus(paidToLocal), 0);

  const targetOutstanding = priorityTarget === "LOCAL_LOAN" ? localOutstanding : bankOutstanding;

  const recommendedPayment = Decimal.min(idleCash, targetOutstanding);
  const savingsPerDay = recommendedPayment.mul(annualRate).div(365);
  const savingsPerMonth = savingsPerDay.mul(30);

  return {
    priorityTarget,
    bankAnnualRate: bankRate,
    localAnnualRate: localRate,
    annualRate,
    idleCash,
    recommendedPayment,
    savingsPerDay,
    savingsPerMonth,
  };
}
