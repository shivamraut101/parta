"use client";

import Decimal from "decimal.js";
import { useEffect, useMemo, useState, useTransition } from "react";

import {
  createDebtAccount,
  recordDebtDrawdown,
  recordDebtPayment,
  updateDebtAccount,
} from "@/app/debt-engine/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

type DebtTargetType = "BANK_CC" | "LOCAL_LOAN";
type DebtPaymentSource = "CASH" | "UPI";
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
    DRAWDOWN: "Take Out",
    REPAYMENT: "Put Back",
    ADJUSTMENT: "Manual Adjust",
  };
  return map[type];
}

function isRevolvingKind(kind: DebtAccountKind) {
  return kind === "BANK_CC" || kind === "BANK_OD" || kind === "LOCAL_FLEXI";
}

function defaultRateInputTypeForKind(kind: DebtAccountKind): DebtRateInputType {
  if (kind === "LOCAL_DAILY") return "DAILY_FIXED";
  if (kind === "LOCAL_MONTHLY") return "MONTHLY_PERCENT";
  if (kind === "LOCAL_BULLET" || kind === "LOCAL_FLEXI") return "EMI_MONTHLY";
  return "ANNUAL_PERCENT";
}

const bankKinds: DebtAccountKind[] = [
  "BANK_CC",
  "BANK_TERM_LOAN",
  "BANK_OD",
  "BANK_BILL_DISCOUNT",
];

const localKinds: DebtAccountKind[] = [
  "LOCAL_DAILY",
  "LOCAL_MONTHLY",
  "LOCAL_BULLET",
  "LOCAL_FLEXI",
];

