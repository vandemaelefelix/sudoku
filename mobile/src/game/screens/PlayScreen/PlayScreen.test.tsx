import { Stack } from 'expo-router'
import { act, renderRouter, screen, waitFor } from 'expo-router/testing-library'
import { useEffect, useState } from 'react'
import { Text } from 'react-native'
import { createGame, generate, type Game } from '@sudoku/core'
import type { SaveGame } from '@/game/hooks/useGameSaver'
import { createMemoryStorage, type GameStorage } from '@/storage'
import { GameStorageContext } from '@/storage/hooks/useGameStorage'
import { OwnerContext } from '@/storage/hooks/useOwner'
import { PlayScreen } from './PlayScreen'

// The mock keeps the save of the screen, so a test can save as the game screen does.
let mockSave: SaveGame | null = null
let setOwner: (owner: string | null) => void = () => undefined

// expo-router/testing-library replaces the Reanimated mock of jest.setup, so the real game screen does not load here.
jest.mock('@/game/screens/GameScreen', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native')
  const { createElement, useContext } = jest.requireActual<typeof import('react')>('react')
  const { GameSaveContext } =
    jest.requireActual<typeof import('@/game/hooks/useGameSaver')>('@/game/hooks/useGameSaver')
  return {
    GameScreen: () => {
      mockSave = useContext(GameSaveContext)
      return createElement(View, { testID: 'game-screen' })
    },
  }
})

function Layout({ storage }: { storage: GameStorage }) {
  const [owner, set] = useState<string | null>(null)
  useEffect(() => {
    setOwner = set
  }, [])
  return (
    <GameStorageContext value={storage}>
      <OwnerContext value={owner}>
        <Stack screenOptions={{ headerShown: false }} />
      </OwnerContext>
    </GameStorageContext>
  )
}

function renderPlay(storage: GameStorage) {
  renderRouter(
    {
      _layout: () => <Layout storage={storage} />,
      index: () => <Text>home</Text>,
      game: PlayScreen,
    },
    { initialUrl: '/game' },
  )
}

async function withGame(): Promise<GameStorage> {
  const storage = createMemoryStorage()
  await storage.puzzles.start({
    level: 'easy',
    source: 'generated',
    game: createGame(generate('easy', 3)),
    owner: null,
  })
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

it('keeps the newest game when the owner changes during a save', async () => {
  const storage = await withGame()
  const save = storage.puzzles.save
  const gate: { open?: () => void } = {}
  const held = new Promise<void>((resolve) => {
    gate.open = resolve
  })
  let calls = 0
  renderPlay({
    ...storage,
    puzzles: {
      ...storage.puzzles,
      save: async (id, game, owner) => {
        calls += 1
        if (calls === 1) await held
        return save(id, game, owner)
      },
    },
  })
  await act(async () => undefined)
  const start = (await storage.puzzles.current())?.game as Game
  const move = (playedMs: number): Game => ({ ...start, playedMs })

  mockSave?.(move(1))
  mockSave?.(move(2))
  await act(async () => setOwner('user_1'))
  mockSave?.(move(3))
  await act(async () => {
    gate.open?.()
    await held
  })

  // A second queue, if one exists, writes its waiting game during these turns.
  await act(async () => undefined)
  await act(async () => undefined)
  await act(async () => undefined)
  expect((await storage.puzzles.current())?.game.playedMs).toBe(3)
})
