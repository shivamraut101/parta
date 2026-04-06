import Decimal from "decimal.js";
import { and, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { dailySummaries, expenses, financialConfigs } from "@/db/schema";
import { calculateDailyInterest } from "@/lib/finance/calculateDailyInterest";

export type DailyNetProfitBreakdown = {
  grossProfit: Decimal;
  dailyDrains: Decimal;
  totalExpenses: Decimal;
  netParta: Decimal;
};

export async function calculateDailyNetProfit(
  shopId: string,
  summaryDate: string,
): Promise<DailyNetProfitBreakdown> {
  const [summary] = await db
    .select({
      totalSalesCash: dailySummaries.totalSalesCash,
      totalSalesUpi: dailySummaries.totalSalesUpi,
      marginApplied: dailySummaries.marginApplied,
    })
    .from(dailySummaries)
    .where(
      and(eq(dailySummaries.shopId, shopId), eq(dailySummaries.summaryDate, summaryDate)),
    )
    .limit(1);

  const [config] = await db
    .select({
      ccLimit: financialConfigs.ccLimit,
      bankInterestRatePa: financialConfigs.bankInterestRatePa,
      dailyLocalDrain: financialConfigs.dailyLocalDrain,
    })
    .from(financialConfigs)
    .where(eq(financialConfigs.shopId, shopId))
    .limit(1);

  const [expenseAgg] = await db
    .select({
      total: sql<string>`coalesce(sum(${expenses.amount}), '0')`,
    })
    .from(expenses)
    .where(and(eq(expenses.shopId, shopId), eq(expenses.expenseDate, summaryDate)));

  const totalSales = new Decimal(summary?.totalSalesCash ?? "0").add(
    new Decimal(summary?.totalSalesUpi ?? "0"),
  );
  const marginMultiplier = new Decimal(summary?.marginApplied ?? "0").div(100);
  const grossProfit = totalSales.mul(marginMultiplier);

  const dailyLocalDrain = new Decimal(config?.dailyLocalDrain ?? "0");
  const dailyInterest = calculateDailyInterest(config?.ccLimit ?? "0", config?.bankInterestRatePa ?? "0");
  const dailyDrains = dailyLocalDrain.add(dailyInterest);

  const totalExpenses = new Decimal(expenseAgg?.total ?? "0");
  const netParta = grossProfit.minus(dailyDrains).minus(totalExpenses);

  return {
    grossProfit,
    dailyDrains,
    totalExpenses,
    netParta,
  };
}
