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

  it('creates the game in progress and the history tables', async () => {
    await migrate(db)
    const tables = await db.getAllAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
      [],
    )
    expect(tables.map((table) => table.name)).toEqual(['game_history', 'game_in_progress'])
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
      expect(tables.map((table) => table.name)).toEqual(['game_history', 'game_in_progress'])
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
    expect(MIGRATIONS[1]).toContain(`json('[${zeros}]')`)
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
