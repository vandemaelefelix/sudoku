import { createMemoryStorage } from '@/storage'
import { newGame, wonGame } from '@/storage/contract/fixtures.testkit'
import { loadHomeStats } from './homeStats.utils'

it('gives no win rate and no streak on a device without games', async () => {
  const { stats } = createMemoryStorage()
  await expect(loadHomeStats(stats, { includeScanned: false, owner: null })).resolves.toEqual({
    winRate: null,
    played: 0,
    streak: 0,
  })
})

it('gives the win rate, the games played and the current streak of all levels', async () => {
  const storage = createMemoryStorage()
  const { id } = await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame(), owner: null })
  await storage.puzzles.save(id, wonGame(60_000), null)
  await expect(loadHomeStats(storage.stats, { includeScanned: false, owner: null })).resolves.toEqual({
    winRate: 1,
    played: 1,
    streak: 1,
  })
})

it('counts only the games of the owner of the filter', async () => {
  const storage = createMemoryStorage()
  const { id } = await storage.puzzles.start({
    level: 'easy',
    source: 'generated',
    game: newGame(),
    owner: 'user-alice',
  })
  await storage.puzzles.save(id, wonGame(60_000), 'user-alice')
  await expect(loadHomeStats(storage.stats, { includeScanned: false, owner: null })).resolves.toMatchObject({
    played: 0,
  })
  await expect(loadHomeStats(storage.stats, { includeScanned: false, owner: 'user-alice' })).resolves.toMatchObject({
    played: 1,
  })
})
