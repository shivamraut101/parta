import Decimal from "decimal.js";
import { and, eq, gte, lte, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  dailySummaries,
  debtPayments,
  expenses,
  financialConfigs,
  monthlySnapshots,
} from "@/db/schema";
import { calculateDailyInterest } from "@/lib/finance/calculateDailyInterest";

/**
 * Aggregates all daily data for the given month (YYYY-MM format) and upserts
 * into monthly_snapshots.  Returns the upserted snapshot data.
 */
export async function generateMonthlySnapshot(
  shopId: string,
  monthYear: string, // e.g. "2026-03"
): Promise<{
  monthYear: string;
  totalSales: Decimal;
  totalInterestPaid: Decimal;
  totalExpenses: Decimal;
  totalNetProfit: Decimal;
  turnoverVelocity: Decimal;
}> {
  if (!/^\d{4}-\d{2}$/.test(monthYear)) {
    throw new Error("monthYear must be in YYYY-MM format.");
  }

  const [year, month] = monthYear.split("-").map(Number);
  const fromDate = `${monthYear}-01`;
  const toDate = new Date(year!, month!, 0) // last day of month
    .toLocaleDateString("en-CA");

  const [config] = await db
    .select({
      ccLimit: financialConfigs.ccLimit,
      bankInterestRatePa: financialConfigs.bankInterestRatePa,
      dailyLocalDrain: financialConfigs.dailyLocalDrain,
    })
    .from(financialConfigs)
    .where(eq(financialConfigs.shopId, shopId))
    .limit(1);

  // How many days had a daily summary (basis for interest calc)
  const summaryRows = await db
    .select({
      summaryDate: dailySummaries.summaryDate,
      totalSalesCash: dailySummaries.totalSalesCash,
      totalSalesUpi: dailySummaries.totalSalesUpi,
      marginApplied: dailySummaries.marginApplied,
      isVoided: dailySummaries.isVoided,
    })
    .from(dailySummaries)
    .where(
      and(
        eq(dailySummaries.shopId, shopId),
        gte(dailySummaries.summaryDate, fromDate),
        lte(dailySummaries.summaryDate, toDate),
      ),
    );

  const activeSummaries = summaryRows.filter((r) => !r.isVoided);
  const dayCount = activeSummaries.length;

  const totalSales = activeSummaries.reduce((acc, r) => {
    return acc.add(new Decimal(r.totalSalesCash)).add(new Decimal(r.totalSalesUpi));
  }, new Decimal(0));

  const totalGrossProfit = activeSummaries.reduce((acc, r) => {
    const sales = new Decimal(r.totalSalesCash).add(new Decimal(r.totalSalesUpi));
    return acc.add(sales.mul(new Decimal(r.marginApplied).div(100)));
  }, new Decimal(0));

  // Total expenses for the month
  const [expenseAgg] = await db
    .select({ total: sql<string>`coalesce(sum(${expenses.amount}), '0')` })
    .from(expenses)
    .where(
      and(
        eq(expenses.shopId, shopId),
        gte(expenses.expenseDate, fromDate),
        lte(expenses.expenseDate, toDate),
      ),
    );
  const totalExpenses = new Decimal(expenseAgg?.total ?? "0");

  // Total interest drain = daily rate × active business days
  const dailyInterest = config
    ? calculateDailyInterest(config.ccLimit, config.bankInterestRatePa)
    : new Decimal(0);
  const dailyLocalDrain = config ? new Decimal(config.dailyLocalDrain) : new Decimal(0);
  const dailyDrainPerDay = dailyInterest.add(dailyLocalDrain);
  const totalInterestPaid = dailyDrainPerDay.mul(dayCount);

  // Net profit = gross profit - interest drain - expenses
  const totalNetProfit = totalGrossProfit.minus(totalInterestPaid).minus(totalExpenses);

  // Debt payments in the month
  const [debtAgg] = await db
    .select({ total: sql<string>`coalesce(sum(${debtPayments.amount}), '0')` })
    .from(debtPayments)
    .where(
      and(
        eq(debtPayments.shopId, shopId),
        gte(debtPayments.paymentDate, fromDate),
        lte(debtPayments.paymentDate, toDate),
      ),
    );
  const totalDebtPaid = new Decimal(debtAgg?.total ?? "0");

  // Turnover velocity = sales / (interest_paid + debt_paid) — liquidity efficiency ratio
  const denominator = totalInterestPaid.add(totalDebtPaid);
  const turnoverVelocity = denominator.gt(0) ? totalSales.div(denominator) : new Decimal(0);

  await db
    .insert(monthlySnapshots)
    .values({
      shopId,
      monthYear,
      totalInterestPaid: totalInterestPaid.toFixed(2),
      totalNetProfit: totalNetProfit.toFixed(2),
      turnoverVelocity: turnoverVelocity.toFixed(6),
    })
    .onConflictDoUpdate({
      target: [monthlySnapshots.shopId, monthlySnapshots.monthYear],
      set: {
        totalInterestPaid: totalInterestPaid.toFixed(2),
        totalNetProfit: totalNetProfit.toFixed(2),
        turnoverVelocity: turnoverVelocity.toFixed(6),
      },
    });

  return {
    monthYear,
    totalSales,
    totalInterestPaid,
    totalExpenses,
    totalNetProfit,
    turnoverVelocity,
  };
}
