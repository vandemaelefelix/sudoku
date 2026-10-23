import { tick } from '@sudoku/core'
import { migrate } from './migrations'
import { openNodeDatabase, temporaryDatabaseFile, type NodeDatabase } from './nodeDatabase'
import type { SyncPageInput } from './HistoryRepository'
import { describeGameStorage } from './contract/describeGameStorage.testkit'
import { movedGame, newGame, seedCursor, testDeps, uuid, wonGame } from './contract/fixtures.testkit'
import { createSqliteStorage } from './sqliteStorage'
import type { SqlDatabase } from './sql.types'
import type { HistoryRecord, Level } from './storage.types'
import { toWireEntry } from './wireEntry'

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

const REMOTE_AT = '2026-10-01T09:00:00.000Z'
const record = (n: number, playedMs: number): HistoryRecord => ({
  id: uuid(900 + n),
  level: 'easy',
  source: 'generated',
  seed: null,
  result: 'won',
  playedMs,
  mistakes: 0,
  hintsUsed: 0,
  finishedAt: REMOTE_AT,
  createdAt: REMOTE_AT,
  updatedAt: REMOTE_AT,
  deletedAt: null,
})
const page = (changes: HistoryRecord[], cursor = 'next'): SyncPageInput => ({
  owner: 'user-alice',
  sent: [],
  acceptedIds: [],
  changes: changes.map(toWireEntry),
  cursor,
})
// The contract of the sync is stricter than the CHECKs, so no valid entry breaks a CHECK. This trigger breaks
// the insert of one entry in the way a CHECK does.
const refuse = (db: NodeDatabase, playedMs: number, message: string) =>
  db.execAsync(
    `CREATE TRIGGER refuse BEFORE INSERT ON game_history WHEN NEW.played_ms = ${playedMs}
      BEGIN SELECT RAISE(ABORT, '${message}'); END`,
  )

