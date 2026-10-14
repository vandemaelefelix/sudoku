import { computeStreak, LEVELS } from '@sudoku/core'
import type { LevelSummary, StatsFilter, StatsRepository } from './StatsRepository'
import type { HistoryEntry, Level, StorageDeps } from './storage.types'

function mean(values: readonly number[]): number | null {
  return values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length
}

function counted(entries: readonly HistoryEntry[], { includeScanned }: StatsFilter): HistoryEntry[] {
  return entries.filter((entry) => includeScanned || entry.source === 'generated')
}

function summarize(entries: readonly HistoryEntry[], level: Level | null, filter: StatsFilter): LevelSummary {
  const rows = counted(entries, filter).filter((entry) => level === null || entry.level === level)
  const won = rows.filter((entry) => entry.result === 'won')
  const finished = rows.filter((entry) => entry.result === 'won' || entry.result === 'lost')
  const best = won
    .filter((entry) => entry.hintsUsed === 0 && entry.source === 'generated')
    .map((entry) => entry.playedMs)
  return {
    played: finished.length,
    won: won.length,
    lost: finished.length - won.length,
    abandoned: rows.filter((entry) => entry.result === 'abandoned').length,
    winRate: finished.length === 0 ? null : won.length / finished.length,
    bestMs: best.length === 0 ? null : Math.min(...best),
    averageMs: mean(best),
    flawlessWins: won.filter((entry) => entry.mistakes === 0 && entry.hintsUsed === 0).length,
    averageMistakes: mean(finished.map((entry) => entry.mistakes)),
    averageHints: mean(finished.map((entry) => entry.hintsUsed)),
  }
}

/** The in-memory fake of StatsRepository. It counts by the same rules as the SQL, and the contract test keeps both honest. */
export function createMemoryStatsRepository(
  entries: () => readonly HistoryEntry[],
  deps: StorageDeps,
): StatsRepository {
  return {
    async summary(level, filter) {
      return summarize(entries(), level, filter)
    },
    async byLevel(filter) {
      return Object.fromEntries(LEVELS.map((level) => [level, summarize(entries(), level, filter)])) as Record<
        Level,
        LevelSummary
      >
    },
    async recentTimes(level, count, filter) {
      // The entries run newest first.
      const wins = counted(entries(), filter).filter((entry) => entry.level === level && entry.result === 'won')
      return wins
        .slice(0, count)
        .toReversed()
        .map((entry) => entry.playedMs)
    },
    async streak(timeZone, filter) {
      const wins = counted(entries(), filter).filter((entry) => entry.result === 'won')
      return computeStreak(
        wins.map((entry) => entry.finishedAt),
        deps.now(),
        timeZone,
      )
    },
  }
}
