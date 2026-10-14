import { fireEvent, render, screen } from '@testing-library/react-native'
import { SplashContext } from '@/splash/hooks/useSplash'
import { HomeMenu } from './HomeMenu'

function renderMenu(continueLevel: 'medium' | null = null) {
  const props = { continueLevel, onNewGame: jest.fn(), onContinue: jest.fn(), onScan: jest.fn(), onSettings: jest.fn() }
  render(<HomeMenu {...props} />)
  return props
}

it('lists the four levels, and a tap asks for a game at that level', () => {
  const { onNewGame } = renderMenu()
  for (const name of ['Easy', 'Medium', 'Hard', 'Expert']) {
    expect(screen.getByRole('button', { name })).toBeTruthy()
  }
  fireEvent.press(screen.getByRole('button', { name: 'Expert' }))
  expect(onNewGame).toHaveBeenCalledWith('expert')
})

it('shows Continue only when a game is in progress', () => {
  renderMenu(null)
  expect(screen.queryByRole('button', { name: /^Continue/ })).toBeNull()
})

it('shows Continue and the levels together when a game is in progress', () => {
  const { onContinue } = renderMenu('medium')
  fireEvent.press(screen.getByRole('button', { name: 'Continue, Medium' }))
  expect(onContinue).toHaveBeenCalledTimes(1)
  expect(screen.getByRole('button', { name: 'Easy' })).toBeTruthy()
})

it('links to Scan and to Settings', () => {
  const { onScan, onSettings } = renderMenu()
  fireEvent.press(screen.getByRole('button', { name: 'Scan a puzzle' }))
  fireEvent.press(screen.getByRole('button', { name: 'Settings' }))
  expect(onScan).toHaveBeenCalledTimes(1)
  expect(onSettings).toHaveBeenCalledTimes(1)
})

it('tells the splash that it is ready when the store has answered, and not before', () => {
  const markReady = jest.fn()
  const props = { onNewGame: jest.fn(), onContinue: jest.fn(), onScan: jest.fn(), onSettings: jest.fn() }
  const { rerender } = render(
    <SplashContext value={{ phase: 'intro', markReady }}>
      <HomeMenu {...props} continueLevel={undefined} />
    </SplashContext>,
  )
  expect(markReady).not.toHaveBeenCalled()
  rerender(
    <SplashContext value={{ phase: 'intro', markReady }}>
      <HomeMenu {...props} continueLevel={null} />
    </SplashContext>,
  )
  expect(markReady).toHaveBeenCalledTimes(1)
})
