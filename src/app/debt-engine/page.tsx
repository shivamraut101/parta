import Decimal from "decimal.js";
import { redirect } from "next/navigation";

import { DebtOptimizerCard } from "@/app/debt-engine/DebtOptimizerCard";
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
