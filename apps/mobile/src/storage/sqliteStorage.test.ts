import { tick } from '@sudoku/core'
import { migrate } from './migrations'
import { openNodeDatabase, temporaryDatabaseFile, type NodeDatabase } from './nodeDatabase'
import { describeGameStorage, movedGame, newGame, testDeps, wonGame } from './repositories.contract'
import { createSqliteStorage } from './sqliteStorage'
import type { Level } from './storage.types'

const open: NodeDatabase[] = []

async function openStorage(path?: string, deps = testDeps()) {
  const db = openNodeDatabase(path)
  open.push(db)
  await migrate(db)
  return { db, storage: createSqliteStorage(db, deps) }
}

afterEach(() => {
  for (const db of open.splice(0)) db.close()
})

describeGameStorage('the SQLite storage', async (deps) => (await openStorage(undefined, deps)).storage)

describe('createSqliteStorage', () => {
  it('resumes after the app is killed', async () => {
    const file = temporaryDatabaseFile()
    try {
      const first = await openStorage(file.path)
      const { id } = await first.storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame() })
      const moved = tick(newGame(), 125_000)
      await first.storage.puzzles.save(id, moved)

      // A killed app never closes its connection: the second one opens while the first stays open.
      const second = await openStorage(file.path)
      const current = await second.storage.puzzles.current()
      expect(current?.id).toBe(id)
      expect(current?.game).toEqual(moved)
      expect(current?.game.playedMs).toBe(125_000)
    } finally {
      for (const db of open.splice(0)) db.close()
      file.remove()
    }
  })

  it('rolls back a finish whose history entry fails', async () => {
    const { db, storage } = await openStorage()
    const started = await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame() })
    const at = '2026-01-01T00:00:00.000Z'
    await db.runAsync(
      `INSERT INTO game_history
        (id, level, source, result, played_ms, mistakes, hints_used, finished_at, created_at, updated_at)
        VALUES (?, 'easy', 'generated', 'lost', 1, 3, 0, ?, ?, ?)`,
      [started.id, at, at, at],
    )

    await expect(storage.puzzles.save(started.id, wonGame(50_000))).rejects.toThrow('UNIQUE constraint failed')
    await expect(storage.puzzles.current()).resolves.toEqual(started)
    await expect(storage.history.list()).resolves.toEqual([expect.objectContaining({ result: 'lost', playedMs: 1 })])
  })

  it('keeps a saved game that does not load, and gives null', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
    const { db, storage } = await openStorage()
    const { id } = await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame() })
    await db.runAsync('UPDATE game_in_progress SET saved_game = ? WHERE id = ?', ['{"version":99}', id])

    await expect(storage.puzzles.current()).resolves.toBeNull()
    await expect(storage.puzzles.current()).resolves.toBeNull()
    const deletedAt = async () =>
      (
        await db.getFirstAsync<{ deleted_at: string | null }>('SELECT deleted_at FROM game_in_progress WHERE id = ?', [
          id,
        ])
      )?.deleted_at
    expect(await deletedAt()).toBeNull()
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()

    await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame() })
    expect(await deletedAt()).toEqual(expect.any(String))
  })

  it('soft-deletes a finished game and keeps its timestamps (ADR-012)', async () => {
    const { db, storage } = await openStorage()
    const { id } = await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame() })
    await storage.puzzles.save(id, wonGame(50_000))
    const row = await db.getFirstAsync<{ created_at: string; updated_at: string; deleted_at: string | null }>(
      'SELECT created_at, updated_at, deleted_at FROM game_in_progress WHERE id = ?',
      [id],
    )
    expect(row?.deleted_at).toEqual(expect.any(String))
    expect((row?.updated_at ?? '') > (row?.created_at ?? '')).toBe(true)
  })

  it('refuses a level that is not one of the four', async () => {
    const { storage } = await openStorage()
    await expect(
      storage.puzzles.start({ level: 'nightmare' as Level, source: 'generated', game: newGame() }),
    ).rejects.toThrow('CHECK constraint failed')
  })

  it('starts a game over a saved game that does not load, and writes no history entry', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
    const { db, storage } = await openStorage()
    const { id } = await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame() })
    await db.runAsync('UPDATE game_in_progress SET saved_game = ? WHERE id = ?', ['{"version":99}', id])

    const next = await storage.puzzles.start({ level: 'hard', source: 'generated', game: newGame() })

    await expect(storage.puzzles.current()).resolves.toEqual(next)
    await expect(storage.history.list()).resolves.toEqual([])
    warn.mockRestore()
  })

  it('rolls back a start whose abandoned entry fails, and keeps the game in progress', async () => {
    const { db, storage } = await openStorage()
    const first = await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame() })
    await storage.puzzles.save(first.id, movedGame())
    // A history entry with the id of the game makes the abandoned entry fail on the primary key.
    const at = '2026-01-01T00:00:00.000Z'
    await db.runAsync(
      `INSERT INTO game_history
        (id, level, source, result, played_ms, mistakes, hints_used, finished_at, created_at, updated_at)
        VALUES (?, 'easy', 'generated', 'lost', 1, 3, 0, ?, ?, ?)`,
      [first.id, at, at, at],
    )

    await expect(storage.puzzles.start({ level: 'hard', source: 'generated', game: newGame() })).rejects.toThrow(
      'UNIQUE constraint failed',
    )
    await expect(storage.puzzles.current()).resolves.toMatchObject({ id: first.id })
  })
})
