import { createMemoryStorage } from './memoryStorage'
import { describeGameStorage } from './contract/describeGameStorage.testkit'

describeGameStorage('the in-memory storage', async (deps) => createMemoryStorage(deps))

describe('createMemoryStorage', () => {
  it('works without deps, for screen tests', async () => {
    const storage = createMemoryStorage()
    await expect(storage.puzzles.current()).resolves.toBeNull()
  })
})
