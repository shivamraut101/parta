"use client";

import Decimal from "decimal.js";
import { Pencil } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";

import {
  recordCurrentAccountAdjustment,
  recordDebtDrawdown,
  recordDebtPayment,
} from "@/app/debt-engine/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type DebtTargetType = "BANK_CC" | "LOCAL_LOAN";
type DebtPaymentSource = "CASH" | "UPI" | "NEFT" | "IMPS" | "CC_TO_CA_TRANSFER" | "CA_TO_CC_TRANSFER";
type DebtAccountKind =
  | "BANK_CC"
  | "BANK_TERM_LOAN"
  | "BANK_OD"
  | "BANK_BILL_DISCOUNT"
  | "LOCAL_DAILY"
  | "LOCAL_MONTHLY"
  | "LOCAL_BULLET"
  | "LOCAL_FLEXI";

type DebtRateInputType =
  | "ANNUAL_PERCENT"
  | "MONTHLY_PERCENT"
  | "DAILY_FIXED"
  | "EMI_DAILY"
  | "EMI_MONTHLY";

type DebtAccountOption = {
  id: string;
  name: string;
  lenderName: string | null;
  linkedCurrentAccountName: string | null;
  kind: DebtAccountKind;
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
  rateInputType: DebtRateInputType;
};

type DebtAccountMovement = {
  id: string;
  debtAccountId: string;
  movementType: "OPENING" | "DRAWDOWN" | "REPAYMENT" | "ADJUSTMENT";
  amount: string;
  movementDate: string;
  source: DebtPaymentSource | null;
  notes: string | null;
};

type CurrentAccountSnapshot = {
  id: string;
  accountName: string;
  openingBalance: string;
  currentBalance: string;
};

type CurrentAccountMovement = {
  id: string;
  movementDate: string;
  movementType: "SALES_INFLOW" | "CC_DRAWDOWN_INFLOW" | "EXTERNAL_DEPOSIT_INFLOW" | "SUPPLIER_PAYMENT_OUTFLOW" | "CC_REPAYMENT_OUTFLOW" | "EXPENSE_OUTFLOW" | "ADJUSTMENT";
  amount: string;
  direction: number;
  description: string | null;
  notes: string | null;
};

