import { openNodeDatabase } from './nodeDatabase'

describe('openNodeDatabase', () => {
  it('refuses a statement on the database inside a transaction, as expo-sqlite does', async () => {
    const db = openNodeDatabase(':memory:')
    try {
      await db.execAsync('CREATE TABLE a (id TEXT PRIMARY KEY)')
      await expect(
        db.withExclusiveTransactionAsync(async () => {
          await db.runAsync('INSERT INTO a (id) VALUES (?)', ['x'])
        }),
      ).rejects.toThrow('inside a transaction')
      await expect(db.getAllAsync('SELECT id FROM a', [])).resolves.toEqual([])
    } finally {
      db.close()
    }
  })
})
