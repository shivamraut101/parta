"use server";

import Decimal from "decimal.js";
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { debtPayments, shops, supplierTransactions, suppliers } from "@/db/schema";
import { logAuditEvent } from "@/lib/audit/logAuditEvent";
import { assertBusinessDayUnlocked } from "@/lib/lock/assertBusinessDayUnlocked";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { getBusinessDateString } from "@/lib/time/businessDate";

const addSupplierSchema = z.object({
  name: z.string().trim().min(2).max(160),
  category: z.string().trim().min(1).max(80),
  contactNumber: z.string().trim().max(20).optional(),
});

const purchaseSchema = z.object({
  supplierId: z.string().uuid(),
  amount: z.coerce.number().positive(),
  note: z.string().trim().optional(),
});

const paymentSchema = z.object({
  supplierId: z.string().uuid(),
  amount: z.coerce.number().positive(),
  note: z.string().trim().optional(),
  source: z.enum(["CASH", "UPI"]),
  payViaCc: z.coerce.boolean().optional().default(false),
});

const returnSchema = z.object({
  supplierId: z.string().uuid(),
  amount: z.coerce.number().positive(),
  note: z.string().trim().optional(),
});

async function assertTenantShopOwnership(shopId: string, userId: string) {
  const [shop] = await db
    .select({ id: shops.id })
    .from(shops)
    .where(and(eq(shops.id, shopId), eq(shops.ownerId, userId)))
    .limit(1);

  if (!shop) {
    throw new Error("Tenant ownership verification failed.");
  }
}

async function assertSupplierOwnership(supplierId: string, shopId: string) {
  const [supplier] = await db
    .select({ id: suppliers.id })
    .from(suppliers)
    .where(and(eq(suppliers.id, supplierId), eq(suppliers.shopId, shopId)))
    .limit(1);

  if (!supplier) {
    throw new Error("Supplier does not belong to this shop.");
  }
}

export async function addSupplier(formData: FormData) {
  const context = await getTenantContext();
  if (!context) {
    throw new Error("Unauthorized tenant context.");
  }

  await assertTenantShopOwnership(context.shopId, context.userId);

  const parsed = addSupplierSchema.safeParse({
    name: formData.get("name"),
    category: formData.get("category"),
    contactNumber: formData.get("contactNumber") || undefined,
  });

  if (!parsed.success) {
    throw new Error("Invalid supplier details.");
  }

  const { name, category, contactNumber } = parsed.data;

  await db.insert(suppliers).values({
    shopId: context.shopId,
    name,
    category,
    contactNumber: contactNumber || null,
    currentBalance: "0",
  });

  await logAuditEvent({
    shopId: context.shopId,
    actorUserId: context.userId,
    eventType: "SUPPLIER_ADDED",
    entityType: "SUPPLIER",
    payload: { name, category, contactNumber: contactNumber || null },
  });

  revalidatePath("/supplier-wall");
}

export async function recordSupplierPurchase(formData: FormData) {
  const context = await getTenantContext();
  if (!context) {
    throw new Error("Unauthorized tenant context.");
  }

  const parsed = purchaseSchema.safeParse({
    supplierId: formData.get("supplierId"),
    amount: formData.get("amount"),
    note: formData.get("note") ?? undefined,
  });

  if (!parsed.success) {
    throw new Error("Invalid supplier purchase payload.");
  }

  const payload = parsed.data;

  await assertTenantShopOwnership(context.shopId, context.userId);
  await assertSupplierOwnership(payload.supplierId, context.shopId);
  const businessDate = getBusinessDateString();
  await assertBusinessDayUnlocked(context.shopId, businessDate);

  const amount = new Decimal(payload.amount);

  await db.transaction(async (tx) => {
    await tx.insert(supplierTransactions).values({
      shopId: context.shopId,
      supplierId: payload.supplierId,
      type: "PURCHASE",
      amount: amount.toFixed(2),
      note: payload.note || null,
    });

    await tx
      .update(suppliers)
      .set({
        currentBalance: sql`${suppliers.currentBalance} + ${amount.toFixed(2)}`,
      })
      .where(and(eq(suppliers.id, payload.supplierId), eq(suppliers.shopId, context.shopId)));
  });

  await logAuditEvent({
    shopId: context.shopId,
    actorUserId: context.userId,
    eventDate: businessDate,
    eventType: "SUPPLIER_PURCHASE_RECORDED",
    entityType: "SUPPLIER_TRANSACTION",
    entityId: payload.supplierId,
    payload: {
      supplierId: payload.supplierId,
      amount: payload.amount,
      type: "PURCHASE",
      note: payload.note || null,
    },
  });

  revalidatePath("/supplier-wall");
}

