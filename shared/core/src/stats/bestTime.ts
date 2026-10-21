/** The facts of one finished game that decide whether it counts for the best time. */
export type CountedGameFacts = {
  readonly result: 'won' | 'lost' | 'abandoned'
  readonly source: 'generated' | 'scanned'
  readonly hintsUsed: number
}

/**
 * The one rule for the best time and the average time (ADR-012, amendment): a won generated game without hints counts.
 * A scanned game never counts, because its level is an estimate (ADR-011). The SQL in `HistoryRepository` and
 * `StatsRepository` repeats this rule for speed (ADR-023), and the repository contract suite checks it against this function.
 */
export function countsForBestTime(game: CountedGameFacts): boolean {
  return game.result === 'won' && game.source === 'generated' && game.hintsUsed === 0
}
