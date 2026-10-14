import { createMemoryStorage } from '@/storage'
import { newGame, wonGame } from '@/storage/repositories.contract'
import { loadHomeStats } from './homeStats.utils'

jest.mock('@/utils/timeZone.utils', () => ({ deviceTimeZone: () => 'UTC' }))

it('gives no win rate and no streak on a device without games', async () => {
  const { stats } = createMemoryStorage()
  await expect(loadHomeStats(stats, false)).resolves.toEqual({ winRate: null, played: 0, streak: 0 })
})

it('gives the win rate, the games played and the current streak of all levels', async () => {
  const storage = createMemoryStorage()
  const { id } = await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame() })
  await storage.puzzles.save(id, wonGame(60_000))
  await expect(loadHomeStats(storage.stats, false)).resolves.toEqual({ winRate: 1, played: 1, streak: 1 })
})
