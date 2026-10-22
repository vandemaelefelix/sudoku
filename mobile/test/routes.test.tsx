// This import comes first. expo-router/testing-library mocks Reanimated again with the library mock, which has no
// useReducedMotion. Jest keeps a module that is already loaded, so the mock of jest.setup.ts stays.
// oxlint-disable-next-line import/no-unassigned-import -- the import loads the jest.setup.ts mock before expo-router/testing-library.
import 'react-native-reanimated'
import { Stack } from 'expo-router'
import { act, fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library'
import { Alert, type AlertButton } from 'react-native'
import { useReducedMotion } from 'react-native-reanimated'
import { createGame, generate, grade, hintMessage, planHint, type Game } from '@sudoku/core'
import { createAppIntl } from '@/i18n/utils/intl.utils'
import { hintText } from '@/utils/hintText.utils'
import { formatPuzzleNumber } from '@/game/utils/finish.utils'
import { createMemoryStorage, type GameStorage } from '@/storage'
import { newGame, wonGame } from '@/storage/repositories.contract'
import GameRoute from '@/app/game'
import HomeRoute from '@/app/index'
import ScanRoute from '@/app/scan'
import SettingsRoute from '@/app/settings'
import TechniqueRoute from '@/app/techniques/[technique]'
import TechniquesRoute from '@/app/techniques/index'
import { GameStorageContext } from '@/storage/hooks/useGameStorage'
import { OwnerContext } from '@/storage/hooks/useOwner'

// expo-router/testing-library adds this matcher at runtime, but it ships no type for it.
declare global {
  namespace jest {
    interface Matchers<R> {
      toHavePathname(pathname: string): R
    }
  }
}

function renderApp(storage: GameStorage = createMemoryStorage(), owner: string | null = null) {
  renderRouter({
    _layout: () => (
      <GameStorageContext value={storage}>
        <OwnerContext value={owner}>
          <Stack screenOptions={{ headerShown: false }} />
        </OwnerContext>
      </GameStorageContext>
    ),
    index: HomeRoute,
    game: GameRoute,
    scan: ScanRoute,
    settings: SettingsRoute,
    'techniques/index': TechniquesRoute,
    'techniques/[technique]': TechniqueRoute,
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

/** Answers each Alert with the button of that text. */
function answerAlert(text: string) {
  return jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons?: AlertButton[]) => {
    buttons?.find((button) => button.text === text)?.onPress?.()
  })
}

// A key with all nine of its digits placed is disabled, so the wrong digits come from the keys that still work.
function loseGame(game: Game) {
  const cell = game.givens.findIndex((digit) => digit === 0)
  const wrong = [1, 2, 3, 4, 5, 6, 7, 8, 9]
    .filter((digit) => digit !== game.solution[cell])
    .filter((digit) => game.givens.filter((given) => given === digit).length < 9)
    .slice(0, 3)
  fireEvent.press(screen.getByTestId(`cell-${cell}`))
  for (const digit of wrong) fireEvent.press(screen.getByLabelText(`Enter ${digit}`))
}

// A key is disabled only when all nine of its digits are placed, so the key of each open cell still works.
function winGame(game: Game) {
  game.givens.forEach((given, cell) => {
    if (given !== 0) return
    fireEvent.press(screen.getByTestId(`cell-${cell}`))
    fireEvent.press(screen.getByLabelText(`Enter ${game.solution[cell]}`))
  })
}

async function waitForLostEntry(storage: GameStorage) {
  await waitFor(async () => expect(await storage.history.list(null)).toMatchObject([{ result: 'lost' }]))
}

// Jest runs as a development build, so PlayScreen logs every save. Only that log is silenced.
const log = console.log
beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].startsWith('[storage] saved in ')) return
    log(...args)
  })
})

afterEach(() => {
  jest.restoreAllMocks()
  jest.mocked(useReducedMotion).mockReturnValue(false)
})

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
  expect(grade(progress.game.givens).level).toBe('easy')
  expect(screen.getAllByTestId(/^cell-\d+$/)).toHaveLength(81)
  expect((await inProgress(storage)).seed).toEqual(expect.any(Number))
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

