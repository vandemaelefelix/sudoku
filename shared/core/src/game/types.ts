export type Digit = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9

/** `lost` follows the third mistake. `won` follows the last correct number. */
export type GameStatus = 'playing' | 'paused' | 'lost' | 'won'

/** The entries and notes before one edit action. */
export type UndoStep = {
  readonly entries: readonly number[]
  readonly notes: readonly (readonly Digit[])[]
}

/** Every grid array has 81 cells, row by row. 0 marks an empty cell. */
export type Game = {
  readonly givens: readonly number[]
  readonly solution: readonly number[]
  /** 0 on every cell with a given. */
  readonly entries: readonly number[]
  /**
   * The entries that came with the start and that the player did not make, such as scanned digits.
   * 0 on every other cell. No action changes them.
   */
  readonly startEntries: readonly number[]
  /** Sorted. Empty on every cell with a given or an entry. */
  readonly notes: readonly (readonly Digit[])[]
  readonly selected: number | null
  readonly mistakes: number
  readonly hintsUsed: number
  /** Time played in milliseconds. Pauses and the time after the end do not count. */
  readonly playedMs: number
  readonly status: GameStatus
  /** Oldest first, at most UNDO_LIMIT steps. */
  readonly undoSteps: readonly UndoStep[]
}

/** What one action completed. Each list holds unit indices 0 to 8, or digits. */
export type Completion = {
  readonly rows: readonly number[]
  readonly columns: readonly number[]
  readonly boxes: readonly number[]
  readonly digits: readonly Digit[]
  readonly grid: boolean
}

export type MoveResult = {
  readonly game: Game
  readonly completed: Completion
}

/** Returns a number in [0, 1), as Math.random does. */
export type Random = () => number
