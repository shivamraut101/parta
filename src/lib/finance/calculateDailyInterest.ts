import Decimal from "decimal.js";

import { normalizeAnnualRate } from "@/lib/finance/normalizeRate";

export function calculateDailyInterest(limit: string, annualRate: string): Decimal {
  return new Decimal(limit).mul(normalizeAnnualRate(annualRate)).div(365);
}
