export function isExpired(expiresAt: Date | string | null): boolean {
  if (!expiresAt) return false;
  const ts = typeof expiresAt === "string" ? new Date(expiresAt) : expiresAt;
  return ts.getTime() <= Date.now();
}

export function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

export function startOfDayUtc(date: Date = new Date()): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}
