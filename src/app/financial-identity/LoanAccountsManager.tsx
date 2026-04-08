"use client";

import Decimal from "decimal.js";
import { useTransition } from "react";
import { useState } from "react";

import { createDebtAccount, updateDebtAccount } from "@/app/debt-engine/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select-modern";

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

export type LoanAccount = {
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

const bankKinds: DebtAccountKind[] = ["BANK_CC", "BANK_TERM_LOAN", "BANK_OD", "BANK_BILL_DISCOUNT"];
const localKinds: DebtAccountKind[] = ["LOCAL_DAILY", "LOCAL_MONTHLY", "LOCAL_BULLET", "LOCAL_FLEXI"];

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

function isRevolvingKind(kind: DebtAccountKind) {
  return kind === "BANK_CC" || kind === "BANK_OD" || kind === "LOCAL_FLEXI";
}

function defaultRateInputTypeForKind(kind: DebtAccountKind): DebtRateInputType {
  if (kind === "LOCAL_DAILY") return "DAILY_FIXED";
  if (kind === "LOCAL_MONTHLY") return "MONTHLY_PERCENT";
  if (kind === "LOCAL_BULLET" || kind === "LOCAL_FLEXI") return "EMI_MONTHLY";
  return "ANNUAL_PERCENT";
}

function fmt(value: Decimal) {
  return `₹${Number(value.toFixed(2)).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function LoanAccountsManager({
  accounts,
  today,
  currentAccounts,
}: {
  accounts: LoanAccount[];
  today: string;
  currentAccounts: Array<{ accountName: string }>;
}) {
  const [isAccountPending, startAccountTransition] = useTransition();

  const [showDialog, setShowDialog] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [editingId, setEditingId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form fields
  const [name, setName] = useState("");
  const [lenderName, setLenderName] = useState("");
  const [linkedCurrentAccountName, setLinkedCurrentAccountName] = useState("");
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

  function resetForm() {
    setName("");
    setLenderName("");
    setLinkedCurrentAccountName("");
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
    setEditingId("");
  }

  function openCreate() {
    setMode("create");
    setError(null);
    resetForm();
    setShowDialog(true);
  }

  function openEdit(account: LoanAccount) {
    setMode("edit");
    setError(null);
    setEditingId(account.id);
    setName(account.name);
    setLenderName(account.lenderName || "");
    setLinkedCurrentAccountName(account.linkedCurrentAccountName || "");
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
    setShowDialog(true);
  }

  function handleSave() {
    setError(null);
    setSuccess(null);

    if (!name.trim()) {
      setError("Loan name required hai.");
      return;
    }
    if (mode === "create" && new Decimal(outstandingAmount || "0").lte(0)) {
      setError("Outstanding amount 0 se bada hona chahiye.");
      return;
    }

    const fd = new FormData();
    if (mode === "edit") fd.set("debtAccountId", editingId);
    fd.set("name", name);
    fd.set("lenderName", lenderName);
    fd.set("linkedCurrentAccountName", linkedCurrentAccountName.trim());
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
    fd.set("maturityDate", maturityDate);
    if (notes.trim()) fd.set("notes", notes.trim());

    startAccountTransition(async () => {
      try {
        if (mode === "create") {
          await createDebtAccount(fd);
        } else {
          await updateDebtAccount(fd);
        }
        setShowDialog(false);
        resetForm();
        setSuccess(mode === "create" ? "Loan account add ho gaya." : "Loan account update ho gaya.");
        setTimeout(() => setSuccess(null), 3000);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Loan save nahi ho paya.";
        setError(msg);
      }
    });
  }

  return (
    <section className="rounded-2xl bg-white shadow-sm ring-1 ring-stone-100">
      <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4">
        <div>
          <p className="text-base font-bold text-stone-900">Loan Accounts</p>
          <p className="text-xs text-stone-500">CC, Term Loans, Local Loans — sabhi yahan manage karo</p>
        </div>
        <Button
          type="button"
          onClick={openCreate}
          className="h-9 rounded-xl bg-teal-700 px-4 text-sm font-bold text-white hover:bg-teal-800"
        >
          + Add Loan
        </Button>
      </div>

      <div className="px-5 py-4">
        {success ? (
          <p className="mb-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-800">
            {success}
          </p>
        ) : null}

        {accounts.length === 0 ? (
          <p className="rounded-xl bg-stone-50 px-4 py-4 text-sm text-stone-500">
            Abhi koi loan account nahi hai. Agar CC, OD, Term Loan ya Local Loan hai to <span className="font-semibold text-teal-700">+ Add Loan</span> se add karo.
          </p>
        ) : (
          <div className="space-y-3">
            {accounts.map((account) => (
              <div key={account.id} className="rounded-xl border border-stone-200 bg-stone-50 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold text-stone-900">{account.name}</p>
                    <p className="text-xs text-stone-500">{kindLabel(account.kind)}{account.lenderName ? ` · ${account.lenderName}` : ""}</p>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => openEdit(account)}
                    className="h-8 shrink-0 rounded-lg border border-stone-200 bg-white px-3 text-xs font-bold text-stone-700 hover:bg-stone-100"
                  >
                    Edit
                  </Button>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-[12px] text-stone-600">
                  {isRevolvingKind(account.kind) ? (
                    <>
                      <p>CC Limit: <span className="font-bold text-stone-900">{fmt(new Decimal(account.creditLimit || "0"))}</span></p>
                      <p>Outstanding: <span className="font-bold text-red-700">{fmt(new Decimal(account.outstandingAmount || "0"))}</span></p>
                      <p>Available: <span className="font-bold text-green-700">{fmt(Decimal.max(new Decimal(account.creditLimit || "0").minus(new Decimal(account.outstandingAmount || "0")), 0))}</span></p>
                    </>
                  ) : (
                    <>
                      <p>Principal: <span className="font-bold text-stone-900">{fmt(new Decimal(account.principalAmount || "0"))}</span></p>
                      <p>Outstanding: <span className="font-bold text-red-700">{fmt(new Decimal(account.outstandingAmount || "0"))}</span></p>
                    </>
                  )}
                  {account.startDate ? <p>Start: <span className="font-semibold">{account.startDate}</span></p> : null}
                  {account.maturityDate ? <p>Maturity: <span className="font-semibold">{account.maturityDate}</span></p> : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {accounts.length > 0 && currentAccounts.length > 0 ? (
        <div className="border-t border-stone-100 px-5 py-4">
          <p className="mb-3 text-sm font-bold text-stone-900">CA Linkage</p>
          {currentAccounts.map((ca) => {
            const linkedLoans = accounts.filter((acc) => acc.linkedCurrentAccountName === ca.accountName);
            if (linkedLoans.length === 0) return null;
            return (
              <div key={ca.accountName} className="mb-3 rounded-lg bg-blue-50 px-3 py-2 text-[12px]">
                <p className="font-semibold text-blue-900">{ca.accountName}</p>
                <p className="mt-1 text-blue-800">
                  {linkedLoans.map((l) => l.name).join(", ")}
                </p>
              </div>
            );
          })}
        </div>
      ) : null}

      <Dialog
        open={showDialog}
        onOpenChange={(open) => {
          setShowDialog(open);
          if (!open) setError(null);
        }}
      >
        <DialogContent className="w-full max-h-[calc(100dvh-2rem)] overflow-hidden rounded-3xl border-stone-200 bg-white p-0 sm:max-w-lg">
          <DialogHeader className="sticky top-0 z-10 border-b border-stone-100 bg-white px-5 pb-3 pt-4 pr-12">
            <DialogTitle className="text-base font-bold text-stone-900">
              {mode === "create" ? "Add Loan Account" : "Edit Loan Account"}
            </DialogTitle>
            <DialogDescription className="text-xs text-stone-500">
              {mode === "create"
                ? "Naya CC, Term Loan ya Local Loan add karo."
                : "Loan details update karo."}
            </DialogDescription>
          </DialogHeader>

          <div className="hide-scrollbar max-h-[78dvh] overflow-y-auto px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3 sm:max-h-[70vh] sm:pb-6">
            {error ? (
              <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                {error}
              </p>
            ) : null}

            <div className="space-y-3">
              <div>
                <Label className="mb-1.5 block text-xs font-semibold text-stone-500">Loan name *</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. SBI CC, Local Karim Bhai"
                  className="h-12 rounded-xl border-slate-200 px-4 text-sm"
                />
              </div>

              <div>
                <Label className="mb-1.5 block text-xs font-semibold text-stone-500">Lender name (optional)</Label>
                <Input
                  value={lenderName}
                  onChange={(e) => setLenderName(e.target.value)}
                  placeholder="e.g. SBI, HDFC, Karim Bhai"
                  className="h-12 rounded-xl border-slate-200 px-4 text-sm"
                />
              </div>

              <div>
                <Label className="mb-1.5 block text-xs font-semibold text-stone-500">Loan type *</Label>
                <Select
                  value={kind}
                  onValueChange={(value) => {
                    const next = value as DebtAccountKind;
                    setKind(next);
                    setRateInputType(defaultRateInputTypeForKind(next));
                    if (next === "BANK_CC" || next === "BANK_OD") {
                      setCreditLimit((prev) => (new Decimal(prev || "0").gt(0) ? prev : principalAmount));
                    }
                    if (!(next === "BANK_CC" || next === "BANK_OD" || next === "LOCAL_FLEXI")) {
                      setLinkedCurrentAccountName("");
                    }
                  }}
                >
                  <SelectTrigger className="h-12 rounded-xl border-slate-200 bg-white px-4 text-sm">
                    <SelectValue placeholder="Select loan type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>Bank Loans</SelectLabel>
                      {bankKinds.map((k) => (
                        <SelectItem key={k} value={k}>{kindLabel(k)}</SelectItem>
                      ))}
                    </SelectGroup>
                    <SelectGroup>
                      <SelectLabel>Local Loans</SelectLabel>
                      {localKinds.map((k) => (
                        <SelectItem key={k} value={k}>{kindLabel(k)}</SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>

              {(kind === "BANK_CC" || kind === "BANK_OD" || kind === "LOCAL_FLEXI") ? (
                <div>
                  <Label className="mb-1.5 block text-xs font-semibold text-stone-500">Linked Current A/c (optional)</Label>
                  {currentAccounts.length > 0 ? (
                    <>
                      <Select
                        value={linkedCurrentAccountName || "__none__"}
                        onValueChange={(value) => setLinkedCurrentAccountName(value === "__none__" ? "" : value)}
                      >
                        <SelectTrigger className="h-12 rounded-xl border-slate-200 bg-white px-4 text-sm">
                          <SelectValue placeholder="— No linking —" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">— No linking —</SelectItem>
                          {currentAccounts.map((ca) => (
                            <SelectItem key={ca.accountName} value={ca.accountName}>
                              {ca.accountName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="mt-1 text-[11px] text-stone-500">
                        CC ↔ Current A/c transfer ke liye link karo (optional).
                      </p>
                    </>
                  ) : (
                    <p className="text-[12px] text-stone-500">
                      Koi Current Account setup nahi hai. <span className="font-semibold">Shop Defaults</span> me add karo pehle.
                    </p>
                  )}
                </div>
              ) : null}

              {kind === "BANK_CC" || kind === "BANK_OD" ? (
                <div>
                  <Label className="mb-1.5 block text-xs font-semibold text-stone-500">Credit Limit (bank approved max limit)</Label>
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
                  onValueChange={(value) => setRateInputType(value as DebtRateInputType)}
                >
                  <SelectTrigger className="h-12 rounded-xl border-slate-200 bg-white px-4 text-sm">
                    <SelectValue placeholder="Select interest type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ANNUAL_PERCENT">Annual %</SelectItem>
                    <SelectItem value="MONTHLY_PERCENT">Monthly %</SelectItem>
                    <SelectItem value="DAILY_FIXED">Daily fixed interest</SelectItem>
                    <SelectItem value="EMI_DAILY">Daily installment</SelectItem>
                    <SelectItem value="EMI_MONTHLY">Monthly installment</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="mb-1.5 block text-xs font-semibold text-stone-500">
                  {kind === "BANK_CC" || kind === "BANK_OD"
                    ? "Starting Used Amount (start date pe kitna use tha)"
                    : "Starting Loan Amount (shuru ka total loan)"}
                </Label>
                <Input
                  value={principalAmount}
                  onChange={(e) => setPrincipalAmount(e.target.value)}
                  placeholder="e.g. 100000"
                  className="h-12 rounded-xl border-slate-200 px-4 text-sm"
                />
              </div>

              <div>
                <Label className="mb-1.5 block text-xs font-semibold text-stone-500">Outstanding Amount *</Label>
                <Input
                  value={outstandingAmount}
                  onChange={(e) => setOutstandingAmount(e.target.value)}
                  placeholder="Abhi kitna baki hai"
                  className="h-12 rounded-xl border-slate-200 px-4 text-sm"
                />
                <p className="mt-1 text-[11px] text-stone-500">
                  Note: takouts aur repayments Debt Engine se record karo — outstanding auto-update hoga.
                </p>
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
                      onValueChange={(value) => setInstallmentFrequency(value as "DAILY" | "WEEKLY" | "MONTHLY" | "BULLET")}
                    >
                      <SelectTrigger className="h-12 rounded-xl border-slate-200 bg-white px-4 text-sm">
                        <SelectValue placeholder="Select frequency" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DAILY">Daily</SelectItem>
                        <SelectItem value="WEEKLY">Weekly</SelectItem>
                        <SelectItem value="MONTHLY">Monthly</SelectItem>
                        <SelectItem value="BULLET">Bullet</SelectItem>
                      </SelectContent>
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

              <div>
                <Label className="mb-1.5 block text-xs font-semibold text-stone-500">Notes (optional)</Label>
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Extra context"
                  className="h-12 rounded-xl border-slate-200 px-4 text-sm"
                />
              </div>

              <p className="rounded-xl bg-stone-50 px-3 py-2 text-[11px] text-stone-500">
                Tip: Daily takouts aur repayments Debt Engine se record karo. Outstanding wahan auto-update hoga.
              </p>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowDialog(false)}
                className="h-12 rounded-xl border border-stone-200 bg-white text-sm font-bold text-stone-700 hover:bg-stone-50"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSave}
                disabled={isAccountPending || !name.trim()}
                className="h-12 rounded-xl bg-teal-700 text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-70"
              >
                {isAccountPending
                  ? mode === "create"
                    ? "Loan add ho raha hai..."
                    : "Loan update ho raha hai..."
                  : mode === "create"
                    ? "Save Loan"
                    : "Update Loan"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
