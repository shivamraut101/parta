import Decimal from "decimal.js";
import { and, desc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { dailySummaries, debtAccounts, debtPayments, financialConfigs } from "@/db/schema";
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

function getInstallmentDays(frequency: "DAILY" | "WEEKLY" | "MONTHLY" | "BULLET") {
  if (frequency === "DAILY") return 1;
  if (frequency === "WEEKLY") return 7;
  if (frequency === "MONTHLY") return 30;
  return 30;
}

function estimateEffectiveAnnualRate(account: {
  rateInputType: "ANNUAL_PERCENT" | "MONTHLY_PERCENT" | "DAILY_FIXED" | "EMI_DAILY" | "EMI_MONTHLY";
  outstandingAmount: string;
  annualRatePa: string;
  monthlyRate: string;
  dailyFixedInterest: string;
  installmentAmount: string;
  remainingInstallments: number;
  installmentFrequency: "DAILY" | "WEEKLY" | "MONTHLY" | "BULLET";
}) {
  const outstanding = new Decimal(account.outstandingAmount || "0");
  if (outstanding.lte(0)) return new Decimal(0);

  if (account.rateInputType === "ANNUAL_PERCENT") {
    return normalizeAnnualRate(account.annualRatePa || "0");
  }

  if (account.rateInputType === "MONTHLY_PERCENT") {
    return normalizeMonthlyRate(account.monthlyRate || "0").mul(12);
  }

  if (account.rateInputType === "DAILY_FIXED") {
    const dailyFixed = new Decimal(account.dailyFixedInterest || "0");
    return dailyFixed.gt(0) ? dailyFixed.mul(365).div(outstanding) : new Decimal(0);
  }

  const installmentAmount = new Decimal(account.installmentAmount || "0");
  const remainingInstallments = new Decimal(account.remainingInstallments || 0);
  if (installmentAmount.gt(0) && remainingInstallments.gt(0)) {
    const totalToPay = installmentAmount.mul(remainingInstallments);
    const interestPortion = Decimal.max(totalToPay.minus(outstanding), 0);
    const remainingDays = remainingInstallments.mul(getInstallmentDays(account.installmentFrequency));
    if (remainingDays.lte(0)) return new Decimal(0);
    const dailyInterest = interestPortion.div(remainingDays);
    return dailyInterest.mul(365).div(outstanding);
  }

  return new Decimal(0);
}

export async function getRepaymentRecommendation(
  shopId: string,
): Promise<RepaymentRecommendation> {
  let activeAccounts: Array<{
    id: string;
    kind: string;
    rateInputType: "ANNUAL_PERCENT" | "MONTHLY_PERCENT" | "DAILY_FIXED" | "EMI_DAILY" | "EMI_MONTHLY";
    outstandingAmount: string;
    annualRatePa: string;
    monthlyRate: string;
    dailyFixedInterest: string;
    installmentAmount: string;
    remainingInstallments: number;
    installmentFrequency: "DAILY" | "WEEKLY" | "MONTHLY" | "BULLET";
  }> = [];

  try {
    activeAccounts = await db
      .select({
        id: debtAccounts.id,
        kind: debtAccounts.kind,
        rateInputType: debtAccounts.rateInputType,
        outstandingAmount: debtAccounts.outstandingAmount,
        annualRatePa: debtAccounts.annualRatePa,
        monthlyRate: debtAccounts.monthlyRate,
        dailyFixedInterest: debtAccounts.dailyFixedInterest,
        installmentAmount: debtAccounts.installmentAmount,
        remainingInstallments: debtAccounts.remainingInstallments,
        installmentFrequency: debtAccounts.installmentFrequency,
      })
      .from(debtAccounts)
      .where(and(eq(debtAccounts.shopId, shopId), eq(debtAccounts.isActive, true)));
  } catch {
    activeAccounts = [];
  }

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

  if (activeAccounts.length > 0) {
    const candidates = activeAccounts.map((account) => {
      const annualRate = estimateEffectiveAnnualRate(account);
      const outstanding = new Decimal(account.outstandingAmount || "0");
      return {
        annualRate,
        outstanding,
        targetType: account.kind.startsWith("BANK_") ? "BANK_CC" as DebtTarget : "LOCAL_LOAN" as DebtTarget,
      };
    });

    const sorted = candidates.sort((a, b) => b.annualRate.comparedTo(a.annualRate));
    const top = sorted[0];
    const recommendedPayment = Decimal.min(idleCash, top?.outstanding ?? 0);
    const annualRate = top?.annualRate ?? new Decimal(0);
    const savingsPerDay = recommendedPayment.mul(annualRate).div(365);
    const savingsPerMonth = savingsPerDay.mul(30);

    return {
      priorityTarget: top?.targetType ?? "BANK_CC",
      bankAnnualRate: bankRate,
      localAnnualRate: localRate,
      annualRate,
      idleCash,
      recommendedPayment,
      savingsPerDay,
      savingsPerMonth,
    };
  }

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
