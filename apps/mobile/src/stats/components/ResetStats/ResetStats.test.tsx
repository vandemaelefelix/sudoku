import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { Alert, type AlertButton } from 'react-native'
import { createMemoryStorage } from '@/storage'
import { GameStorageContext } from '@/storage/hooks/useGameStorage'
import { newGame, wonGame } from '@/storage/repositories.contract'
import { ResetStats } from './ResetStats'

afterEach(() => jest.restoreAllMocks())

function renderReset(onReset = jest.fn()) {
  const storage = createMemoryStorage()
  render(
    <GameStorageContext value={storage}>
      <ResetStats onReset={onReset} />
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
  const { id } = await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame() })
  await storage.puzzles.save(id, wonGame(60_000))
  await answer('Cancel')
  await expect(storage.history.list()).resolves.toHaveLength(1)
  expect(onReset).not.toHaveBeenCalled()
})

it('deletes the history and tells the screen when the player confirms', async () => {
  const { storage, onReset } = renderReset()
  const { id } = await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame() })
  await storage.puzzles.save(id, wonGame(60_000))
  await answer('Reset')
  await expect(storage.history.list()).resolves.toEqual([])
  expect(onReset).toHaveBeenCalledTimes(1)
})
