// This import comes first. expo-router/testing-library mocks Reanimated again with the library mock, which has no
// useReducedMotion. Jest keeps a module that is already loaded, so the mock of jest.setup.ts stays.
// oxlint-disable-next-line import/no-unassigned-import -- the import loads the jest.setup.ts mock before expo-router/testing-library.
import 'react-native-reanimated'
import { Stack } from 'expo-router'
import { fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library'
import { Alert, type AlertButton } from 'react-native'
import { GIVENS_TARGET, createGame, generate, type Game } from '@sudoku/core'
import { createMemoryStorage, type GameStorage } from '@/storage'
import GameRoute from '@/app/game'
import HomeRoute from '@/app/index'
import ScanRoute from '@/app/scan'
import SettingsRoute from '@/app/settings'
import { GameStorageContext } from '@/storage/hooks/useGameStorage'

// expo-router/testing-library adds this matcher at runtime, but it ships no type for it.
declare global {
  namespace jest {
    interface Matchers<R> {
      toHavePathname(pathname: string): R
    }
  }
}

function renderApp(storage: GameStorage = createMemoryStorage()) {
  renderRouter({
    _layout: () => (
      <GameStorageContext value={storage}>
        <Stack screenOptions={{ headerShown: false }} />
      </GameStorageContext>
    ),
    index: HomeRoute,
    game: GameRoute,
    scan: ScanRoute,
    settings: SettingsRoute,
  })
  return storage
}

// The board draws the grid after it knows its size.
const layOutBoard = async () =>
  fireEvent(await screen.findByTestId('board'), 'layout', { nativeEvent: { layout: { width: 358, height: 358 } } })

async function inProgress(storage: GameStorage) {
  const progress = await storage.puzzles.current()
  if (progress === null) throw new Error('No game in progress')
  return progress
}

async function startGame(storage: GameStorage, name = 'Easy') {
  fireEvent.press(await screen.findByRole('button', { name }))
  await waitFor(() => expect(screen).toHavePathname('/game'))
  await layOutBoard()
  return inProgress(storage)
}

const givensOf = (grid: readonly number[]) => grid.filter((digit) => digit !== 0).length

/** Answers the next Alert with the button of that text. */
function answerAlert(text: string) {
  return jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons?: AlertButton[]) => {
    buttons?.find((button) => button.text === text)?.onPress?.()
  })
}

// A key with all nine of its digit placed is disabled, so the wrong digits come from the keys that still work.
function loseGame(game: Game) {
  const cell = game.givens.findIndex((digit) => digit === 0)
  const wrong = [1, 2, 3, 4, 5, 6, 7, 8, 9]
    .filter((digit) => digit !== game.solution[cell])
    .filter((digit) => game.givens.filter((given) => given === digit).length < 9)
    .slice(0, 3)
  fireEvent.press(screen.getByTestId(`cell-${cell}`))
  for (const digit of wrong) fireEvent.press(screen.getByLabelText(`Enter ${digit}`))
}

async function waitForLostEntry(storage: GameStorage) {
  await waitFor(async () => expect(await storage.history.list()).toMatchObject([{ result: 'lost' }]))
}

// Jest runs as a development build, so PlayScreen logs every save. Only that log is silenced.
const log = console.log
beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].startsWith('[storage] saved in ')) return
    log(...args)
  })
})

afterEach(() => jest.restoreAllMocks())

it('opens on the home screen without Continue when no game is in progress', async () => {
  renderApp()
  expect(await screen.findByRole('button', { name: 'Easy' })).toBeTruthy()
  expect(screen).toHavePathname('/')
  expect(screen.queryByRole('button', { name: /^Continue/ })).toBeNull()
})

it('starts a new game at the tapped level and saves it', async () => {
  const storage = renderApp()
  const progress = await startGame(storage)
  expect(progress).toMatchObject({ level: 'easy', source: 'generated' })
  expect(givensOf(progress.game.givens)).toBe(GIVENS_TARGET.easy)
  expect(screen.getAllByTestId(/^cell-\d+$/)).toHaveLength(81)
})

it('a double tap on a level starts one game', async () => {
  const storage = createMemoryStorage()
  const start = jest.spyOn(storage.puzzles, 'start')
  renderApp(storage)
  const easy = await screen.findByRole('button', { name: 'Easy' })
  fireEvent.press(easy)
  fireEvent.press(easy)
  await waitFor(() => expect(screen).toHavePathname('/game'))
  expect(start).toHaveBeenCalledTimes(1)
})

it('saves a move, and Continue resumes the move', async () => {
  const storage = renderApp()
  const { game } = await startGame(storage)
  const cell = game.givens.findIndex((digit) => digit === 0)
  const digit = game.solution[cell] ?? 0
  fireEvent.press(screen.getByTestId(`cell-${cell}`))
  fireEvent.press(screen.getByLabelText(`Enter ${digit}`))
  await waitFor(async () => expect((await inProgress(storage)).game.entries[cell]).toBe(digit))

  fireEvent.press(screen.getByLabelText('Back to home'))
  fireEvent.press(await screen.findByRole('button', { name: 'Continue, Easy' }))
  await waitFor(() => expect(screen).toHavePathname('/game'))
  await layOutBoard()
  expect(screen.getByTestId(`cell-${cell}`).props.accessibilityLabel).toMatch(new RegExp(`, ${digit}$`))
})

