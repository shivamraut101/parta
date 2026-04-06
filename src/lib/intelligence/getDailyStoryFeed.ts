import Decimal from "decimal.js";
import { and, asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { debtPayments, suppliers } from "@/db/schema";
import { getInterestLeakMetrics } from "@/lib/debt/getInterestLeakMetrics";
import { getRepaymentRecommendation } from "@/lib/debt/getRepaymentRecommendation";
import { calculateDailyNetProfit } from "@/lib/finance/calculateDailyNetProfit";
import { getBusinessDateString } from "@/lib/time/businessDate";

type DailyStoryFeed = {
  morning: {
    interestDrainToday: Decimal;
    breakEvenSales: Decimal;
  };
  debtAlert: {
    higherDebtLabel: string;
    lowerDebtLabel: string;
    priorityLabel: string;
    ratioText: string;
    recommendedPayment: Decimal;
    hasComparison: boolean;
  };
  saakhAlert: {
    supplierId: string;
    supplierName: string;
    daysSincePayment: number;
    suggestedPayment: Decimal;
  } | null;
  nightly: {
    netProfitToday: Decimal;
    interestSavedToday: Decimal;
  };
};

export async function getDailyStoryFeed(
  shopId: string,
  baseMarginPercent: string,
): Promise<DailyStoryFeed> {
  const today = getBusinessDateString();

  const leak = await getInterestLeakMetrics(shopId);
  const recommendation = await getRepaymentRecommendation(shopId);

  const margin = new Decimal(baseMarginPercent || "0").div(100);
  const breakEvenSales = margin.gt(0) ? leak.totalPerDay.div(margin) : new Decimal(0);

  const bankRate = recommendation.bankAnnualRate;
  const localRate = recommendation.localAnnualRate;
  const higherIsLocal = localRate.gte(bankRate);
  const hasComparison = bankRate.gt(0) && localRate.gt(0);
  const comparisonRatio = hasComparison
    ? higherIsLocal
      ? localRate.div(bankRate)
      : bankRate.div(localRate)
    : null;

  const [saakhCandidate] = await db
    .select({
      id: suppliers.id,
      name: suppliers.name,
      currentBalance: suppliers.currentBalance,
      lastPaymentDate: suppliers.lastPaymentDate,
    })
    .from(suppliers)
    .where(eq(suppliers.shopId, shopId))
    .orderBy(asc(suppliers.lastPaymentDate));

  let saakhAlert: DailyStoryFeed["saakhAlert"] = null;
  if (saakhCandidate?.lastPaymentDate && new Decimal(saakhCandidate.currentBalance).gt(0)) {
    const daysSincePayment = Math.floor(
      (Date.now() - new Date(saakhCandidate.lastPaymentDate).getTime()) / (1000 * 60 * 60 * 24),
    );

    if (daysSincePayment >= 1) {
      saakhAlert = {
        supplierId: saakhCandidate.id,
        supplierName: saakhCandidate.name,
        daysSincePayment,
        suggestedPayment: Decimal.min(new Decimal(saakhCandidate.currentBalance), new Decimal(500)),
      };
    }
  }

  const net = await calculateDailyNetProfit(shopId, today);

  const debtPaymentsToday = await db
    .select({
      targetType: debtPayments.targetType,
      amount: debtPayments.amount,
    })
    .from(debtPayments)
    .where(and(eq(debtPayments.shopId, shopId), eq(debtPayments.paymentDate, today)));

  const interestSavedToday = debtPaymentsToday.reduce((sum, row) => {
    const rate = row.targetType === "LOCAL_LOAN" ? recommendation.localAnnualRate : recommendation.bankAnnualRate;
    return sum.add(new Decimal(row.amount).mul(rate).div(365));
  }, new Decimal(0));

  return {
    morning: {
      interestDrainToday: leak.totalPerDay,
      breakEvenSales,
    },
    debtAlert: {
      higherDebtLabel: higherIsLocal ? "Local Loan" : "Bank CC",
      lowerDebtLabel: higherIsLocal ? "Bank CC" : "Local Loan",
      priorityLabel: recommendation.priorityTarget === "LOCAL_LOAN" ? "Local Loan" : "Bank CC",
      ratioText: comparisonRatio ? `${comparisonRatio.toFixed(1)}x` : "N/A",
      recommendedPayment: recommendation.recommendedPayment,
      hasComparison,
    },
    saakhAlert,
    nightly: {
      netProfitToday: net.netParta,
      interestSavedToday,
    },
  };
}
