import Decimal from "decimal.js";
import { redirect } from "next/navigation";

import { updateDebtProfile } from "@/app/financial-identity/actions";
import { calculateDailyInterest } from "@/lib/finance/calculateDailyInterest";
import { getTenantContext } from "@/lib/tenant/getTenantContext";

export const dynamic = "force-dynamic";

function formatCurrency(value: Decimal) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(Number(value.toFixed(2)));
}

type PageProps = {
  searchParams?: Promise<{ saved?: string }>;
};

export default async function FinancialIdentityPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const saved = params?.saved === "1";
  const tenant = await getTenantContext();

  if (!tenant) {
    redirect("/");
  }

  const dailyInterestCost = calculateDailyInterest(
    tenant.financialConfig.ccLimit,
    tenant.financialConfig.bankInterestRatePa,
  );

  const dailyDrain = new Decimal(tenant.financialConfig.dailyLocalDrain);

  return (
    <main className="mx-auto w-full max-w-lg px-4 pb-24 pt-4">
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">Aur</p>
        <h1 className="text-2xl font-black text-stone-900">Financial Identity</h1>
        <p className="mt-0.5 text-sm text-stone-500">Paise ki main settings</p>
        {saved ? (
          <div className="mt-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-800">
            Financial profile saved successfully
          </div>
        ) : null}
      </div>

      <section className="mb-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-100">
          <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">Daily Bank Byaaj</p>
          <p className="mt-1 text-2xl font-black text-stone-900">{formatCurrency(dailyInterestCost)}</p>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-100">
          <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">Daily Fixed Drain</p>
          <p className="mt-1 text-2xl font-black text-amber-700">{formatCurrency(dailyDrain)}</p>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-stone-100">
        <p className="mb-4 text-base font-bold text-stone-900">Edit Financial Profile</p>
        <form action={updateDebtProfile} className="space-y-3">
          <div>
            <label htmlFor="ccLimit" className="mb-1.5 block text-xs font-semibold text-stone-500">CC Limit (₹)</label>
            <input id="ccLimit" name="ccLimit" type="number" step="0.01" min="0" defaultValue={tenant.financialConfig.ccLimit} required className="h-14 w-full rounded-xl border-2 border-stone-200 bg-white px-4 text-base focus:border-teal-500 focus:outline-none" />
          </div>

          <div>
            <label htmlFor="bankInterestRatePa" className="mb-1.5 block text-xs font-semibold text-stone-500">Bank Interest Rate - Annual %</label>
            <input id="bankInterestRatePa" name="bankInterestRatePa" type="number" step="0.000001" min="0" defaultValue={tenant.financialConfig.bankInterestRatePa} required className="h-14 w-full rounded-xl border-2 border-stone-200 bg-white px-4 text-base focus:border-teal-500 focus:outline-none" />
          </div>

          <div>
            <label htmlFor="dailyLocalDrain" className="mb-1.5 block text-xs font-semibold text-stone-500">Daily Local Drain (₹)</label>
            <input id="dailyLocalDrain" name="dailyLocalDrain" type="number" step="0.01" min="0" defaultValue={tenant.financialConfig.dailyLocalDrain} required className="h-14 w-full rounded-xl border-2 border-stone-200 bg-white px-4 text-base focus:border-teal-500 focus:outline-none" />
          </div>

          <div>
            <label htmlFor="localLoanAprMonthly" className="mb-1.5 block text-xs font-semibold text-stone-500">Local Loan Rate - Monthly %</label>
            <input id="localLoanAprMonthly" name="localLoanAprMonthly" type="number" step="0.000001" min="0" max="100" defaultValue={tenant.financialConfig.localLoanAprMonthly} required className="h-14 w-full rounded-xl border-2 border-stone-200 bg-white px-4 text-base focus:border-teal-500 focus:outline-none" />
          </div>

          <div>
            <label htmlFor="baseMarginDefault" className="mb-1.5 block text-xs font-semibold text-stone-500">Default Margin %</label>
            <input id="baseMarginDefault" name="baseMarginDefault" type="number" step="0.000001" min="0" defaultValue={tenant.financialConfig.baseMarginDefault} required className="h-14 w-full rounded-xl border-2 border-stone-200 bg-white px-4 text-base focus:border-teal-500 focus:outline-none" />
          </div>

          <button type="submit" className="h-14 w-full rounded-xl bg-teal-700 text-base font-bold text-white">Save Financial Profile</button>
        </form>
      </section>
    </main>
  );
}
