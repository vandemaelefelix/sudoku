import type { Game } from '@sudoku/core'

export type SaveReport = {
  /** ms: the duration of the write, from the clock of the queue. */
  saved(game: Game, ms: number): void
  failed(error: unknown): void
}

/**
 * One write runs at a time. While it runs, only the newest game waits: a fast run of moves gives
 * at most two writes, and the last move always lands. A finished game does not wait. The returned function never waits and never throws.
 */
export function createSaveQueue(
  write: (game: Game) => Promise<void>,
  report: SaveReport,
  now: () => number = () => performance.now(),
): (game: Game) => void {
  let running = false
  let waiting: Game | null = null

  const send = (game: Game) => {
    const started = now()
    return write(game).then(
      () => report.saved(game, now() - started),
      (error: unknown) => report.failed(error),
    )
  }

  const run = (game: Game) => {
    running = true
    send(game).finally(() => {
      running = false
      const next = waiting
      waiting = null
      if (next !== null) run(next)
    })
  }

  return (game) => {
    if (game.status !== 'playing') {
      // A won or lost game goes to the repository at once. A wait here would let a start() that the player
      // triggers next run first and record the game as abandoned (ADR-023). The repository keeps the order.
      waiting = null
      send(game)
    } else if (running) waiting = game
    else run(game)
  }
}
