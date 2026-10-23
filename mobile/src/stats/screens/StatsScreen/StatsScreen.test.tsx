import { Alert, Text, type AlertButton } from 'react-native'
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react-native'
import type { Game } from '@sudoku/core'
import { isDevelopmentVariant } from '@/utils/appVariant.utils'
import { useIncludeScanned } from '@/stats/hooks/useIncludeScanned'
import { createMemoryStorage, type GameStorage } from '@/storage'
import { GameStorageContext } from '@/storage/hooks/useGameStorage'
import { lostGame, newGame, wonGame } from '@/storage/repositories.contract'
import type { Theme } from '@/theme/theme.types'
import { THEMES } from '@/theme/themes/registry'
import { IntlProvider } from 'react-intl'
import { CATALOGUES } from '@/i18n/messages'
import { StatsScreen } from './StatsScreen'

jest.mock('@/utils/appVariant.utils', () => ({ isDevelopmentVariant: jest.fn(() => false) }))

function inTheme(theme: Theme) {
  const unistyles = jest.requireMock<typeof import('react-native-unistyles')>('react-native-unistyles')
  return jest.spyOn(unistyles, 'useUnistyles').mockReturnValue({ theme, rt: unistyles.UnistylesRuntime } as never)
}

// The switch is one store for the whole test file, so each test turns it off again.
afterEach(async () => {
  jest.restoreAllMocks()
  const { result, unmount } = renderHook(() => useIncludeScanned())
  await act(async () => result.current.setIncludeScanned(false))
  unmount()
})

async function finish(storage: GameStorage, game: Game) {
  const { id } = await storage.puzzles.start({ level: 'medium', source: 'generated', game: newGame(), owner: null })
  await storage.puzzles.save(id, game, null)
}

async function storageWithGames() {
  const storage = createMemoryStorage()
  await finish(storage, wonGame(60_000))
  await finish(storage, lostGame(20_000))
  return storage
}

function renderScreen(storage: GameStorage, onBack = jest.fn()) {
  render(
    <GameStorageContext value={storage}>
      <StatsScreen onBack={onBack} />
    </GameStorageContext>,
  )
  return onBack
}

it('shows the card and the table of all levels first', async () => {
  renderScreen(await storageWithGames())
  await waitFor(() => expect(screen.getByLabelText('50% won, 1 day streak')).toBeTruthy())
  expect(screen.getByRole('tab', { name: 'All', selected: true })).toBeTruthy()
  expect(screen.getByLabelText('Medium, Played: 2')).toBeTruthy()
  expect(screen.getByRole('header', { name: /^Streak/ })).toBeTruthy()
})

it('shows the stats in Dutch', async () => {
  const storage = await storageWithGames()
  render(
    <IntlProvider locale="nl-BE" messages={CATALOGUES.nl}>
      <GameStorageContext value={storage}>
        <StatsScreen onBack={jest.fn()} />
      </GameStorageContext>
    </IntlProvider>,
  )
  await waitFor(() => expect(screen.getByLabelText('50% gewonnen, 1 dag op rij')).toBeTruthy())
  expect(screen.getByRole('tab', { name: 'Alle', selected: true })).toBeTruthy()
  expect(screen.getByLabelText('Gemiddeld, Gespeeld: 2')).toBeTruthy()
  fireEvent.press(screen.getByRole('tab', { name: 'Gemiddeld' }))
  expect(screen.getByLabelText('Beste, zonder hints: 01:00')).toBeTruthy()
  expect(screen.getByLabelText('Fouten, per spel: 1,5')).toBeTruthy()
  fireEvent.press(screen.getByRole('tab', { name: 'Expert' }))
  expect(screen.getByText('Nog geen spellen op niveau Expert.')).toBeTruthy()
})

it('shows the detail of a level on its tab, and the streak only on All', async () => {
  renderScreen(await storageWithGames())
  await waitFor(() => screen.getByRole('tab', { name: 'Medium' }))
  fireEvent.press(screen.getByRole('tab', { name: 'Medium' }))
  expect(screen.getByLabelText('Best, no hints: 01:00')).toBeTruthy()
  expect(screen.queryByRole('header', { name: /^Streak/ })).toBeNull()
  fireEvent.press(screen.getByRole('tab', { name: 'Expert' }))
  expect(screen.getByText('No Expert games yet.')).toBeTruthy()
})

it('has a back button that calls onBack', async () => {
  const onBack = renderScreen(await storageWithGames())
  fireEvent.press(screen.getByRole('button', { name: 'Back' }))
  expect(onBack).toHaveBeenCalledTimes(1)
})

