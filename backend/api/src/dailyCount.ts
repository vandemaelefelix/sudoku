// ADR-027 decision 9: stored history entries per player per UTC day. A no-op and a refused write do not count.
export const DAILY_CAP = 200

const DAY_SECONDS = 86_400

// The UTC date as yyyy-mm-dd.
export function dayKey(now: Date): string {
  return now.toISOString().slice(0, 10)
}

// The TTL of a daily count row: the start of its UTC day plus 2 days, in epoch seconds (ADR-028 decision 9).
export function countExpiresAt(now: Date): number {
  return Date.parse(`${dayKey(now)}T00:00:00.000Z`) / 1000 + 2 * DAY_SECONDS
}
