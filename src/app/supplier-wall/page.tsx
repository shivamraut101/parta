import { asc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { SupplierWallClient } from "@/app/supplier-wall/SupplierWallClient";
import { db } from "@/db";
import { suppliers } from "@/db/schema";
import { calculateSupplierSaakh } from "@/lib/supplier/calculateSupplierSaakh";
import { getTenantContext } from "@/lib/tenant/getTenantContext";

export const dynamic = "force-dynamic";

type SupplierWallPageProps = {
  searchParams?: Promise<{ highlight?: string }>;
};

export default async function SupplierWallPage({ searchParams }: SupplierWallPageProps) {
  const tenant = await getTenantContext();

  if (!tenant) {
    redirect("/");
  }

  const params = await searchParams;
  const highlight = params?.highlight ?? null;

  const supplierRows = await db
    .select({
      id: suppliers.id,
      name: suppliers.name,
      category: suppliers.category,
      contactNumber: suppliers.contactNumber,
      currentBalance: suppliers.currentBalance,
      lastPaymentDate: suppliers.lastPaymentDate,
    })
    .from(suppliers)
    .where(eq(suppliers.shopId, tenant.shopId))
    .orderBy(asc(suppliers.name));

  const wallData = await Promise.all(
    supplierRows.map(async (row) => {
      const saakh = await calculateSupplierSaakh(row.id);

      return {
        ...row,
        trustScore: saakh.score,
      };
    }),
  );

  return (
    <main className="mx-auto w-full max-w-lg px-4 pb-24 pt-4">
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">Saakh</p>
        <h1 className="text-2xl font-black text-stone-900">Supplier Wall</h1>
        <p className="text-sm text-stone-500">Chalta khata aur trust score</p>
      </div>

      <SupplierWallClient suppliers={wallData} highlight={highlight} />
    </main>
  );
}