describe('createSqliteStorage', () => {
  it('resumes after the app is killed', async () => {
    const file = temporaryDatabaseFile()
    try {
      const first = await openStorage(file.path)
      const { id } = await first.storage.puzzles.start({
        level: 'easy',
        source: 'generated',
        game: newGame(),
        owner: null,
      })
      const moved = tick(newGame(), 125_000)
      await first.storage.puzzles.save(id, moved, null)

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
    const started = await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame(), owner: null })
    const at = '2026-01-01T00:00:00.000Z'
    await db.runAsync(
      `INSERT INTO game_history
        (id, level, source, result, played_ms, mistakes, hints_used, finished_at, created_at, updated_at)
        VALUES (?, 'easy', 'generated', 'lost', 1, 3, 0, ?, ?, ?)`,
      [started.id, at, at, at],
    )

    await expect(storage.puzzles.save(started.id, wonGame(50_000), null)).rejects.toThrow('UNIQUE constraint failed')
    await expect(storage.puzzles.current()).resolves.toEqual(started)
    await expect(storage.history.list(null)).resolves.toEqual([
      expect.objectContaining({ result: 'lost', playedMs: 1 }),
    ])
  })

  it('queues a history write behind a finish, so it never meets "database is locked"', async () => {
    const db = openNodeDatabase()
    open.push(db)
    await migrate(db)
    let armed = false
    let clearing: Promise<void> | undefined
    // The clear starts while the transaction of the finish holds the write lock, before its commit.
    const interleaved: SqlDatabase = {
      ...db,
      withExclusiveTransactionAsync: (task) =>
        db.withExclusiveTransactionAsync(async (txn) => {
          await task(txn)
          if (armed) clearing ??= storage.history.clear(null)
        }),
    }
    const storage = createSqliteStorage(interleaved, testDeps())
    const { id } = await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame(), owner: null })
    armed = true
    await storage.puzzles.save(id, wonGame(50_000), null)
    await expect(clearing).resolves.toBeUndefined()
    await expect(storage.history.list(null)).resolves.toEqual([])
  })

  describe('a sync page', () => {
    it('drops an entry that breaks a CHECK, writes the rest and saves the cursor', async () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
      const { db, storage } = await openStorage()
      await refuse(db, 777, 'CHECK constraint failed: played_ms')
      await expect(
        storage.history.applySyncPage(page([record(1, 60_000), record(2, 777), record(3, 50_000)])),
      ).resolves.toMatchObject({ changed: true })
      const ids = (await storage.history.list('user-alice')).map((entry) => entry.id)
      expect([...ids].sort()).toEqual([uuid(901), uuid(903)])
      await expect(storage.sync.cursor('user-alice')).resolves.toBe('next')
      warn.mockRestore()
    })

    it('writes nothing, not even the cursor, when the database fails for another reason', async () => {
      const { db, storage } = await openStorage()
      await refuse(db, 777, 'disk I/O error')
      await seedCursor(storage, 'user-alice', 'before')
      await expect(storage.history.applySyncPage(page([record(1, 60_000), record(2, 777)], 'after'))).rejects.toThrow(
        'disk I/O error',
      )
      await expect(storage.history.list('user-alice')).resolves.toEqual([])
      await expect(storage.sync.cursor('user-alice')).resolves.toBe('before')
    })
  })

  it('queues every sync write behind a finish, so none meets "database is locked"', async () => {
    const db = openNodeDatabase()
    open.push(db)
    await migrate(db)
    let armed = false
    const writes: Promise<unknown>[] = []
    const interleaved: SqlDatabase = {
      ...db,
      withExclusiveTransactionAsync: (task) =>
        db.withExclusiveTransactionAsync(async (txn) => {
          await task(txn)
          if (armed) {
            armed = false
            const sync = { owner: 'user-alice', sent: [], acceptedIds: [], changes: [], cursor: 'next' }
            writes.push(
              storage.history.applySyncPage(sync),
              storage.history.answerAdopt('user-alice', true),
              storage.history.deleteOwner('user-alice'),
            )
          }
        }),
    }
    const storage = createSqliteStorage(interleaved, testDeps())
    const { id } = await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame(), owner: null })
    armed = true
    await storage.puzzles.save(id, wonGame(50_000), null)
    await expect(Promise.all(writes)).resolves.toHaveLength(3)
  })

  it('keeps a saved game that does not load, and gives null', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
    const { db, storage } = await openStorage()
    const { id } = await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame(), owner: null })
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

    await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame(), owner: null })
    expect(await deletedAt()).toEqual(expect.any(String))
  })

  it('soft-deletes a finished game and keeps its timestamps (ADR-012)', async () => {
    const { db, storage } = await openStorage()
    const { id } = await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame(), owner: null })
    await storage.puzzles.save(id, wonGame(50_000), null)
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
      storage.puzzles.start({ level: 'nightmare' as Level, source: 'generated', game: newGame(), owner: null }),
    ).rejects.toThrow('CHECK constraint failed')
  })

  it('starts a game over a saved game that does not load, and writes no history entry', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
    const { db, storage } = await openStorage()
    const { id } = await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame(), owner: null })
    await db.runAsync('UPDATE game_in_progress SET saved_game = ? WHERE id = ?', ['{"version":99}', id])

    const next = await storage.puzzles.start({ level: 'hard', source: 'generated', game: newGame(), owner: null })

    await expect(storage.puzzles.current()).resolves.toEqual(next)
    await expect(storage.history.list(null)).resolves.toEqual([])
    warn.mockRestore()
  })

  it('rolls back a start whose abandoned entry fails, and keeps the game in progress', async () => {
    const { db, storage } = await openStorage()
    const first = await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame(), owner: null })
    await storage.puzzles.save(first.id, movedGame(), null)
    // A history entry with the id of the game makes the abandoned entry fail on the primary key.
    const at = '2026-01-01T00:00:00.000Z'
    await db.runAsync(
      `INSERT INTO game_history
        (id, level, source, result, played_ms, mistakes, hints_used, finished_at, created_at, updated_at)
        VALUES (?, 'easy', 'generated', 'lost', 1, 3, 0, ?, ?, ?)`,
      [first.id, at, at, at],
    )

    await expect(
      storage.puzzles.start({ level: 'hard', source: 'generated', game: newGame(), owner: null }),
    ).rejects.toThrow('UNIQUE constraint failed')
    await expect(storage.puzzles.current()).resolves.toMatchObject({ id: first.id })
  })
})
