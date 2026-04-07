import Decimal from "decimal.js";
import { and, asc, desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { DebtOptimizerCard } from "@/app/debt-engine/DebtOptimizerCard";
import { Card, CardContent } from "@/components/ui/card";
import { db } from "@/db";
import { debtAccountMovements, debtAccounts } from "@/db/schema";
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
    lenderName: string | null;
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
  }> = [];

  let recentMovements: Array<{
    id: string;
    debtAccountId: string;
    movementType: "OPENING" | "DRAWDOWN" | "REPAYMENT" | "ADJUSTMENT";
    amount: string;
    movementDate: string;
    source: "CASH" | "UPI" | null;
    notes: string | null;
  }> = [];

  try {
    accounts = await db
      .select({
        id: debtAccounts.id,
        name: debtAccounts.name,
        lenderName: debtAccounts.lenderName,
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
      })
      .from(debtAccounts)
      .where(and(eq(debtAccounts.shopId, tenant.shopId), eq(debtAccounts.isActive, true)))
      .orderBy(asc(debtAccounts.name));
  } catch {
    accounts = [];
  }

  try {
    recentMovements = await db
      .select({
        id: debtAccountMovements.id,
        debtAccountId: debtAccountMovements.debtAccountId,
        movementType: debtAccountMovements.movementType,
        amount: debtAccountMovements.amount,
        movementDate: debtAccountMovements.movementDate,
        source: debtAccountMovements.source,
        notes: debtAccountMovements.notes,
      })
      .from(debtAccountMovements)
      .where(eq(debtAccountMovements.shopId, tenant.shopId))
      .orderBy(desc(debtAccountMovements.movementDate), desc(debtAccountMovements.createdAt))
      .limit(40);
  } catch {
    recentMovements = [];
  }

  return (
    <main className="mx-auto w-full max-w-lg px-4 pb-24 pt-4">
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">Karj</p>
        <h1 className="text-2xl font-black text-stone-900">Debt Engine</h1>
        <p className="mt-0.5 text-sm text-stone-500">Pehle mehenga byaaj chukao</p>
      </div>

      <section className="mb-4 grid grid-cols-2 gap-3">
        <Card className="rounded-2xl border-stone-200">
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">Aaj Ka Drain</p>
            <p className="mt-1 text-2xl font-black text-red-700">{formatCurrency(leakMetrics.totalPerDay)}</p>
            <p className="text-xs text-stone-400">per day</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-stone-200">
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">Priority</p>
            <p className="mt-1 text-2xl font-black text-stone-900">
              {recommendation.priorityTarget === "LOCAL_LOAN" ? "Local" : "Bank"}
            </p>
            <p className="text-xs text-stone-400">loan target</p>
          </CardContent>
        </Card>
      </section>

      <section>
        <DebtOptimizerCard
          today={getBusinessDateString()}
          leakPerHour={leakMetrics.totalPerHour.toString()}
          accounts={accounts.map((a) => ({
            id: a.id,
            name: a.name,
            lenderName: a.lenderName,
            kind: a.kind,
            creditLimit: a.creditLimit,
            principalAmount: a.principalAmount,
            outstandingAmount: a.outstandingAmount,
            totalDrawnAmount: a.totalDrawnAmount,
            totalRepaidAmount: a.totalRepaidAmount,
            annualRatePa: a.annualRatePa,
            monthlyRate: a.monthlyRate,
            dailyFixedInterest: a.dailyFixedInterest,
            installmentAmount: a.installmentAmount,
            installmentFrequency: a.installmentFrequency,
            remainingInstallments: a.remainingInstallments,
            startDate: a.startDate,
            maturityDate: a.maturityDate,
            notes: a.notes,
            rateInputType: a.rateInputType,
          }))}
          recentMovements={recentMovements}
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
