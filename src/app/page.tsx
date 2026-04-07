import Decimal from "decimal.js";
import { eq } from "drizzle-orm";
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  CreditCard,
  IndianRupee,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import Link from "next/link";

import { signInWithPassword, signUpWithPassword } from "@/app/auth/actions";
import { createInitialShop } from "@/app/onboarding/actions";
import { PasswordField } from "@/components/auth/PasswordField";
import { AuthSubmitButton } from "@/components/auth/AuthSubmitButton";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { db } from "@/db";
import { dailySummaries, debtPayments, suppliers } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getDailyStoryFeed } from "@/lib/intelligence/getDailyStoryFeed";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { getBusinessDateString } from "@/lib/time/businessDate";

export const dynamic = "force-dynamic";

function formatMoney(value: Decimal, symbol: string) {
  return `${symbol}${Number(value.toFixed(2)).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

type HomePageProps = {
  searchParams?: Promise<{
    authError?: string;
    authNotice?: string;
    email?: string;
  }>;
};

function getAuthErrorMessage(rawError?: string) {
  if (!rawError) return null;
  if (rawError === "email_not_confirmed") {
    return "Your email is not confirmed yet. Please open the verification email and try again.";
  }
  if (rawError === "invalid_email") {
    return "Please enter a valid email address.";
  }
  return rawError;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const [params, user, tenant] = await Promise.all([
    searchParams,
    getCurrentUser(),
    getTenantContext(),
  ]);

  const authError = getAuthErrorMessage(params?.authError);
  const authNotice = params?.authNotice;
  const prefillEmail = params?.email ?? "";

  // ── Not logged in ──────────────────────────────────────────────────────────
  if (!tenant) {
    if (!user) {
      return (
        <main className="relative isolate min-h-[100dvh] overflow-hidden px-4 py-8">
          <div className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute -left-24 top-14 h-64 w-64 rounded-full bg-teal-300/45 blur-3xl" />
            <div className="absolute -right-24 top-56 h-64 w-64 rounded-full bg-amber-300/40 blur-3xl" />
            <div className="absolute bottom-10 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-emerald-200/45 blur-3xl" />
          </div>

          <div className="mx-auto w-full max-w-md">
            <section className="mb-4 rounded-[2rem] border border-white/80 bg-white/80 p-6 shadow-[0_18px_70px_rgba(15,118,110,0.16)] backdrop-blur">
              <div className="mb-4 text-center">
                <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-700 to-cyan-700 text-2xl font-black text-white shadow-lg shadow-teal-700/30">
                  ₹
                </div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-teal-700">
                  Retail Profit OS
                </p>
                <h1 className="mt-1 text-3xl font-black text-stone-900">Digital Munim</h1>
                <p className="mt-1 text-sm text-stone-600">Aapki dukaan ka digital hisaab</p>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-stone-900 px-2 py-2 text-[11px] font-semibold text-white">
                  Galla
                </div>
                <div className="rounded-xl bg-teal-50 px-2 py-2 text-[11px] font-semibold text-teal-800 ring-1 ring-teal-200">
                  Karj
                </div>
                <div className="rounded-xl bg-amber-50 px-2 py-2 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-200">
                  Saakh
                </div>
              </div>
            </section>

            {/* Notices */}
            {authError ? (
              <div className="mb-4 flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
                <AlertCircle size={18} className="mt-0.5 shrink-0 text-red-600" />
                <p className="text-sm font-medium text-red-800">{authError}</p>
              </div>
            ) : null}
            {authNotice === "check_email" ? (
              <div className="mb-4 flex items-start gap-2 rounded-2xl border border-green-200 bg-green-50 px-4 py-3">
                <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-green-600" />
                <p className="text-sm font-medium text-green-800">
                  Account bana diya! Inbox check karo aur email confirm karo.
                </p>
              </div>
            ) : null}
            {authNotice === "reset_email_sent" ? (
              <div className="mb-4 flex items-start gap-2 rounded-2xl border border-green-200 bg-green-50 px-4 py-3">
                <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-green-600" />
                <p className="text-sm font-medium text-green-800">
                  Password reset link bhej diya. Inbox check karo.
                </p>
              </div>
            ) : null}
            {authNotice === "password_updated" ? (
              <div className="mb-4 flex items-start gap-2 rounded-2xl border border-green-200 bg-green-50 px-4 py-3">
                <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-green-600" />
                <p className="text-sm font-medium text-green-800">
                  Password badal gaya! Neeche sign in karo.
                </p>
              </div>
            ) : null}

            {/* Sign In */}
            <form
              action={signInWithPassword}
              className="space-y-3 rounded-[2rem] border border-white/85 bg-white/90 p-6 shadow-[0_14px_40px_rgba(15,23,42,0.08)] backdrop-blur"
            >
              <div className="mb-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">
                  Welcome Back
                </p>
                <p className="text-xl font-black text-stone-900">Sign In करें</p>
              </div>
              <input
                type="email"
                name="email"
                required
                defaultValue={prefillEmail}
                placeholder="Email address"
                autoComplete="email"
                inputMode="email"
                className="h-14 w-full rounded-xl border-2 border-stone-200 bg-white px-4 text-base text-stone-900 focus:border-teal-500 focus:outline-none"
              />
              <PasswordField
                id="signInPassword"
                name="password"
                placeholder="Password"
                autoComplete="current-password"
                className="h-14 w-full rounded-xl border-2 border-stone-200 bg-white px-4 pr-12 text-base text-stone-900 focus:border-teal-500 focus:outline-none"
              />
              <AuthSubmitButton
                label="Sign In करें"
                className="h-14 w-full rounded-xl bg-gradient-to-r from-teal-700 to-cyan-700 text-base font-bold text-white shadow-md shadow-teal-800/25 active:from-teal-800 active:to-cyan-800"
              />
              <div className="text-center">
                <Link href="/auth/forgot-password" className="text-sm font-medium text-stone-500 underline decoration-stone-300 underline-offset-4">
                  Password bhool gaye?
                </Link>
              </div>
            </form>

            {/* Sign Up */}
            <form
              action={signUpWithPassword}
              className="mt-4 space-y-3 rounded-[2rem] bg-stone-900 p-6 text-white shadow-[0_16px_40px_rgba(17,24,39,0.28)]"
            >
              <div className="mb-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60">
                  New Shop Setup
                </p>
                <p className="text-xl font-black text-white">Naya Account बनाएं</p>
              </div>
              <input
                type="email"
                name="email"
                required
                placeholder="Email address"
                autoComplete="email"
                inputMode="email"
                className="h-14 w-full rounded-xl border border-white/15 bg-white/10 px-4 text-base text-white placeholder:text-white/60 focus:border-teal-300 focus:outline-none"
              />
              <PasswordField
                id="signUpPassword"
                name="password"
                placeholder="Password (minimum 8 characters)"
                autoComplete="new-password"
                className="h-14 w-full rounded-xl border border-white/15 bg-white/10 px-4 pr-12 text-base text-white placeholder:text-white/60 focus:border-teal-300 focus:outline-none"
              />
              <AuthSubmitButton
                label="Account बनाएं"
                className="h-14 w-full rounded-xl bg-white text-base font-bold text-stone-900 active:bg-stone-200"
              />
            </form>

            <p className="mt-4 text-center text-xs font-medium text-stone-500">
              Simple daily routine. Fast entries. Better profit clarity.
            </p>
          </div>
        </main>
      );
    }

    // ── Logged in but no shop yet ──────────────────────────────────────────
    return (
      <main className="mx-auto w-full max-w-lg px-4 py-6">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-700 text-xl font-black text-white shadow-md">
            ₹
          </div>
          <h1 className="text-xl font-black text-stone-900">Digital Munim</h1>
          <p className="mt-1 text-sm text-stone-500">Apni dukaan setup karo — sirf 2 minute mein</p>
        </div>

        <form
          action={createInitialShop}
          className="space-y-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-stone-100"
        >
          <div>
            <label htmlFor="shopName" className="mb-1.5 block text-sm font-bold text-stone-700">
              Dukaan ka naam <span className="font-normal text-stone-400">(Shop Name)</span>
            </label>
            <input
              id="shopName"
              name="shopName"
              required
              placeholder="e.g. Sharma General Store"
              className="h-14 w-full rounded-xl border-2 border-stone-200 bg-white px-4 text-base focus:border-teal-500 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="brandName" className="mb-1.5 block text-sm font-bold text-stone-700">
              Brand ya nick-naam <span className="font-normal text-stone-400">(Optional)</span>
            </label>
            <input
              id="brandName"
              name="brandName"
              placeholder="e.g. Sharma Ji"
              className="h-14 w-full rounded-xl border-2 border-stone-200 bg-white px-4 text-base focus:border-teal-500 focus:outline-none"
            />
          </div>

          <div className="rounded-xl border-2 border-stone-100 bg-stone-50 p-4">
            <p className="mb-3 text-sm font-bold text-stone-700">
              Paise ki setting <span className="font-normal text-stone-400">(Financial Setup)</span>
            </p>
            <div className="space-y-3">
              <div>
                <label htmlFor="ccLimit" className="mb-1 block text-xs font-semibold text-stone-500">
                  CC / Bank Limit (₹)
                </label>
                <input
                  id="ccLimit"
                  name="ccLimit"
                  defaultValue="0"
                  required
                  inputMode="decimal"
                  className="h-12 w-full rounded-xl border-2 border-stone-200 bg-white px-4 text-base focus:border-teal-500 focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="bankInterestRatePa" className="mb-1 block text-xs font-semibold text-stone-500">
                  Bank Byaaj — Saalana % (e.g. 18)
                </label>
                <input
                  id="bankInterestRatePa"
                  name="bankInterestRatePa"
                  defaultValue="18"
                  required
                  inputMode="decimal"
                  className="h-12 w-full rounded-xl border-2 border-stone-200 bg-white px-4 text-base focus:border-teal-500 focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="dailyLocalDrain" className="mb-1 block text-xs font-semibold text-stone-500">
                  Roz ka local byaaj (₹/din)
                </label>
                <input
                  id="dailyLocalDrain"
                  name="dailyLocalDrain"
                  defaultValue="0"
                  required
                  inputMode="decimal"
                  className="h-12 w-full rounded-xl border-2 border-stone-200 bg-white px-4 text-base focus:border-teal-500 focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="localLoanAprMonthly" className="mb-1 block text-xs font-semibold text-stone-500">
                  Local loan rate — mahine ka % (e.g. 3)
                </label>
                <input
                  id="localLoanAprMonthly"
                  name="localLoanAprMonthly"
                  defaultValue="3"
                  required
                  inputMode="decimal"
                  className="h-12 w-full rounded-xl border-2 border-stone-200 bg-white px-4 text-base focus:border-teal-500 focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="baseMarginDefault" className="mb-1 block text-xs font-semibold text-stone-500">
                  Default Nafa % (e.g. 20)
                </label>
                <input
                  id="baseMarginDefault"
                  name="baseMarginDefault"
                  defaultValue="20"
                  required
                  inputMode="decimal"
                  className="h-12 w-full rounded-xl border-2 border-stone-200 bg-white px-4 text-base focus:border-teal-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <input type="hidden" name="primaryColor" value="#0f766e" />
          <input type="hidden" name="currencySymbol" value="₹" />

          <button
            type="submit"
            className="h-14 w-full rounded-xl bg-teal-700 text-base font-bold text-white active:bg-teal-800"
          >
            Dukaan Shuru Karo →
          </button>
        </form>
      </main>
    );
  }

  // ── Logged in, shop exists — Dashboard ────────────────────────────────────
  const story = await getDailyStoryFeed(tenant.shopId, tenant.financialConfig.baseMarginDefault);
  const sym = tenant.brand.currencySymbol;
  const today = getBusinessDateString();

  const isMorningUnconfigured =
    story.morning.interestDrainToday.eq(0) && story.morning.breakEvenSales.eq(0);
  const isDebtUnconfigured =
    story.debtAlert.recommendedPayment.eq(0) || !story.debtAlert.hasComparison;
  const isNightlyUnconfigured =
    story.nightly.netProfitToday.eq(0) && story.nightly.interestSavedToday.eq(0);

  const [hasDailyEntry, hasDebtPayment, hasSupplier] = await Promise.all([
    db
      .select({ id: dailySummaries.id })
      .from(dailySummaries)
      .where(eq(dailySummaries.shopId, tenant.shopId))
      .limit(1)
      .then((r) => r.length > 0),
    db
      .select({ id: debtPayments.id })
      .from(debtPayments)
      .where(eq(debtPayments.shopId, tenant.shopId))
      .limit(1)
      .then((r) => r.length > 0),
    db
      .select({ id: suppliers.id })
      .from(suppliers)
      .where(eq(suppliers.shopId, tenant.shopId))
      .limit(1)
      .then((r) => r.length > 0),
  ]);

  const hasFinancialConfig =
    new Decimal(tenant.financialConfig.ccLimit).gt(0) ||
    new Decimal(tenant.financialConfig.dailyLocalDrain).gt(0) ||
    new Decimal(tenant.financialConfig.bankInterestRatePa).gt(0);

  const setupDone = [hasFinancialConfig, hasDailyEntry, hasDebtPayment, hasSupplier].filter(
    Boolean,
  ).length;

  return (
    <ThemeProvider
      primaryColor={tenant.brand.primaryColor}
      logoUrl={tenant.brand.logoUrl}
      brandName={tenant.brand.brandName}
    >
      <main className="mx-auto w-full max-w-lg px-4 pb-24 pt-4">
        {/* Date + greeting */}
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">{today}</p>
            <h1 className="text-xl font-black text-stone-900">
              Namaskar, {tenant.brand.brandName} 🙏
            </h1>
          </div>
          <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-bold text-teal-700">
            {setupDone}/4 Ready
          </span>
        </div>

        {/* Morning drain hero card */}
        <Link href="/daily-parta" className="card-press mb-4 block">
          <div
            className={`rounded-2xl p-5 text-white shadow-md ${
              isMorningUnconfigured
                ? "bg-stone-700"
                : "bg-gradient-to-br from-teal-700 to-teal-800"
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-white/70">
                  Aaj Ka Byaaj Kharcha
                </p>
                <p className="mt-1 text-4xl font-black">
                  {isMorningUnconfigured
                    ? "—"
                    : formatMoney(story.morning.interestDrainToday, sym)}
                </p>
                {!isMorningUnconfigured && (
                  <p className="mt-1.5 text-sm text-white/80">
                    Break-even:{" "}
                    <span className="font-bold">
                      {formatMoney(story.morning.breakEvenSales, sym)}
                    </span>{" "}
                    sales chahiye
                  </p>
                )}
                {isMorningUnconfigured && (
                  <p className="mt-1 text-sm text-white/70">
                    Financial Identity setup karo →
                  </p>
                )}
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20">
                <IndianRupee size={24} className="text-white" />
              </div>
            </div>
          </div>
        </Link>

        {/* Quick action tiles */}
        <div className="mb-4 grid grid-cols-3 gap-3">
          <Link
            href="/daily-parta"
            className="card-press flex flex-col items-center gap-1.5 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-100"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
              <ClipboardList size={20} />
            </span>
            <span className="text-center text-xs font-bold text-stone-700">Galla Darj</span>
          </Link>
          <Link
            href="/debt-engine"
            className="card-press flex flex-col items-center gap-1.5 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-100"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
              <CreditCard size={20} />
            </span>
            <span className="text-center text-xs font-bold text-stone-700">Karj Dena</span>
          </Link>
          <Link
            href="/supplier-wall"
            className="card-press flex flex-col items-center gap-1.5 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-100"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-700">
              <Users size={20} />
            </span>
            <span className="text-center text-xs font-bold text-stone-700">Suppliers</span>
          </Link>
        </div>

        {/* Story cards */}
        <div className="space-y-3">
          {/* Net Profit (nightly) */}
          <Link href="/daily-parta" className="card-press block">
            <div
              className={`rounded-2xl p-4 shadow-sm ring-1 ${
                isNightlyUnconfigured
                  ? "bg-white ring-stone-100"
                  : story.nightly.netProfitToday.gte(0)
                    ? "bg-green-50 ring-green-200"
                    : "bg-red-50 ring-red-200"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {story.nightly.netProfitToday.gte(0) ? (
                    <TrendingUp size={18} className="text-green-600" />
                  ) : (
                    <TrendingDown size={18} className="text-red-600" />
                  )}
                  <p className="text-xs font-bold uppercase tracking-wider text-stone-400">
                    Aaj Ka Net Parta
                  </p>
                </div>
                <ChevronRight size={16} className="text-stone-300" />
              </div>
              {isNightlyUnconfigured ? (
                <p className="mt-2 text-sm text-stone-500">
                  Galla darj karo toh net parta yahan dikhega
                </p>
              ) : (
                <>
                  <p
                    className={`mt-1 text-3xl font-black ${
                      story.nightly.netProfitToday.gte(0) ? "text-green-700" : "text-red-700"
                    }`}
                  >
                    {formatMoney(story.nightly.netProfitToday, sym)}
                  </p>
                  <p className="mt-1 text-xs text-stone-500">
                    Byaaj bachaya:{" "}
                    <span className="font-semibold">
                      {formatMoney(story.nightly.interestSavedToday, sym)}
                    </span>
                  </p>
                </>
              )}
            </div>
          </Link>

          {/* Debt alert */}
          <Link href="/debt-engine" className="card-press block">
            <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CreditCard size={18} className="text-amber-600" />
                  <p className="text-xs font-bold uppercase tracking-wider text-stone-400">
                    Karj Optimizer
                  </p>
                </div>
                <ChevronRight size={16} className="text-stone-300" />
              </div>
              {isDebtUnconfigured ? (
                <p className="mt-2 text-sm text-stone-500">
                  Rates set karo toh yahan repayment plan milega
                </p>
              ) : (
                <>
                  <p className="mt-1 text-base font-bold text-stone-900">
                    {story.debtAlert.higherDebtLabel} ka byaaj {story.debtAlert.ratioText} zyada hai
                  </p>
                  <p className="mt-1 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
                    Aaj {formatMoney(story.debtAlert.recommendedPayment, sym)}{" "}
                    {story.debtAlert.priorityLabel} mein daalo
                  </p>
                </>
              )}
            </div>
          </Link>

          {/* Saakh alert */}
          {story.saakhAlert ? (
            <Link
              href={`/supplier-wall?highlight=${story.saakhAlert.supplierId}`}
              className="card-press block"
            >
              <div className="rounded-2xl bg-red-50 p-4 shadow-sm ring-1 ring-red-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertCircle size={18} className="text-red-600" />
                    <p className="text-xs font-bold uppercase tracking-wider text-red-400">
                      Supplier Alert
                    </p>
                  </div>
                  <ChevronRight size={16} className="text-red-300" />
                </div>
                <p className="mt-1 text-base font-bold text-red-900">
                  {story.saakhAlert.supplierName} — {story.saakhAlert.daysSincePayment} din se
                  payment nahi
                </p>
                <p className="mt-1 text-sm text-red-700">
                  {formatMoney(story.saakhAlert.suggestedPayment, sym)} ka payment karo, trust score
                  bachao
                </p>
              </div>
            </Link>
          ) : null}

          {/* Setup checklist */}
          {setupDone < 4 ? (
            <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-100">
              <p className="mb-3 text-xs font-bold uppercase tracking-wider text-stone-400">
                Setup Checklist
              </p>
              <div className="space-y-2">
                {[
                  {
                    done: hasFinancialConfig,
                    label: "Financial Identity set karo",
                    href: "/financial-identity",
                  },
                  { done: hasDailyEntry, label: "Pehla Galla darj karo", href: "/daily-parta" },
                  {
                    done: hasDebtPayment,
                    label: "Pehli karj payment daalo",
                    href: "/debt-engine",
                  },
                  {
                    done: hasSupplier,
                    label: "Pehla supplier add karo",
                    href: "/supplier-wall",
                  },
                ].map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 rounded-xl p-2.5 ${
                      item.done ? "opacity-50" : "hover:bg-stone-50"
                    }`}
                  >
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs ${
                        item.done ? "bg-green-100 text-green-700" : "bg-stone-100 text-stone-400"
                      }`}
                    >
                      {item.done ? "✓" : "○"}
                    </span>
                    <span
                      className={`text-sm font-semibold ${
                        item.done ? "text-stone-400 line-through" : "text-stone-700"
                      }`}
                    >
                      {item.label}
                    </span>
                    {!item.done && (
                      <ChevronRight size={14} className="ml-auto text-stone-300" />
                    )}
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </main>
    </ThemeProvider>
  );
}