it('shows the empty numbers on a device without games', async () => {
  renderScreen(createMemoryStorage())
  await waitFor(() => expect(screen.getByLabelText('No games finished, 0 day streak')).toBeTruthy())
  expect(screen.queryByText(/NaN|Infinity/)).toBeNull()
})

it('counts a scanned game after the switch turns on', async () => {
  const storage = createMemoryStorage()
  const { id } = await storage.puzzles.start({ level: 'easy', source: 'scanned', game: newGame(), owner: null })
  await storage.puzzles.save(id, wonGame(30_000), null)
  renderScreen(storage)
  await waitFor(() => screen.getByLabelText('Easy, Played: 0'))
  await act(async () => fireEvent.press(screen.getByLabelText('Include scanned puzzles')))
  await waitFor(() => expect(screen.getByLabelText('Easy, Played: 1')).toBeTruthy())
})

it('labels the strip of the last 14 days', async () => {
  renderScreen(await storageWithGames())
  await waitFor(() => expect(screen.getByText('Last 14 days')).toBeTruthy())
  expect(screen.getByText('today on the right')).toBeTruthy()
})

it('writes 1 day, not 1 days', async () => {
  renderScreen(await storageWithGames())
  await waitFor(() => expect(screen.getByLabelText('Current: 1 day')).toBeTruthy())
})

it('says that the stats do not load when the storage fails', async () => {
  jest.spyOn(console, 'warn').mockImplementation(() => undefined)
  const storage = createMemoryStorage()
  jest.spyOn(storage.stats, 'summary').mockRejectedValue(new Error('locked'))
  renderScreen(storage)
  await waitFor(() => expect(screen.getByText('The stats do not load.')).toBeTruthy())
})

it('puts the title in the bar when a theme has no title block', async () => {
  inTheme({ ...THEMES.cobalt, size: { ...THEMES.cobalt.size, titleBlock: 0 } })
  renderScreen(await storageWithGames())
  await waitFor(() => screen.getByRole('tab', { name: 'All' }))
  expect(screen.queryByTestId('title-block')).toBeNull()
  expect(screen.getByRole('header', { name: 'Stats' })).toBeTruthy()
})

it.each(['cobalt', 'forest', 'bordeaux'] as const)(
  'puts the title in a title block under the bar in %s',
  async (name) => {
    inTheme(THEMES[name])
    renderScreen(await storageWithGames())
    await waitFor(() => screen.getByRole('tab', { name: 'All' }))
    expect(screen.getByTestId('title-block')).toBeTruthy()
    expect(screen.getByRole('header', { name: 'Stats' })).toBeTruthy()
  },
)

it('has no reset button outside the development variant', async () => {
  renderScreen(await storageWithGames())
  await waitFor(() => screen.getByRole('tab', { name: 'All' }))
  expect(screen.queryByRole('button', { name: 'Reset stats' })).toBeNull()
})

it('resets the stats from the development variant, and shows the empty numbers', async () => {
  jest.mocked(isDevelopmentVariant).mockReturnValue(true)
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined)
  renderScreen(await storageWithGames())
  await waitFor(() => screen.getByLabelText('50% won, 1 day streak'))
  fireEvent.press(screen.getByRole('button', { name: 'Reset stats' }))
  const buttons = alert.mock.calls[0]?.[2] as AlertButton[]
  await act(async () => buttons.find((button) => button.text === 'Reset')?.onPress?.())
  await waitFor(() => expect(screen.getByLabelText('No games finished, 0 day streak')).toBeTruthy())
  expect(screen.getByLabelText('Medium, Played: 0')).toBeTruthy()
})

it('shows the footer that the route gives, at the bottom', async () => {
  const storage = await storageWithGames()
  render(
    <GameStorageContext value={storage}>
      <StatsScreen onBack={jest.fn()} footer={<Text>Synced just now</Text>} />
    </GameStorageContext>,
  )
  await waitFor(() => expect(screen.getByLabelText('50% won, 1 day streak')).toBeTruthy())
  expect(screen.getByText('Synced just now')).toBeTruthy()
})

it('reads the numbers again when the refresh key changes', async () => {
  const storage = await storageWithGames()
  const tree = (refreshKey: number) => (
    <GameStorageContext value={storage}>
      <StatsScreen onBack={jest.fn()} refreshKey={refreshKey} />
    </GameStorageContext>
  )
  const { rerender } = render(tree(0))
  await waitFor(() => expect(screen.getByLabelText('Medium, Played: 2')).toBeTruthy())
  await finish(storage, wonGame(50_000))
  rerender(tree(1))
  await waitFor(() => expect(screen.getByLabelText('Medium, Played: 3')).toBeTruthy())
})
