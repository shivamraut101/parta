import { eq } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";

import {
  inviteMember,
  lockBusinessDay,
  resetAccountData,
  reopenBusinessDay,
  updateBrandSettings,
} from "@/app/admin/actions";
import { PasswordField } from "@/components/auth/PasswordField";
import { PendingSubmitButton } from "@/components/ui/PendingSubmitButton";
import { db } from "@/db";
import { shopMembers } from "@/db/schema";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { getBusinessDateString } from "@/lib/time/businessDate";

type AdminPageProps = {
  searchParams?: Promise<{
    saved?: string;
    day?: string;
    error?: string;
  }>;
};

function notice(saved?: string, day?: string) {
  if (saved === "brand") return "Brand settings saved";
  if (saved === "finance") return "Financial settings saved";
  if (saved === "locked") return `Business day ${day ?? "selected"} locked`;
  if (saved === "reopened") return `Business day ${day ?? "selected"} reopened`;
  if (saved === "invited") return "Invitation sent and member added";
  if (saved === "member_removed") return "Team member removed";
  if (saved === "account_reset") return "Account data reset complete";
  return null;
}

function errorNotice(error?: string) {
  if (error === "reset_invalid_input") return "Reset failed: enter password and type RESET to confirm";
  if (error === "reset_invalid_password") return "Reset failed: current password is incorrect";
  if (error === "reset_auth_required") return "Reset failed: please sign in again and retry";
  if (error === "reset_failed") return "Reset failed due to server/database issue. Please retry.";
  return null;
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const tenant = await getTenantContext();
  if (!tenant) redirect("/");

  const params = await searchParams;
  const today = getBusinessDateString();
  const msg = notice(params?.saved, params?.day);
  const resetError = errorNotice(params?.error);

  let members: { id: string; userId: string; role: string }[] = [];
  try {
    members = await db
      .select({ id: shopMembers.id, userId: shopMembers.userId, role: shopMembers.role })
      .from(shopMembers)
      .where(eq(shopMembers.shopId, tenant.shopId));
  } catch {
    members = [];
  }

  return (
    <main className="mx-auto w-full max-w-lg px-4 pb-24 pt-4">
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">Aur</p>
        <h1 className="text-2xl font-black text-stone-900">Admin Control</h1>
        <p className="text-sm text-stone-500">Dukaan settings aur team access</p>
      </div>

      {msg ? (
        <div className="mb-4 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          {msg}
        </div>
      ) : null}

      {resetError ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {resetError}
        </div>
      ) : null}

      <section className="space-y-4">
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-stone-100">
          <p className="mb-3 text-base font-bold text-stone-900">Day Lock Control</p>
          <form action={lockBusinessDay} className="space-y-3">
            <input id="lockDate" name="date" defaultValue={today} required className="h-12 w-full rounded-xl border-2 border-stone-200 px-4 text-sm" />
            <PendingSubmitButton className="h-12 w-full rounded-xl bg-amber-600 text-sm font-bold text-white disabled:opacity-70" pendingChildren={<span>Day lock ho raha hai...</span>}>
              Lock Day
            </PendingSubmitButton>
          </form>
          <form action={reopenBusinessDay} className="mt-3 space-y-3">
            <input id="unlockDate" name="date" defaultValue={today} required className="h-12 w-full rounded-xl border-2 border-stone-200 px-4 text-sm" />
            <PendingSubmitButton className="h-12 w-full rounded-xl bg-sky-700 text-sm font-bold text-white disabled:opacity-70" pendingChildren={<span>Day reopen ho raha hai...</span>}>
              Reopen Day
            </PendingSubmitButton>
          </form>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-stone-100">
          <p className="mb-3 text-base font-bold text-stone-900">Brand Profile</p>
          <form action={updateBrandSettings} className="space-y-3">
            <input id="shopName" name="shopName" defaultValue={tenant.shopName} required placeholder="Shop Name" className="h-12 w-full rounded-xl border-2 border-stone-200 px-4 text-sm" />
            <input id="brandName" name="brandName" defaultValue={tenant.brand.brandName} required placeholder="Brand Name" className="h-12 w-full rounded-xl border-2 border-stone-200 px-4 text-sm" />
            <input id="primaryColor" name="primaryColor" defaultValue={tenant.brand.primaryColor} pattern="^#[0-9a-fA-F]{6}$" required placeholder="#0f766e" className="h-12 w-full rounded-xl border-2 border-stone-200 px-4 text-sm" />
            <input id="currencySymbol" name="currencySymbol" defaultValue={tenant.brand.currencySymbol} required placeholder="₹" className="h-12 w-full rounded-xl border-2 border-stone-200 px-4 text-sm" />
            <input id="logoUrl" name="logoUrl" defaultValue={tenant.brand.logoUrl ?? ""} placeholder="Logo URL (optional)" className="h-12 w-full rounded-xl border-2 border-stone-200 px-4 text-sm" />
            <PendingSubmitButton className="h-12 w-full rounded-xl bg-stone-900 text-sm font-bold text-white disabled:opacity-70" pendingChildren={<span>Brand settings save ho rahi hain...</span>}>
              Save Brand
            </PendingSubmitButton>
          </form>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-stone-100">
          <p className="mb-2 text-base font-bold text-stone-900">Financial Control</p>
          <p className="mb-3 text-sm text-stone-500">
            Financial settings ab single source ke liye Financial Identity page par maintain hoti hain.
          </p>
          <Link
            href="/financial-identity"
            className="flex h-12 w-full items-center justify-center rounded-xl bg-emerald-700 text-sm font-bold text-white hover:bg-emerald-800"
          >
            Open Financial Identity
          </Link>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-stone-100">
          <p className="mb-3 text-base font-bold text-stone-900">Team Management</p>
          <form action={inviteMember} className="space-y-3">
            <input id="inviteEmail" name="email" type="email" required placeholder="staff@example.com" className="h-12 w-full rounded-xl border-2 border-stone-200 px-4 text-sm" />
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: "VIEWER", label: "Viewer", desc: "Dekh sakta hai" },
                { value: "MANAGER", label: "Manager", desc: "Edit kar sakta hai" },
              ].map((opt) => (
                <label key={opt.value} className="relative cursor-pointer">
                  <input type="radio" name="role" value={opt.value} defaultChecked={opt.value === "VIEWER"} className="peer sr-only" />
                  <div className="rounded-xl border-2 border-stone-200 bg-white px-3 py-2.5 text-center transition-colors peer-checked:border-teal-500 peer-checked:bg-teal-50">
                    <p className="text-sm font-bold text-stone-800 peer-checked:text-teal-700">{opt.label}</p>
                    <p className="text-[11px] text-stone-400">{opt.desc}</p>
                  </div>
                </label>
              ))}
            </div>
            <PendingSubmitButton className="h-12 w-full rounded-xl bg-teal-700 text-sm font-bold text-white disabled:opacity-70" pendingChildren={<span>Invite bheja ja raha hai...</span>}>
              Send Invite
            </PendingSubmitButton>
          </form>

          {members.length > 0 ? (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">Current Members</p>
              {members.map((m) => (
                <div key={m.id} className="flex items-center justify-between rounded-xl bg-stone-50 px-3 py-2">
                  <span className="text-sm text-stone-700">User {m.userId.slice(0, 8)}…</span>
                  <span className="rounded-full bg-stone-200 px-2 py-0.5 text-xs font-bold text-stone-700">{m.role}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl border border-red-200 bg-red-50/30 p-5 shadow-sm">
          <p className="mb-1 text-base font-bold text-red-700">Account Reset</p>
          <p className="mb-3 text-xs text-red-600">
            Warning: this clears all business data (Daily Parta, Debt, Suppliers, Reports, Audit).
          </p>
          <form action={resetAccountData} className="space-y-3">
            <PasswordField
              id="currentPassword"
              name="currentPassword"
              placeholder="Current sign-in password"
              autoComplete="current-password"
              className="h-12 w-full rounded-xl border-2 border-red-200 bg-white px-4 pr-12 text-sm text-stone-900 focus:border-red-500 focus:outline-none"
            />
            <input
              id="confirmPhrase"
              name="confirmPhrase"
              required
              placeholder='Type RESET to confirm'
              className="h-12 w-full rounded-xl border-2 border-red-200 bg-white px-4 text-sm text-stone-900 focus:border-red-500 focus:outline-none"
            />
            <PendingSubmitButton className="h-12 w-full rounded-xl bg-red-700 text-sm font-bold text-white active:bg-red-800 disabled:opacity-70" pendingChildren={<span>Account data reset ho raha hai...</span>}>
              Reset Account Data
            </PendingSubmitButton>
          </form>
        </div>
      </section>
    </main>
  );
}
