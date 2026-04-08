"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Props = {
  today: string;
  initialFrom: string;
  initialTo: string;
  initialScope: "ALL" | "CA" | "DEBT";
  initialDirection: "ALL" | "IN" | "OUT";
  initialMovementType: string;
  movementTypeOptions: Array<{ value: string; label: string }>;
};

export function LedgerFilters({
  today,
  initialFrom,
  initialTo,
  initialScope,
  initialDirection,
  initialMovementType,
  movementTypeOptions,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [fromDate, setFromDate] = useState(initialFrom);
  const [toDate, setToDate] = useState(initialTo);
  const [scope, setScope] = useState<"ALL" | "CA" | "DEBT">(initialScope);
  const [direction, setDirection] = useState<"ALL" | "IN" | "OUT">(initialDirection);
  const [movementType, setMovementType] = useState(initialMovementType || "__all__");

  const basePath = "/debt-engine/ledger";

  const nextQuery = useMemo(() => {
    const query = new URLSearchParams(searchParams.toString());

    if (fromDate) query.set("from", fromDate);
    else query.delete("from");

    if (toDate) query.set("to", toDate);
    else query.delete("to");

    if (scope && scope !== "ALL") query.set("scope", scope);
    else query.delete("scope");

    if (direction && direction !== "ALL") query.set("direction", direction);
    else query.delete("direction");

    if (movementType && movementType !== "__all__") query.set("movementType", movementType);
    else query.delete("movementType");

    return query.toString();
  }, [searchParams, fromDate, toDate, scope, direction, movementType]);

  function applyFilters() {
    router.push(nextQuery ? `${basePath}?${nextQuery}` : basePath);
  }

  function resetFilters() {
    setFromDate("");
    setToDate("");
    setScope("ALL");
    setDirection("ALL");
    setMovementType("__all__");
    router.push(basePath);
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="ledgerFrom" className="mb-1.5 block text-xs font-semibold text-stone-500">From Date</label>
          <input
            id="ledgerFrom"
            type="date"
            max={today}
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm"
          />
        </div>
        <div>
          <label htmlFor="ledgerTo" className="mb-1.5 block text-xs font-semibold text-stone-500">To Date</label>
          <input
            id="ledgerTo"
            type="date"
            max={today}
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-stone-500">Ledger Scope</label>
          <Select value={scope} onValueChange={(value) => setScope(value as "ALL" | "CA" | "DEBT")}>
            <SelectTrigger className="h-11 rounded-xl border-stone-200 bg-white px-3 text-sm">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent position="popper">
              <SelectItem value="ALL">All</SelectItem>
              <SelectItem value="CA">Current A/c Only</SelectItem>
              <SelectItem value="DEBT">Debt Only</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-stone-500">Direction</label>
          <Select value={direction} onValueChange={(value) => setDirection(value as "ALL" | "IN" | "OUT")}>
            <SelectTrigger className="h-11 rounded-xl border-stone-200 bg-white px-3 text-sm">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent position="popper">
              <SelectItem value="ALL">All</SelectItem>
              <SelectItem value="IN">Inflow (+)</SelectItem>
              <SelectItem value="OUT">Outflow (-)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-semibold text-stone-500">Movement Type</label>
        <Select value={movementType} onValueChange={setMovementType}>
          <SelectTrigger className="h-11 rounded-xl border-stone-200 bg-white px-3 text-sm">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectItem value="__all__">All Types</SelectItem>
            {movementTypeOptions.filter((x) => x.value).map((type) => (
              <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={applyFilters}
          className="h-11 flex-1 rounded-xl bg-teal-700 px-4 text-sm font-bold text-white"
        >
          Apply Filters
        </button>
        <button
          type="button"
          onClick={resetFilters}
          className="h-11 rounded-xl border border-stone-200 bg-white px-4 text-sm font-bold text-stone-700"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
