import { db } from "@/db";
import { auditEvents } from "@/db/schema";
import { getBusinessDateString } from "@/lib/time/businessDate";

type LogAuditEventParams = {
  shopId: string;
  actorUserId: string;
  eventType: string;
  entityType: string;
  entityId?: string;
  payload?: Record<string, unknown>;
  eventDate?: string;
};

function isMissingRelationError(error: unknown, relationName: string): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return message.includes("does not exist") && message.includes(relationName.toLowerCase());
}

export async function logAuditEvent(params: LogAuditEventParams) {
  try {
    await db.insert(auditEvents).values({
      shopId: params.shopId,
      actorUserId: params.actorUserId,
      eventDate: params.eventDate ?? getBusinessDateString(),
      eventType: params.eventType,
      entityType: params.entityType,
      entityId: params.entityId ?? null,
      payload: params.payload ?? {},
    });
  } catch (error) {
    if (isMissingRelationError(error, "audit_events")) {
      return;
    }

    throw error;
  }
}
