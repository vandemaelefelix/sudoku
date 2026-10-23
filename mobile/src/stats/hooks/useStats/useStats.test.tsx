import { renderHook, waitFor } from '@testing-library/react-native'
import type { ReactNode } from 'react'
import { createMemoryStorage } from '@/storage'
import { newGame, wonGame } from '@/storage/repositories.contract'
import { GameStorageContext } from '@/storage/hooks/useGameStorage'
import { OwnerContext } from '@/storage/hooks/useOwner'
import { useStats } from './useStats'


function wrapperFor(storage: ReturnType<typeof createMemoryStorage>, owner: string | null = null) {
  return ({ children }: { children: ReactNode }) => (
    <GameStorageContext value={storage}>
      <OwnerContext value={owner}>{children}</OwnerContext>
    </GameStorageContext>
  )
}

it('loads the overview, the levels, the times and the streak', async () => {
  const storage = createMemoryStorage()
  const { id } = await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame(), owner: null })
  await storage.puzzles.save(id, wonGame(60_000), null)

  const { result } = renderHook(() => useStats(false), { wrapper: wrapperFor(storage) })
  expect(result.current).toEqual({ status: 'loading' })

  await waitFor(() => expect(result.current.status).toBe('ready'))
  if (result.current.status !== 'ready') throw new Error('not ready')
  const { data } = result.current
  expect(data.overall).toMatchObject({ played: 1, won: 1 })
  expect(data.levels.easy).toMatchObject({ played: 1 })
  expect(data.levels.expert).toMatchObject({ played: 0, winRate: null })
  expect(data.times.easy).toEqual([60_000])
  expect(data.times.hard).toEqual([])
  expect(data.streak.recent).toHaveLength(14)
})

it('fails softly when the storage fails', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
  const storage = createMemoryStorage()
  jest.spyOn(storage.stats, 'summary').mockRejectedValue(new Error('locked'))
  const { result } = renderHook(() => useStats(false), { wrapper: wrapperFor(storage) })
  await waitFor(() => expect(result.current).toEqual({ status: 'failed' }))
  warn.mockRestore()
})

it('counts only the games of the signed-in owner', async () => {
  const storage = createMemoryStorage()
  for (const owner of ['user-alice', null]) {
    // oxlint-disable-next-line no-await-in-loop -- the fake gives ids in call order, so the games start one by one.
    const { id } = await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame(), owner })
    // oxlint-disable-next-line no-await-in-loop -- the save belongs to the start above.
    await storage.puzzles.save(id, wonGame(owner === null ? 30_000 : 60_000), owner)
  }

  const { result } = renderHook(() => useStats(false), { wrapper: wrapperFor(storage, 'user-alice') })

  await waitFor(() => expect(result.current.status).toBe('ready'))
  if (result.current.status !== 'ready') throw new Error('not ready')
  expect(result.current.data.overall).toMatchObject({ played: 1 })
  expect(result.current.data.times.easy).toEqual([60_000])
})