export function DebtOptimizerCard({
  today,
  leakPerHour,
  accounts,
  recentMovements,
  recommendation,
}: {
  today: string;
  leakPerHour: string;
  accounts: DebtAccountOption[];
  recentMovements: DebtAccountMovement[];
  recommendation: {
    priorityTarget: DebtTargetType;
    recommendedPayment: string;
    savingsPerMonth: string;
  };
}) {
  const [isPending, startTransition] = useTransition();
  const [isAccountPending, startAccountTransition] = useTransition();
  const [isDrawPending, startDrawTransition] = useTransition();

  const [amount, setAmount] = useState("0");
  const [paymentDate, setPaymentDate] = useState(today);
  const [targetType, setTargetType] = useState<DebtTargetType>(recommendation.priorityTarget);
  const [source, setSource] = useState<DebtPaymentSource>("CASH");
  const [debtAccountId, setDebtAccountId] = useState("");

  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [saved, setSaved] = useState(false);
  const [showAccountDialog, setShowAccountDialog] = useState(false);
  const [accountFormMode, setAccountFormMode] = useState<"create" | "edit">("create");
  const [editingAccountId, setEditingAccountId] = useState("");
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [accountSuccess, setAccountSuccess] = useState<string | null>(null);
  const [drawError, setDrawError] = useState<string | null>(null);
  const [drawSuccess, setDrawSuccess] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [lenderName, setLenderName] = useState("");
  const [kind, setKind] = useState<DebtAccountKind>("BANK_CC");
  const [rateInputType, setRateInputType] = useState<DebtRateInputType>("ANNUAL_PERCENT");
  const [creditLimit, setCreditLimit] = useState("0");
  const [principalAmount, setPrincipalAmount] = useState("0");
  const [outstandingAmount, setOutstandingAmount] = useState("0");
  const [annualRatePa, setAnnualRatePa] = useState("0");
  const [monthlyRate, setMonthlyRate] = useState("0");
  const [dailyFixedInterest, setDailyFixedInterest] = useState("0");
  const [installmentAmount, setInstallmentAmount] = useState("0");
  const [installmentFrequency, setInstallmentFrequency] = useState<"DAILY" | "WEEKLY" | "MONTHLY" | "BULLET">("MONTHLY");
  const [remainingInstallments, setRemainingInstallments] = useState("0");
  const [startDate, setStartDate] = useState(today);
  const [maturityDate, setMaturityDate] = useState("");
  const [notes, setNotes] = useState("");

  const [drawDebtAccountId, setDrawDebtAccountId] = useState("");
  const [drawAmount, setDrawAmount] = useState("0");
  const [drawDate, setDrawDate] = useState(today);
  const [drawSource, setDrawSource] = useState<DebtPaymentSource>("CASH");
  const [drawNotes, setDrawNotes] = useState("");

  const leakBase = useMemo(() => new Decimal(leakPerHour || "0"), [leakPerHour]);
  const leakPerSecond = useMemo(() => leakBase.div(3600), [leakBase]);
  const cumulativeLeak = useMemo(
    () => leakPerSecond.mul(secondsElapsed),
    [leakPerSecond, secondsElapsed],
  );

  const revolvingAccounts = useMemo(
    () => accounts.filter((a) => isRevolvingKind(a.kind)),
    [accounts],
  );

  const effectiveDrawDebtAccountId = drawDebtAccountId || revolvingAccounts[0]?.id || "";

  useEffect(() => {
    const interval = window.setInterval(() => {
      setSecondsElapsed((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(interval);
  }, []);

  function resetAccountForm() {
    setName("");
    setLenderName("");
    setKind("BANK_CC");
    setRateInputType("ANNUAL_PERCENT");
    setCreditLimit("0");
    setPrincipalAmount("0");
    setOutstandingAmount("0");
    setAnnualRatePa("0");
    setMonthlyRate("0");
    setDailyFixedInterest("0");
    setInstallmentAmount("0");
    setInstallmentFrequency("MONTHLY");
    setRemainingInstallments("0");
    setStartDate(today);
    setMaturityDate("");
    setNotes("");
    setEditingAccountId("");
  }

  function openCreateAccountDialog() {
    setAccountFormMode("create");
    setAccountError(null);
    resetAccountForm();
    setShowAccountDialog(true);
  }

  function openEditAccountDialog(account: DebtAccountOption) {
    setAccountFormMode("edit");
    setAccountError(null);
    setEditingAccountId(account.id);
    setName(account.name);
    setLenderName(account.lenderName || "");
    setKind(account.kind);
    setRateInputType(account.rateInputType);
    setCreditLimit(account.creditLimit || "0");
    setPrincipalAmount(account.principalAmount || "0");
    setOutstandingAmount(account.outstandingAmount || "0");
    setAnnualRatePa(account.annualRatePa || "0");
    setMonthlyRate(account.monthlyRate || "0");
    setDailyFixedInterest(account.dailyFixedInterest || "0");
    setInstallmentAmount(account.installmentAmount || "0");
    setInstallmentFrequency(account.installmentFrequency || "MONTHLY");
    setRemainingInstallments(String(account.remainingInstallments || 0));
    setStartDate(account.startDate || today);
    setMaturityDate(account.maturityDate || "");
    setNotes(account.notes || "");
    setShowAccountDialog(true);
  }

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

  function handleSaveAccount() {
    setAccountError(null);
    setAccountSuccess(null);

    if (!name.trim()) {
      setAccountError("Loan name required hai.");
      return;
    }

    if (accountFormMode === "create" && new Decimal(outstandingAmount || "0").lte(0)) {
      setAccountError("Outstanding amount 0 se bada hona chahiye.");
      return;
    }

    const fd = new FormData();
    if (accountFormMode === "edit") fd.set("debtAccountId", editingAccountId);
    fd.set("name", name);
    fd.set("lenderName", lenderName);
    fd.set("kind", kind);
    fd.set("rateInputType", rateInputType);
    fd.set("creditLimit", creditLimit);
    fd.set("principalAmount", principalAmount);
    fd.set("outstandingAmount", outstandingAmount);
    fd.set("annualRatePa", annualRatePa);
    fd.set("monthlyRate", monthlyRate);
    fd.set("dailyFixedInterest", dailyFixedInterest);
    fd.set("installmentAmount", installmentAmount);
    fd.set("installmentFrequency", installmentFrequency);
    fd.set("remainingInstallments", remainingInstallments);
    fd.set("startDate", startDate);
    if (maturityDate) fd.set("maturityDate", maturityDate);
    if (notes.trim()) fd.set("notes", notes.trim());

    startAccountTransition(async () => {
      try {
        if (accountFormMode === "create") {
          await createDebtAccount(fd);
        } else {
          await updateDebtAccount(fd);
        }
        setShowAccountDialog(false);
        resetAccountForm();
        setAccountSuccess(accountFormMode === "create" ? "Loan account saved successfully." : "Loan account updated successfully.");
        setTimeout(() => setAccountSuccess(null), 2500);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Loan save nahi ho paya.";
        setAccountError(message);
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

      <Card className="rounded-2xl border-stone-200">
        <CardHeader className="border-b-0 p-5 pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-bold text-stone-900">Loan Accounts</CardTitle>
            <Button
              type="button"
              onClick={openCreateAccountDialog}
              className="h-8 rounded-lg bg-teal-700 px-3 text-xs font-bold text-white hover:bg-teal-800"
            >
              + Add Loan
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-5 pt-0">
          {accounts.length === 0 ? (
            <p className="rounded-xl bg-stone-50 px-4 py-3 text-sm text-stone-500">
              Koi loan account nahi hai. Add Loan se shuru karo.
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
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => openEditAccountDialog(account)}
                        className="h-8 rounded-lg border border-stone-200 bg-white px-3 text-xs font-bold text-stone-700 hover:bg-stone-50"
                      >
                        Edit
                      </Button>
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
                            Taken out total: <span className="font-bold text-stone-800">{fmt(new Decimal(account.totalDrawnAmount || "0"))}</span>
                          </p>
                          <p>
                            Put back total: <span className="font-bold text-stone-800">{fmt(new Decimal(account.totalRepaidAmount || "0"))}</span>
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
                            Taken out total: <span className="font-bold text-stone-800">{fmt(new Decimal(account.totalDrawnAmount || "0"))}</span>
                          </p>
                          <p>
                            Put back total: <span className="font-bold text-stone-800">{fmt(new Decimal(account.totalRepaidAmount || "0"))}</span>
                          </p>
                        </>
                      )}
                    </div>

                    {recentMovements.filter((m) => m.debtAccountId === account.id).slice(0, 3).length > 0 ? (
                      <div className="mt-2 space-y-1 rounded-lg border border-stone-100 bg-white p-2">
                        {recentMovements.filter((m) => m.debtAccountId === account.id).slice(0, 3).map((movement) => (
                          <div key={movement.id} className="flex items-center justify-between text-[11px] text-stone-500">
                            <p>
                              <span className="font-semibold text-stone-700">{movementLabel(movement.movementType)}</span> · {movement.movementDate}
                            </p>
                            <p className="font-bold text-stone-800">{fmt(new Decimal(movement.amount || "0"))}</p>
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
            CC Flow Tracker <span className="text-sm font-normal text-stone-400">(Take Out)</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 p-5 pt-0">
          <div>
            <Label className="mb-1.5 block text-xs font-semibold text-stone-500">CC/OD/Flexi Account</Label>
            <Select
              value={effectiveDrawDebtAccountId}
              onChange={(e) => setDrawDebtAccountId(e.target.value)}
              className="h-12 rounded-xl border-slate-200 bg-white px-4 text-sm"
            >
              <option value="">-- Select CC Account --</option>
              {revolvingAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({kindLabel(a.kind)})
                </option>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1.5 block text-xs font-semibold text-stone-500">Take Out Amount (₹)</Label>
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

          <div>
            <Label className="mb-2 block text-xs font-semibold text-stone-500">Source</Label>
            <div className="flex gap-2">
              {(["CASH", "UPI"] as DebtPaymentSource[]).map((s) => (
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
                  {s}
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
            Put Back / Repayment <span className="text-sm font-normal text-stone-400">(CC me dalo ya loan chukao)</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 p-5 pt-0">
          <div>
            <Label htmlFor="debtAccount" className="mb-1.5 block text-xs font-semibold text-stone-500">
              Kaunsa Loan?
            </Label>
            <Select
              id="debtAccount"
              value={debtAccountId}
              onChange={(e) => {
                const id = e.target.value;
                setDebtAccountId(id);
                const selected = accounts.find((a) => a.id === id);
                if (selected) {
                  setTargetType(selected.kind.startsWith("BANK_") ? "BANK_CC" : "LOCAL_LOAN");
                }
              }}
              className="h-12 rounded-xl border-slate-200 px-4 text-sm text-stone-900"
            >
              <option value="">-- Select Loan Account --</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({kindLabel(a.kind)})
                </option>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="debtAmount" className="mb-1.5 block text-xs font-semibold text-stone-500">
                Amount (₹)
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

          <div>
            <Label className="mb-2 block text-xs font-semibold text-stone-500">Kaise Dena Hai</Label>
            <div className="flex gap-2">
              {(["CASH", "UPI"] as DebtPaymentSource[]).map((s) => (
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
                  {s === "CASH" ? "Cash" : "UPI"}
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
            {isPending ? "Saving..." : "Karj Chukao"}
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

      <Dialog
        open={showAccountDialog}
        onOpenChange={(open) => {
          setShowAccountDialog(open);
          if (!open) {
            setAccountError(null);
          }
        }}
      >
        <DialogContent className="w-full max-h-[calc(100dvh-2rem)] overflow-hidden rounded-3xl border-stone-200 bg-white p-0 sm:max-w-lg">
          <DialogHeader className="sticky top-0 z-10 border-b border-stone-100 bg-white px-5 pb-3 pt-4 pr-12">
            <DialogTitle className="text-base font-bold text-stone-900">
              {accountFormMode === "create" ? "Add Loan Account" : "Edit Loan Account"}
            </DialogTitle>
            <DialogDescription className="text-xs text-stone-500">
              {accountFormMode === "create"
                ? "Fill details to create a new debt account."
                : "Update account details to keep CC and debt numbers accurate."}
            </DialogDescription>
          </DialogHeader>

          <div className="hide-scrollbar max-h-[78dvh] overflow-y-auto px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3 sm:max-h-[70vh] sm:pb-6">

            {accountError ? (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                {accountError}
              </p>
            ) : null}

            <div className="space-y-3">
            <div>
              <Label className="mb-1.5 block text-xs font-semibold text-stone-500">Loan name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Loan name"
                className="h-12 rounded-xl border-slate-200 px-4 text-sm"
              />
            </div>

            <div>
              <Label className="mb-1.5 block text-xs font-semibold text-stone-500">Lender name</Label>
              <Input
                value={lenderName}
                onChange={(e) => setLenderName(e.target.value)}
                placeholder="Lender name"
                className="h-12 rounded-xl border-slate-200 px-4 text-sm"
              />
            </div>

            <div>
              <Label className="mb-1.5 block text-xs font-semibold text-stone-500">Loan type</Label>
              <Select
                value={kind}
                onChange={(e) => {
                  const next = e.target.value as DebtAccountKind;
                  setKind(next);
                  setRateInputType(defaultRateInputTypeForKind(next));
                  if (next === "BANK_CC" || next === "BANK_OD") {
                    setCreditLimit((prev) => (new Decimal(prev || "0").gt(0) ? prev : principalAmount));
                  }
                }}
                className="h-12 rounded-xl border-slate-200 bg-white px-4 text-sm"
              >
                <optgroup label="Bank Loans">
                  {bankKinds.map((k) => (
                    <option key={k} value={k}>{kindLabel(k)}</option>
                  ))}
                </optgroup>
                <optgroup label="Local Loans">
                  {localKinds.map((k) => (
                    <option key={k} value={k}>{kindLabel(k)}</option>
                  ))}
                </optgroup>
              </Select>
            </div>

            {kind === "BANK_CC" || kind === "BANK_OD" ? (
              <div>
                <Label className="mb-1.5 block text-xs font-semibold text-stone-500">Credit Limit (CC limit)</Label>
                <Input
                  value={creditLimit}
                  onChange={(e) => setCreditLimit(e.target.value)}
                  placeholder="e.g. 500000"
                  className="h-12 rounded-xl border-slate-200 px-4 text-sm"
                />
              </div>
            ) : null}

            <div>
              <Label className="mb-1.5 block text-xs font-semibold text-stone-500">Interest type</Label>
              <Select
                value={rateInputType}
                onChange={(e) => setRateInputType(e.target.value as DebtRateInputType)}
                className="h-12 rounded-xl border-slate-200 bg-white px-4 text-sm"
              >
                <option value="ANNUAL_PERCENT">Annual %</option>
                <option value="MONTHLY_PERCENT">Monthly %</option>
                <option value="DAILY_FIXED">Daily fixed interest</option>
                <option value="EMI_DAILY">Daily installment</option>
                <option value="EMI_MONTHLY">Monthly installment</option>
              </Select>
            </div>

            <div>
              <Label className="mb-1.5 block text-xs font-semibold text-stone-500">Principal Amount (original loan)</Label>
              <Input
                value={principalAmount}
                onChange={(e) => setPrincipalAmount(e.target.value)}
                placeholder="e.g. 100000"
                className="h-12 rounded-xl border-slate-200 px-4 text-sm"
              />
            </div>

            <div>
              <Label className="mb-1.5 block text-xs font-semibold text-stone-500">Outstanding Amount (abhi kitna baki)</Label>
              <Input
                value={outstandingAmount}
                onChange={(e) => setOutstandingAmount(e.target.value)}
                placeholder="e.g. 86000"
                className="h-12 rounded-xl border-slate-200 px-4 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1.5 block text-xs font-semibold text-stone-500">Start Date</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-12 rounded-xl border-slate-200 px-4 text-sm"
                />
              </div>
              <div>
                <Label className="mb-1.5 block text-xs font-semibold text-stone-500">Maturity Date (optional)</Label>
                <Input
                  type="date"
                  value={maturityDate}
                  onChange={(e) => setMaturityDate(e.target.value)}
                  className="h-12 rounded-xl border-slate-200 px-4 text-sm"
                />
              </div>
            </div>

            {rateInputType === "ANNUAL_PERCENT" ? (
              <div>
                <Label className="mb-1.5 block text-xs font-semibold text-stone-500">Annual Rate %</Label>
                <Input
                  value={annualRatePa}
                  onChange={(e) => setAnnualRatePa(e.target.value)}
                  placeholder="e.g. 14"
                  className="h-12 rounded-xl border-slate-200 px-4 text-sm"
                />
              </div>
            ) : null}

            {rateInputType === "MONTHLY_PERCENT" ? (
              <div>
                <Label className="mb-1.5 block text-xs font-semibold text-stone-500">Monthly Rate %</Label>
                <Input
                  value={monthlyRate}
                  onChange={(e) => setMonthlyRate(e.target.value)}
                  placeholder="e.g. 5"
                  className="h-12 rounded-xl border-slate-200 px-4 text-sm"
                />
              </div>
            ) : null}

            {rateInputType === "DAILY_FIXED" ? (
              <div>
                <Label className="mb-1.5 block text-xs font-semibold text-stone-500">Daily Interest Amount (₹ per day)</Label>
                <Input
                  value={dailyFixedInterest}
                  onChange={(e) => setDailyFixedInterest(e.target.value)}
                  placeholder="e.g. 600"
                  className="h-12 rounded-xl border-slate-200 px-4 text-sm"
                />
              </div>
            ) : null}

            {rateInputType === "EMI_DAILY" || rateInputType === "EMI_MONTHLY" ? (
              <>
                <div>
                  <Label className="mb-1.5 block text-xs font-semibold text-stone-500">Installment Amount</Label>
                  <Input
                    value={installmentAmount}
                    onChange={(e) => setInstallmentAmount(e.target.value)}
                    placeholder="e.g. 1200"
                    className="h-12 rounded-xl border-slate-200 px-4 text-sm"
                  />
                </div>
                <div>
                  <Label className="mb-1.5 block text-xs font-semibold text-stone-500">Installment Frequency</Label>
                  <Select
                    value={installmentFrequency}
                    onChange={(e) => setInstallmentFrequency(e.target.value as "DAILY" | "WEEKLY" | "MONTHLY" | "BULLET")}
                    className="h-12 rounded-xl border-slate-200 bg-white px-4 text-sm"
                  >
                    <option value="DAILY">Daily</option>
                    <option value="WEEKLY">Weekly</option>
                    <option value="MONTHLY">Monthly</option>
                    <option value="BULLET">Bullet</option>
                  </Select>
                </div>
                <div>
                  <Label className="mb-1.5 block text-xs font-semibold text-stone-500">Remaining Installments</Label>
                  <Input
                    value={remainingInstallments}
                    onChange={(e) => setRemainingInstallments(e.target.value)}
                    placeholder="e.g. 90"
                    className="h-12 rounded-xl border-slate-200 px-4 text-sm"
                  />
                </div>
              </>
            ) : null}

            <p className="rounded-xl bg-stone-50 px-3 py-2 text-[11px] text-stone-500">
              Tip: CC account me &quot;Credit Limit&quot;, &quot;Outstanding&quot;, aur tracker card ke through &quot;Take Out&quot; + &quot;Put Back&quot; maintain karo, tab started/left numbers accurate rahenge.
            </p>

            <div>
              <Label className="mb-1.5 block text-xs font-semibold text-stone-500">Notes (optional)</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Extra context"
                className="h-12 rounded-xl border-slate-200 px-4 text-sm"
              />
            </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowAccountDialog(false)}
                className="h-12 rounded-xl border border-stone-200 bg-white text-sm font-bold text-stone-700 hover:bg-stone-50"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSaveAccount}
                disabled={isAccountPending || !name.trim()}
                className="h-12 rounded-xl bg-teal-700 text-sm font-bold text-white hover:bg-teal-800"
              >
                {isAccountPending ? "Saving..." : accountFormMode === "create" ? "Save Loan" : "Update Loan"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {accountSuccess ? (
        <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs font-semibold text-green-700">
          {accountSuccess}
        </p>
      ) : null}
    </div>
  );
}
