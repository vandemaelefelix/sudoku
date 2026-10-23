import type { GameStorage } from '@/storage'
import { runAdoptStep } from './adoptStep'
import { ALICE, createTestStorage, finishGame } from './sync.testkit'

let storage: GameStorage

beforeEach(() => {
  storage = createTestStorage()
})

function step(ask: () => Promise<boolean>) {
  return runAdoptStep({ history: storage.history, owner: ALICE, ask })
}

it('does not ask when no game lacks an owner, and does not remember it', async () => {
  const ask = jest.fn(async () => true)
  await step(ask)
  expect(ask).not.toHaveBeenCalled()
  await finishGame(storage, null)
  await step(ask)
  expect(ask).toHaveBeenCalledTimes(1)
})

it('adopts the games on yes and remembers the answer', async () => {
  const id = await finishGame(storage, null)
  await step(async () => true)
  await expect(storage.history.list(ALICE)).resolves.toMatchObject([{ id }])
  const ask = jest.fn(async () => true)
  await finishGame(storage, null)
  await step(ask)
  expect(ask).not.toHaveBeenCalled()
})

it('leaves the games without an owner on no, and does not ask again', async () => {
  await finishGame(storage, null)
  await step(async () => false)
  await expect(storage.history.list(null)).resolves.toHaveLength(1)
  await expect(storage.history.list(ALICE)).resolves.toEqual([])
  const ask = jest.fn(async () => true)
  await step(ask)
  expect(ask).not.toHaveBeenCalled()
})
