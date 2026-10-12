import { fromSavedGame, toSavedGame, type Game } from '@sudoku/core'
import { devWarn, errorMessage } from '@/utils/log.utils'
import { insertHistoryEntry } from './HistoryRepository'
import type { SqlDatabase } from './sql.types'
import type { GameResult, Level, PuzzleSource, SavedProgress, StorageDeps } from './storage.types'

/** The game in progress (ADR-012). Screens use this interface, never SQL. */
export type PuzzleRepository = {
  /** Starts a game in progress and discards the one before it. Throws a RangeError for a won or lost game. */
  start(input: { level: Level; source: PuzzleSource; game: Game }): Promise<SavedProgress>
  /** The game in progress, or null. A saved game that does not load gives null and stays in storage. */
  current(): Promise<SavedProgress | null>
  /**
   * Saves the game after a move. A won or lost game moves to the history in the same transaction.
   * Does nothing when `id` is not the game in progress.
   */
  save(id: string, game: Game): Promise<void>
  discard(id: string): Promise<void>
}

export function resultOf(game: Game): GameResult | null {
  return game.status === 'won' || game.status === 'lost' ? game.status : null
}

type ProgressRow = { id: string; level: Level; source: PuzzleSource; saved_game: string }

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

  return {
    start: ({ level, source, game }) =>
      inOrder(async () => {
        if (resultOf(game) !== null) throw new RangeError(`A ${game.status} game cannot start`)
        const id = deps.newId()
        const now = deps.now()
        await db.withExclusiveTransactionAsync(async (txn) => {
          await txn.runAsync('UPDATE game_in_progress SET deleted_at = ?, updated_at = ? WHERE deleted_at IS NULL', [
            now,
            now,
          ])
          await txn.runAsync(
            `INSERT INTO game_in_progress (id, level, source, saved_game, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?)`,
            [id, level, source, JSON.stringify(toSavedGame(game)), now, now],
          )
        })
        return { id, level, source, game }
      }),

    current: () =>
      inOrder(async () => {
        const row = await db.getFirstAsync<ProgressRow>(
          `SELECT id, level, source, saved_game FROM game_in_progress
            WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 1`,
          [],
        )
        if (row === null) return null
        try {
          const game = fromSavedGame(JSON.parse(row.saved_game))
          return { id: row.id, level: row.level, source: row.source, game }
        } catch (error) {
          // Keep the row: a later app version can still load it. Only start() discards it.
          devWarn('storage', `The saved game ${row.id} does not load: ${errorMessage(error)}`)
          return null
        }
      }),

    save: (id, game) =>
      inOrder(() =>
        db.withExclusiveTransactionAsync(async (txn) => {
          const row = await txn.getFirstAsync<Pick<ProgressRow, 'level' | 'source'>>(
            'SELECT level, source FROM game_in_progress WHERE id = ? AND deleted_at IS NULL',
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
  }
}