it('Continue resumes the time played', async () => {
  const storage = createMemoryStorage()
  const { givens, solution } = generate('medium', 7)
  await storage.puzzles.start({
    level: 'medium',
    source: 'generated',
    game: { ...createGame({ givens, solution }), playedMs: 65_000 },
  })
  renderApp(storage)
  fireEvent.press(await screen.findByRole('button', { name: 'Continue, Medium' }))
  expect(await screen.findByLabelText('Pause, time 01:05')).toBeTruthy()
})

it('selecting a cell does not save', async () => {
  const storage = createMemoryStorage()
  renderApp(storage)
  const { game } = await startGame(storage)
  const save = jest.spyOn(storage.puzzles, 'save')
  const open = game.givens.findIndex((digit) => digit === 0)
  fireEvent.press(screen.getByTestId(`cell-${open}`))
  fireEvent.press(screen.getByTestId('cell-0'))
  expect(save).not.toHaveBeenCalled()
})

it('the moves show at once while a save hangs', async () => {
  const storage = createMemoryStorage()
  renderApp(storage)
  const { game } = await startGame(storage)
  const save = jest.spyOn(storage.puzzles, 'save').mockReturnValue(new Promise<void>(() => undefined))
  const open = game.givens
    .map((digit, cell) => (digit === 0 ? cell : -1))
    .filter((cell) => cell !== -1)
    .slice(0, 3)
  for (const cell of open) {
    fireEvent.press(screen.getByTestId(`cell-${cell}`))
    fireEvent.press(screen.getByLabelText(`Enter ${game.solution[cell] ?? 0}`))
  }
  for (const cell of open) {
    expect(screen.getByTestId(`cell-${cell}`).props.accessibilityLabel).toMatch(new RegExp(`, ${game.solution[cell]}$`))
  }
  // The first write hangs, so the newer moves wait in one slot and are not written yet.
  expect(save).toHaveBeenCalledTimes(1)
})

it('asks before a new game replaces the game in progress, then discards it without history', async () => {
  const storage = renderApp()
  const first = await startGame(storage)
  fireEvent.press(screen.getByLabelText('Back to home'))
  const alert = answerAlert('New game')
  await screen.findByRole('button', { name: 'Continue, Easy' })
  const second = await startGame(storage, 'Hard')
  expect(alert).toHaveBeenCalledWith('Start a new game?', 'Your current game ends.', expect.any(Array))
  expect(second.id).not.toBe(first.id)
  expect(second.level).toBe('hard')
  expect(await storage.history.list()).toEqual([])
})

it('keeps the game in progress when the player cancels', async () => {
  const storage = renderApp()
  const first = await startGame(storage)
  fireEvent.press(screen.getByLabelText('Back to home'))
  const alert = answerAlert('Cancel')
  fireEvent.press(await screen.findByRole('button', { name: 'Hard' }))
  await waitFor(() => expect(alert).toHaveBeenCalled())
  expect(screen).toHavePathname('/')
  expect((await inProgress(storage)).id).toBe(first.id)
})

it('does not ask when no game is in progress', async () => {
  const alert = jest.spyOn(Alert, 'alert')
  const storage = renderApp()
  await startGame(storage)
  expect(alert).not.toHaveBeenCalled()
})

it('stays on the home screen when the game does not start', async () => {
  const storage = createMemoryStorage()
  jest.spyOn(storage.puzzles, 'start').mockRejectedValueOnce(new Error('disk full'))
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
  renderApp(storage)
  fireEvent.press(await screen.findByRole('button', { name: 'Easy' }))
  await waitFor(() => expect(warn).toHaveBeenCalledWith(expect.stringContaining('[storage] The game does not start')))
  expect(screen).toHavePathname('/')
})

it('opens the scan flow', async () => {
  renderApp()
  fireEvent.press(await screen.findByRole('button', { name: 'Scan a puzzle' }))
  expect(await screen.findByTestId('camera')).toBeTruthy()
  expect(screen).toHavePathname('/scan')
})

it('opens Settings', async () => {
  renderApp()
  fireEvent.press(await screen.findByRole('button', { name: 'Settings' }))
  await waitFor(() => expect(screen).toHavePathname('/settings'))
})

it('New puzzle starts a new game at the same level, and the lost game is in the history', async () => {
  const storage = renderApp()
  const lost = await startGame(storage)
  loseGame(lost.game)
  await waitForLostEntry(storage)
  fireEvent.press(screen.getByRole('button', { name: 'New puzzle' }))
  await waitFor(() => expect(screen.queryByTestId('game-over')).toBeNull())
  const next = await inProgress(storage)
  expect(next.id).not.toBe(lost.id)
  expect(next.level).toBe('easy')
})

it('Try this puzzle again starts the same puzzle as a new saved game', async () => {
  const storage = renderApp()
  const lost = await startGame(storage)
  loseGame(lost.game)
  await waitForLostEntry(storage)
  fireEvent.press(screen.getByRole('button', { name: 'Try this puzzle again' }))
  await waitFor(() => expect(screen.queryByTestId('game-over')).toBeNull())
  const retried = await inProgress(storage)
  expect(retried.id).not.toBe(lost.id)
  expect(retried.game.givens).toEqual(lost.game.givens)
  expect(retried.game.mistakes).toBe(0)
  expect(await storage.history.list()).toHaveLength(1)
})

it('Back to home after a loss shows no Continue', async () => {
  const storage = renderApp()
  const lost = await startGame(storage)
  loseGame(lost.game)
  await waitForLostEntry(storage)
  fireEvent.press(within(screen.getByTestId('game-over-sheet')).getByRole('button', { name: 'Back to home' }))
  await waitFor(() => expect(screen).toHavePathname('/'))
  expect(await screen.findByRole('button', { name: 'Easy' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: /^Continue/ })).toBeNull()
})
