import Decimal from "decimal.js";
import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { generateSnapshotAction } from "@/app/admin/actions";
import { PendingSubmitButton } from "@/components/ui/PendingSubmitButton";
import { db } from "@/db";
import { monthlySnapshots } from "@/db/schema";
import { ExportCsvButton } from "@/components/reports/ExportCsvButton";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { getBusinessDateString } from "@/lib/time/businessDate";

export const dynamic = "force-dynamic";

type ReportsPageProps = {
  searchParams?: Promise<{ generated?: string }>;
};

function formatCurrency(value: Decimal) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(Number(value.toFixed(2)));
}

function currentMonthYear() {
  const today = getBusinessDateString(); // YYYY-MM-DD
  return today.slice(0, 7); // YYYY-MM
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const tenant = await getTenantContext();

  if (!tenant) {
    redirect("/");
  }

  const params = await searchParams;
  const thisMonth = currentMonthYear();

  const snapshots = await db
    .select({
      id: monthlySnapshots.id,
      monthYear: monthlySnapshots.monthYear,
      totalInterestPaid: monthlySnapshots.totalInterestPaid,
      totalNetProfit: monthlySnapshots.totalNetProfit,
      turnoverVelocity: monthlySnapshots.turnoverVelocity,
    })
    .from(monthlySnapshots)
    .where(eq(monthlySnapshots.shopId, tenant.shopId))
    .orderBy(desc(monthlySnapshots.monthYear))
    .limit(24);

  return (
    <main className="mx-auto w-full max-w-lg px-4 pb-24 pt-4">
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">Reports</p>
        <h1 className="text-2xl font-black text-stone-900">Monthly Snapshot</h1>
        <p className="text-sm text-stone-500">Mahine ka summary</p>
      </div>

      {params?.generated ? (
        <div className="mb-4 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          Snapshot generated for {params.generated}.
        </div>
      ) : null}

      <div className="mb-5 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-100">
        <p className="mb-3 text-base font-bold text-stone-900">Generate Snapshot</p>
        <form action={generateSnapshotAction} className="space-y-3">
          <div>
              <input
                type="month"
                name="monthYear"
                defaultValue={thisMonth}
                required
                className="h-14 w-full rounded-xl border-2 border-stone-200 bg-white px-4 text-base focus:border-teal-500 focus:outline-none"
              />
          </div>
          <PendingSubmitButton
            className="h-12 w-full rounded-xl bg-teal-700 text-sm font-bold text-white disabled:opacity-70"
            pendingChildren={<span>Snapshot generate ho raha hai...</span>}
          >
            Generate
          </PendingSubmitButton>
          <ExportCsvButton
            monthYear={thisMonth}
            label="Export Current CSV"
            className="flex h-12 w-full items-center justify-center rounded-xl border-2 border-stone-200 text-sm font-bold text-stone-700"
          />
        </form>
      </div>

      {snapshots.length === 0 ? (
        <p className="rounded-xl bg-white px-4 py-6 text-center text-sm text-stone-400 shadow-sm ring-1 ring-stone-100">No monthly snapshots yet. Generate one above.</p>
      ) : (
        <div className="space-y-3">
          {snapshots.map((snap) => {
            const netProfit = new Decimal(snap.totalNetProfit);
            const interest = new Decimal(snap.totalInterestPaid);
            const velocity = new Decimal(snap.turnoverVelocity);

            return (
              <div key={snap.id} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-100">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-black text-stone-900">{snap.monthYear}</p>
                    <p className="text-xs text-stone-500">Interest: {formatCurrency(interest)}</p>
                    <p className="text-xs text-stone-500">Velocity: {velocity.toFixed(2)}x</p>
                  </div>
                  <p className={`text-2xl font-black ${netProfit.gte(0) ? "text-green-700" : "text-red-700"}`}>
                    {formatCurrency(netProfit)}
                  </p>
                </div>
                <ExportCsvButton
                  monthYear={snap.monthYear}
                  label="Export CSV"
                  className="mt-3 flex h-11 w-full items-center justify-center rounded-xl border-2 border-stone-200 text-sm font-bold text-stone-700"
                />
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
