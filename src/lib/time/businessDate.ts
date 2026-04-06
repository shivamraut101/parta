const BUSINESS_TIME_ZONE = "Asia/Kolkata";

function isYmdDateString(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function shiftYmd(ymd: string, deltaDays: number): string {
  const dt = new Date(`${ymd}T00:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  return dt.toISOString().slice(0, 10);
}

export function getBusinessDateString(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function getBusinessDateDaysAgo(daysAgo: number, fromDate: Date = new Date()): string {
  const today = getBusinessDateString(fromDate);
  return shiftYmd(today, -Math.max(0, daysAgo));
}

export function normalizeBusinessDateInput(input: FormDataEntryValue | null | undefined): string {
  if (typeof input === "string" && isYmdDateString(input)) {
    return input;
  }

  return getBusinessDateString();
}
