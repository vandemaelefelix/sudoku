import { Stack } from 'expo-router'
import { act, renderRouter, screen, waitFor } from 'expo-router/testing-library'
import { Text } from 'react-native'
import { createGame, generate } from '@sudoku/core'
import { createMemoryStorage, type GameStorage } from '@/storage'
import { GameStorageContext } from '@/storage/hooks/useGameStorage'
import { PlayScreen } from './PlayScreen'

// expo-router/testing-library replaces the Reanimated mock of jest.setup, so the real game screen does not load here.
jest.mock('@/game/screens/GameScreen', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native')
  const { createElement } = jest.requireActual<typeof import('react')>('react')
  return { GameScreen: () => createElement(View, { testID: 'game-screen' }) }
})

function renderPlay(storage: GameStorage) {
  renderRouter(
    {
      _layout: () => (
        <GameStorageContext value={storage}>
          <Stack screenOptions={{ headerShown: false }} />
        </GameStorageContext>
      ),
      index: () => <Text>home</Text>,
      game: PlayScreen,
    },
    { initialUrl: '/game' },
  )
}

async function withGame(): Promise<GameStorage> {
  const storage = createMemoryStorage()
  await storage.puzzles.start({ level: 'easy', source: 'generated', game: createGame(generate('easy', 3)) })
  return storage
}

it('draws the game in its first render when the repository knows the game', async () => {
  renderPlay(await withGame())
  expect(screen.getByTestId('game-screen')).toBeOnTheScreen()
  expect(screen.queryByTestId('play-loading')).toBeNull()
  // The best times load after the first render.
  await act(async () => undefined)
})

it('waits for current() when the repository does not know the game yet', async () => {
  const storage = await withGame()
  renderPlay({ ...storage, puzzles: { ...storage.puzzles, peek: () => undefined } })
  expect(screen.getByTestId('play-loading')).toBeOnTheScreen()
  expect(await screen.findByTestId('game-screen')).toBeOnTheScreen()
})

it('goes home without a game in progress', async () => {
  renderPlay(createMemoryStorage())
  await waitFor(() => expect(screen).toHavePathname('/'))
})
