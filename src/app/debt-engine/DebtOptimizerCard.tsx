"use client";

import Decimal from "decimal.js";
import { useEffect, useMemo, useState, useTransition } from "react";

import { recordDebtPayment } from "@/app/debt-engine/actions";

type DebtTargetType = "BANK_CC" | "LOCAL_LOAN";
type DebtPaymentSource = "CASH" | "UPI";

function fmt(value: Decimal) {
  return `₹${Number(value.toFixed(2)).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function DebtOptimizerCard({
  today,
  leakPerHour,
  recommendation,
}: {
  today: string;
  leakPerHour: string;
  recommendation: {
    priorityTarget: DebtTargetType;
    recommendedPayment: string;
    savingsPerMonth: string;
  };
}) {
  const [isPending, startTransition] = useTransition();
  const [amount, setAmount] = useState("0");
  const [paymentDate, setPaymentDate] = useState(today);
  const [targetType, setTargetType] = useState<DebtTargetType>(recommendation.priorityTarget);
  const [source, setSource] = useState<DebtPaymentSource>("CASH");
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [saved, setSaved] = useState(false);

  const leakBase = useMemo(() => new Decimal(leakPerHour), [leakPerHour]);
  const leakPerSecond = useMemo(() => leakBase.div(3600), [leakBase]);
  const cumulativeLeak = useMemo(
    () => leakPerSecond.mul(secondsElapsed),
    [leakPerSecond, secondsElapsed],
  );

  useEffect(() => {
    const interval = window.setInterval(() => {
      setSecondsElapsed((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(interval);
  }, []);

  function handleSubmit() {
    const fd = new FormData();
    fd.set("amount", amount);
    fd.set("date", paymentDate);
    fd.set("targetType", targetType);
    fd.set("source", source);
    startTransition(async () => {
      await recordDebtPayment(fd);
      setAmount("0");
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    });
  }

  return (
    <div className="space-y-4">
      {/* Live leak meter */}
      <div className="rounded-2xl bg-gradient-to-br from-stone-900 to-stone-800 p-5 text-white shadow-md">
        <p className="text-xs font-semibold uppercase tracking-wider text-red-300">
          Is Page Ko Khola Tab Se Byaaj Gaya
        </p>
        <p className="mt-1 text-5xl font-black text-red-300">{fmt(cumulativeLeak)}</p>
        <p className="mt-1.5 text-sm text-stone-400">
          Roz ka drain:{" "}
          <span className="font-bold text-stone-200">{fmt(leakBase.mul(24))}</span>
        </p>
      </div>

      {/* Recommendation */}
      <div className="rounded-2xl bg-green-50 p-5 ring-1 ring-green-200">
        <p className="text-xs font-bold uppercase tracking-wider text-green-600">
          Marwari Salah — Aaj Kya Karo
        </p>
        <p className="mt-2 text-base font-bold text-green-900">
          {fmt(new Decimal(recommendation.recommendedPayment))} daalo{" "}
          {recommendation.priorityTarget === "LOCAL_LOAN" ? "Local Loan" : "Bank CC"} mein
        </p>
        <p className="mt-1 text-sm text-green-700">
          Isse mahine mein{" "}
          <span className="font-bold">{fmt(new Decimal(recommendation.savingsPerMonth))}</span>{" "}
          bachenge
        </p>
      </div>

      {/* Record payment form */}
      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-stone-100">
        <p className="mb-4 text-base font-bold text-stone-900">
          Payment Darj Karo{" "}
          <span className="text-sm font-normal text-stone-400">(Record Deposit)</span>
        </p>

        <div className="mb-4 grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="debtAmount" className="mb-1.5 block text-xs font-semibold text-stone-500">
              Amount (₹)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg font-bold text-stone-400">
                ₹
              </span>
              <input
                id="debtAmount"
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="h-14 w-full rounded-xl border-2 border-stone-200 bg-white pl-7 pr-3 text-base font-bold text-stone-900 focus:border-teal-500 focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label htmlFor="debtDate" className="mb-1.5 block text-xs font-semibold text-stone-500">
              Tarikh
            </label>
            <input
              id="debtDate"
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="h-14 w-full rounded-xl border-2 border-stone-200 bg-white px-4 text-base text-stone-900 focus:border-teal-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Target */}
        <div className="mb-3">
          <p className="mb-2 text-xs font-semibold text-stone-500">Kahan Dena Hai</p>
          <div className="flex gap-2">
            {(["BANK_CC", "LOCAL_LOAN"] as DebtTargetType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTargetType(t)}
                className={`h-12 flex-1 rounded-xl text-sm font-bold transition-colors ${
                  targetType === t
                    ? "bg-stone-900 text-white"
                    : "border-2 border-stone-200 bg-white text-stone-600"
                }`}
              >
                {t === "BANK_CC" ? "Bank CC" : "Local Loan"}
              </button>
            ))}
          </div>
        </div>

        {/* Source */}
        <div className="mb-5">
          <p className="mb-2 text-xs font-semibold text-stone-500">Kaise Dena Hai</p>
          <div className="flex gap-2">
            {(["CASH", "UPI"] as DebtPaymentSource[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSource(s)}
                className={`h-12 flex-1 rounded-xl text-sm font-bold transition-colors ${
                  source === s
                    ? "bg-stone-900 text-white"
                    : "border-2 border-stone-200 bg-white text-stone-600"
                }`}
              >
                {s === "CASH" ? "💵 Cash" : "📱 UPI"}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={isPending}
          className="h-14 w-full rounded-xl bg-teal-700 text-base font-bold text-white active:bg-teal-800 disabled:opacity-60"
        >
          {isPending ? "Saving..." : "Karj Chukao ✓"}
        </button>

        {saved ? (
          <p className="mt-3 text-center text-sm font-semibold text-green-700">
            ✓ Payment recorded!
          </p>
        ) : null}
      </div>
    </div>
  );
}
