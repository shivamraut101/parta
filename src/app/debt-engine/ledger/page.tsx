import Decimal from "decimal.js";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { Pencil } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LedgerFilters } from "@/app/debt-engine/ledger/LedgerFilters";
import { db } from "@/db";
import {
  currentAccountAccounts,
  currentAccountMovements,
  debtAccountMovements,
  debtAccounts,
} from "@/db/schema";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { getBusinessDateString } from "@/lib/time/businessDate";

export const dynamic = "force-dynamic";

type LedgerScope = "ALL" | "CA" | "DEBT";
type LedgerDirection = "ALL" | "IN" | "OUT";

type CaMovementType =
  | "SALES_INFLOW"
  | "CC_DRAWDOWN_INFLOW"
  | "EXTERNAL_DEPOSIT_INFLOW"
  | "SUPPLIER_PAYMENT_OUTFLOW"
  | "CC_REPAYMENT_OUTFLOW"
  | "EXPENSE_OUTFLOW"
  | "ADJUSTMENT";

type DebtMovementType = "OPENING" | "DRAWDOWN" | "REPAYMENT" | "ADJUSTMENT";

type LedgerRow = {
  id: string;
  kind: "ca" | "debt";
  movementDate: string;
  createdAt: Date;
  movementType: string;
  label: string;
  amount: string;
  direction: 1 | -1;
  accountName: string | null;
  description: string | null;
  notes: string | null;
  balanceAfter: string | null;
};