it('a double tap on Continue opens one game screen', async () => {
  const storage = createMemoryStorage()
  const { givens, solution } = generate('easy', 5)
  await storage.puzzles.start({
    level: 'easy',
    source: 'generated',
    game: createGame({ givens, solution }),
    owner: null,
  })
  renderApp(storage)
  const resume = await screen.findByRole('button', { name: 'Continue, Easy' })
  fireEvent.press(resume)
  fireEvent.press(resume)
  await waitFor(() => expect(screen).toHavePathname('/game'))
  await layOutBoard()
  expect(screen.getAllByTestId('board', { includeHiddenElements: true })).toHaveLength(1)
  const cell = givens.findIndex((digit) => digit === 0)
  const digit = solution[cell] ?? 0
  fireEvent.press(screen.getByTestId(`cell-${cell}`))
  fireEvent.press(screen.getByLabelText(`Enter ${digit}`))
  await waitFor(async () => expect((await inProgress(storage)).game.entries[cell]).toBe(digit))
  fireEvent.press(screen.getByLabelText('Back to home'))
  await waitFor(() => expect(screen).toHavePathname('/'))
  await screen.findByRole('button', { name: 'Continue, Easy' })
  expect((await inProgress(storage)).game.entries[cell]).toBe(digit)
})

it('Continue resumes the time played', async () => {
  const storage = createMemoryStorage()
  const { givens, solution } = generate('medium', 7)
  await storage.puzzles.start({
    level: 'medium',
    source: 'generated',
    game: { ...createGame({ givens, solution }), playedMs: 65_000 },
    owner: null,
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
  expect(await storage.history.list(null)).toEqual([])
})

it('keeps the game in progress when the player cancels', async () => {
  const storage = renderApp()
  const first = await startGame(storage)
  fireEvent.press(screen.getByLabelText('Back to home'))
  // Continue shows after the home focus read, so the level tap asks first.
  await screen.findByRole('button', { name: 'Continue, Easy' })
  const start = jest.spyOn(storage.puzzles, 'start')
  const alert = answerAlert('Cancel')
  fireEvent.press(screen.getByRole('button', { name: 'Hard' }))
  await waitFor(() => expect(alert).toHaveBeenCalled())
  // An ignored cancel starts the game in a later microtask. This flush lets that start happen before the checks.
  await act(() => jest.advanceTimersByTimeAsync(0))
  expect(start).not.toHaveBeenCalled()
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
  expect(screen.getByRole('header', { name: 'Settings' })).toBeTruthy()
  expect(screen.getByRole('header', { name: 'Assists' })).toBeTruthy()
  fireEvent.press(screen.getByRole('button', { name: 'Back' }))
  await waitFor(() => expect(screen).toHavePathname('/'))
  expect(await screen.findByRole('button', { name: 'Easy' })).toBeTruthy()
})

it('a double tap on Settings opens one Settings screen', async () => {
  renderApp()
  const settings = await screen.findByRole('button', { name: 'Settings' })
  fireEvent.press(settings)
  fireEvent.press(settings)
  await waitFor(() => expect(screen).toHavePathname('/settings'))
  fireEvent.press(screen.getByRole('button', { name: 'Back' }))
  await waitFor(() => expect(screen).toHavePathname('/'))
})

it('New puzzle after a scanned game saves a generated game', async () => {
  const storage = createMemoryStorage()
  const { givens, solution } = generate('easy', 11)
  await storage.puzzles.start({ level: 'easy', source: 'scanned', game: createGame({ givens, solution }), owner: null })
  renderApp(storage)
  fireEvent.press(await screen.findByRole('button', { name: 'Continue, Easy' }))
  await waitFor(() => expect(screen).toHavePathname('/game'))
  await layOutBoard()
  const lost = await inProgress(storage)
  loseGame(lost.game)
  await waitForLostEntry(storage)
  fireEvent.press(await screen.findByRole('button', { name: 'New puzzle' }))
  await waitFor(() => expect(screen.queryByTestId('game-over')).toBeNull())
  const next = await inProgress(storage)
  expect(next.id).not.toBe(lost.id)
  expect(next.source).toBe('generated')
})

it('New puzzle starts a new game at the same level, and the lost game is in the history', async () => {
  const storage = renderApp()
  const lost = await startGame(storage, 'Medium')
  loseGame(lost.game)
  await waitForLostEntry(storage)
  fireEvent.press(await screen.findByRole('button', { name: 'New puzzle' }))
  await waitFor(() => expect(screen.queryByTestId('game-over')).toBeNull())
  const next = await inProgress(storage)
  expect(next.id).not.toBe(lost.id)
  expect(next.level).toBe('medium')
  expect(next.seed).toEqual(expect.any(Number))
  expect(await storage.history.list(null)).toMatchObject([{ id: lost.id, level: 'medium', result: 'lost' }])
  await layOutBoard()
  expect(screen.getAllByTestId(/^cell-\d+$/)).toHaveLength(81)
})

it('Try this puzzle again starts the same puzzle as a new saved game', async () => {
  const storage = renderApp()
  const lost = await startGame(storage)
  loseGame(lost.game)
  await waitForLostEntry(storage)
  fireEvent.press(await screen.findByRole('button', { name: 'Try this puzzle again' }))
  await waitFor(() => expect(screen.queryByTestId('game-over')).toBeNull())
  const retried = await inProgress(storage)
  expect(retried.id).not.toBe(lost.id)
  expect(retried.game.givens).toEqual(lost.game.givens)
  expect(retried.game.mistakes).toBe(0)
  expect(retried.seed).toBe(lost.seed)
  expect(await storage.history.list(null)).toHaveLength(1)
})

it('Try this puzzle again keeps the start entries', async () => {
  const storage = createMemoryStorage()
  const { givens, solution } = generate('easy', 11)
  // loseGame plays the first empty cell, so the start entries go on the two empty cells after it.
  const scanned = givens.flatMap((digit, cell) => (digit === 0 ? [cell] : [])).slice(1, 3)
  const entries = givens.map((_, cell) => (scanned.includes(cell) ? (solution[cell] ?? 0) : 0))
  await storage.puzzles.start({
    level: 'easy',
    source: 'scanned',
    game: createGame({ givens, solution, entries }),
    owner: null,
  })
  renderApp(storage)
  fireEvent.press(await screen.findByRole('button', { name: 'Continue, Easy' }))
  await waitFor(() => expect(screen).toHavePathname('/game'))
  await layOutBoard()
  const lost = await inProgress(storage)
  loseGame(lost.game)
  await waitForLostEntry(storage)
  fireEvent.press(await screen.findByRole('button', { name: 'Try this puzzle again' }))
  await waitFor(() => expect(screen.queryByTestId('game-over')).toBeNull())
  const retried = await inProgress(storage)
  expect(retried.id).not.toBe(lost.id)
  expect(retried.source).toBe('scanned')
  expect(retried.game.entries).toEqual(entries)
  expect(retried.game.mistakes).toBe(0)
  await layOutBoard()
  for (const cell of scanned) {
    expect(screen.getByTestId(`cell-${cell}`).props.accessibilityLabel).toMatch(new RegExp(`, ${solution[cell]}$`))
  }
})

it('Back to home after a loss shows no Continue', async () => {
  const storage = renderApp()
  const lost = await startGame(storage)
  loseGame(lost.game)
  await waitForLostEntry(storage)
  fireEvent.press(within(await screen.findByTestId('game-over-sheet')).getByRole('button', { name: 'Back to home' }))
  await waitFor(() => expect(screen).toHavePathname('/'))
  expect(await screen.findByRole('button', { name: 'Easy' })).toBeTruthy()
  expect(await storage.puzzles.current()).toBeNull()
  await waitFor(() => expect(screen.queryByRole('button', { name: /^Continue/ })).toBeNull())
})

it('a won game shows the finish card, and New puzzle starts a new game at the same level', async () => {
  jest.mocked(useReducedMotion).mockReturnValue(true)
  const storage = renderApp()
  const won = await startGame(storage, 'Medium')
  winGame(won.game)
  await screen.findByTestId('finish')
  expect(screen.getByText('Solved · Medium')).toBeTruthy()
  expect(screen.getByText('New best')).toBeTruthy()
  expect(screen.getByText(`Puzzle ${formatPuzzleNumber(won.seed ?? -1)}`)).toBeTruthy()
  await waitFor(async () =>
    expect(await storage.history.list(null)).toMatchObject([{ id: won.id, result: 'won', seed: won.seed }]),
  )
  fireEvent.press(await screen.findByRole('button', { name: 'New puzzle' }))
  await waitFor(() => expect(screen.queryByTestId('finish')).toBeNull())
  const next = await inProgress(storage)
  expect(next.id).not.toBe(won.id)
  expect(next.level).toBe('medium')
})

it('the finish card shows no New best when the stored best time is not beaten', async () => {
  jest.mocked(useReducedMotion).mockReturnValue(true)
  const storage = createMemoryStorage()
  const earlier = await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame(), owner: null })
  await storage.puzzles.save(earlier.id, wonGame(0), null)
  renderApp(storage)
  const won = await startGame(storage)
  winGame(won.game)
  await screen.findByTestId('finish')
  expect(screen.queryByText('New best')).toBeNull()
})

