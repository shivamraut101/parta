import { signOutAction } from "@/app/auth/actions";
import { NavLinks } from "@/components/layout/NavLinks";
import { getTenantContext } from "@/lib/tenant/getTenantContext";

export async function SiteNav() {
  const tenant = await getTenantContext();

  if (!tenant) {
    return null;
  }

  return (
    <header className="sticky top-0 z-40 border-b border-stone-200 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5">
        {/* Brand */}
        <div className="flex shrink-0 items-center gap-2">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl text-sm font-black text-white"
            style={{ backgroundColor: tenant.brand.primaryColor }}
          >
            {tenant.brand.brandName.slice(0, 1).toUpperCase()}
          </div>
          <span className="text-base font-bold text-stone-900">
            {tenant.brand.brandName}
          </span>
        </div>

        {/* Desktop nav links — hidden on mobile (BottomNav used instead) */}
        <div className="hidden min-w-0 flex-1 sm:flex">
          <NavLinks />
        </div>

        {/* Desktop sign out */}
        <form action={signOutAction} className="hidden sm:block">
          <button
            type="submit"
            className="rounded-lg border border-stone-200 px-4 py-2 text-sm font-semibold text-stone-600 transition-all hover:bg-stone-50 active:scale-[0.985]"
          >
            Sign Out
          </button>
        </form>
      </div>
    </header>
  );
}