function fmt(value: Decimal) {
  return `Rs ${Number(value.toFixed(2)).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function caMovementLabel(type: CaMovementType) {
  const map: Record<CaMovementType, string> = {
    SALES_INFLOW: "Sales Inflow",
    CC_DRAWDOWN_INFLOW: "CC -> CA",
    EXTERNAL_DEPOSIT_INFLOW: "External Deposit",
    SUPPLIER_PAYMENT_OUTFLOW: "Supplier Payment",
    CC_REPAYMENT_OUTFLOW: "CA -> CC",
    EXPENSE_OUTFLOW: "Expense",
    ADJUSTMENT: "Manual Adjustment",
  };
  return map[type];
}

function debtMovementLabel(type: DebtMovementType) {
  const map: Record<DebtMovementType, string> = {
    OPENING: "Opening",
    DRAWDOWN: "Take Out (Drawdown)",
    REPAYMENT: "Put Back (Repayment)",
    ADJUSTMENT: "Manual Adjustment",
  };
  return map[type];
}

function debtDirection(type: DebtMovementType): 1 | -1 {
  if (type === "REPAYMENT") return -1;
  return 1;
}

const movementTypeOptions: Array<{ value: string; label: string }> = [
  { value: "", label: "All Types" },
  { value: "SALES_INFLOW", label: "Sales Inflow" },
  { value: "CC_DRAWDOWN_INFLOW", label: "CC -> CA" },
  { value: "EXTERNAL_DEPOSIT_INFLOW", label: "External Deposit" },
  { value: "SUPPLIER_PAYMENT_OUTFLOW", label: "Supplier Payment" },
  { value: "CC_REPAYMENT_OUTFLOW", label: "CA -> CC" },
  { value: "EXPENSE_OUTFLOW", label: "Expense" },
  { value: "OPENING", label: "Debt Opening" },
  { value: "DRAWDOWN", label: "Debt Drawdown" },
  { value: "REPAYMENT", label: "Debt Repayment" },
  { value: "ADJUSTMENT", label: "Adjustment" },
];

type PageProps = {
  searchParams?: Promise<{
    from?: string;
    to?: string;
    scope?: LedgerScope;
    movementType?: string;
    direction?: LedgerDirection;
  }>;
};

export default async function UnifiedLedgerPage({ searchParams }: PageProps) {
  const tenant = await getTenantContext();
  if (!tenant) {
    redirect("/");
  }

  const params = await searchParams;
  const today = getBusinessDateString();
  const fromDate = params?.from || "";
  const toDate = params?.to || "";
  const scope: LedgerScope = params?.scope || "ALL";
  const selectedMovementType = params?.movementType || "";
  const direction: LedgerDirection = params?.direction || "ALL";

  const [account] = await db
    .select({
      accountName: currentAccountAccounts.accountName,
      openingBalance: currentAccountAccounts.openingBalance,
      currentBalance: currentAccountAccounts.currentBalance,
    })
    .from(currentAccountAccounts)
    .where(eq(currentAccountAccounts.shopId, tenant.shopId))
    .limit(1);

  const caFilters = [eq(currentAccountMovements.shopId, tenant.shopId)];
  if (fromDate) caFilters.push(gte(currentAccountMovements.movementDate, fromDate));
  if (toDate) caFilters.push(lte(currentAccountMovements.movementDate, toDate));

  const debtFilters = [eq(debtAccountMovements.shopId, tenant.shopId)];
  if (fromDate) debtFilters.push(gte(debtAccountMovements.movementDate, fromDate));
  if (toDate) debtFilters.push(lte(debtAccountMovements.movementDate, toDate));

  const [caRows, debtRows] = await Promise.all([
    scope === "DEBT"
      ? Promise.resolve([])
      : db
          .select({
            id: currentAccountMovements.id,
            movementDate: currentAccountMovements.movementDate,
            createdAt: currentAccountMovements.createdAt,
            movementType: currentAccountMovements.movementType,
            amount: currentAccountMovements.amount,
            direction: currentAccountMovements.direction,
            description: currentAccountMovements.description,
            notes: currentAccountMovements.notes,
            balanceAfter: currentAccountMovements.balanceAfter,
          })
          .from(currentAccountMovements)
          .where(and(...caFilters))
          .orderBy(desc(currentAccountMovements.movementDate), desc(currentAccountMovements.createdAt))
          .limit(600),
    scope === "CA"
      ? Promise.resolve([])
      : db
          .select({
            id: debtAccountMovements.id,
            debtAccountId: debtAccountMovements.debtAccountId,
            debtAccountName: debtAccounts.name,
            movementDate: debtAccountMovements.movementDate,
            createdAt: debtAccountMovements.createdAt,
            movementType: debtAccountMovements.movementType,
            amount: debtAccountMovements.amount,
            notes: debtAccountMovements.notes,
          })
          .from(debtAccountMovements)
          .leftJoin(
            debtAccounts,
            and(
              eq(debtAccounts.id, debtAccountMovements.debtAccountId),
              eq(debtAccounts.shopId, tenant.shopId),
            ),
          )
          .where(and(...debtFilters))
          .orderBy(desc(debtAccountMovements.movementDate), desc(debtAccountMovements.createdAt))
          .limit(600),
  ]);

  const normalizedCaRows: LedgerRow[] = caRows.map((row) => ({
    id: row.id,
    kind: "ca",
    movementDate: row.movementDate,
    createdAt: row.createdAt,
    movementType: row.movementType,
    label: caMovementLabel(row.movementType as CaMovementType),
    amount: row.amount,
    direction: row.direction === 1 ? 1 : -1,
    accountName: account?.accountName || "Current Account",
    description: row.description,
    notes: row.notes,
    balanceAfter: row.balanceAfter,
  }));

  const normalizedDebtRows: LedgerRow[] = debtRows.map((row) => {
    const type = row.movementType as DebtMovementType;
    return {
      id: row.id,
      kind: "debt",
      movementDate: row.movementDate,
      createdAt: row.createdAt,
      movementType: row.movementType,
      label: debtMovementLabel(type),
      amount: row.amount,
      direction: debtDirection(type),
      accountName: row.debtAccountName || null,
      description: row.debtAccountName ? `Debt Account: ${row.debtAccountName}` : "Debt account not linked",
      notes: row.notes,
      balanceAfter: null,
    };
  });

  let rows = [...normalizedCaRows, ...normalizedDebtRows]
    .sort((a, b) => {
      const da = new Date(`${a.movementDate}T00:00:00Z`).getTime();
      const dbb = new Date(`${b.movementDate}T00:00:00Z`).getTime();
      if (dbb !== da) return dbb - da;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });

  if (selectedMovementType) {
    rows = rows.filter((row) => row.movementType === selectedMovementType);
  }

  if (direction === "IN") {
    rows = rows.filter((row) => row.direction === 1);
  } else if (direction === "OUT") {
    rows = rows.filter((row) => row.direction === -1);
  }

  const totalInflow = rows.reduce(
    (sum, row) => (row.direction === 1 ? sum.add(row.amount || "0") : sum),
    new Decimal(0),
  );
  const totalOutflow = rows.reduce(
    (sum, row) => (row.direction === -1 ? sum.add(row.amount || "0") : sum),
    new Decimal(0),
  );

  return (
    <main className="mx-auto w-full max-w-lg px-4 pb-24 pt-4">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">Ledger</p>
          <h1 className="text-2xl font-black text-stone-900">All Transactions Ledger</h1>
          <p className="mt-0.5 text-sm text-stone-500">Debt + Current A/c complete statement</p>
        </div>
        <Link href="/debt-engine" className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-bold text-stone-700">
          Back
        </Link>
      </div>

      <Card className="mb-4 rounded-2xl border-sky-200 bg-sky-50">
        <CardContent className="grid grid-cols-2 gap-2 p-4 text-[12px] text-sky-900">
          <p>
            A/c: <span className="font-bold">{account?.accountName || "Not Setup"}</span>
          </p>
          <p>
            Opening: <span className="font-bold">{fmt(new Decimal(account?.openingBalance || "0"))}</span>
          </p>
          <p>
            Filtered Inflow: <span className="font-bold text-green-700">{fmt(totalInflow)}</span>
          </p>
          <p>
            Filtered Outflow: <span className="font-bold text-red-700">{fmt(totalOutflow)}</span>
          </p>
          <p className="col-span-2">
            Current Balance: <span className="font-bold text-slate-900">{fmt(new Decimal(account?.currentBalance || "0"))}</span>
          </p>
        </CardContent>
      </Card>

      <Card className="mb-4 rounded-2xl border-stone-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-bold text-stone-900">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <LedgerFilters
            today={today}
            initialFrom={fromDate}
            initialTo={toDate}
            initialScope={scope}
            initialDirection={direction}
            initialMovementType={selectedMovementType}
            movementTypeOptions={movementTypeOptions}
          />
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-stone-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-bold text-stone-900">Statement Entries ({rows.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="rounded-xl bg-stone-50 px-3 py-6 text-center text-sm text-stone-500">Filter ke hisaab se koi statement entry nahi mili.</p>
          ) : (
            <div className="space-y-2">
              {rows.map((row) => (
                <div key={`${row.kind}-${row.id}`} className="rounded-xl border border-stone-100 bg-white p-3">
                  <div className="flex items-start justify-between gap-2 text-xs">
                    <p className="min-w-0 leading-tight break-words font-semibold text-stone-800">{row.label}</p>
                    <p className="shrink-0 pl-2 text-right text-stone-500">{row.movementDate}</p>
                  </div>

                  <div className="mt-1 flex items-start justify-between gap-2 text-sm">
                    <p className={`min-w-0 leading-tight break-words font-bold ${row.direction === 1 ? "text-green-700" : "text-red-700"}`}>
                      {row.direction === 1 ? "+" : "-"}{fmt(new Decimal(row.amount || "0")).replace("Rs ", "")}
                    </p>
                    <div className="shrink-0 pl-2 text-right text-xs text-stone-500">
                      {row.balanceAfter ? (
                        <p>
                          Balance After: <span className="font-semibold text-stone-700">{fmt(new Decimal(row.balanceAfter || "0"))}</span>
                        </p>
                      ) : null}
                      <Link
                        href={`/debt-engine/transactions/edit?kind=${row.kind}&id=${row.id}&returnTo=${encodeURIComponent("/debt-engine/ledger")}`}
                        className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-md border border-sky-200 text-sky-700 hover:bg-sky-50"
                        aria-label="Edit transaction"
                        title="Edit transaction"
                      >
                        <Pencil size={12} />
                      </Link>
                    </div>
                  </div>

                  {row.accountName ? <p className="mt-1 text-xs text-stone-500">Account: {row.accountName}</p> : null}
                  {row.description ? <p className="mt-0.5 text-xs text-stone-500">{row.description}</p> : null}
                  {row.notes ? <p className="mt-0.5 text-xs text-stone-400">Note: {row.notes}</p> : null}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
