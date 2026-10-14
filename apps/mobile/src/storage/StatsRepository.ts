import { computeStreak, LEVELS, type Streak } from '@sudoku/core'
import type { SqlExecutor } from './sql.types'
import type { Level, StorageDeps } from './storage.types'

/** The stats that depend on which games count. Scanned games count only when `includeScanned` is true (ADR-023). */
export type StatsFilter = { includeScanned: boolean }

export type LevelSummary = {
  /** Won and lost games. An abandoned game is not played. */
  played: number
  won: number
  lost: number
  abandoned: number
  /** Won divided by played. Null when nothing was played. */
  winRate: number | null
  /** The shortest time of a won generated game without hints. A scanned game never counts, whatever the filter says. */
  bestMs: number | null
  /** The mean time of the same games as the best time, so a level has an average only when it has a best time. */
  averageMs: number | null
  /** Won games with no mistake and no hint. */
  flawlessWins: number
  /** The mean over the won and lost games. */
  averageMistakes: number | null
  averageHints: number | null
}

/** The counted stats of the history (ADR-023). Screens use this interface, never SQL. */
export type StatsRepository = {
  /** `level` null counts all levels. */
  summary(level: Level | null, filter: StatsFilter): Promise<LevelSummary>
  byLevel(filter: StatsFilter): Promise<Record<Level, LevelSummary>>
  /** The times of the last `count` won games of a level, oldest first. */
  recentTimes(level: Level, count: number, filter: StatsFilter): Promise<number[]>
  /** `timeZone` is an IANA name. Rejects with a RangeError for a name that does not exist. */
  streak(timeZone: string, filter: StatsFilter): Promise<Streak>
}

type SummaryRow = {
  won: number
  lost: number
  abandoned: number
  flawless: number
  best_ms: number | null
  average_ms: number | null
  average_mistakes: number | null
  average_hints: number | null
}

// One row for every call: an aggregate without GROUP BY always returns a row, with NULL or 0 when no game matches.
// The best and the average time read the same games: won, generated, no hints, whatever the filter says (ADR-012, amendment).
const SUMMARY_SQL = `SELECT
    COALESCE(SUM(result = 'won'), 0) AS won,
    COALESCE(SUM(result = 'lost'), 0) AS lost,
    COALESCE(SUM(result = 'abandoned'), 0) AS abandoned,
    COALESCE(SUM(result = 'won' AND mistakes = 0 AND hints_used = 0), 0) AS flawless,
    MIN(CASE WHEN result = 'won' AND hints_used = 0 AND source = 'generated' THEN played_ms END) AS best_ms,
    AVG(CASE WHEN result = 'won' AND hints_used = 0 AND source = 'generated' THEN played_ms END) AS average_ms,
    AVG(CASE WHEN result IN ('won', 'lost') THEN mistakes END) AS average_mistakes,
    AVG(CASE WHEN result IN ('won', 'lost') THEN hints_used END) AS average_hints
  FROM game_history
  WHERE deleted_at IS NULL AND (? IS NULL OR level = ?) AND (? = 1 OR source = 'generated')`

const RECENT_SQL = `SELECT played_ms FROM (
    SELECT played_ms, finished_at, rowid AS row_id FROM game_history
    WHERE result = 'won' AND level = ? AND deleted_at IS NULL AND (? = 1 OR source = 'generated')
    ORDER BY finished_at DESC, rowid DESC LIMIT ?
  ) ORDER BY finished_at ASC, row_id ASC`

const WINS_SQL = `SELECT finished_at FROM game_history
  WHERE result = 'won' AND deleted_at IS NULL AND (? = 1 OR source = 'generated')`

export function createSqliteStatsRepository(db: SqlExecutor, deps: StorageDeps): StatsRepository {
  const summary: StatsRepository['summary'] = async (level, { includeScanned }) => {
    const row = await db.getFirstAsync<SummaryRow>(SUMMARY_SQL, [level, level, includeScanned ? 1 : 0])
    // The query always gives a row.
    const counts = row ?? {
      won: 0,
      lost: 0,
      abandoned: 0,
      flawless: 0,
      best_ms: null,
      average_ms: null,
      average_mistakes: null,
      average_hints: null,
    }
    const played = counts.won + counts.lost
    return {
      played,
      won: counts.won,
      lost: counts.lost,
      abandoned: counts.abandoned,
      winRate: played === 0 ? null : counts.won / played,
      bestMs: counts.best_ms,
      averageMs: counts.average_ms,
      flawlessWins: counts.flawless,
      averageMistakes: counts.average_mistakes,
      averageHints: counts.average_hints,
    }
  }

  return {
    summary,
    async byLevel(filter) {
      const summaries = await Promise.all(LEVELS.map((level) => summary(level, filter)))
      return Object.fromEntries(LEVELS.map((level, index) => [level, summaries[index]])) as Record<Level, LevelSummary>
    },
    recentTimes: async (level, count, { includeScanned }) => {
      const rows = await db.getAllAsync<{ played_ms: number }>(RECENT_SQL, [level, includeScanned ? 1 : 0, count])
      return rows.map((row) => row.played_ms)
    },
    async streak(timeZone, { includeScanned }) {
      const rows = await db.getAllAsync<{ finished_at: string }>(WINS_SQL, [includeScanned ? 1 : 0])
      return computeStreak(
        rows.map((row) => row.finished_at),
        deps.now(),
        timeZone,
      )
    },
  }
}
