import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { dailyClosures } from "@/db/schema";

function isMissingRelationError(error: unknown, relationName: string): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return message.includes("does not exist") && message.includes(relationName.toLowerCase());
}

export async function assertBusinessDayUnlocked(shopId: string, businessDate: string) {
  try {
    const [closure] = await db
      .select({ isLocked: dailyClosures.isLocked })
      .from(dailyClosures)
      .where(and(eq(dailyClosures.shopId, shopId), eq(dailyClosures.closureDate, businessDate)))
      .limit(1);

    if (closure?.isLocked) {
      throw new Error(`Business day ${businessDate} is locked. Reopen it from Admin Control first.`);
    }
  } catch (error) {
    if (isMissingRelationError(error, "daily_closures")) {
      return;
    }

    throw error;
  }
}
