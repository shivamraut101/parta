import Decimal from "decimal.js";
import { and, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { debtAccounts, debtPayments, financialConfigs } from "@/db/schema";
import { normalizeAnnualRate, normalizeMonthlyRate } from "@/lib/finance/normalizeRate";

export type InterestLeakMetrics = {
  ccOutstanding: Decimal;
  localOutstanding: Decimal;
  ccPerDay: Decimal;
  localPerDay: Decimal;
  totalPerDay: Decimal;
  totalPerHour: Decimal;
};

function getInstallmentDays(frequency: "DAILY" | "WEEKLY" | "MONTHLY" | "BULLET") {
  if (frequency === "DAILY") return 1;
  if (frequency === "WEEKLY") return 7;
  if (frequency === "MONTHLY") return 30;
  return 30;
}

function estimateAccountDailyDrain(account: {
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
  const annual = normalizeAnnualRate(account.annualRatePa || "0");
  const monthly = normalizeMonthlyRate(account.monthlyRate || "0");
  const dailyFixed = new Decimal(account.dailyFixedInterest || "0");
  const installmentAmount = new Decimal(account.installmentAmount || "0");
  const remainingInstallments = new Decimal(account.remainingInstallments || 0);

  if (account.rateInputType === "DAILY_FIXED") {
    return dailyFixed.gt(0) ? dailyFixed : new Decimal(0);
  }

  if (account.rateInputType === "ANNUAL_PERCENT") {
    return annual.gt(0) ? outstanding.mul(annual).div(365) : new Decimal(0);
  }

  if (account.rateInputType === "MONTHLY_PERCENT") {
    return monthly.gt(0) ? outstanding.mul(monthly.mul(12)).div(365) : new Decimal(0);
  }

  if ((account.rateInputType === "EMI_DAILY" || account.rateInputType === "EMI_MONTHLY") && installmentAmount.gt(0) && remainingInstallments.gt(0)) {
    const totalToPay = installmentAmount.mul(remainingInstallments);
    const interestPortion = Decimal.max(totalToPay.minus(outstanding), 0);
    const remainingDays = remainingInstallments.mul(getInstallmentDays(account.installmentFrequency));
    return remainingDays.gt(0) ? interestPortion.div(remainingDays) : new Decimal(0);
  }

  return new Decimal(0);
}

export async function getInterestLeakMetrics(shopId: string): Promise<InterestLeakMetrics> {
  let activeAccounts: Array<{
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

  if (activeAccounts.length > 0) {
    let ccOutstanding = new Decimal(0);
    let localOutstanding = new Decimal(0);
    let ccPerDay = new Decimal(0);
    let localPerDay = new Decimal(0);

    for (const account of activeAccounts) {
      const accountOutstanding = new Decimal(account.outstandingAmount || "0");
      const perDay = estimateAccountDailyDrain(account);
      if (account.kind.startsWith("BANK_")) {
        ccOutstanding = ccOutstanding.add(accountOutstanding);
        ccPerDay = ccPerDay.add(perDay);
      } else {
        localOutstanding = localOutstanding.add(accountOutstanding);
        localPerDay = localPerDay.add(perDay);
      }
    }

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
