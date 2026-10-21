import { Stack } from 'expo-router'
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library'
import { Alert, Text, type AlertButton } from 'react-native'
import { createGame, generate } from '@sudoku/core'
import { createMemoryStorage, type GameStorage } from '@/storage'
import { GameStorageContext } from '@/storage/hooks/useGameStorage'
import { OwnerContext } from '@/storage/hooks/useOwner'
import { HomeScreen } from './HomeScreen'

function renderHome(storage: GameStorage = createMemoryStorage(), owner: string | null = null) {
  renderRouter(
    {
      _layout: () => (
        <GameStorageContext value={storage}>
          <OwnerContext value={owner}>
            <Stack screenOptions={{ headerShown: false }} />
          </OwnerContext>
        </GameStorageContext>
      ),
      index: HomeScreen,
      game: () => <Text>game</Text>,
    },
    { initialUrl: '/' },
  )
  return storage
}

function answerAlert(text: string) {
  return jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons?: AlertButton[]) => {
    buttons?.find((button) => button.text === text)?.onPress?.()
  })
}

// The alert answers at once, so the start goes on in the same turn. act keeps its router update inside the test.
const pressLevel = async (name: string) => {
  const button = await screen.findByRole('button', { name })
  await act(async () => fireEvent.press(button))
}

async function startEasy(storage: GameStorage) {
  await storage.puzzles.start({
    level: 'easy',
    source: 'generated',
    game: createGame(generate('easy', 9)),
    owner: null,
  })
}

afterEach(() => jest.restoreAllMocks())

it('starts a generated game at the tapped level, then opens the game', async () => {
  const storage = renderHome()
  await pressLevel('Hard')
  await waitFor(() => expect(screen).toHavePathname('/game'))
  const progress = await storage.puzzles.current()
  expect(progress).toMatchObject({ level: 'hard', source: 'generated' })
  expect(progress?.seed).toEqual(expect.any(Number))
  expect(progress?.game.givens).toEqual(generate('hard', progress?.seed ?? 0).givens)
})

it('starts the game for the signed-in owner', async () => {
  const storage = createMemoryStorage()
  const start = jest.spyOn(storage.puzzles, 'start')
  renderHome(storage, 'user-alice')
  await pressLevel('Easy')
  await waitFor(() => expect(screen).toHavePathname('/game'))
  expect(start).toHaveBeenCalledWith(expect.objectContaining({ owner: 'user-alice' }))
})

it('asks before it replaces a game in progress, and Cancel keeps that game and stays home', async () => {
  const storage = createMemoryStorage()
  await startEasy(storage)
  const alert = answerAlert('Cancel')
  renderHome(storage)
  await pressLevel('Hard')
  await waitFor(() => expect(alert).toHaveBeenCalledTimes(1))
  expect(screen).toHavePathname('/')
  expect(await storage.puzzles.current()).toMatchObject({ level: 'easy' })
})

it('replaces the game in progress on New game', async () => {
  const storage = createMemoryStorage()
  await startEasy(storage)
  answerAlert('New game')
  renderHome(storage)
  await pressLevel('Hard')
  await waitFor(() => expect(screen).toHavePathname('/game'))
  expect(await storage.puzzles.current()).toMatchObject({ level: 'hard' })
})

it('a double tap on a level starts one game', async () => {
  const storage = createMemoryStorage()
  const start = jest.spyOn(storage.puzzles, 'start')
  renderHome(storage)
  const hard = await screen.findByRole('button', { name: 'Hard' })
  fireEvent.press(hard)
  fireEvent.press(hard)
  await waitFor(() => expect(screen).toHavePathname('/game'))
  expect(start).toHaveBeenCalledTimes(1)
})
