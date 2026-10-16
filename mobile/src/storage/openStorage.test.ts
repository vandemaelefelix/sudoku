import { openDatabaseAsync } from 'expo-sqlite'
import { openNodeDatabase, type NodeDatabase } from './nodeDatabase'

jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }))
jest.mock('expo-crypto', () => ({ randomUUID: () => 'uuid' }))

const openDatabase = jest.mocked(openDatabaseAsync)
const databases: NodeDatabase[] = []

// Each test loads a new copy of openStorage, so the storage of one test does not reach the next.
function loadOpenStorage(): typeof import('./openStorage').openStorage {
  let open: typeof import('./openStorage').openStorage | undefined
  jest.isolateModules(() => {
    open = (jest.requireActual('./openStorage') as typeof import('./openStorage')).openStorage
  })
  if (open === undefined) throw new Error('openStorage did not load')
  return open
}

beforeEach(() => {
  openDatabase.mockReset()
  openDatabase.mockImplementation(async () => {
    const db = openNodeDatabase()
    databases.push(db)
    return db as unknown as Awaited<ReturnType<typeof openDatabaseAsync>>
  })
})

afterEach(() => {
  for (const db of databases.splice(0)) db.close()
})

describe('openStorage', () => {
  it('gives every call the same storage on one database', async () => {
    const openStorage = loadOpenStorage()
    const [first, second] = await Promise.all([openStorage(), openStorage()])
    expect(second).toBe(first)
    await expect(openStorage()).resolves.toBe(first)
    expect(openDatabase).toHaveBeenCalledTimes(1)
  })

  it('opens the database again after an open that failed', async () => {
    const openStorage = loadOpenStorage()
    openDatabase.mockRejectedValueOnce(new Error('database is locked'))
    await expect(openStorage()).rejects.toThrow('database is locked')
    await expect(openStorage()).resolves.toEqual(expect.objectContaining({ puzzles: expect.any(Object) }))
    expect(openDatabase).toHaveBeenCalledTimes(2)
  })
})
