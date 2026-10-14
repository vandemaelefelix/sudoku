import { fromSavedGame, toSavedGame, type Game } from '@sudoku/core'
import { devWarn, errorMessage } from '@/utils/log.utils'
import { insertHistoryEntry } from './HistoryRepository'
import type { SqlDatabase } from './sql.types'
import type { GameResult, Level, PuzzleSource, SavedProgress, StorageDeps } from './storage.types'

/** The game in progress (ADR-012). Screens use this interface, never SQL. */
export type PuzzleRepository = {
  /**
   * Starts a game in progress and discards the one before it. Rejects with a RangeError for a won or lost game.
   * peek() gives the new game as soon as start() returns, so a screen can open it while the write runs.
   */
  start(input: { level: Level; source: PuzzleSource; seed?: number | null; game: Game }): Promise<SavedProgress>
  /** The game in progress, or null. A saved game that does not load gives null and stays in storage. */
  current(): Promise<SavedProgress | null>
  /**
   * Saves the game after a move. A won or lost game moves to the history in the same transaction.
   * Does nothing when `id` is not the game in progress.
   */
  save(id: string, game: Game): Promise<void>
  discard(id: string): Promise<void>
  /**
   * The game in progress as far as this repository knows, without a read: a screen can draw it in its first frame.
   * It follows every start, read, save and discard in call order, so a save on its way already counts.
   * undefined: nothing is known yet. Call current().
   */
  peek(): SavedProgress | null | undefined
}

type StartInput = Parameters<PuzzleRepository['start']>[0]

/** The writes and reads of a repository that stores the games. insert writes a new game in progress with its id. */
type StoredPuzzles = Omit<PuzzleRepository, 'start' | 'peek'> & { insert(progress: SavedProgress): Promise<void> }

/**
 * Adds start() and peek() to a repository that stores the games. A current() that resolves after a later write
 * does not change peek(): its row can be older than the game of that write. A failed start makes peek() unknown.
 */
export function withPeek(stored: StoredPuzzles, newId: () => string): PuzzleRepository {
  let latest: SavedProgress | null | undefined = undefined
  let writes = 0
  return {
    start: ({ level, source, seed = null, game }: StartInput) => {
      if (resultOf(game) !== null) return Promise.reject(new RangeError(`A ${game.status} game cannot start`))
      const started: SavedProgress = { id: newId(), level, source, seed, game }
      writes += 1
      latest = started
      return stored.insert(started).then(
        () => started,
        (error: unknown) => {
          if (latest === started) latest = undefined
          throw error
        },
      )
    },
    current: async () => {
      const writesBefore = writes
      const progress = await stored.current()
      if (writes === writesBefore) latest = progress
      return progress
    },
    save: (id, game) => {
      if (latest?.id === id) latest = resultOf(game) === null ? { ...latest, game } : null
      writes += 1
      return stored.save(id, game)
    },
    discard: (id) => {
      if (latest?.id === id) latest = null
      writes += 1
      return stored.discard(id)
    },
    peek: () => latest,
  }
}

export function resultOf(game: Game): GameResult | null {
  return game.status === 'won' || game.status === 'lost' ? game.status : null
}

type ProgressRow = { id: string; level: Level; source: PuzzleSource; seed: number | null; saved_game: string }

/** Runs each task after the one before. Two exclusive transactions on one connection must not overlap. */
function createQueue() {
  let last: Promise<unknown> = Promise.resolve()
  return <T>(task: () => Promise<T>): Promise<T> => {
    const next = last.then(task, task)
    last = next.catch(() => undefined)
    return next
  }
}

export function createSqlitePuzzleRepository(db: SqlDatabase, deps: StorageDeps): PuzzleRepository {
  const inOrder = createQueue()

  return withPeek(
    {
      insert: ({ id, level, source, seed, game }) =>
        inOrder(async () => {
          const now = deps.now()
          await db.withExclusiveTransactionAsync(async (txn) => {
            await txn.runAsync('UPDATE game_in_progress SET deleted_at = ?, updated_at = ? WHERE deleted_at IS NULL', [
              now,
              now,
            ])
            await txn.runAsync(
              `INSERT INTO game_in_progress (id, level, source, seed, saved_game, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [id, level, source, seed, JSON.stringify(toSavedGame(game)), now, now],
            )
          })
        }),

      current: () =>
        inOrder(async () => {
          const row = await db.getFirstAsync<ProgressRow>(
            `SELECT id, level, source, seed, saved_game FROM game_in_progress
            WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 1`,
            [],
          )
          if (row === null) return null
          try {
            const game = fromSavedGame(JSON.parse(row.saved_game))
            return { id: row.id, level: row.level, source: row.source, seed: row.seed, game }
          } catch (error) {
            // Keep the row: a later app version can still load it. Only start() discards it.
            devWarn('storage', `The saved game ${row.id} does not load: ${errorMessage(error)}`)
            return null
          }
        }),

      save: (id, game) =>
        inOrder(() =>
          db.withExclusiveTransactionAsync(async (txn) => {
            const row = await txn.getFirstAsync<Pick<ProgressRow, 'level' | 'source' | 'seed'>>(
              'SELECT level, source, seed FROM game_in_progress WHERE id = ? AND deleted_at IS NULL',
              [id],
            )
            if (row === null) return
            const now = deps.now()
            const result = resultOf(game)
            await txn.runAsync(
              'UPDATE game_in_progress SET saved_game = ?, updated_at = ?, deleted_at = ? WHERE id = ?',
              [JSON.stringify(toSavedGame(game)), now, result === null ? null : now, id],
            )
            if (result !== null) {
              await insertHistoryEntry(txn, {
                id,
                level: row.level,
                source: row.source,
                seed: row.seed,
                result,
                playedMs: game.playedMs,
                mistakes: game.mistakes,
                hintsUsed: game.hintsUsed,
                finishedAt: now,
              })
            }
          }),
        ),

      discard: (id) =>
        inOrder(async () => {
          const now = deps.now()
          await db.runAsync(
            'UPDATE game_in_progress SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL',
            [now, now, id],
          )
        }),
    },
    deps.newId,
  )
}
