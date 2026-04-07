import Decimal from "decimal.js";
import { and, desc, eq, gte, lte, or, sql } from "drizzle-orm";
import { redirect } from "next/navigation";

import { LOCAL_DAILY_LOAN_PAYMENT_DESC } from "@/app/daily-parta/constants";
import { DailyPartaForm } from "@/app/daily-parta/DailyPartaForm";
import { DailyPartaHistoryClient } from "@/app/daily-parta/DailyPartaHistoryClient";
import { db } from "@/db";
import { dailySummaries, expenses } from "@/db/schema";
import { calculateDailyInterest } from "@/lib/finance/calculateDailyInterest";
import { calculateDailyNetProfit } from "@/lib/finance/calculateDailyNetProfit";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { getBusinessDateDaysAgo, getBusinessDateString } from "@/lib/time/businessDate";

export const dynamic = "force-dynamic";

export default async function DailyPartaPage() {
  const tenant = await getTenantContext();

  if (!tenant) {
    redirect("/");
  }

  const todayString = getBusinessDateString();
  const sevenDaysAgoString = getBusinessDateDaysAgo(6);

  const [todayExpenseAgg] = await db
    .select({
      total: sql<string>`coalesce(sum(${expenses.amount}), '0')`,
      count: sql<number>`count(*)::int`,
    })
    .from(expenses)
    .where(
      and(
        eq(expenses.shopId, tenant.shopId),
        eq(expenses.expenseDate, todayString),
        or(
          sql`${expenses.description} is null`,
          sql`${expenses.description} <> ${LOCAL_DAILY_LOAN_PAYMENT_DESC}`,
        ),
      ),
    );

  const [todayLocalDailyLoanAgg] = await db
    .select({
      total: sql<string>`coalesce(sum(${expenses.amount}), '0')`,
    })
    .from(expenses)
    .where(
      and(
        eq(expenses.shopId, tenant.shopId),
        eq(expenses.expenseDate, todayString),
        eq(expenses.description, LOCAL_DAILY_LOAN_PAYMENT_DESC),
      ),
    );

  const dailyDrains = new Decimal(tenant.financialConfig.dailyLocalDrain).add(
    calculateDailyInterest(
      tenant.financialConfig.ccLimit,
      tenant.financialConfig.bankInterestRatePa,
    ),
  );

  const recentSummaries = await db
    .select({
      id: dailySummaries.id,
      date: dailySummaries.summaryDate,
      estimatedGrossProfit: dailySummaries.estimatedGrossProfit,
      isVoided: dailySummaries.isVoided,
      voidReason: dailySummaries.voidReason,
    })
    .from(dailySummaries)
    .where(
      and(
        eq(dailySummaries.shopId, tenant.shopId),
        gte(dailySummaries.summaryDate, sevenDaysAgoString),
        lte(dailySummaries.summaryDate, todayString),
      ),
    )
    .orderBy(desc(dailySummaries.summaryDate))
    .limit(7);

  const recentWithNet = await Promise.all(
    recentSummaries.map(async (summary) => {
      const breakdown = await calculateDailyNetProfit(tenant.shopId, summary.date);

      return {
        id: summary.id,
        date: summary.date,
        grossProfit: String(summary.estimatedGrossProfit),
        netParta: breakdown.netParta.toString(),
        isVoided: summary.isVoided,
        voidReason: summary.voidReason,
      };
    }),
  );

  return (
    <main className="mx-auto w-full max-w-lg px-4 pb-24 pt-4">
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">Galla</p>
        <h1 className="text-2xl font-black text-stone-900">Aaj Ka Hisaab</h1>
        <p className="mt-0.5 text-sm text-stone-500">{tenant.shopName}</p>
      </div>

      <DailyPartaForm
        defaultDate={todayString}
        defaultMargin={tenant.financialConfig.baseMarginDefault}
        dailyDrains={dailyDrains.toString()}
        persistedExpenseTotal={todayExpenseAgg?.total ?? "0"}
        persistedExpenseCount={todayExpenseAgg?.count ?? 0}
        persistedLocalDailyLoanPayment={todayLocalDailyLoanAgg?.total ?? "0"}
      />

      <section className="mt-5">
        <DailyPartaHistoryClient items={recentWithNet} />
      </section>
    </main>
  );
}
