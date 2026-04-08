import Decimal from "decimal.js";
import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";

import { updateDebtProfile } from "@/app/financial-identity/actions";
import { LoanAccountsManager } from "@/app/financial-identity/LoanAccountsManager";
import { PendingSubmitButton } from "@/components/ui/PendingSubmitButton";
import { db } from "@/db";
import { currentAccountAccounts, debtAccounts } from "@/db/schema";
import { calculateDailyInterest } from "@/lib/finance/calculateDailyInterest";
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

  let currentAccount:
    | {
      accountName: string;
      accountNumber: string | null;
      bankName: string | null;
      ifscCode: string | null;
      openingBalance: string;
      startDate: string | null;
      notes: string | null;
    }
    | undefined;

  let allCurrentAccounts: Array<{ accountName: string }> = [];

  try {
    const [row] = await db
      .select({
        accountName: currentAccountAccounts.accountName,
        accountNumber: currentAccountAccounts.accountNumber,
        bankName: currentAccountAccounts.bankName,
        ifscCode: currentAccountAccounts.ifscCode,
        openingBalance: currentAccountAccounts.openingBalance,
        startDate: currentAccountAccounts.startDate,
        notes: currentAccountAccounts.notes,
      })
      .from(currentAccountAccounts)
      .where(eq(currentAccountAccounts.shopId, tenant.shopId))
      .limit(1);

    currentAccount = row;
  } catch {
    currentAccount = undefined;
  }

  try {
    allCurrentAccounts = await db
      .select({
        accountName: currentAccountAccounts.accountName,
      })
      .from(currentAccountAccounts)
      .where(eq(currentAccountAccounts.shopId, tenant.shopId));
  } catch {
    allCurrentAccounts = [];
  }

  let loanAccounts: Array<{
    id: string;
    name: string;
    lenderName: string | null;
    linkedCurrentAccountName: string | null;
    kind: "BANK_CC" | "BANK_TERM_LOAN" | "BANK_OD" | "BANK_BILL_DISCOUNT" | "LOCAL_DAILY" | "LOCAL_MONTHLY" | "LOCAL_BULLET" | "LOCAL_FLEXI";
    creditLimit: string;
    principalAmount: string;
    outstandingAmount: string;
    totalDrawnAmount: string;
    totalRepaidAmount: string;
    annualRatePa: string;
    monthlyRate: string;
    dailyFixedInterest: string;
    installmentAmount: string;
    installmentFrequency: "DAILY" | "WEEKLY" | "MONTHLY" | "BULLET";
    remainingInstallments: number;
    startDate: string | null;
    maturityDate: string | null;
    notes: string | null;
    rateInputType: "ANNUAL_PERCENT" | "MONTHLY_PERCENT" | "DAILY_FIXED" | "EMI_DAILY" | "EMI_MONTHLY";
    updatedAt: Date;
  }> = [];

  try {
    loanAccounts = await db
      .select({
        id: debtAccounts.id,
        name: debtAccounts.name,
        lenderName: debtAccounts.lenderName,
        linkedCurrentAccountName: debtAccounts.linkedCurrentAccountName,
        kind: debtAccounts.kind,
        creditLimit: debtAccounts.creditLimit,
        principalAmount: debtAccounts.principalAmount,
        outstandingAmount: debtAccounts.outstandingAmount,
        totalDrawnAmount: debtAccounts.totalDrawnAmount,
        totalRepaidAmount: debtAccounts.totalRepaidAmount,
        annualRatePa: debtAccounts.annualRatePa,
        monthlyRate: debtAccounts.monthlyRate,
        dailyFixedInterest: debtAccounts.dailyFixedInterest,
        installmentAmount: debtAccounts.installmentAmount,
        installmentFrequency: debtAccounts.installmentFrequency,
        remainingInstallments: debtAccounts.remainingInstallments,
        startDate: debtAccounts.startDate,
        maturityDate: debtAccounts.maturityDate,
        notes: debtAccounts.notes,
        rateInputType: debtAccounts.rateInputType,
        updatedAt: debtAccounts.updatedAt,
      })
      .from(debtAccounts)
      .where(eq(debtAccounts.shopId, tenant.shopId))
      .orderBy(desc(debtAccounts.updatedAt));
  } catch {
    loanAccounts = [];
  }

  // Keep only the newest record per same business identity to avoid accidental clone cards.
  const uniqueLoanAccounts = Array.from(
    loanAccounts
      .reduce((map, account) => {
        const key = [
          account.kind,
          account.name.trim().toLowerCase(),
          (account.lenderName ?? "").trim().toLowerCase(),
          account.startDate ?? "",
          new Decimal(account.creditLimit || "0").toFixed(2),
        ].join("|");

        if (!map.has(key)) {
          map.set(key, account);
        }

        return map;
      }, new Map<string, (typeof loanAccounts)[number]>())
      .values(),
  );

  return (
    <main className="mx-auto w-full max-w-lg px-4 pb-24 pt-4">
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">Aur</p>
        <h1 className="text-2xl font-black text-stone-900">Financial Identity</h1>
        <p className="mt-0.5 text-sm text-stone-500">Current Account aur Loan Accounts yahan manage karo.</p>
        <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-900">
          Loans ko yahan setup karo (ek baar). Har loan me interest rate aur payment terms define karo.
          <div className="mt-1">
            <Link href="/debt-engine" className="font-semibold underline">
              Debt Engine me jao for daily drawdowns &amp; repayments
            </Link>
          </div>
        </div>
        {saved ? (
          <div className="mt-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-800">
            Financial profile saved successfully
          </div>
        ) : null}
      </div>

      <section className="mb-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-stone-100">
        <p className="mb-4 text-base font-bold text-stone-900">Shop Defaults</p>
        <form action={updateDebtProfile} className="space-y-3">
          <div>
            <label htmlFor="baseMarginDefault" className="mb-1.5 block text-xs font-semibold text-stone-500">Default Margin %</label>
            <input id="baseMarginDefault" name="baseMarginDefault" type="number" step="0.000001" min="0" defaultValue={tenant.financialConfig.baseMarginDefault} className="h-14 w-full rounded-xl border-2 border-stone-200 bg-white px-4 text-base focus:border-teal-500 focus:outline-none" />
          </div>

          <div className="my-2 border-t border-stone-100 pt-3">
            <p className="mb-2 text-sm font-bold text-stone-900">Current Account Setup</p>
            <p className="mb-3 text-xs text-stone-500">Optional module. Enable karo tabhi CA profile save/update hoga.</p>
            <label className="flex items-center gap-2 text-sm font-semibold text-stone-700">
              <input
                id="enableCurrentAccount"
                name="enableCurrentAccount"
                type="checkbox"
                defaultChecked={Boolean(currentAccount)}
                className="h-4 w-4 rounded border-stone-300"
              />
              Enable Current Account Tracking
            </label>
          </div>

          <div>
            <label htmlFor="currentAccountName" className="mb-1.5 block text-xs font-semibold text-stone-500">Current Account Name (optional)</label>
            <input id="currentAccountName" name="currentAccountName" type="text" defaultValue={currentAccount?.accountName ?? ""} placeholder="e.g. SBI Current 2098" className="h-14 w-full rounded-xl border-2 border-stone-200 bg-white px-4 text-base focus:border-teal-500 focus:outline-none" />
          </div>

          <div>
            <label htmlFor="currentAccountOpeningBalance" className="mb-1.5 block text-xs font-semibold text-stone-500">Current Account Opening Balance (₹) (optional)</label>
            <input id="currentAccountOpeningBalance" name="currentAccountOpeningBalance" type="number" step="0.01" min="0" defaultValue={currentAccount?.openingBalance ?? "0"} placeholder="0" className="h-14 w-full rounded-xl border-2 border-stone-200 bg-white px-4 text-base focus:border-teal-500 focus:outline-none" />
          </div>

          <div>
            <label htmlFor="currentAccountStartDate" className="mb-1.5 block text-xs font-semibold text-stone-500">Current Account Start Date (optional)</label>
            <input id="currentAccountStartDate" name="currentAccountStartDate" type="date" defaultValue={currentAccount?.startDate ?? ""} className="h-14 w-full rounded-xl border-2 border-stone-200 bg-white px-4 text-base focus:border-teal-500 focus:outline-none" />
          </div>

          <div>
            <label htmlFor="currentBankName" className="mb-1.5 block text-xs font-semibold text-stone-500">Bank Name (optional)</label>
            <input id="currentBankName" name="currentBankName" type="text" defaultValue={currentAccount?.bankName ?? ""} className="h-14 w-full rounded-xl border-2 border-stone-200 bg-white px-4 text-base focus:border-teal-500 focus:outline-none" />
          </div>

          <div>
            <label htmlFor="currentAccountNumber" className="mb-1.5 block text-xs font-semibold text-stone-500">Account Number (optional)</label>
            <input id="currentAccountNumber" name="currentAccountNumber" type="text" defaultValue={currentAccount?.accountNumber ?? ""} className="h-14 w-full rounded-xl border-2 border-stone-200 bg-white px-4 text-base focus:border-teal-500 focus:outline-none" />
          </div>

          <div>
            <label htmlFor="currentIfscCode" className="mb-1.5 block text-xs font-semibold text-stone-500">IFSC Code (optional)</label>
            <input id="currentIfscCode" name="currentIfscCode" type="text" defaultValue={currentAccount?.ifscCode ?? ""} className="h-14 w-full rounded-xl border-2 border-stone-200 bg-white px-4 text-base focus:border-teal-500 focus:outline-none" />
          </div>

          <div>
            <label htmlFor="currentAccountNotes" className="mb-1.5 block text-xs font-semibold text-stone-500">CA Notes (optional)</label>
            <input id="currentAccountNotes" name="currentAccountNotes" type="text" defaultValue={currentAccount?.notes ?? ""} className="h-14 w-full rounded-xl border-2 border-stone-200 bg-white px-4 text-base focus:border-teal-500 focus:outline-none" />
          </div>

          <PendingSubmitButton
            className="h-14 w-full rounded-xl bg-teal-700 text-base font-bold text-white disabled:opacity-70"
            pendingChildren={<span>Financial profile save ho raha hai...</span>}
          >
            Save Financial Profile
          </PendingSubmitButton>
        </form>
      </section>

      <LoanAccountsManager accounts={uniqueLoanAccounts} today={getBusinessDateString()} currentAccounts={allCurrentAccounts} />
    </main>
  );
}
