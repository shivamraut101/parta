"use client";

import Decimal from "decimal.js";
import { useState, useTransition } from "react";

import { voidDailyEntry } from "@/app/daily-parta/actions";

type HistoryItem = {
  id: string;
  date: string;
  grossProfit: string;
  netParta: string;
  isVoided: boolean;
  voidReason: string | null;
};

function fmt(value: Decimal) {
  return `₹${Number(value.toFixed(2)).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function DailyPartaHistoryClient({ items }: { items: HistoryItem[] }) {
  const [voidTarget, setVoidTarget] = useState<{ id: string; date: string } | null>(null);
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();

  function submitVoid() {
    if (!voidTarget || reason.trim().length < 3) return;
    const fd = new FormData();
    fd.set("summaryId", voidTarget.id);
    fd.set("reason", reason.trim());
    startTransition(async () => {
      await voidDailyEntry(fd);
      setVoidTarget(null);
      setReason("");
    });
  }

  return (
    <>
      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-stone-100">
        <p className="mb-4 text-base font-bold text-stone-900">
          Pichle 7 Din{" "}
          <span className="text-sm font-normal text-stone-400">(Last 7 Days)</span>
        </p>

        {items.length === 0 ? (
          <p className="rounded-xl bg-stone-50 px-4 py-6 text-center text-sm text-stone-400">
            Abhi tak koi entry nahi — pehla galla darj karo!
          </p>
        ) : (
          <div className="space-y-3">
            {items.map((item) => {
              const grossProfit = new Decimal(item.grossProfit || "0");
              const netParta = new Decimal(item.netParta || "0");

              return (
                <div
                  key={item.id}
                  className={`rounded-xl p-4 ring-1 ${
                    item.isVoided
                      ? "bg-stone-50 opacity-60 ring-stone-200"
                      : netParta.gte(0)
                        ? "bg-green-50 ring-green-200"
                        : "bg-red-50 ring-red-200"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-stone-800">{item.date}</p>
                        {item.isVoided ? (
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
                            VOID
                          </span>
                        ) : null}
                      </div>
                      <p className="text-xs text-stone-400">Gross: {fmt(grossProfit)}</p>
                      {item.isVoided && item.voidReason ? (
                        <p className="mt-0.5 text-xs text-stone-400">
                          Reason: {item.voidReason}
                        </p>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-3">
                      <p
                        className={`text-xl font-black ${
                          item.isVoided
                            ? "text-stone-400"
                            : netParta.gte(0)
                              ? "text-green-700"
                              : "text-red-700"
                        }`}
                      >
                        {fmt(netParta)}
                      </p>
                      {!item.isVoided ? (
                        <button
                          type="button"
                          onClick={() => setVoidTarget({ id: item.id, date: item.date })}
                          className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-bold text-red-600 active:bg-red-50"
                        >
                          Void
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Void confirmation bottom sheet */}
      {voidTarget ? (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40 sm:items-center sm:justify-center">
          <div className="w-full rounded-t-2xl bg-white p-5 pb-8 sm:max-w-md sm:rounded-2xl sm:pb-5">
            <p className="text-base font-bold text-stone-900">
              Void karna chahte ho? — {voidTarget.date}
            </p>
            <p className="mt-1 text-sm text-stone-400">Karan batao (min 3 akshar)</p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Duplicate entry, wrong date"
              rows={3}
              className="mt-3 w-full rounded-xl border-2 border-stone-200 bg-white px-4 py-3 text-sm text-stone-900 focus:border-teal-500 focus:outline-none"
            />
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setVoidTarget(null);
                  setReason("");
                }}
                disabled={isPending}
                className="h-12 flex-1 rounded-xl border-2 border-stone-200 bg-white text-sm font-bold text-stone-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitVoid}
                disabled={isPending || reason.trim().length < 3}
                className="h-12 flex-1 rounded-xl bg-red-600 text-sm font-bold text-white disabled:opacity-50"
              >
                {isPending ? "Voiding…" : "Haan, Void Karo"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
