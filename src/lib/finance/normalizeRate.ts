import Decimal from "decimal.js";

function normalizePercentLikeRate(rate: string | number | Decimal): Decimal {
  const value = new Decimal(rate || 0);

  if (value.lte(0)) {
    return new Decimal(0);
  }

  // Accept either decimal (0.18) or percent-style input (18, 9.65, 7.5).
  return value.gte(1) ? value.div(100) : value;
}

export function normalizeAnnualRate(rate: string | number | Decimal): Decimal {
  return normalizePercentLikeRate(rate);
}

export function normalizeMonthlyRate(rate: string | number | Decimal): Decimal {
  return normalizePercentLikeRate(rate);
}
