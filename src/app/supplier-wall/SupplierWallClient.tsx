"use client";

import Decimal from "decimal.js";
import { useEffect, useRef, useState, useTransition } from "react";

import {
  addSupplier,
  recordSupplierPayment,
  recordSupplierPurchase,
  recordSupplierReturn,
} from "@/app/supplier-wall/actions";

type SupplierCardData = {
  id: string;
  name: string;
  category: string;
  contactNumber: string | null;
  currentBalance: string;
  lastPaymentDate: string | null;
  trustScore: number;
};

function fmt(value: Decimal) {
  return `₹${Number(value.toFixed(2)).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function SupplierWallClient({
  suppliers,
  highlight,
}: {
  suppliers: SupplierCardData[];
  highlight?: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [isAddPending, startAddTransition] = useTransition();
  const highlightRef = useRef<HTMLDivElement>(null);

  const [openModal, setOpenModal] = useState<{
    supplierId: string;
    mode: "PURCHASE" | "PAYMENT" | "RETURN";
  } | null>(null);

  const [amount, setAmount] = useState("0");
  const [note, setNote] = useState("");
  const [source, setSource] = useState<"CASH" | "UPI">("CASH");
  const [payViaCc, setPayViaCc] = useState(false);

  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newContact, setNewContact] = useState("");

  useEffect(() => {
    if (highlight && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlight]);

  function submit() {
    if (!openModal) return;

    const formData = new FormData();
    formData.set("supplierId", openModal.supplierId);
    formData.set("amount", amount);
    formData.set("note", note);

    startTransition(async () => {
      if (openModal.mode === "PURCHASE") {
        await recordSupplierPurchase(formData);
      } else if (openModal.mode === "RETURN") {
        await recordSupplierReturn(formData);
      } else {
        formData.set("source", source);
        formData.set("payViaCc", payViaCc ? "true" : "false");
        await recordSupplierPayment(formData);
      }

      setOpenModal(null);
      setAmount("0");
      setNote("");
      setSource("CASH");
      setPayViaCc(false);
    });
  }

  function submitAddSupplier() {
    const formData = new FormData();
    formData.set("name", newName);
    formData.set("category", newCategory);
    if (newContact) formData.set("contactNumber", newContact);

    startAddTransition(async () => {
      await addSupplier(formData);
      setShowAddSupplier(false);
      setNewName("");
      setNewCategory("");
      setNewContact("");
    });
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setShowAddSupplier(true)}
        className="h-14 w-full rounded-xl bg-teal-700 text-base font-bold text-white"
      >
        + Supplier Add Karo
      </button>

      {suppliers.length === 0 ? (
        <div className="rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-stone-100">
          <p className="text-lg font-bold text-stone-900">Abhi koi supplier nahi</p>
          <p className="mt-1 text-sm text-stone-500">Upar se pehla supplier add karo.</p>
        </div>
      ) : (
        suppliers.map((supplier) => {
          const balance = new Decimal(supplier.currentBalance);
          const highlighted = supplier.id === highlight;
          const trustColor =
            supplier.trustScore >= 70
              ? "bg-green-500"
              : supplier.trustScore >= 40
                ? "bg-amber-500"
                : "bg-red-500";

          return (
            <div key={supplier.id} ref={highlighted ? highlightRef : undefined}>
              <div
                className={`rounded-2xl bg-white p-4 shadow-sm ring-1 transition-shadow ${
                  highlighted ? "ring-rose-400 shadow-md" : "ring-stone-100"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-black text-stone-900">{supplier.name}</p>
                    <p className="text-xs text-stone-500">
                      {supplier.category}
                      {supplier.contactNumber ? ` • ${supplier.contactNumber}` : ""}
                    </p>
                    <p className="mt-1 text-xs text-stone-400">
                      {supplier.lastPaymentDate
                        ? `Last paid: ${supplier.lastPaymentDate}`
                        : "No payment yet"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">
                      Balance
                    </p>
                    <p
                      className={`text-xl font-black ${
                        balance.gt(0) ? "text-red-700" : "text-green-700"
                      }`}
                    >
                      {fmt(balance)}
                    </p>
                  </div>
                </div>

                <div className="mt-3 rounded-xl bg-stone-50 p-3">
                  <div className="mb-1 flex items-center justify-between text-xs text-stone-500">
                    <span>Trust Score</span>
                    <span className="font-bold text-stone-700">{supplier.trustScore}/100</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-stone-200">
                    <div
                      className={`h-full rounded-full ${trustColor}`}
                      style={{ width: `${supplier.trustScore}%` }}
                    />
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setOpenModal({ supplierId: supplier.id, mode: "PURCHASE" })}
                    className="h-12 rounded-xl border-2 border-stone-200 bg-white text-sm font-bold text-stone-700"
                  >
                    Maal Aaya
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpenModal({ supplierId: supplier.id, mode: "PAYMENT" })}
                    className="h-12 rounded-xl bg-teal-700 text-sm font-bold text-white"
                  >
                    Paisa Diya
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setOpenModal({ supplierId: supplier.id, mode: "RETURN" })}
                  className="mt-2 h-12 w-full rounded-xl border-2 border-stone-200 bg-stone-50 text-sm font-bold text-stone-700"
                >
                  Maal Wapas
                </button>
              </div>
            </div>
          );
        })
      )}

      {openModal ? (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40 sm:items-center sm:justify-center">
          <div className="w-full rounded-t-2xl bg-white p-5 pb-8 sm:max-w-md sm:rounded-2xl sm:pb-5">
            <p className="text-lg font-bold text-stone-900">
              {openModal.mode === "PURCHASE"
                ? "Maal Aaya"
                : openModal.mode === "RETURN"
                  ? "Maal Wapas"
                  : "Paisa Diya"}
            </p>
            <p className="mt-1 text-sm text-stone-400">Supplier ledger quick entry</p>

            <div className="mt-4 space-y-3">
              <div>
                <label htmlFor="supplierAmount" className="mb-1.5 block text-xs font-semibold text-stone-500">
                  Amount (₹)
                </label>
                <input
                  id="supplierAmount"
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  className="h-14 w-full rounded-xl border-2 border-stone-200 bg-white px-4 text-base font-bold text-stone-900 focus:border-teal-500 focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="supplierNote" className="mb-1.5 block text-xs font-semibold text-stone-500">
                  Note
                </label>
                <input
                  id="supplierNote"
                  type="text"
                  placeholder="Invoice #123"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  className="h-12 w-full rounded-xl border-2 border-stone-200 bg-white px-4 text-sm text-stone-900 focus:border-teal-500 focus:outline-none"
                />
              </div>

              {openModal.mode === "PAYMENT" ? (
                <>
                  <div>
                    <label htmlFor="source" className="mb-1.5 block text-xs font-semibold text-stone-500">
                      Source
                    </label>
                    <select
                      id="source"
                      value={source}
                      onChange={(event) => setSource(event.target.value as "CASH" | "UPI")}
                      className="h-12 w-full rounded-xl border-2 border-stone-200 bg-white px-4 text-sm text-stone-900 focus:border-teal-500 focus:outline-none"
                    >
                      <option value="CASH">Cash</option>
                      <option value="UPI">UPI</option>
                    </select>
                  </div>

                  <label className="flex items-center gap-2 text-sm text-stone-700">
                    <input
                      type="checkbox"
                      checked={payViaCc}
                      onChange={(event) => setPayViaCc(event.target.checked)}
                    />
                    Pay via CC (Debt Engine mein bhi record karo)
                  </label>
                </>
              ) : null}
            </div>

            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={() => setOpenModal(null)}
                className="h-12 flex-1 rounded-xl border-2 border-stone-200 bg-white text-sm font-bold text-stone-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={isPending}
                className="h-12 flex-1 rounded-xl bg-teal-700 text-sm font-bold text-white disabled:opacity-60"
              >
                {isPending ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showAddSupplier ? (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40 sm:items-center sm:justify-center">
          <div className="w-full rounded-t-2xl bg-white p-5 pb-8 sm:max-w-md sm:rounded-2xl sm:pb-5">
            <p className="text-lg font-bold text-stone-900">Naya Supplier Add Karo</p>
            <p className="mt-1 text-sm text-stone-400">Chalta Khata shuru karo</p>

            <div className="mt-4 space-y-3">
              <div>
                <label htmlFor="newSupplierName" className="mb-1.5 block text-xs font-semibold text-stone-500">
                  Supplier Name
                </label>
                <input
                  id="newSupplierName"
                  type="text"
                  placeholder="Ram Lal Fabrics"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="h-12 w-full rounded-xl border-2 border-stone-200 bg-white px-4 text-sm text-stone-900 focus:border-teal-500 focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="newSupplierCategory" className="mb-1.5 block text-xs font-semibold text-stone-500">
                  Category
                </label>
                <input
                  id="newSupplierCategory"
                  type="text"
                  placeholder="Fabric / Footwear"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="h-12 w-full rounded-xl border-2 border-stone-200 bg-white px-4 text-sm text-stone-900 focus:border-teal-500 focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="newSupplierContact" className="mb-1.5 block text-xs font-semibold text-stone-500">
                  Contact (optional)
                </label>
                <input
                  id="newSupplierContact"
                  type="tel"
                  placeholder="98xxxxxxxx"
                  value={newContact}
                  onChange={(e) => setNewContact(e.target.value)}
                  className="h-12 w-full rounded-xl border-2 border-stone-200 bg-white px-4 text-sm text-stone-900 focus:border-teal-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={() => setShowAddSupplier(false)}
                className="h-12 flex-1 rounded-xl border-2 border-stone-200 bg-white text-sm font-bold text-stone-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitAddSupplier}
                disabled={isAddPending || !newName.trim() || !newCategory.trim()}
                className="h-12 flex-1 rounded-xl bg-teal-700 text-sm font-bold text-white disabled:opacity-60"
              >
                {isAddPending ? "Adding..." : "Add"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
