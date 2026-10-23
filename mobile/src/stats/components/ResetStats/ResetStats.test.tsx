import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { Alert, type AlertButton } from 'react-native'
import { createMemoryStorage } from '@/storage'
import { GameStorageContext } from '@/storage/hooks/useGameStorage'
import { OwnerContext } from '@/storage/hooks/useOwner'
import { newGame, wonGame } from '@/storage/contract/fixtures.testkit'
import { ResetStats } from './ResetStats'

afterEach(() => jest.restoreAllMocks())

function renderReset(onReset = jest.fn(), owner: string | null = null) {
  const storage = createMemoryStorage()
  render(
    <GameStorageContext value={storage}>
      <OwnerContext value={owner}>
        <ResetStats onReset={onReset} />
      </OwnerContext>
    </GameStorageContext>,
  )
  return { storage, onReset }
}

async function answer(label: string) {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined)
  fireEvent.press(screen.getByRole('button', { name: 'Reset stats' }))
  const buttons = alert.mock.calls[0]?.[2] as AlertButton[]
  await act(async () => buttons.find((button) => button.text === label)?.onPress?.())
}

it('asks before it deletes, and deletes nothing when the player cancels', async () => {
  const { storage, onReset } = renderReset()
  const { id } = await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame(), owner: null })
  await storage.puzzles.save(id, wonGame(60_000), null)
  await answer('Cancel')
  await expect(storage.history.list(null)).resolves.toHaveLength(1)
  expect(onReset).not.toHaveBeenCalled()
})

it('deletes the history and tells the screen when the player confirms', async () => {
  const { storage, onReset } = renderReset()
  const { id } = await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame(), owner: null })
  await storage.puzzles.save(id, wonGame(60_000), null)
  await answer('Reset')
  await expect(storage.history.list(null)).resolves.toEqual([])
  expect(onReset).toHaveBeenCalledTimes(1)
})

it('deletes only the history of the signed-in owner', async () => {
  const { storage } = renderReset(jest.fn(), 'user-alice')
  for (const owner of ['user-alice', null]) {
    // oxlint-disable-next-line no-await-in-loop -- the fake gives ids in call order, so the games start one by one.
    const { id } = await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame(), owner })
    // oxlint-disable-next-line no-await-in-loop -- the save belongs to the start above.
    await storage.puzzles.save(id, wonGame(60_000), owner)
  }
  await answer('Reset')
  await expect(storage.history.list('user-alice')).resolves.toEqual([])
  await expect(storage.history.list(null)).resolves.toHaveLength(1)
})
