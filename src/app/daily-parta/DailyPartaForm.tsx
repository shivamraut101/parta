"use client";

import Decimal from "decimal.js";
import { CheckCircle2, TrendingDown, TrendingUp } from "lucide-react";
import { useMemo, useState, useTransition } from "react";

import { addExpense, saveDailyEntry } from "@/app/daily-parta/actions";

type ExpenseCategory = "STAFF_ADVANCE" | "TEA_SNACKS" | "UTILITIES" | "REPAIRS" | "MISC";

type QuickExpense = {
  id: string;
  amount: string;
  category: ExpenseCategory;
  description?: string;
};

const expenseCategories: { value: ExpenseCategory; label: string; hindiLabel: string }[] = [
  { value: "TEA_SNACKS", label: "Tea & Snacks", hindiLabel: "चाय-नाश्ता" },
  { value: "STAFF_ADVANCE", label: "Staff Advance", hindiLabel: "एडवांस" },
  { value: "UTILITIES", label: "Utilities", hindiLabel: "बिजली-पानी" },
  { value: "REPAIRS", label: "Repairs", hindiLabel: "मरम्मत" },
  { value: "MISC", label: "Misc", hindiLabel: "अन्य" },
];

function fmt(value: Decimal) {
  return `₹${Number(value.toFixed(2)).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function DailyPartaForm({
  defaultDate,
  defaultMargin,
  dailyDrains,
  persistedExpenseTotal,
  persistedExpenseCount,
  persistedLocalDailyLoanPayment,
}: {
  defaultDate: string;
  defaultMargin: string;
  dailyDrains: string;
  persistedExpenseTotal: string;
  persistedExpenseCount: number;
  persistedLocalDailyLoanPayment: string;
}) {
  const [isPending, startTransition] = useTransition();

  const [date, setDate] = useState(defaultDate);
  const [cashSales, setCashSales] = useState("0");
  const [upiSales, setUpiSales] = useState("0");
  const [margin, setMargin] = useState(defaultMargin);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [includeLocalDailyLoanPayment, setIncludeLocalDailyLoanPayment] = useState(
    new Decimal(persistedLocalDailyLoanPayment || "0").gt(0),
  );
  const [localDailyLoanPayment, setLocalDailyLoanPayment] = useState(
    persistedLocalDailyLoanPayment || "0",
  );

  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseCategory, setExpenseCategory] = useState<ExpenseCategory>("TEA_SNACKS");
  const [expenseDescription, setExpenseDescription] = useState("");
  const [quickExpenses, setQuickExpenses] = useState<QuickExpense[]>([]);
  const [expenseSaved, setExpenseSaved] = useState(false);

  const totalSales = useMemo(
    () => new Decimal(cashSales || "0").add(upiSales || "0"),
    [cashSales, upiSales],
  );

  const grossProfit = useMemo(
    () => totalSales.mul(new Decimal(margin || "0").div(100)),
    [totalSales, margin],
  );

  const localExpenses = useMemo(
    () => quickExpenses.reduce((sum, item) => sum.add(item.amount || "0"), new Decimal(0)),
    [quickExpenses],
  );

  const totalExpenses = useMemo(
    () => new Decimal(persistedExpenseTotal).add(localExpenses),
    [persistedExpenseTotal, localExpenses],
  );

  const localDailyLoanPaymentAmount = useMemo(
    () =>
      includeLocalDailyLoanPayment
        ? new Decimal(localDailyLoanPayment || "0")
        : new Decimal(0),
    [includeLocalDailyLoanPayment, localDailyLoanPayment],
  );

  const netParta = useMemo(
    () => grossProfit.minus(new Decimal(dailyDrains)).minus(totalExpenses).minus(localDailyLoanPaymentAmount),
    [grossProfit, dailyDrains, totalExpenses, localDailyLoanPaymentAmount],
  );

  const isProfit = netParta.gte(0);

  function handleSaveDailyEntry() {
    const fd = new FormData();
    fd.set("date", date);
    fd.set("totalSalesCash", cashSales);
    fd.set("totalSalesUpi", upiSales);
    fd.set("marginApplied", margin);
    fd.set("includeLocalDailyLoanPayment", includeLocalDailyLoanPayment ? "true" : "false");
    fd.set("localDailyLoanPayment", localDailyLoanPayment);
    startTransition(async () => {
      await saveDailyEntry(fd);
      setSavedAt(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }));
    });
  }

  function handleAddExpense() {
    const amt = new Decimal(expenseAmount || "0");
    if (amt.lte(0)) return;

    const quick: QuickExpense = {
      id: crypto.randomUUID(),
      amount: expenseAmount,
      category: expenseCategory,
      description: expenseDescription,
    };
    setQuickExpenses((prev) => [quick, ...prev]);

    const fd = new FormData();
    fd.set("date", date);
    fd.set("amount", expenseAmount);
    fd.set("category", expenseCategory);
    fd.set("description", expenseDescription);
    setExpenseAmount("");
    setExpenseDescription("");

    startTransition(async () => {
      await addExpense(fd);
      setExpenseSaved(true);
      setTimeout(() => setExpenseSaved(false), 2500);
    });
  }

  return (
    <div className="space-y-4">
      {/* ── NET PARTA HERO ───────────────────────────────────────────────── */}
      <div
        className={`rounded-2xl p-5 text-white shadow-md ${
          isProfit
            ? "bg-gradient-to-br from-green-600 to-green-700"
            : "bg-gradient-to-br from-red-600 to-red-700"
        }`}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-white/75">
              Net Parta — Live
            </p>
            <p className="mt-1 text-4xl font-black">{fmt(netParta)}</p>
            <p className="mt-0.5 text-sm text-white/70">
              {isProfit ? "Nafa ✓" : "Nuksan ✗"}
            </p>
          </div>
          <div className="mt-1 rounded-xl bg-white/20 p-2">
            {isProfit ? (
              <TrendingUp size={22} className="text-white" />
            ) : (
              <TrendingDown size={22} className="text-white" />
            )}
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs text-white/80">
          <div className="rounded-lg bg-white/10 px-2 py-1.5">
            <p className="font-semibold text-white">{fmt(grossProfit)}</p>
            <p>Gross Nafa</p>
          </div>
          <div className="rounded-lg bg-white/10 px-2 py-1.5">
            <p className="font-semibold text-white">{fmt(new Decimal(dailyDrains))}</p>
            <p>Byaaj Kharcha</p>
          </div>
          <div className="rounded-lg bg-white/10 px-2 py-1.5">
            <p className="font-semibold text-white">{fmt(totalExpenses)}</p>
            <p>Kharche</p>
          </div>
        </div>
        {includeLocalDailyLoanPayment ? (
          <p className="mt-2 text-xs text-white/80">
            Local daily loan payment: <span className="font-semibold text-white">{fmt(localDailyLoanPaymentAmount)}</span>
          </p>
        ) : null}
      </div>

      {/* ── GALLA ENTRY ─────────────────────────────────────────────────── */}
      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-stone-100">
        <p className="mb-4 text-base font-bold text-stone-900">
          Galla Darj Karo <span className="text-sm font-normal text-stone-400">(Record Sales)</span>
        </p>

        {/* Date */}
        <div className="mb-4">
          <label htmlFor="summaryDate" className="mb-1.5 block text-xs font-semibold text-stone-500">
            Tarikh (Date)
          </label>
          <input
            id="summaryDate"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-14 w-full rounded-xl border-2 border-stone-200 bg-white px-4 text-base text-stone-900 focus:border-teal-500 focus:outline-none"
          />
          <p className="mt-1 text-[11px] text-stone-500">
            Purani date select karke us din ka galla update/edit kar sakte ho (agar day locked nahi hai).
          </p>
        </div>

        {/* Cash + UPI */}
        <div className="mb-4 grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="cashSales" className="mb-1.5 block text-xs font-semibold text-stone-500">
              💵 Cash Sales
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg font-bold text-stone-400">
                ₹
              </span>
              <input
                id="cashSales"
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                value={cashSales}
                onChange={(e) => setCashSales(e.target.value)}
                className="h-14 w-full rounded-xl border-2 border-stone-200 bg-white pl-7 pr-3 text-base font-bold text-stone-900 focus:border-teal-500 focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label htmlFor="upiSales" className="mb-1.5 block text-xs font-semibold text-stone-500">
              📱 UPI Sales
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg font-bold text-stone-400">
                ₹
              </span>
              <input
                id="upiSales"
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                value={upiSales}
                onChange={(e) => setUpiSales(e.target.value)}
                className="h-14 w-full rounded-xl border-2 border-stone-200 bg-white pl-7 pr-3 text-base font-bold text-stone-900 focus:border-teal-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Total sales display */}
        <div className="mb-4 rounded-xl bg-stone-50 px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-stone-500">Kul Galla (Total Sales)</span>
            <span className="text-lg font-black text-stone-900">{fmt(totalSales)}</span>
          </div>
        </div>

        {/* Margin slider */}
        <div className="mb-5">
          <div className="mb-2 flex items-center justify-between">
            <label htmlFor="marginSlider" className="text-xs font-semibold text-stone-500">
              Nafa % (Margin)
            </label>
            <span className="rounded-full bg-teal-50 px-4 py-1.5 text-sm font-black text-teal-700">
              {Number(margin).toFixed(1)}%
            </span>
          </div>
          <input
            id="marginSlider"
            type="range"
            min="5"
            max="100"
            step="0.5"
            value={margin}
            onChange={(e) => setMargin(e.target.value)}
            className="h-3 w-full cursor-pointer appearance-none rounded-full bg-stone-200"
          />
          <div className="mt-1 flex justify-between text-[10px] text-stone-400">
            <span>5%</span>
            <span>50%</span>
            <span>100%</span>
          </div>
        </div>

        {/* Local daily loan payment */}
        <div className="mb-5 rounded-xl border-2 border-stone-100 bg-stone-50 p-4">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={includeLocalDailyLoanPayment}
              onChange={(e) => setIncludeLocalDailyLoanPayment(e.target.checked)}
              className="h-5 w-5 rounded border-stone-300 text-teal-700"
            />
            <span className="text-sm font-semibold text-stone-700">
              Aaj local daily loan payment kiya
            </span>
          </label>

          {includeLocalDailyLoanPayment ? (
            <div className="mt-3">
              <label
                htmlFor="localDailyLoanPayment"
                className="mb-1.5 block text-xs font-semibold text-stone-500"
              >
                Payment Amount (₹) - daily value alag ho sakti hai
              </label>
              <input
                id="localDailyLoanPayment"
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                value={localDailyLoanPayment}
                onChange={(e) => setLocalDailyLoanPayment(e.target.value)}
                className="h-12 w-full rounded-xl border-2 border-stone-200 bg-white px-4 text-base font-bold text-stone-900 focus:border-teal-500 focus:outline-none"
              />
            </div>
          ) : null}
        </div>

        {/* Save button */}
        <button
          type="button"
          onClick={handleSaveDailyEntry}
          disabled={isPending}
          className="h-14 w-full rounded-xl bg-teal-700 text-base font-bold text-white active:bg-teal-800 disabled:opacity-60"
        >
          {isPending ? "Saving..." : "Galla Band Karo ✓"}
        </button>

        {savedAt ? (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-green-50 px-4 py-3">
            <CheckCircle2 size={18} className="text-green-600" />
            <p className="text-sm font-semibold text-green-800">Saved at {savedAt}</p>
          </div>
        ) : null}
      </div>

      {/* ── EXPENSE LOG ──────────────────────────────────────────────────── */}
      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-stone-100">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-base font-bold text-stone-900">
            Kharche Log <span className="text-sm font-normal text-stone-400">(Expenses)</span>
          </p>
          {persistedExpenseCount > 0 ? (
            <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-bold text-rose-700">
              {persistedExpenseCount} entries • {fmt(new Decimal(persistedExpenseTotal))}
            </span>
          ) : null}
        </div>

        {/* Amount input */}
        <div className="mb-3">
          <label htmlFor="expenseAmount" className="mb-1.5 block text-xs font-semibold text-stone-500">
            Amount (₹)
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg font-bold text-stone-400">
              ₹
            </span>
            <input
              id="expenseAmount"
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              value={expenseAmount}
              onChange={(e) => setExpenseAmount(e.target.value)}
              placeholder="0"
              className="h-14 w-full rounded-xl border-2 border-stone-200 bg-white pl-7 pr-3 text-base font-bold text-stone-900 focus:border-teal-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Category pills */}
        <div className="mb-3">
          <p className="mb-2 text-xs font-semibold text-stone-500">Category</p>
          <div className="flex flex-wrap gap-2">
            {expenseCategories.map((cat) => (
              <button
                key={cat.value}
                type="button"
                onClick={() => setExpenseCategory(cat.value)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                  expenseCategory === cat.value
                    ? "bg-stone-900 text-white"
                    : "bg-stone-100 text-stone-600 active:bg-stone-200"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Optional description */}
        <div className="mb-4">
          <label htmlFor="expenseDescription" className="mb-1.5 block text-xs font-semibold text-stone-500">
            Note <span className="font-normal">(optional)</span>
          </label>
          <input
            id="expenseDescription"
            type="text"
            value={expenseDescription}
            onChange={(e) => setExpenseDescription(e.target.value)}
            placeholder="e.g. Chai for 3 customers"
            className="h-12 w-full rounded-xl border-2 border-stone-200 bg-white px-4 text-base text-stone-900 focus:border-teal-500 focus:outline-none"
          />
        </div>

        <button
          type="button"
          onClick={handleAddExpense}
          disabled={isPending}
          className="h-14 w-full rounded-xl border-2 border-stone-200 bg-white text-base font-bold text-stone-800 active:bg-stone-50 disabled:opacity-60"
        >
          {isPending ? "Logging..." : "+ Kharcha Add Karo"}
        </button>

        {expenseSaved ? (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-green-50 px-4 py-3">
            <CheckCircle2 size={18} className="text-green-600" />
            <p className="text-sm font-semibold text-green-800">Expense logged</p>
          </div>
        ) : null}

        {/* Quick expense list (session) */}
        {quickExpenses.length > 0 ? (
          <div className="mt-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">
              This Session
            </p>
            {quickExpenses.map((expense) => (
              <div
                key={expense.id}
                className="flex items-center justify-between rounded-xl bg-stone-50 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-stone-800">{expense.category}</p>
                  {expense.description ? (
                    <p className="text-xs text-stone-400">{expense.description}</p>
                  ) : null}
                </div>
                <p className="text-base font-bold text-stone-900">
                  {fmt(new Decimal(expense.amount || "0"))}
                </p>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