it('the next game compares against the best time of the game that just finished', async () => {
  jest.mocked(useReducedMotion).mockReturnValue(true)
  const storage = renderApp()
  const first = await startGame(storage)
  winGame(first.game)
  await screen.findByText('New best')
  fireEvent.press(await screen.findByRole('button', { name: 'New puzzle' }))
  await waitFor(() => expect(screen.queryByTestId('finish')).toBeNull())
  await layOutBoard()
  const second = await inProgress(storage)
  winGame(second.game)
  await screen.findByTestId('finish')
  // Both games take 0 ms of play in Jest, and an equal time is not a new best.
  expect(screen.queryByText('New best')).toBeNull()
})

it('Back to home on the finish card shows no Continue', async () => {
  jest.mocked(useReducedMotion).mockReturnValue(true)
  const storage = renderApp()
  const won = await startGame(storage)
  winGame(won.game)
  await screen.findByTestId('finish')
  fireEvent.press(within(screen.getByTestId('finish')).getByRole('button', { name: 'Back to home' }))
  await waitFor(() => expect(screen).toHavePathname('/'))
  expect(await screen.findByRole('button', { name: 'Easy' })).toBeTruthy()
  await waitFor(() => expect(screen.queryByRole('button', { name: /^Continue/ })).toBeNull())
})

