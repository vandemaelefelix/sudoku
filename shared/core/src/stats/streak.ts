/** How many days `Streak.recent` covers, today included. */
export const STREAK_WINDOW_DAYS = 14

export type Streak = {
  /** Days in a row with a win, counted back from today. A streak stays alive until the end of the next day (ADR-023). */
  readonly current: number
  readonly longest: number
  /** Oldest first. The last item is today. True for a day with a win. */
  readonly recent: readonly boolean[]
}

const DAY_MS = 86_400_000

/** One formatter for all times: building a formatter costs more than using it, and the history can hold thousands of wins. */
function dayNumberOf(timeZone: string): (iso: string) => number {
  const format = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: 'numeric', day: 'numeric' })
  return (iso) => {
    const parts = format.formatToParts(new Date(iso))
    const part = (type: string) => Number(parts.find((candidate) => candidate.type === type)?.value)
    return Date.UTC(part('year'), part('month') - 1, part('day')) / DAY_MS
  }
}

/**
 * Counts the streak from the times of the won games. The day of a time is its calendar day in `timeZone`, an IANA name
 * such as "Europe/Brussels". All times are ISO 8601 UTC. SQLite has no time zones, so every StatsRepository uses this function.
 * Throws a RangeError for a time zone that does not exist.
 */
export function computeStreak(winTimes: readonly string[], now: string, timeZone: string): Streak {
  const dayOf = dayNumberOf(timeZone)
  const days = new Set(winTimes.map(dayOf))
  const today = dayOf(now)

  let current = 0
  // Today may still get its win, so a streak that ends yesterday is alive.
  let day = days.has(today) ? today : today - 1
  while (days.has(day)) {
    current += 1
    day -= 1
  }

  let longest = 0
  for (const start of days) {
    // Count a run from its first day only.
    if (days.has(start - 1)) continue
    let end = start
    while (days.has(end + 1)) end += 1
    longest = Math.max(longest, end - start + 1)
  }

  const recent = Array.from({ length: STREAK_WINDOW_DAYS }, (_, index) =>
    days.has(today - (STREAK_WINDOW_DAYS - 1 - index)),
  )
  return { current, longest, recent }
}
