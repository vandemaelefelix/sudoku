import { MIGRATIONS, migrate } from './migrations'
import { openNodeDatabase, type NodeDatabase } from './nodeDatabase'

let db: NodeDatabase

beforeEach(() => {
  db = openNodeDatabase(':memory:')
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
})