export async function recordSupplierPayment(formData: FormData) {
  const context = await getTenantContext();
  if (!context) {
    throw new Error("Unauthorized tenant context.");
  }

  const parsed = paymentSchema.safeParse({
    supplierId: formData.get("supplierId"),
    amount: formData.get("amount"),
    note: formData.get("note") ?? undefined,
    source: formData.get("source"),
    payViaCc: formData.get("payViaCc") === "true",
  });

  if (!parsed.success) {
    throw new Error("Invalid supplier payment payload.");
  }

  const payload = parsed.data;

  await assertTenantShopOwnership(context.shopId, context.userId);
  await assertSupplierOwnership(payload.supplierId, context.shopId);
  const businessDate = getBusinessDateString();
  await assertBusinessDayUnlocked(context.shopId, businessDate);

  const amount = new Decimal(payload.amount);

  await db.transaction(async (tx) => {
    await tx.insert(supplierTransactions).values({
      shopId: context.shopId,
      supplierId: payload.supplierId,
      type: "PAYMENT",
      amount: amount.toFixed(2),
      note: payload.note || null,
    });

    await tx
      .update(suppliers)
      .set({
        currentBalance: sql`greatest(${suppliers.currentBalance} - ${amount.toFixed(2)}, 0)`,
        lastPaymentDate: businessDate,
      })
      .where(and(eq(suppliers.id, payload.supplierId), eq(suppliers.shopId, context.shopId)));

    if (payload.payViaCc) {
      await tx.insert(debtPayments).values({
        shopId: context.shopId,
        amount: amount.toFixed(2),
        paymentDate: businessDate,
        targetType: "BANK_CC",
        source: payload.source,
      });
    }
  });

  await logAuditEvent({
    shopId: context.shopId,
    actorUserId: context.userId,
    eventDate: businessDate,
    eventType: payload.payViaCc ? "SUPPLIER_PAYMENT_VIA_CC" : "SUPPLIER_PAYMENT_RECORDED",
    entityType: "SUPPLIER_TRANSACTION",
    entityId: payload.supplierId,
    payload: {
      supplierId: payload.supplierId,
      amount: payload.amount,
      source: payload.source,
      type: "PAYMENT",
      payViaCc: payload.payViaCc,
      note: payload.note || null,
    },
  });

  revalidatePath("/supplier-wall");
  revalidatePath("/debt-engine");
}

export async function recordSupplierReturn(formData: FormData) {
  const context = await getTenantContext();
  if (!context) {
    throw new Error("Unauthorized tenant context.");
  }

  const parsed = returnSchema.safeParse({
    supplierId: formData.get("supplierId"),
    amount: formData.get("amount"),
    note: formData.get("note") ?? undefined,
  });

  if (!parsed.success) {
    throw new Error("Invalid supplier return payload.");
  }

  const payload = parsed.data;
  await assertTenantShopOwnership(context.shopId, context.userId);
  await assertSupplierOwnership(payload.supplierId, context.shopId);

  const businessDate = getBusinessDateString();
  await assertBusinessDayUnlocked(context.shopId, businessDate);

  const amount = new Decimal(payload.amount);

  await db.transaction(async (tx) => {
    await tx.insert(supplierTransactions).values({
      shopId: context.shopId,
      supplierId: payload.supplierId,
      type: "RETURN",
      amount: amount.toFixed(2),
      note: payload.note || null,
    });

    await tx
      .update(suppliers)
      .set({
        currentBalance: sql`greatest(${suppliers.currentBalance} - ${amount.toFixed(2)}, 0)`,
      })
      .where(and(eq(suppliers.id, payload.supplierId), eq(suppliers.shopId, context.shopId)));
  });

  await logAuditEvent({
    shopId: context.shopId,
    actorUserId: context.userId,
    eventDate: businessDate,
    eventType: "SUPPLIER_RETURN_RECORDED",
    entityType: "SUPPLIER_TRANSACTION",
    entityId: payload.supplierId,
    payload: {
      supplierId: payload.supplierId,
      amount: payload.amount,
      type: "RETURN",
      note: payload.note || null,
    },
  });

  revalidatePath("/supplier-wall");
}
