import Decimal from "decimal.js";
import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";

import {
  updateCurrentAccountMovementEntry,
  updateDebtMovementMeta,
} from "@/app/debt-engine/actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import { currentAccountMovements, debtAccountMovements } from "@/db/schema";
import { getTenantContext } from "@/lib/tenant/getTenantContext";

type PageProps = {
  searchParams?: Promise<{
    kind?: "ca" | "debt";
    id?: string;
    returnTo?: string;
  }>;
};

function fmt(value: Decimal) {
  return `Rs ${Number(value.toFixed(2)).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function safeReturnTo(path?: string) {
  if (!path) return "/debt-engine";
  if (path.startsWith("/debt-engine")) return path;
  return "/debt-engine";
}

export default async function EditTransactionPage({ searchParams }: PageProps) {
  const tenant = await getTenantContext();
  if (!tenant) {
    redirect("/");
  }

  const params = await searchParams;
  const kind = params?.kind;
  const id = params?.id;
  const returnTo = safeReturnTo(params?.returnTo);

  if (!kind || !id) {
    redirect(returnTo);
  }

  if (kind === "debt") {
    const [movement] = await db
      .select({
        id: debtAccountMovements.id,
        movementType: debtAccountMovements.movementType,
        amount: debtAccountMovements.amount,
        movementDate: debtAccountMovements.movementDate,
        source: debtAccountMovements.source,
        notes: debtAccountMovements.notes,
      })
      .from(debtAccountMovements)
      .where(and(eq(debtAccountMovements.id, id), eq(debtAccountMovements.shopId, tenant.shopId)))
      .limit(1);

    if (!movement) {
      redirect(returnTo);
    }

    return (
      <main className="mx-auto w-full max-w-lg px-4 pb-24 pt-4">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">Edit</p>
            <h1 className="text-2xl font-black text-stone-900">Debt Transaction</h1>
          </div>
          <Link href={returnTo} className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-bold text-stone-700">
            Back
          </Link>
        </div>

        <Card className="rounded-2xl border-stone-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold text-stone-900">Edit Transaction</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={updateDebtMovementMeta} className="space-y-3">
              <input type="hidden" name="movementId" value={movement.id} />
              <input type="hidden" name="returnTo" value={returnTo} />

              <div className="rounded-xl bg-stone-50 p-3 text-xs text-stone-600">
                <p>Type: <span className="font-bold text-stone-800">{movement.movementType}</span></p>
                <p className="mt-1">Amount: <span className="font-bold text-stone-800">{fmt(new Decimal(movement.amount || "0"))}</span></p>
                <p className="mt-1 text-stone-500">Amount change yahan allow nahi hai to keep debt math safe.</p>
              </div>

              <div>
                <label htmlFor="movementDate" className="mb-1.5 block text-xs font-semibold text-stone-500">Date</label>
                <input
                  id="movementDate"
                  name="movementDate"
                  type="date"
                  defaultValue={movement.movementDate}
                  className="h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm"
                />
              </div>

              <div>
                <label htmlFor="notes" className="mb-1.5 block text-xs font-semibold text-stone-500">Notes</label>
                <input
                  id="notes"
                  name="notes"
                  type="text"
                  defaultValue={movement.notes || ""}
                  placeholder="Optional notes"
                  className="h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm"
                />
              </div>

              <button type="submit" className="h-11 w-full rounded-xl bg-teal-700 text-sm font-bold text-white">
                Save Changes
              </button>
            </form>
          </CardContent>
        </Card>
      </main>
    );
  }

  const [movement] = await db
    .select({
      id: currentAccountMovements.id,
      movementType: currentAccountMovements.movementType,
      movementDate: currentAccountMovements.movementDate,
      amount: currentAccountMovements.amount,
      direction: currentAccountMovements.direction,
      sourceType: currentAccountMovements.sourceType,
      notes: currentAccountMovements.notes,
      description: currentAccountMovements.description,
    })
    .from(currentAccountMovements)
    .where(and(eq(currentAccountMovements.id, id), eq(currentAccountMovements.shopId, tenant.shopId)))
    .limit(1);

  if (!movement) {
    redirect(returnTo);
  }

  const isManual = movement.sourceType === "MANUAL_ADJUSTMENT";

  return (
    <main className="mx-auto w-full max-w-lg px-4 pb-24 pt-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">Edit</p>
          <h1 className="text-2xl font-black text-stone-900">Current A/c Transaction</h1>
        </div>
        <Link href={returnTo} className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-bold text-stone-700">
          Back
        </Link>
      </div>

      <Card className="rounded-2xl border-stone-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-bold text-stone-900">Edit Transaction</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={updateCurrentAccountMovementEntry} className="space-y-3">
            <input type="hidden" name="movementId" value={movement.id} />
            <input type="hidden" name="returnTo" value={returnTo} />

            <div className="rounded-xl bg-stone-50 p-3 text-xs text-stone-600">
              <p>Type: <span className="font-bold text-stone-800">{movement.movementType}</span></p>
              <p className="mt-1">Source: <span className="font-bold text-stone-800">{movement.sourceType || "SYSTEM"}</span></p>
              {movement.description ? <p className="mt-1 text-stone-500">{movement.description}</p> : null}
              {!isManual ? (
                <p className="mt-1 text-stone-500">Linked/system movement hai: only notes editable.</p>
              ) : null}
            </div>

            {isManual ? (
              <>
                <div>
                  <label htmlFor="movementDate" className="mb-1.5 block text-xs font-semibold text-stone-500">Date</label>
                  <input
                    id="movementDate"
                    name="movementDate"
                    type="date"
                    defaultValue={movement.movementDate}
                    className="h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="amount" className="mb-1.5 block text-xs font-semibold text-stone-500">Amount</label>
                    <input
                      id="amount"
                      name="amount"
                      type="number"
                      step="0.01"
                      min="0"
                      defaultValue={movement.amount}
                      className="h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="direction" className="mb-1.5 block text-xs font-semibold text-stone-500">Direction</label>
                    <select
                      id="direction"
                      name="direction"
                      defaultValue={movement.direction === 1 ? "IN" : "OUT"}
                      className="h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm"
                    >
                      <option value="IN">Inflow (+)</option>
                      <option value="OUT">Outflow (-)</option>
                    </select>
                  </div>
                </div>
              </>
            ) : null}

            <div>
              <label htmlFor="notes" className="mb-1.5 block text-xs font-semibold text-stone-500">Notes</label>
              <input
                id="notes"
                name="notes"
                type="text"
                defaultValue={movement.notes || ""}
                placeholder="Optional notes"
                className="h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm"
              />
            </div>

            <button type="submit" className="h-11 w-full rounded-xl bg-teal-700 text-sm font-bold text-white">
              Save Changes
            </button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
