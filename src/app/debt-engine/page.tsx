import Decimal from "decimal.js";
import { and, asc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { DebtOptimizerCard } from "@/app/debt-engine/DebtOptimizerCard";
import { db } from "@/db";
import { debtAccounts } from "@/db/schema";
import { getInterestLeakMetrics } from "@/lib/debt/getInterestLeakMetrics";
import { getRepaymentRecommendation } from "@/lib/debt/getRepaymentRecommendation";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { getBusinessDateString } from "@/lib/time/businessDate";

export const dynamic = "force-dynamic";

function formatCurrency(value: Decimal) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(Number(value.toFixed(2)));
}

export default async function DebtEnginePage() {
  const tenant = await getTenantContext();

  if (!tenant) {
    redirect("/");
  }

  const recommendation = await getRepaymentRecommendation(tenant.shopId);
  const leakMetrics = await getInterestLeakMetrics(tenant.shopId);
  let accounts: Array<{
    id: string;
    name: string;
    kind: "BANK_CC" | "BANK_TERM_LOAN" | "BANK_OD" | "BANK_BILL_DISCOUNT" | "LOCAL_DAILY" | "LOCAL_MONTHLY" | "LOCAL_BULLET" | "LOCAL_FLEXI";
    outstandingAmount: string;
    annualRatePa: string;
    monthlyRate: string;
    dailyFixedInterest: string;
    rateInputType: "ANNUAL_PERCENT" | "MONTHLY_PERCENT" | "DAILY_FIXED" | "EMI_DAILY" | "EMI_MONTHLY";
  }> = [];

  try {
    accounts = await db
      .select({
        id: debtAccounts.id,
        name: debtAccounts.name,
        kind: debtAccounts.kind,
        outstandingAmount: debtAccounts.outstandingAmount,
        annualRatePa: debtAccounts.annualRatePa,
        monthlyRate: debtAccounts.monthlyRate,
        dailyFixedInterest: debtAccounts.dailyFixedInterest,
        rateInputType: debtAccounts.rateInputType,
      })
      .from(debtAccounts)
      .where(and(eq(debtAccounts.shopId, tenant.shopId), eq(debtAccounts.isActive, true)))
      .orderBy(asc(debtAccounts.name));
  } catch {
    accounts = [];
  }

  return (
    <main className="mx-auto w-full max-w-lg px-4 pb-24 pt-4">
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">Karj</p>
        <h1 className="text-2xl font-black text-stone-900">Debt Engine</h1>
        <p className="mt-0.5 text-sm text-stone-500">Pehle mehenga byaaj chukao</p>
      </div>

      <section className="mb-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-100">
          <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">Aaj Ka Drain</p>
          <p className="mt-1 text-2xl font-black text-red-700">{formatCurrency(leakMetrics.totalPerDay)}</p>
          <p className="text-xs text-stone-400">per day</p>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-100">
          <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">Priority</p>
          <p className="mt-1 text-2xl font-black text-stone-900">
            {recommendation.priorityTarget === "LOCAL_LOAN" ? "Local" : "Bank"}
          </p>
          <p className="text-xs text-stone-400">loan target</p>
        </div>
      </section>

      <section>
        <DebtOptimizerCard
          today={getBusinessDateString()}
          leakPerHour={leakMetrics.totalPerHour.toString()}
          accounts={accounts.map((a) => ({
            id: a.id,
            name: a.name,
            kind: a.kind,
            outstandingAmount: a.outstandingAmount,
            annualRatePa: a.annualRatePa,
            monthlyRate: a.monthlyRate,
            dailyFixedInterest: a.dailyFixedInterest,
            rateInputType: a.rateInputType,
          }))}
          recommendation={{
            priorityTarget: recommendation.priorityTarget,
            recommendedPayment: recommendation.recommendedPayment.toString(),
            savingsPerMonth: recommendation.savingsPerMonth.toString(),
          }}
        />
      </section>
    </main>
  );
}
