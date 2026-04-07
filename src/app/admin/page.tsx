import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import {
  inviteMember,
  lockBusinessDay,
  reopenBusinessDay,
  updateBrandSettings,
  updateFinancialSettings,
} from "@/app/admin/actions";
import { db } from "@/db";
import { shopMembers } from "@/db/schema";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { getBusinessDateString } from "@/lib/time/businessDate";

type AdminPageProps = {
  searchParams?: Promise<{
    saved?: string;
    day?: string;
  }>;
};

function notice(saved?: string, day?: string) {
  if (saved === "brand") return "Brand settings saved";
  if (saved === "finance") return "Financial settings saved";
  if (saved === "locked") return `Business day ${day ?? "selected"} locked`;
  if (saved === "reopened") return `Business day ${day ?? "selected"} reopened`;
  if (saved === "invited") return "Invitation sent and member added";
  if (saved === "member_removed") return "Team member removed";
  return null;
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const tenant = await getTenantContext();
  if (!tenant) redirect("/");

  const params = await searchParams;
  const today = getBusinessDateString();
  const msg = notice(params?.saved, params?.day);

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

      <section className="space-y-4">
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-stone-100">
          <p className="mb-3 text-base font-bold text-stone-900">Day Lock Control</p>
          <form action={lockBusinessDay} className="space-y-3">
            <input id="lockDate" name="date" defaultValue={today} required className="h-12 w-full rounded-xl border-2 border-stone-200 px-4 text-sm" />
            <button type="submit" className="h-12 w-full rounded-xl bg-amber-600 text-sm font-bold text-white">Lock Day</button>
          </form>
          <form action={reopenBusinessDay} className="mt-3 space-y-3">
            <input id="unlockDate" name="date" defaultValue={today} required className="h-12 w-full rounded-xl border-2 border-stone-200 px-4 text-sm" />
            <button type="submit" className="h-12 w-full rounded-xl bg-sky-700 text-sm font-bold text-white">Reopen Day</button>
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
            <button type="submit" className="h-12 w-full rounded-xl bg-stone-900 text-sm font-bold text-white">Save Brand</button>
          </form>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-stone-100">
          <p className="mb-3 text-base font-bold text-stone-900">Financial Control</p>
          <form action={updateFinancialSettings} className="space-y-3">
            <input id="ccLimit" name="ccLimit" defaultValue={tenant.financialConfig.ccLimit} required placeholder="CC Limit" className="h-12 w-full rounded-xl border-2 border-stone-200 px-4 text-sm" />
            <input id="bankInterestRatePa" name="bankInterestRatePa" defaultValue={tenant.financialConfig.bankInterestRatePa} required placeholder="Bank Interest Annual" className="h-12 w-full rounded-xl border-2 border-stone-200 px-4 text-sm" />
            <input id="dailyLocalDrain" name="dailyLocalDrain" defaultValue={tenant.financialConfig.dailyLocalDrain} required placeholder="Daily Local Drain" className="h-12 w-full rounded-xl border-2 border-stone-200 px-4 text-sm" />
            <input id="localLoanAprMonthly" name="localLoanAprMonthly" defaultValue={tenant.financialConfig.localLoanAprMonthly} required placeholder="Local Loan Monthly" className="h-12 w-full rounded-xl border-2 border-stone-200 px-4 text-sm" />
            <input id="baseMarginDefault" name="baseMarginDefault" defaultValue={tenant.financialConfig.baseMarginDefault} required placeholder="Base Margin %" className="h-12 w-full rounded-xl border-2 border-stone-200 px-4 text-sm" />
            <button type="submit" className="h-12 w-full rounded-xl bg-emerald-700 text-sm font-bold text-white">Save Financial</button>
          </form>
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
            <button type="submit" className="h-12 w-full rounded-xl bg-teal-700 text-sm font-bold text-white">Send Invite</button>
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
      </section>
    </main>
  );
}