function fmt(value: Decimal) {
  return `₹${Number(value.toFixed(2)).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function kindLabel(kind: DebtAccountKind) {
  const map: Record<DebtAccountKind, string> = {
    BANK_CC: "Bank CC",
    BANK_TERM_LOAN: "Bank Term Loan",
    BANK_OD: "Bank OD",
    BANK_BILL_DISCOUNT: "Bill Discount",
    LOCAL_DAILY: "Local Daily",
    LOCAL_MONTHLY: "Local Monthly",
    LOCAL_BULLET: "Local Bullet",
    LOCAL_FLEXI: "Local Flexi",
  };
  return map[kind];
}

function movementLabel(type: DebtAccountMovement["movementType"]) {
  const map: Record<DebtAccountMovement["movementType"], string> = {
    OPENING: "Opening",
    DRAWDOWN: "Take Out (Drawdown)",
    REPAYMENT: "Put Back (Repayment)",
    ADJUSTMENT: "Manual Adjust",
  };
  return map[type];
}

function paymentSourceLabel(source: DebtPaymentSource) {
  const map: Record<DebtPaymentSource, string> = {
    CASH: "Cash",
    UPI: "UPI",
    NEFT: "NEFT",
    IMPS: "IMPS",
    CC_TO_CA_TRANSFER: "CC -> Current A/c",
    CA_TO_CC_TRANSFER: "Current A/c -> CC",
  };
  return map[source];
}

function caMovementLabel(type: CurrentAccountMovement["movementType"]) {
  const map: Record<CurrentAccountMovement["movementType"], string> = {
    SALES_INFLOW: "Sales Inflow",
    CC_DRAWDOWN_INFLOW: "CC -> CA",
    EXTERNAL_DEPOSIT_INFLOW: "External Deposit",
    SUPPLIER_PAYMENT_OUTFLOW: "Supplier Payment",
    CC_REPAYMENT_OUTFLOW: "CA -> CC",
    EXPENSE_OUTFLOW: "Expense",
    ADJUSTMENT: "Adjustment",
  };
  return map[type];
}

function isRevolvingKind(kind: DebtAccountKind) {
  return kind === "BANK_CC" || kind === "BANK_OD" || kind === "LOCAL_FLEXI";
}

const drawSourceOptions: DebtPaymentSource[] = [
  "CC_TO_CA_TRANSFER",
  "CASH",
  "UPI",
  "NEFT",
  "IMPS",
];

const repaymentSourceOptions: DebtPaymentSource[] = [
  "CA_TO_CC_TRANSFER",
  "CASH",
  "UPI",
  "NEFT",
  "IMPS",
];

export function DebtOptimizerCard({
  today,
  leakPerHour,
  accounts,
  recentMovements,
  currentAccount,
  recentCurrentAccountMovements,
  recommendation,
}: {
  today: string;
  leakPerHour: string;
  accounts: DebtAccountOption[];
  recentMovements: DebtAccountMovement[];
  currentAccount: CurrentAccountSnapshot | null;
  recentCurrentAccountMovements: CurrentAccountMovement[];
  recommendation: {
    priorityTarget: DebtTargetType;
    recommendedPayment: string;
    savingsPerMonth: string;
  };
}) {
  const [isPending, startTransition] = useTransition();
  const [isDrawPending, startDrawTransition] = useTransition();
  const [isCaEntryPending, startCaEntryTransition] = useTransition();

  const [amount, setAmount] = useState("0");
  const [paymentDate, setPaymentDate] = useState(today);
  const [targetType, setTargetType] = useState<DebtTargetType>(recommendation.priorityTarget);
  const [source, setSource] = useState<DebtPaymentSource>("CASH");
  const [debtAccountId, setDebtAccountId] = useState("");

  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [saved, setSaved] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [drawError, setDrawError] = useState<string | null>(null);
  const [drawSuccess, setDrawSuccess] = useState<string | null>(null);

  const [drawDebtAccountId, setDrawDebtAccountId] = useState("");
  const [drawAmount, setDrawAmount] = useState("0");
  const [drawDate, setDrawDate] = useState(today);
  const [drawSource, setDrawSource] = useState<DebtPaymentSource>("CASH");
  const [drawNotes, setDrawNotes] = useState("");

  const [caEntryAmount, setCaEntryAmount] = useState("0");
  const [caEntryDate, setCaEntryDate] = useState(today);
  const [caEntryDirection, setCaEntryDirection] = useState<"IN" | "OUT">("IN");
  const [caEntryNotes, setCaEntryNotes] = useState("");
  const [caEntryError, setCaEntryError] = useState<string | null>(null);
  const [caEntrySuccess, setCaEntrySuccess] = useState<string | null>(null);

  const leakBase = useMemo(() => new Decimal(leakPerHour || "0"), [leakPerHour]);
  const leakPerSecond = useMemo(() => leakBase.div(3600), [leakBase]);
  const cumulativeLeak = useMemo(
    () => leakPerSecond.mul(secondsElapsed),
    [leakPerSecond, secondsElapsed],
  );

  const recentCaInflow = useMemo(
    () => recentCurrentAccountMovements
      .filter((m) => m.direction === 1)
      .reduce((sum, m) => sum.add(new Decimal(m.amount || "0")), new Decimal(0)),
    [recentCurrentAccountMovements],
  );

  const recentCaOutflow = useMemo(
    () => recentCurrentAccountMovements
      .filter((m) => m.direction === -1)
      .reduce((sum, m) => sum.add(new Decimal(m.amount || "0")), new Decimal(0)),
    [recentCurrentAccountMovements],
  );

  const revolvingAccounts = useMemo(
    () => accounts.filter((a) => isRevolvingKind(a.kind)),
    [accounts],
  );

  const effectiveDrawDebtAccountId = drawDebtAccountId || revolvingAccounts[0]?.id || "";
  const selectedDrawAccount = useMemo(
    () => accounts.find((a) => a.id === effectiveDrawDebtAccountId) || null,
    [accounts, effectiveDrawDebtAccountId],
  );
  const selectedRepaymentAccount = useMemo(
    () => accounts.find((a) => a.id === debtAccountId) || null,
    [accounts, debtAccountId],
  );

  useEffect(() => {
    const interval = window.setInterval(() => {
      setSecondsElapsed((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(interval);
  }, []);

  function handleSubmit() {
    if (accounts.length > 0 && !debtAccountId) {
      setPaymentError("Please select a loan account.");
      return;
    }

    if (new Decimal(amount || "0").lte(0)) {
      setPaymentError("Payment amount 0 se bada hona chahiye.");
      return;
    }

    setPaymentError(null);
    const fd = new FormData();
    fd.set("amount", amount);
    fd.set("date", paymentDate);
    fd.set("targetType", targetType);
    fd.set("source", source);
    if (debtAccountId) fd.set("debtAccountId", debtAccountId);

    startTransition(async () => {
      try {
        await recordDebtPayment(fd);
        setAmount("0");
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Payment save nahi ho paya.";
        setPaymentError(message);
      }
    });
  }

  function handleRecordDrawdown() {
    setDrawError(null);
    setDrawSuccess(null);

    if (!effectiveDrawDebtAccountId) {
      setDrawError("CC account select karo.");
      return;
    }

    if (new Decimal(drawAmount || "0").lte(0)) {
      setDrawError("Take-out amount 0 se bada hona chahiye.");
      return;
    }

    const fd = new FormData();
    fd.set("debtAccountId", effectiveDrawDebtAccountId);
    fd.set("amount", drawAmount);
    fd.set("date", drawDate);
    fd.set("source", drawSource);
    if (drawNotes.trim()) fd.set("notes", drawNotes.trim());

    startDrawTransition(async () => {
      try {
        await recordDebtDrawdown(fd);
        setDrawAmount("0");
        setDrawNotes("");
        setDrawSuccess("CC take-out recorded.");
        setTimeout(() => setDrawSuccess(null), 2500);
      } catch (error) {
        const message = error instanceof Error ? error.message : "CC take-out save nahi ho paya.";
        setDrawError(message);
      }
    });
  }

  function handleRecordCurrentAccountEntry() {
    setCaEntryError(null);
    setCaEntrySuccess(null);

    if (new Decimal(caEntryAmount || "0").lte(0)) {
      setCaEntryError("Amount 0 se bada hona chahiye.");
      return;
    }

    const fd = new FormData();
    fd.set("amount", caEntryAmount);
    fd.set("date", caEntryDate);
    fd.set("direction", caEntryDirection);
    fd.set("accountName", currentAccount?.accountName || selectedDrawAccount?.linkedCurrentAccountName || "Current Account");
    if (caEntryNotes.trim()) fd.set("notes", caEntryNotes.trim());

    startCaEntryTransition(async () => {
      try {
        await recordCurrentAccountAdjustment(fd);
        setCaEntryAmount("0");
        setCaEntryNotes("");
        setCaEntrySuccess("Current A/c entry recorded.");
        setTimeout(() => setCaEntrySuccess(null), 2500);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Current account entry save nahi ho paya.";
        setCaEntryError(message);
      }
    });
  }

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl border-none bg-linear-to-br from-stone-900 to-stone-800 text-white shadow-md">
        <CardContent className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-red-300">
            Is Page Ko Khola Tab Se Byaaj Gaya
          </p>
          <p className="mt-1 text-5xl font-black text-red-300">{fmt(cumulativeLeak)}</p>
          <p className="mt-1.5 text-sm text-stone-400">
            Roz ka drain: <span className="font-bold text-stone-200">{fmt(leakBase.mul(24))}</span>
          </p>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-green-200 bg-green-50">
        <CardContent className="p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-green-600">
            Marwari Salah - Aaj Kya Karo
          </p>
          <p className="mt-2 text-base font-bold text-green-900">
            {fmt(new Decimal(recommendation.recommendedPayment || "0"))} daalo{" "}
            {recommendation.priorityTarget === "LOCAL_LOAN" ? "Local Loan" : "Bank Loan"} mein
          </p>
          <p className="mt-1 text-sm text-green-700">
            Isse mahine mein <span className="font-bold">{fmt(new Decimal(recommendation.savingsPerMonth || "0"))}</span> bachenge
          </p>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-sky-200 bg-sky-50">
        <CardHeader className="border-b-0 p-5 pb-3">
          <CardTitle className="text-base font-bold text-sky-900">Current Account Tracker</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 p-5 pt-0">
          {currentAccount ? (
            <>
              <div className="grid grid-cols-2 gap-2 rounded-xl bg-white p-3 text-[11px] text-slate-700 ring-1 ring-sky-100">
                <p>
                  A/c: <span className="font-bold text-slate-900">{currentAccount.accountName}</span>
                </p>
                <p>
                  Opening: <span className="font-bold text-slate-900">{fmt(new Decimal(currentAccount.openingBalance || "0"))}</span>
                </p>
                <p>
                  Recent Inflow: <span className="font-bold text-green-700">{fmt(recentCaInflow)}</span>
                </p>
                <p>
                  Recent Outflow: <span className="font-bold text-red-700">{fmt(recentCaOutflow)}</span>
                </p>
              </div>

              <div className="rounded-xl bg-slate-900 px-4 py-3 text-white">
                <p className="text-xs uppercase tracking-wider text-slate-300">Current Balance</p>
                <p className="mt-1 text-3xl font-black text-sky-300">{fmt(new Decimal(currentAccount.currentBalance || "0"))}</p>
              </div>

              {recentCurrentAccountMovements.length > 0 ? (
                <div className="space-y-1 rounded-xl border border-sky-100 bg-white p-2">
                  {recentCurrentAccountMovements.slice(0, 6).map((movement) => (
                    <div key={movement.id} className="flex items-start justify-between gap-2 text-[11px] text-slate-600">
                      <p className="min-w-0 leading-tight break-words">
                        <span className="font-semibold text-slate-800">{caMovementLabel(movement.movementType)}</span>
                        <span className="text-slate-500"> · {movement.movementDate}</span>
                      </p>
                      <p className={`shrink-0 pl-2 text-right font-bold ${movement.direction === 1 ? "text-green-700" : "text-red-700"}`}>
                        {movement.direction === 1 ? "+" : "-"}
                        {fmt(new Decimal(movement.amount || "0")).replace("Rs ", "")}
                        <Link
                          href={`/debt-engine/transactions/edit?kind=ca&id=${movement.id}&returnTo=${encodeURIComponent("/debt-engine")}`}
                          className="ml-2 inline-flex h-6 w-6 items-center justify-center rounded-md border border-sky-200 align-middle text-sky-700 hover:bg-sky-50"
                          aria-label="Edit transaction"
                          title="Edit transaction"
                        >
                          <Pencil size={12} />
                        </Link>
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-lg bg-white px-3 py-2 text-xs text-slate-500 ring-1 ring-sky-100">
                  Abhi tak koi CA movement record nahi hua.
                </p>
              )}

              <div>
                <Link
                  href="/debt-engine/ledger"
                  className="inline-flex h-9 items-center rounded-xl border border-sky-200 bg-white px-3 text-xs font-bold text-sky-800 hover:bg-sky-100"
                >
                  Open Full Ledger
                </Link>
              </div>
            </>
          ) : (
            <p className="rounded-lg bg-white px-3 py-2 text-xs text-slate-500 ring-1 ring-sky-100">
              Current Account profile abhi setup nahi hai. Financial Identity me account name set karo.
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-cyan-200">
        <CardHeader className="border-b-0 p-5 pb-3">
          <CardTitle className="text-base font-bold text-cyan-900">Current A/c Manual Entry</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 p-5 pt-0">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1.5 block text-xs font-semibold text-stone-500">Amount (₹)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={caEntryAmount}
                onChange={(e) => setCaEntryAmount(e.target.value)}
                className="h-12 rounded-xl border-slate-200 px-4 text-sm"
              />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs font-semibold text-stone-500">Date</Label>
              <Input
                type="date"
                value={caEntryDate}
                onChange={(e) => setCaEntryDate(e.target.value)}
                className="h-12 rounded-xl border-slate-200 px-4 text-sm"
              />
            </div>
          </div>

          <div>
            <Label className="mb-2 block text-xs font-semibold text-stone-500">Entry Type</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={caEntryDirection === "IN" ? "default" : "secondary"}
                onClick={() => setCaEntryDirection("IN")}
                className={`h-11 rounded-xl text-sm font-bold ${
                  caEntryDirection === "IN"
                    ? "bg-green-700 text-white hover:bg-green-800"
                    : "border border-stone-200 bg-white text-stone-700 hover:bg-stone-50"
                }`}
              >
                Inflow (+)
              </Button>
              <Button
                type="button"
                variant={caEntryDirection === "OUT" ? "default" : "secondary"}
                onClick={() => setCaEntryDirection("OUT")}
                className={`h-11 rounded-xl text-sm font-bold ${
                  caEntryDirection === "OUT"
                    ? "bg-red-700 text-white hover:bg-red-800"
                    : "border border-stone-200 bg-white text-stone-700 hover:bg-stone-50"
                }`}
              >
                Outflow (-)
              </Button>
            </div>
          </div>

          <div>
            <Label className="mb-1.5 block text-xs font-semibold text-stone-500">Notes (optional)</Label>
            <Input
              value={caEntryNotes}
              onChange={(e) => setCaEntryNotes(e.target.value)}
              placeholder="e.g. Bank charges, owner deposit, misc transfer"
              className="h-12 rounded-xl border-slate-200 px-4 text-sm"
            />
          </div>

          <Button
            type="button"
            onClick={handleRecordCurrentAccountEntry}
            disabled={isCaEntryPending}
            className="h-12 w-full rounded-xl bg-cyan-700 text-base font-bold text-white hover:bg-cyan-800"
          >
            {isCaEntryPending ? "CA entry record ho rahi hai..." : "Record CA Entry"}
          </Button>

          {caEntryError ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
              {caEntryError}
            </p>
          ) : null}

          {caEntrySuccess ? (
            <p className="text-center text-sm font-semibold text-green-700">{caEntrySuccess}</p>
          ) : null}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-stone-200">
        <CardHeader className="border-b-0 p-5 pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-bold text-stone-900">Loan Accounts</CardTitle>
            <Link
              href="/financial-identity"
              className="rounded-lg bg-stone-100 px-3 py-1.5 text-xs font-bold text-stone-700 hover:bg-stone-200"
            >
              + Manage Loans
            </Link>
          </div>
          <p className="mt-0.5 text-[11px] text-stone-400">Add/edit loan accounts in Financial Identity</p>
        </CardHeader>
        <CardContent className="p-5 pt-0">
          {accounts.length === 0 ? (
            <p className="rounded-xl bg-stone-50 px-4 py-3 text-sm text-stone-500">
              Koi loan account nahi mila.{" "}
              <Link href="/financial-identity" className="font-semibold text-teal-700 underline">
                Financial Identity me add karo
              </Link>
              .
            </p>
          ) : (
            <div className="space-y-2">
              {accounts.map((account) => (
                <Card key={account.id} className="rounded-xl border-stone-200">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold text-stone-800">{account.name}</p>
                        <p className="text-xs text-stone-500">{kindLabel(account.kind)}</p>
                      </div>
                    </div>

                    <div className="mt-2 grid grid-cols-2 gap-2 rounded-lg bg-stone-50 p-2 text-[11px] text-stone-600">
                      {isRevolvingKind(account.kind) ? (
                        <>
                          <p>
                            Started (CC Limit): <span className="font-bold text-stone-800">{fmt(new Decimal(account.creditLimit || "0"))}</span>
                          </p>
                          <p>
                            Used now: <span className="font-bold text-stone-800">{fmt(new Decimal(account.outstandingAmount || "0"))}</span>
                          </p>
                          <p>
                            Left in CC: <span className="font-bold text-green-700">{fmt(Decimal.max(new Decimal(account.creditLimit || "0").minus(new Decimal(account.outstandingAmount || "0")), 0))}</span>
                          </p>
                          <p>
                            Total taken out (auto): <span className="font-bold text-stone-800">{fmt(new Decimal(account.totalDrawnAmount || "0"))}</span>
                          </p>
                          <p>
                            Total put back (auto): <span className="font-bold text-stone-800">{fmt(new Decimal(account.totalRepaidAmount || "0"))}</span>
                          </p>
                        </>
                      ) : (
                        <>
                          <p>
                            Started: <span className="font-bold text-stone-800">{fmt(new Decimal(account.principalAmount || "0"))}</span>
                          </p>
                          <p>
                            Left: <span className="font-bold text-stone-800">{fmt(new Decimal(account.outstandingAmount || "0"))}</span>
                          </p>
                          <p>
                            Total taken out (auto): <span className="font-bold text-stone-800">{fmt(new Decimal(account.totalDrawnAmount || "0"))}</span>
                          </p>
                          <p>
                            Total put back (auto): <span className="font-bold text-stone-800">{fmt(new Decimal(account.totalRepaidAmount || "0"))}</span>
                          </p>
                        </>
                      )}
                    </div>

                    {recentMovements.filter((m) => m.debtAccountId === account.id).slice(0, 3).length > 0 ? (
                      <div className="mt-2 space-y-1 rounded-lg border border-stone-100 bg-white p-2">
                        {recentMovements.filter((m) => m.debtAccountId === account.id).slice(0, 3).map((movement) => (
                          <div key={movement.id} className="flex items-start justify-between gap-2 text-[11px] text-stone-500">
                            <p className="min-w-0 leading-tight break-words">
                              <span className="font-semibold text-stone-700">{movementLabel(movement.movementType)}</span>
                              {movement.source ? ` (${paymentSourceLabel(movement.source)})` : ""}
                              <span className="text-stone-500"> · {movement.movementDate}</span>
                            </p>
                            <p className="shrink-0 pl-2 text-right font-bold text-stone-800">
                              {fmt(new Decimal(movement.amount || "0"))}
                              <Link
                                href={`/debt-engine/transactions/edit?kind=debt&id=${movement.id}&returnTo=${encodeURIComponent("/debt-engine")}`}
                                className="ml-2 inline-flex h-6 w-6 items-center justify-center rounded-md border border-sky-200 align-middle text-sky-700 hover:bg-sky-50"
                                aria-label="Edit transaction"
                                title="Edit transaction"
                              >
                                <Pencil size={12} />
                              </Link>
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-stone-200">
        <CardHeader className="border-b-0 p-5 pb-3">
          <CardTitle className="text-base font-bold text-stone-900">
            CC Flow Tracker <span className="text-sm font-normal text-stone-400">(Take Out / Drawdown)</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 p-5 pt-0">
          <div>
            <Label className="mb-1.5 block text-xs font-semibold text-stone-500">CC/OD/Flexi Account</Label>
            <Select
              value={effectiveDrawDebtAccountId}
              onValueChange={(id) => {
                setDrawDebtAccountId(id);
              }}
            >
              <SelectTrigger className="h-12 rounded-xl border-slate-200 bg-white px-4 text-sm">
                <SelectValue placeholder="-- Select CC Account --" />
              </SelectTrigger>
              <SelectContent>
                {revolvingAccounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name} ({kindLabel(a.kind)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1.5 block text-xs font-semibold text-stone-500">Take Out Amount (₹) (CC se nikala hua)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={drawAmount}
                onChange={(e) => setDrawAmount(e.target.value)}
                className="h-12 rounded-xl border-slate-200 px-4 text-sm"
              />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs font-semibold text-stone-500">Tarikh</Label>
              <Input
                type="date"
                value={drawDate}
                onChange={(e) => setDrawDate(e.target.value)}
                className="h-12 rounded-xl border-slate-200 px-4 text-sm"
              />
            </div>
          </div>

          <p className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
            Yeh entry Outstanding ko badhati hai aur &quot;Total taken out (auto)&quot; me add hoti hai.
          </p>

          {selectedDrawAccount?.linkedCurrentAccountName ? (
            <p className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-[11px] text-blue-900">
              Yeh account linked hai ({selectedDrawAccount.linkedCurrentAccountName}): &quot;CC to Current A/c&quot; transfer ho sakta hai, ya direct CASH/UPI/NEFT/IMPS le sakte ho kahi aur.
            </p>
          ) : null}

          <div>
            <Label className="mb-2 block text-xs font-semibold text-stone-500">Source</Label>
            <div className="grid grid-cols-2 gap-2">
              {drawSourceOptions.map((s) => (
                <Button
                  key={s}
                  type="button"
                  variant={drawSource === s ? "default" : "secondary"}
                  onClick={() => setDrawSource(s)}
                  className={`h-10 flex-1 rounded-xl text-sm font-bold ${
                    drawSource === s
                      ? "bg-stone-900 text-white hover:bg-stone-800"
                      : "border border-stone-200 bg-white text-stone-700 hover:bg-stone-50"
                  }`}
                >
                  {paymentSourceLabel(s)}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <Label className="mb-1.5 block text-xs font-semibold text-stone-500">Notes (optional)</Label>
            <Input
              value={drawNotes}
              onChange={(e) => setDrawNotes(e.target.value)}
              placeholder="Kis kaam ke liye nikala"
              className="h-12 rounded-xl border-slate-200 px-4 text-sm"
            />
          </div>

          <Button
            type="button"
            onClick={handleRecordDrawdown}
            disabled={isDrawPending || !effectiveDrawDebtAccountId}
            className="h-12 w-full rounded-xl bg-amber-600 text-base font-bold text-white hover:bg-amber-700"
          >
            {isDrawPending ? "Saving..." : "CC Se Nikalo"}
          </Button>

          {drawError ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
              {drawError}
            </p>
          ) : null}

          {drawSuccess ? (
            <p className="text-center text-sm font-semibold text-green-700">{drawSuccess}</p>
          ) : null}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-stone-200">
        <CardHeader className="border-b-0 p-5 pb-3">
          <CardTitle className="text-base font-bold text-stone-900">
            Put Back / Repayment <span className="text-sm font-normal text-stone-400">(CC me jama karo ya loan chukao)</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 p-5 pt-0">
          <div>
            <Label className="mb-1.5 block text-xs font-semibold text-stone-500">
              Kaunsa Loan?
            </Label>
            <Select
              value={debtAccountId}
              onValueChange={(id) => {
                setDebtAccountId(id);
                const selected = accounts.find((a) => a.id === id);
                if (selected) {
                  setTargetType(selected.kind.startsWith("BANK_") ? "BANK_CC" : "LOCAL_LOAN");
                }
              }}
            >
              <SelectTrigger aria-label="Loan Account" className="h-12 rounded-xl border-slate-200 px-4 text-sm text-stone-900">
                <SelectValue placeholder="-- Select Loan Account --" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name} ({kindLabel(a.kind)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="debtAmount" className="mb-1.5 block text-xs font-semibold text-stone-500">
                Put Back Amount (₹) (wapas diya hua)
              </Label>
              <Input
                id="debtAmount"
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="h-12 rounded-xl border-slate-200 bg-white px-4 text-base font-bold text-stone-900"
              />
            </div>
            <div>
              <Label htmlFor="debtDate" className="mb-1.5 block text-xs font-semibold text-stone-500">
                Tarikh
              </Label>
              <Input
                id="debtDate"
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="h-12 rounded-xl border-slate-200 bg-white px-4 text-base text-stone-900"
              />
            </div>
          </div>

          <p className="rounded-lg border border-teal-100 bg-teal-50 px-3 py-2 text-[11px] text-teal-900">
            Yeh entry Outstanding ko ghatati hai aur &quot;Total put back (auto)&quot; me add hoti hai.
          </p>

          {selectedRepaymentAccount?.linkedCurrentAccountName && isRevolvingKind(selectedRepaymentAccount.kind) ? (
            <p className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-[11px] text-blue-900">
              Yeh account linked hai ({selectedRepaymentAccount.linkedCurrentAccountName}): Direct CASH/UPI/NEFT/IMPS kar sakte ho, ya &quot;Current A/c to CC&quot; transfer choose karo jab extra cash ho.
            </p>
          ) : null}

          <div>
            <Label className="mb-2 block text-xs font-semibold text-stone-500">Kaise Dena Hai</Label>
            <div className="grid grid-cols-2 gap-2">
              {repaymentSourceOptions.map((s) => (
                <Button
                  key={s}
                  type="button"
                  variant={source === s ? "default" : "secondary"}
                  onClick={() => setSource(s)}
                  className={`h-12 flex-1 rounded-xl text-sm font-bold ${
                    source === s
                      ? "bg-stone-900 text-white hover:bg-stone-800"
                      : "border border-stone-200 bg-white text-stone-700 hover:bg-stone-50"
                  }`}
                >
                  {paymentSourceLabel(s)}
                </Button>
              ))}
            </div>
          </div>

          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isPending || (accounts.length > 0 && !debtAccountId)}
            className="h-12 w-full rounded-xl bg-teal-700 text-base font-bold text-white hover:bg-teal-800"
          >
            {isPending ? "Repayment record ho rahi hai..." : "Karj Chukao"}
          </Button>

          {paymentError ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
              {paymentError}
            </p>
          ) : null}

          {saved ? (
            <p className="text-center text-sm font-semibold text-green-700">Payment recorded</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
