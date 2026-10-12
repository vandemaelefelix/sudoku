import { tick } from '@sudoku/core'
import { migrate } from './migrations'
import { openNodeDatabase, temporaryDatabaseFile, type NodeDatabase } from './nodeDatabase'
import { describeGameStorage, newGame, testDeps, wonGame } from './repositories.contract'
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
      first.db.close()
      open.splice(open.indexOf(first.db), 1)

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
})
