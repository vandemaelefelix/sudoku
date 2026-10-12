import type { Game } from '@sudoku/core'

/**
 * True when next differs from previous in data that a resume needs. The selected cell and the time
 * do not count: a selection must stay free, and the time is saved when the app leaves (QR-11).
 */
export function needsSave(previous: Game, next: Game): boolean {
  return (
    previous.entries !== next.entries ||
    previous.notes !== next.notes ||
    previous.undoSteps !== next.undoSteps ||
    previous.mistakes !== next.mistakes ||
    previous.hintsUsed !== next.hintsUsed ||
    previous.status !== next.status
  )
}

export type SaveReport = {
  /** ms: the duration of the write, from the clock of the queue. */
  saved(game: Game, ms: number): void
  failed(error: unknown): void
}

/**
 * One write runs at a time. While it runs, only the newest game waits: a fast run of moves gives
 * at most two writes, and the last move always lands. The returned function never waits and never throws.
 */
export function createSaveQueue(
  write: (game: Game) => Promise<void>,
  report: SaveReport,
  now: () => number = () => performance.now(),
): (game: Game) => void {
  let running = false
  let waiting: Game | null = null

  const run = (game: Game) => {
    running = true
    const started = now()
    write(game)
      .then(
        () => report.saved(game, now() - started),
        (error: unknown) => report.failed(error),
      )
      .finally(() => {
        running = false
        const next = waiting
        waiting = null
        if (next !== null) run(next)
      })
  }

  return (game) => {
    if (running) waiting = game
    else run(game)
  }
}
