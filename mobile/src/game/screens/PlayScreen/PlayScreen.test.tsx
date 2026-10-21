import { Stack } from 'expo-router'
import { act, renderRouter, screen, waitFor } from 'expo-router/testing-library'
import { useEffect, useState, type ComponentProps } from 'react'
import { Alert, Text } from 'react-native'
import { createGame, generate, type Game } from '@sudoku/core'
import type { GameScreen } from '@/game/screens/GameScreen'
import type { SaveGame } from '@/game/utils/gameSession.utils'
import { createMemoryStorage, type GameStorage, type SavedProgress } from '@/storage'
import { GameStorageContext } from '@/storage/hooks/useGameStorage'
import { OwnerContext } from '@/storage/hooks/useOwner'
import { PlayScreen } from './PlayScreen'

// The mock keeps the save and the props of the screen, so a test can save and press the buttons as the game screen does.
let mockSave: SaveGame | null = null
let mockProps: ComponentProps<typeof GameScreen> | null = null
let setOwner: (owner: string | null) => void = () => undefined

// expo-router/testing-library replaces the Reanimated mock of jest.setup, so the real game screen does not load here.
jest.mock('@/game/screens/GameScreen', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native')
  const { createElement, useContext } = jest.requireActual<typeof import('react')>('react')
  const { GameSaveContext } =
    jest.requireActual<typeof import('@/game/hooks/useGameSession')>('@/game/hooks/useGameSession')
  return {
    GameScreen: (props: object) => {
      mockProps = props as typeof mockProps
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

async function renderOver(result: 'won' | 'lost') {
  const storage = await withGame()
  const first = (await storage.puzzles.current()) as SavedProgress
  const over: Game = { ...first.game, status: result, playedMs: 30_000, mistakes: result === 'lost' ? 3 : 0 }
  renderPlay(storage)
  await act(async () => undefined)
  await act(async () => mockSave?.(over))
  await act(async () => undefined)
  return { storage, first, over }
}

describe('after the game is over', () => {
  it('Try this puzzle again starts the same puzzle as a new game in progress', async () => {
    const { storage, first } = await renderOver('lost')
    await act(async () => mockProps?.onRetry())
    const current = await storage.puzzles.current()
    expect(current?.id).not.toBe(first.id)
    expect(current).toMatchObject({ level: 'easy', source: 'generated', seed: first.seed })
    expect(current?.game).toMatchObject({ givens: first.game.givens, status: 'playing', mistakes: 0, playedMs: 0 })
    expect(mockProps?.start).toEqual(current?.game)
  })

  it('reads the best times again after a restart, so the finish card knows the game before', async () => {
    const { first } = await renderOver('won')
    expect(mockProps?.finish).toMatchObject({ bestBeforeMs: null })
    await act(async () => mockProps?.onNewPuzzle?.())
    expect(mockProps?.finish).toMatchObject({ level: first.level, bestBeforeMs: 30_000 })
  })

  it('New puzzle starts a generated puzzle at the same level, without a question', async () => {
    const alert = jest.spyOn(Alert, 'alert')
    const { storage, first } = await renderOver('lost')
    await act(async () => mockProps?.onNewPuzzle?.())
    const current = await storage.puzzles.current()
    expect(current?.id).not.toBe(first.id)
    expect(current).toMatchObject({ level: 'easy', source: 'generated' })
    expect(alert).not.toHaveBeenCalled()
  })

  it('keeps the screen when the start fails', async () => {
    const { storage } = await renderOver('lost')
    const before = mockProps?.start
    jest.spyOn(storage.puzzles, 'start').mockRejectedValueOnce(new Error('disk full'))
    await act(async () => mockProps?.onRetry())
    expect(mockProps?.start).toBe(before)
    expect(screen.getByTestId('game-screen')).toBeOnTheScreen()
  })
})
