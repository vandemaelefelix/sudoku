const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** The muted line of the stats screen. A time in the future, from a clock that is ahead, reads as just now. */
export function formatSyncedAgo(iso: string, now: number): string {
  const elapsed = now - Date.parse(iso)
  if (elapsed < MINUTE) return 'Synced just now'
  if (elapsed < HOUR) return `Synced ${Math.floor(elapsed / MINUTE)} min ago`
  if (elapsed < DAY) return `Synced ${Math.floor(elapsed / HOUR)} h ago`
  const days = Math.floor(elapsed / DAY)
  return `Synced ${days} ${days === 1 ? 'day' : 'days'} ago`
}
