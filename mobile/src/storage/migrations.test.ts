import { place, select, toSavedGame } from '@sudoku/core'
import { MIGRATIONS, migrate } from './migrations'
import { openNodeDatabase, temporaryDatabaseFile, type NodeDatabase } from './nodeDatabase'
import { newGame, testDeps } from './repositories.contract'
import { createSqliteStorage } from './sqliteStorage'
import type { SqlDatabase } from './sql.types'

let db: NodeDatabase

beforeEach(() => {
  db = openNodeDatabase()
})

afterEach(() => {
  db.close()
})

async function version(): Promise<number> {
  return (await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version', []))?.user_version ?? -1
}

async function columns(table: string): Promise<string[]> {
  const rows = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`, [])
  return rows.map((row) => row.name)
}

describe('migrate', () => {
  it('brings a new database to the last migration', async () => {
    await expect(migrate(db)).resolves.toBe(MIGRATIONS.length)
    expect(await version()).toBe(MIGRATIONS.length)
  })

  it('creates the game in progress, the history and the sync state tables', async () => {
    await migrate(db)
    const tables = await db.getAllAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
      [],
    )
    expect(tables.map((table) => table.name)).toEqual(['game_history', 'game_in_progress', 'sync_state'])
  })

  it('gives every table an id, created_at, updated_at and deleted_at (ADR-012)', async () => {
    await migrate(db)
    const rowColumns = expect.arrayContaining(['id', 'created_at', 'updated_at', 'deleted_at'])
    expect(await columns('game_in_progress')).toEqual(rowColumns)
    expect(await columns('game_history')).toEqual(rowColumns)
  })

  it('does nothing on a database that is up to date', async () => {
    await migrate(db)
    await expect(migrate(db)).resolves.toBe(MIGRATIONS.length)
    expect(await version()).toBe(MIGRATIONS.length)
  })

  it('runs only the migrations that are newer than the database', async () => {
    const first = ['CREATE TABLE a (id TEXT PRIMARY KEY)']
    await migrate(db, first)
    await migrate(db, [...first, 'CREATE TABLE b (id TEXT PRIMARY KEY)'])
    expect(await version()).toBe(2)
    expect(await columns('b')).toEqual(['id'])
  })

  it('rolls back a migration that fails and keeps the old version', async () => {
    const first = ['CREATE TABLE a (id TEXT PRIMARY KEY)']
    await migrate(db, first)
    await expect(
      migrate(db, [...first, 'CREATE TABLE b (id TEXT PRIMARY KEY); CREATE TABLE broken (']),
    ).rejects.toThrow('incomplete input')
    expect(await version()).toBe(1)
    expect(await columns('b')).toEqual([])
  })

  it('refuses a database that is newer than the app', async () => {
    await db.execAsync(`PRAGMA user_version = ${MIGRATIONS.length + 1}`)
    await expect(migrate(db)).rejects.toThrow(RangeError)
    expect(await version()).toBe(MIGRATIONS.length + 1)
  })

  it('runs each migration once when two app starts migrate one file together', async () => {
    const file = temporaryDatabaseFile()
    const first = openNodeDatabase(file.path)
    const second = openNodeDatabase(file.path)
    try {
      const results = await Promise.allSettled([migrate(first), migrate(second)])
      expect(results.filter((result) => result.status === 'fulfilled')).not.toHaveLength(0)
      const reasons = results.flatMap((result) => (result.status === 'rejected' ? [String(result.reason)] : []))
      expect(reasons).toEqual(reasons.map(() => expect.stringContaining('database is locked')))
      await expect(migrate(second)).resolves.toBe(MIGRATIONS.length)
      const tables = await second.getAllAsync<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
        [],
      )
      expect(tables.map((table) => table.name)).toEqual(['game_history', 'game_in_progress', 'sync_state'])
    } finally {
      first.close()
      second.close()
      file.remove()
    }
  })

  it('skips a migration that another app start ran after this one read the version', async () => {
    const file = temporaryDatabaseFile()
    const first = openNodeDatabase(file.path)
    const second = openNodeDatabase(file.path)
    try {
      const gate = Promise.withResolvers<void>()
      const late: SqlDatabase = {
        ...second,
        withExclusiveTransactionAsync: async (task) => {
          await gate.promise
          return second.withExclusiveTransactionAsync(task)
        },
      }
      const lateMigration = migrate(late)
      await migrate(first)
      gate.resolve()
      await expect(lateMigration).resolves.toBe(MIGRATIONS.length)
    } finally {
      first.close()
      second.close()
      file.remove()
    }
  })
})

describe('migration 2', () => {
  it('converts a saved game of version 1 to version 2 with no start entries', async () => {
    await migrate(db, MIGRATIONS.slice(0, 1))
    const played = place(select(newGame(), 2), 4).game
    const { startEntries: _startEntries, ...rest } = toSavedGame(played)
    const at = '2026-01-01T00:00:00.000Z'
    await db.runAsync(
      `INSERT INTO game_in_progress (id, level, source, saved_game, created_at, updated_at)
        VALUES ('old', 'easy', 'scanned', ?, ?, ?)`,
      [JSON.stringify({ ...rest, version: 1 }), at, at],
    )

    await migrate(db)
    const current = await createSqliteStorage(db, testDeps()).puzzles.current()

    expect(current?.id).toBe('old')
    expect(current?.game).toEqual(played)
    expect(current?.game.startEntries.every((value) => value === 0)).toBe(true)
  })
  it('keeps a saved game that is not JSON', async () => {
    await migrate(db, MIGRATIONS.slice(0, 1))
    const at = '2026-01-01T00:00:00.000Z'
    await db.runAsync(
      `INSERT INTO game_in_progress (id, level, source, saved_game, created_at, updated_at)
        VALUES ('broken', 'easy', 'generated', 'not json', ?, ?)`,
      [at, at],
    )

    await expect(migrate(db)).resolves.toBe(MIGRATIONS.length)
    const row = await db.getFirstAsync<{ saved_game: string }>('SELECT saved_game FROM game_in_progress', [])
    expect(row?.saved_game).toBe('not json')
  })
  it('keeps its shipped text', () => {
    const zeros = Array.from({ length: 81 }, () => 0).join(',')
    expect(MIGRATIONS[1]).toBe(`UPDATE game_in_progress
    SET saved_game = json_set(saved_game, '$.version', 2, '$.startEntries', json('[${zeros}]'))
    WHERE CASE WHEN json_valid(saved_game) THEN json_extract(saved_game, '$.version') END = 1;`)
  })

  it('leaves a saved game of version 2 as it is', async () => {
    await migrate(db, MIGRATIONS.slice(0, 1))
    const text = JSON.stringify(toSavedGame(place(select(newGame(), 2), 4).game))
    const at = '2026-01-01T00:00:00.000Z'
    await db.runAsync(
      `INSERT INTO game_in_progress (id, level, source, saved_game, created_at, updated_at)
        VALUES ('new', 'easy', 'generated', ?, ?, ?)`,
      [text, at, at],
    )

    await migrate(db)
    const row = await db.getFirstAsync<{ saved_game: string }>('SELECT saved_game FROM game_in_progress', [])
    expect(row?.saved_game).toBe(text)
  })
})

describe('migration 3', () => {
  const at = '2026-01-01T00:00:00.000Z'

  it('gives a game saved before the seed column the seed null', async () => {
    await migrate(db, MIGRATIONS.slice(0, 2))
    await db.runAsync(
      `INSERT INTO game_in_progress (id, level, source, saved_game, created_at, updated_at)
        VALUES ('old', 'easy', 'generated', ?, ?, ?)`,
      [JSON.stringify(toSavedGame(newGame())), at, at],
    )
    await migrate(db)
    await expect(createSqliteStorage(db, testDeps()).puzzles.current()).resolves.toMatchObject({
      id: 'old',
      seed: null,
    })
  })

  it('refuses a negative seed', async () => {
    await migrate(db)
    await expect(
      db.runAsync(
        `INSERT INTO game_in_progress (id, level, source, seed, saved_game, created_at, updated_at)
          VALUES ('bad', 'easy', 'generated', -1, '{}', ?, ?)`,
        [at, at],
      ),
    ).rejects.toThrow('CHECK constraint failed')
  })
})

const secondAt = (second: number) => `2026-10-12T09:00:0${second}.000Z`

describe('migration 4: the abandoned result', () => {
  const HISTORY_ROW = `INSERT INTO game_history
    (id, level, source, result, played_ms, mistakes, hints_used, finished_at, created_at, updated_at, seed)
    VALUES (?, ?, 'generated', ?, ?, 0, 0, ?, ?, ?, ?)`

  it('keeps every history row, its order and its index', async () => {
    await migrate(db, MIGRATIONS.slice(0, 3))
    await db.runAsync(HISTORY_ROW, ['a', 'easy', 'won', 60_000, secondAt(1), secondAt(1), secondAt(1), 412_077])
    await db.runAsync(HISTORY_ROW, ['b', 'hard', 'lost', 30_000, secondAt(2), secondAt(2), secondAt(2), null])

    await migrate(db)

    const rows = await db.getAllAsync<{ id: string; result: string; seed: number | null }>(
      'SELECT id, result, seed FROM game_history ORDER BY rowid',
      [],
    )
    expect(rows).toEqual([
      { id: 'a', result: 'won', seed: 412_077 },
      { id: 'b', result: 'lost', seed: null },
    ])
    const index = await db.getFirstAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'game_history_best_time'",
      [],
    )
    expect(index).toEqual({ name: 'game_history_best_time' })
  })

  it('accepts abandoned and refuses any other result', async () => {
    await migrate(db)
    const at = '2026-10-12T09:00:00.000Z'
    await db.runAsync(HISTORY_ROW, ['c', 'easy', 'abandoned', 1_000, at, at, at, null])
    await expect(db.runAsync(HISTORY_ROW, ['d', 'easy', 'paused', 1_000, at, at, at, null])).rejects.toThrow(
      'CHECK constraint failed',
    )
  })
})

describe('migration 5: the owner and the waiting list', () => {
  const HISTORY_ROW = `INSERT INTO game_history
    (id, level, source, result, played_ms, mistakes, hints_used, finished_at, created_at, updated_at, deleted_at, seed)
    VALUES (?, 'easy', 'generated', ?, ?, 0, 0, ?, ?, ?, ?, ?)`

  async function migrateFromVersion4() {
    await migrate(db, MIGRATIONS.slice(0, 4))
    await db.runAsync(HISTORY_ROW, ['a', 'won', 60_000, secondAt(1), secondAt(1), secondAt(1), null, 412_077])
    await db.runAsync(HISTORY_ROW, ['b', 'lost', 30_000, secondAt(2), secondAt(2), secondAt(2), null, null])
    await db.runAsync(HISTORY_ROW, ['c', 'abandoned', 5_000, secondAt(3), secondAt(3), secondAt(4), secondAt(4), null])
    const saved = JSON.stringify(toSavedGame(place(select(newGame(), 2), 4).game))
    await db.runAsync(
      `INSERT INTO game_in_progress (id, level, source, seed, saved_game, created_at, updated_at)
        VALUES ('playing', 'medium', 'generated', 7, ?, ?, ?)`,
      [saved, secondAt(5), secondAt(5)],
    )
    await migrate(db)
  }

  it('keeps every history row and gives it no owner and no push', async () => {
    await migrateFromVersion4()
    const rows = await db.getAllAsync<Record<string, unknown>>(
      `SELECT id, result, played_ms, seed, updated_at, deleted_at, owner_id, pushed_at
        FROM game_history ORDER BY rowid`,
      [],
    )
    expect(rows).toEqual([
      {
        id: 'a',
        result: 'won',
        played_ms: 60_000,
        seed: 412_077,
        updated_at: secondAt(1),
        deleted_at: null,
        owner_id: null,
        pushed_at: null,
      },
      {
        id: 'b',
        result: 'lost',
        played_ms: 30_000,
        seed: null,
        updated_at: secondAt(2),
        deleted_at: null,
        owner_id: null,
        pushed_at: null,
      },
      {
        id: 'c',
        result: 'abandoned',
        played_ms: 5_000,
        seed: null,
        updated_at: secondAt(4),
        deleted_at: secondAt(4),
        owner_id: null,
        pushed_at: null,
      },
    ])
  })

  it('keeps the indexes of the history and adds the owner index', async () => {
    await migrateFromVersion4()
    const indexes = await db.getAllAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'game_history' AND sql IS NOT NULL ORDER BY name",
      [],
    )
    expect(indexes.map((index) => index.name)).toEqual(['game_history_best_time', 'game_history_owner'])
  })

  it('keeps the game in progress', async () => {
    await migrateFromVersion4()
    await expect(createSqliteStorage(db, testDeps()).puzzles.current()).resolves.toMatchObject({
      id: 'playing',
      level: 'medium',
      seed: 7,
    })
  })

  it('lets an owner adopt the old entries that are not deleted', async () => {
    await migrateFromVersion4()
    await expect(createSqliteStorage(db, testDeps()).history.answerAdopt('user-alice', true)).resolves.toBe(2)
    const owners = await db.getAllAsync<{ id: string; owner_id: string | null }>(
      'SELECT id, owner_id FROM game_history ORDER BY rowid',
      [],
    )
    expect(owners).toEqual([
      { id: 'a', owner_id: 'user-alice' },
      { id: 'b', owner_id: 'user-alice' },
      { id: 'c', owner_id: null },
    ])
  })

  it('creates the sync state as one value per key', async () => {
    await migrate(db)
    await db.runAsync('INSERT INTO sync_state (key, value) VALUES (?, ?)', ['cursor', 'abc'])
    await expect(db.runAsync('INSERT INTO sync_state (key, value) VALUES (?, ?)', ['cursor', 'def'])).rejects.toThrow(
      'UNIQUE constraint failed',
    )
    await expect(db.runAsync('INSERT INTO sync_state (key, value) VALUES (?, ?)', [null, 'x'])).rejects.toThrow(
      'NOT NULL constraint failed',
    )
  })
})