it('starts and finishes a game for the signed-in owner', async () => {
  const storage = createMemoryStorage()
  const start = jest.spyOn(storage.puzzles, 'start')
  renderApp(storage, 'user-alice')
  const lost = await startGame(storage, 'Medium')
  expect(start).toHaveBeenCalledWith(expect.objectContaining({ owner: 'user-alice' }))
  loseGame(lost.game)
  await waitFor(async () =>
    expect(await storage.history.list('user-alice')).toMatchObject([{ id: lost.id, result: 'lost' }]),
  )
  expect(await storage.history.list(null)).toEqual([])
})

describe('the techniques screen', () => {
  it('opens from Settings, and lists the pages of the techniques', async () => {
    renderApp()
    fireEvent.press(await screen.findByRole('button', { name: 'Settings' }))
    fireEvent.press(await screen.findByRole('button', { name: 'Techniques' }))
    await waitFor(() => expect(screen).toHavePathname('/techniques'))
    fireEvent.press(screen.getByRole('button', { name: 'X-wing' }))
    await waitFor(() => expect(screen).toHavePathname('/techniques/xWing'))
    expect(screen.getByRole('header', { name: 'X-wing' })).toBeTruthy()
  })

  it('opens the page of the hint technique from the card, and Back returns to the open hint', async () => {
    const storage = renderApp()
    const { game } = await startGame(storage)
    const plan = planHint(game)
    if (plan?.kind !== 'steps') throw new Error('expected a plan with steps')
    const technique = plan.steps[0]!.technique
    fireEvent.press(screen.getByLabelText('Hint'))
    fireEvent.press(screen.getByRole('button', { name: 'More help' }))
    fireEvent.press(screen.getByRole('link', { name: 'Learn more' }))
    await waitFor(() => expect(screen).toHavePathname(`/techniques/${technique}`))
    fireEvent.press(screen.getByRole('button', { name: 'Back' }))
    await waitFor(() => expect(screen).toHavePathname('/game'))
    expect(screen.getByTestId('hint-card')).toBeTruthy()
    // The rung text ends with the inline link, so the match is not exact.
    expect(screen.getByText(hintText(createAppIntl('en'), hintMessage(plan, 0, 2)), { exact: false })).toBeTruthy()
  })
})
