import { openNodeDatabase, type NodeDatabase } from './nodeDatabase'

let db: NodeDatabase

beforeEach(async () => {
  db = openNodeDatabase()
  await db.execAsync('CREATE TABLE a (id TEXT PRIMARY KEY)')
})

afterEach(() => {
  db.close()
})

// expo-sqlite 57 runs a transaction as a plain BEGIN on a second connection, without a busy timeout.
describe('openNodeDatabase', () => {
  it('uses the write-ahead log, as openStorage does', async () => {
    await expect(db.getFirstAsync('PRAGMA journal_mode', [])).resolves.toEqual({ journal_mode: 'wal' })
  })

  it('lets a read on the database see the last commit during a transaction', async () => {
    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.runAsync('INSERT INTO a (id) VALUES (?)', ['x'])
      await expect(db.getAllAsync('SELECT id FROM a', [])).resolves.toEqual([])
    })
    await expect(db.getAllAsync('SELECT id FROM a', [])).resolves.toEqual([{ id: 'x' }])
  })

  it('refuses a write on the database during a write transaction', async () => {
    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.runAsync('INSERT INTO a (id) VALUES (?)', ['x'])
      await expect(db.runAsync('INSERT INTO a (id) VALUES (?)', ['y'])).rejects.toThrow('database is locked')
    })
    await expect(db.getAllAsync('SELECT id FROM a', [])).resolves.toEqual([{ id: 'x' }])
  })

  it('rolls back a transaction whose task throws', async () => {
    await expect(
      db.withExclusiveTransactionAsync(async (txn) => {
        await txn.runAsync('INSERT INTO a (id) VALUES (?)', ['x'])
        throw new Error('the task failed')
      }),
    ).rejects.toThrow('the task failed')
    await expect(db.getAllAsync('SELECT id FROM a', [])).resolves.toEqual([])
  })
})
