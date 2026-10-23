import { Stack } from 'expo-router'
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library'
import { Alert, Pressable, Text, type AlertButton } from 'react-native'
import { createGame, generate, isWrong } from '@sudoku/core'
import type { ScannedStart } from '@/scan/utils/play.utils'
import { scannedLevel } from '@/game/utils/newGame.utils'
import { createMemoryStorage, type GameStorage } from '@/storage'
import { GameStorageContext } from '@/storage/hooks/useGameStorage'
import { OwnerContext } from '@/storage/hooks/useOwner'
import { useScannedStart } from './useScannedStart'

const { givens, solution } = generate('hard', 4)
const open = givens.findIndex((digit) => digit === 0)
const entries = givens.map((_, cell) => (cell === open ? ((solution[open] ?? 0) % 9) + 1 : 0))
const START: ScannedStart = { givens, solution, entries }

function PlayProbe() {
  const play = useScannedStart()
  return (
    <Pressable accessibilityRole="button" onPress={() => play(START)}>
      <Text>Play this puzzle</Text>
    </Pressable>
  )
}

function renderScan(storage: GameStorage = createMemoryStorage(), owner: string | null = null) {
  renderRouter(
    {
      _layout: () => (
        <GameStorageContext value={storage}>
          <OwnerContext value={owner}>
            <Stack screenOptions={{ headerShown: false }} />
          </OwnerContext>
        </GameStorageContext>
      ),
      index: () => <Text>home</Text>,
      scan: PlayProbe,
      game: () => <Text>game</Text>,
    },
    { initialUrl: '/scan' },
  )
  return storage
}

function answerAlert(text: string) {
  return jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons?: AlertButton[]) => {
    buttons?.find((button) => button.text === text)?.onPress?.()
  })
}

const pressPlay = async () => fireEvent.press(await screen.findByRole('button', { name: 'Play this puzzle' }))

async function startGenerated(storage: GameStorage) {
  const other = generate('easy', 9)
  await storage.puzzles.start({ level: 'easy', source: 'generated', game: createGame(other), owner: null })
}

afterEach(() => jest.restoreAllMocks())

it('starts the scan as the game in progress, then opens the game', async () => {
  const storage = renderScan()
  await pressPlay()
  await waitFor(() => expect(screen).toHavePathname('/game'))
  const progress = await storage.puzzles.current()
  expect(progress).toMatchObject({ level: scannedLevel(givens), source: 'scanned' })
  expect(progress?.game.givens).toEqual(givens)
  expect(progress?.game.entries[open]).toBe(entries[open])
  expect(progress && isWrong(progress.game, open)).toBe(true)
  expect(progress?.game.mistakes).toBe(0)
})

it('asks before it replaces a game in progress, and Cancel keeps that game', async () => {
  const storage = createMemoryStorage()
  await startGenerated(storage)
  const alert = answerAlert('Cancel')
  renderScan(storage)
  await pressPlay()
  await waitFor(() => expect(alert).toHaveBeenCalledTimes(1))
  expect(screen).toHavePathname('/scan')
  expect(await storage.puzzles.current()).toMatchObject({ source: 'generated' })
})
